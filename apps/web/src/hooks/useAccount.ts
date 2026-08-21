"use client";

/**
 * Account hook — Supabase auth + the first-login CLAIM flow, as a module-level
 * singleton backed by useSyncExternalStore (same pattern as useProfile).
 *
 * Flow on login:
 *  1. Restore/extend the session, tell the SyncEngine who we are.
 *  2. If this account already claimed this device → linked, done.
 *  3. If the device has NO local data → silent claim (merge of nothing).
 *  4. Otherwise → `claim: "pending"` with the local counts; the UI shows the
 *     ClaimDataDialog and the user picks "Subir y combinar" or "Empezar de cero"
 *     (resolveClaim).
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
  getSyncEngine,
  isSupabaseConfigured,
} from "@/services/sync";
import { refreshProfile } from "@/hooks/useProfile";
import type { LocalDataCounts } from "@cubeforge/sync-engine";
import type { User } from "@supabase/supabase-js";
import type { SyncEngine } from "@cubeforge/sync-engine";

export type ClaimState = "none" | "pending" | "in_progress";

export type ClaimMode = "merge" | "fresh";

interface AccountState {
  user: User | null;
  loading: boolean;
  configured: boolean;
  claim: ClaimState;
  pendingCounts: LocalDataCounts | null;
  linked: boolean;
  claimError: string | null;
}

let state: AccountState = {
  user: null,
  loading: true,
  configured: isSupabaseConfigured(),
  claim: "none",
  pendingCounts: null,
  linked: false,
  claimError: null,
};

const listeners = new Set<() => void>();
let initPromise: Promise<void> | null = null;

function setState(partial: Partial<AccountState>): void {
  state = { ...state, ...partial };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AccountState {
  return state;
}

/**
 * After a session/user change: decide link vs silent claim vs dialog.
 * Returns true when the claim dialog is now pending (sync must stay gated
 * until the user resolves it), false when the account is linked or the
 * claim resolved silently.
 */
async function handleUser(user: User, engine: SyncEngine | null): Promise<boolean> {
  if (!engine) {
    setState({ user, linked: false, claim: "none", pendingCounts: null });
    return false;
  }
  if (await engine.wasLinked(user.id)) {
    setState({ user, linked: true, claim: "none", pendingCounts: null });
    return false;
  }
  const counts = await engine.getCounts();
  const hasData =
    counts.solves +
      counts.sessions +
      counts.trainingAttempts +
      counts.trainingTasks +
      counts.skills >
    0;
  if (!hasData) {
    await engine.claim("merge");
    setState({ user, linked: true, claim: "none", pendingCounts: null });
    return false;
  }
  // Local data exists. A brand-new account has an EMPTY cloud (the signup
  // trigger only creates the profile row) — there is nothing to merge with,
  // so auto-upload instead of asking. The dialog only appears when BOTH
  // sides hold data: a real merge-vs-replace decision.
  let cloudHasData = true;
  try {
    cloudHasData = await engine.hasCloudData();
  } catch (err) {
    // Offline or API hiccup: fall back to asking (conservative).
    console.warn("[useAccount] cloud data check failed, showing dialog:", err);
  }
  if (!cloudHasData) {
    await engine.claim("merge");
    setState({ user, linked: true, claim: "none", pendingCounts: null });
    return false;
  }
  // Real merge-vs-replace decision: lock the engine until the user picks,
  // so the background sync can't upload the local history first (which
  // would make "start fresh" silently impossible).
  engine.setClaimPending();
  setState({ user, linked: false, claim: "pending", pendingCounts: counts });
  return true;
}

function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const supabase = getSupabaseClient();
    const engine = await getSyncEngine();
    if (!supabase || !engine) {
      setState({ loading: false, configured: false });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      // Don't schedule yet: handleUser decides whether the claim dialog
      // gates the engine (pending) or the account is ready to sync.
      engine.setUser(session.user.id, { schedule: false });
      const pending = await handleUser(session.user, engine);
      if (!pending) engine.scheduleSync(1500);
    } else {
      engine.setUser(null);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user) {
        engine.setUser(user.id, { schedule: false });
        void handleUser(user, engine).then((pending) => {
          if (!pending) engine.scheduleSync(1500);
        });
      } else {
        engine.unlink();
        setState({
          user: null,
          linked: false,
          claim: "none",
          pendingCounts: null,
        });
      }
    });

    setState({ loading: false });
  })();

  return initPromise;
}

async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Account sync is not configured");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth` },
  });
  if (error) throw error;
}

/** The user picked a claim path — run it through the engine. */
async function resolveClaim(mode: ClaimMode): Promise<void> {
  const engine = await getSyncEngine();
  if (!engine || !state.user) return;
  setState({ claim: "in_progress", claimError: null });
  try {
    await engine.claim(mode);
    setState({ claim: "none", linked: true, pendingCounts: null });
    // Identity was remapped to the account — re-read the profile + seed.
    await refreshProfile();
  } catch (err) {
    console.error("[useAccount] claim failed:", err);
    setState({
      claim: "in_progress",
      claimError: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Defer the claim — data stays local-only until the user links it. The
 * engine's claim gate stays closed (no upload, no download), and the UI
 * keeps showing the "pending" state with a way back (reopenClaim).
 */
function dismissClaim(): void {
  setState({ claim: "none", pendingCounts: null });
}

/**
 * Re-open the claim dialog after dismissing it (no logout needed).
 * Re-reads the local counts so they are fresh, and re-gates the engine
 * (idempotent — it was already gated by the dismiss).
 */
async function reopenClaim(): Promise<void> {
  const engine = await getSyncEngine();
  if (!engine || !state.user) return;
  engine.setClaimPending();
  const counts = await engine.getCounts();
  setState({ claim: "pending", pendingCounts: counts });
}

async function signOut(): Promise<void> {
  const engine = await getSyncEngine();
  engine?.unlink();
  const supabase = getSupabaseClient();
  await supabase?.auth.signOut();
  setState({
    user: null,
    linked: false,
    claim: "none",
    pendingCounts: null,
  });
}

/**
 * Permanently delete the account: the edge function (service role) removes
 * the auth user; the RLS `ON DELETE CASCADE` removes every cloud row.
 * Local data is deliberately left in place (local-first).
 */
async function deleteAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  const url = getSupabaseUrl();
  if (!supabase || !url || !state.user) throw new Error("Not signed in");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${url}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      // The gateway validates `apikey` against a real project key (the anon
      // key is public by design) — NOT the project URL.
      apikey: getSupabaseAnonKey() ?? "",
    },
  });
  if (!res.ok) {
    throw new Error(`Delete account failed (${res.status})`);
  }
  await signOut();
}

export function useAccount(): AccountState & {
  signInWithGoogle: () => Promise<void>;
  resolveClaim: (mode: ClaimMode) => Promise<void>;
  dismissClaim: () => void;
  reopenClaim: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized();
  }, []);

  return {
    ...snapshot,
    signInWithGoogle,
    resolveClaim,
    dismissClaim,
    reopenClaim,
    signOut,
    deleteAccount,
  };
}
