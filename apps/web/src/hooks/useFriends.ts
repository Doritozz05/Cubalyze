"use client";

/**
 * useFriends — React bindings for the Fase 8 social surface.
 *
 * Three deliberate choices:
 *
 *  1. **The directory is a module-level store** (`useSyncExternalStore`, the
 *     same pattern as `useProfile`/`useAccount`) because two places render the
 *     same data: the Friends view and the incoming-request badge in the nav
 *     rail. Two independent hook states would drift and double-fetch; one
 *     store with a TTL means the badge and the screen are never out of step —
 *     and the badge costs no extra request, it reads this store.
 *
 *  2. **Failure is state, not an exception.** `error` carries the
 *     `FriendsFailure` reason so the view can render real copy ("no eres
 *     amigo", "sin conexión", "lo bloqueaste").
 *
 *  3. **A friend's detail is per-selection state, not a cache.** Opening a
 *     profile is an online read of a snapshot; keeping it in a global store
 *     would show stale numbers for a friend you looked at ten minutes ago.
 *     `refresh()` is the explicit way to re-read.
 *
 * Nothing here reads a table. Every read goes through the RPCs, which is what
 * makes the "solo amigos ven tu armario" promise a server guarantee rather
 * than a UI convention.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabaseClient, getSyncEngine, requestSync } from "@/services/sync";
import { refreshProfile } from "@/hooks/useProfile";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendDirectory,
  fetchFriendProfile,
  fetchFriendStats,
  fetchShowcase,
  fetchPrivacy,
  removeFriend,
  savePrivacy,
  sendFriendRequest,
  unblockUser,
  type FriendDirectory,
  type FriendProfileView,
  type FriendStats,
  type FriendVisibility,
  type FriendsFailure,
  type FriendsResult,
  type ShowcasePage,
} from "@/services/friends";
import type { HandleClaimResult } from "@cubalyze/sync-engine";

/** How long a fetched directory is trusted before an implicit refresh. */
const DIRECTORY_TTL_MS = 30_000;

// ─── Directory store ───────────────────────────────────────────────────────

interface DirectoryState {
  data: FriendDirectory | null;
  loading: boolean;
  error: FriendsFailure | null;
}

let state: DirectoryState = { data: null, loading: false, error: null };
let loadedAt = 0;
let inflight: Promise<void> | null = null;
/**
 * Invalidates whatever is still on the wire. Bumped by
 * `resetFriendDirectory`, because clearing the store is not enough: a fetch
 * that started a moment before a sign-out would otherwise resolve AFTER the
 * wipe and write the previous account's friend list back into memory — exactly
 * what the wipe exists to prevent on a shared device.
 */
let generation = 0;
/** A forced refresh that arrived while an unforced one was already in flight. */
let queuedForce = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(partial: Partial<DirectoryState>): void {
  state = { ...state, ...partial };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DirectoryState {
  return state;
}

/** One read, applied only if the account has not changed in the meantime. */
async function runFetch(gen: number): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    setState({ data: null, loading: false, error: "unauthorized" });
    return;
  }

  setState({ loading: true, error: null });
  const res = await fetchFriendDirectory(supabase);
  if (gen !== generation) return; // otra cuenta: esta respuesta no es de nadie

  if (res.ok) {
    loadedAt = Date.now();
    setState({ data: res.data, loading: false, error: null });
  } else {
    setState({ loading: false, error: res.reason });
  }
}

/**
 * Read the directory, unless a fresh one is already in hand.
 *
 * Concurrent callers share one request (`inflight`): the badge and the view
 * mount together, and two RPCs for one screen would be pure quota waste.
 *
 * The exception is a FORCED read arriving while one is in flight. That is the
 * post-mutation call: the in-flight answer was computed before the mutation, so
 * returning it would show a list that is wrong by construction (accept a
 * request right after opening the screen and the new friend does not appear).
 * It is queued instead, and the forced read runs as soon as the wire is free.
 */
export async function refreshFriendDirectory(opts?: { force?: boolean }): Promise<void> {
  const force = opts?.force ?? false;
  if (!force && state.data && Date.now() - loadedAt < DIRECTORY_TTL_MS) return;

  if (inflight) {
    if (!force) return inflight;
    queuedForce = true;
    await inflight;
    // Another forced caller may have resumed first and already started the
    // re-read: share theirs instead of firing a second one.
    if (inflight) return inflight;
    if (!queuedForce) return;
  }

  queuedForce = false;
  const gen = generation;
  inflight = runFetch(gen).finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Drop everything. Called on sign-out: a friend list is account data, and
 * leaving it in memory would show the previous account's friends to whoever
 * signs in next on a shared device.
 *
 * The generation bump is the other half of the promise: clearing the store
 * evicts what is HERE, and the bump makes sure a response still travelling
 * cannot put it back.
 */
export function resetFriendDirectory(): void {
  generation += 1;
  loadedAt = 0;
  inflight = null;
  queuedForce = false;
  setState({ data: null, loading: false, error: null });
}

export interface UseFriendDirectory extends DirectoryState {
  /** `force` (default) skips the TTL — use it after a mutation. */
  refresh: (force?: boolean) => Promise<void>;
}

export interface UseFriendDirectoryOptions {
  /**
   * Whether a read is worth attempting at all. The directory is account data,
   * so the nav rail — mounted for everyone, signed in or not — passes
   * `enabled: false` without a session rather than firing a request that can
   * only come back `unauthorized`.
   */
  enabled?: boolean;
}

export function useFriendDirectory(opts?: UseFriendDirectoryOptions): UseFriendDirectory {
  const enabled = opts?.enabled ?? true;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // `enabled` flips true the moment an account appears, which is exactly when
  // the first read becomes possible (and stays a no-op with a warm store).
  useEffect(() => {
    if (enabled) void refreshFriendDirectory();
  }, [enabled]);

  const refresh = useCallback(
    (force = true) => refreshFriendDirectory({ force }),
    [],
  );

  return { ...snapshot, refresh };
}

/**
 * Run a mutation and re-read the directory afterwards.
 *
 * Always forced: the user just changed something (sent, accepted, removed,
 * blocked) and the list they are looking at is now wrong by definition. The
 * TTL exists for background refreshes, not for this.
 */
export function useFriendActions() {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T,>(
      fn: (supabase: ReturnType<typeof getSupabaseClient>) => Promise<FriendsResult<T>>,
    ): Promise<FriendsResult<T>> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, reason: "unauthorized" };
      setBusy(true);
      try {
        const res = await fn(supabase);
        if (res.ok) await refreshFriendDirectory({ force: true });
        return res;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    busy,
    sendRequest: useCallback(
      (handle: string, message = "") =>
        run((sb) => sendFriendRequest(sb, handle, message)),
      [run],
    ),
    accept: useCallback((other: string) => run((sb) => acceptFriendRequest(sb, other)), [run]),
    decline: useCallback((other: string) => run((sb) => declineFriendRequest(sb, other)), [run]),
    cancel: useCallback((other: string) => run((sb) => cancelFriendRequest(sb, other)), [run]),
    remove: useCallback((other: string) => run((sb) => removeFriend(sb, other)), [run]),
    block: useCallback((other: string) => run((sb) => blockUser(sb, other)), [run]),
    unblock: useCallback((other: string) => run((sb) => unblockUser(sb, other)), [run]),
  };
}

// ─── One friend ────────────────────────────────────────────────────────────

export interface FriendDetail {
  profile: FriendProfileView | null;
  stats: FriendStats | null;
  showcase: ShowcasePage | null;
  /** Per-section reasons: the profile can load while stats are `not_shared`. */
  errors: Partial<Record<"profile" | "stats" | "showcase", FriendsFailure>>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Everything a friend's page shows. The three reads are independent on
 * purpose: sharing is per-scope, so a friend who shares their Locker but not
 * their stats must still get a working showcase, with the stats panel saying
 * why it is empty instead of the whole page failing.
 */
export function useFriendDetail(userId: string | null): FriendDetail {
  const [profile, setProfile] = useState<FriendProfileView | null>(null);
  const [stats, setStats] = useState<FriendStats | null>(null);
  const [showcase, setShowcase] = useState<ShowcasePage | null>(null);
  const [errors, setErrors] = useState<FriendDetail["errors"]>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Synchronous guard for `loadMore`: `loadingMore` is React state, so two
  // clicks in the same tick would both read `false` and fetch the SAME page
  // twice, appending every item of it twice. A ref flips before the await.
  const moreInFlight = useRef(false);
  // Every read carries the number of the selection it belongs to. Nothing older
  // than the newest one may write state: three parallel reads take different
  // amounts of time, and the answer that arrives last is not the one the user
  // is looking at. Without this, opening A and then B could leave A's stats on
  // B's page — the classic stale-overwrite, and a data-correctness bug, not a
  // cosmetic one.
  const selection = useRef(0);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    const seq = ++selection.current;
    if (!supabase || !userId) {
      setProfile(null);
      setStats(null);
      setShowcase(null);
      setErrors({});
      setLoading(false);
      return;
    }
    setLoading(true);
    moreInFlight.current = false;
    const [profileRes, statsRes, showcaseRes] = await Promise.all([
      fetchFriendProfile(supabase, userId),
      fetchFriendStats(supabase, userId),
      fetchShowcase(supabase, userId),
    ]);
    if (seq !== selection.current) return; // llegó tarde: ya hay otra selección
    setProfile(profileRes.ok ? profileRes.data : null);
    setStats(statsRes.ok ? statsRes.data : null);
    setShowcase(showcaseRes.ok ? showcaseRes.data : null);
    setErrors({
      ...(profileRes.ok ? {} : { profile: profileRes.reason }),
      ...(statsRes.ok ? {} : { stats: statsRes.reason }),
      ...(showcaseRes.ok ? {} : { showcase: showcaseRes.reason }),
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId || !showcase?.next || moreInFlight.current) return;
    const cursor = showcase.next;
    const seq = selection.current;
    moreInFlight.current = true;
    setLoadingMore(true);
    try {
      const res = await fetchShowcase(supabase, userId, cursor);
      // A page fetched for a previous selection must not be appended to the
      // current one: the cursor belongs to another Locker.
      if (seq !== selection.current) return;
      if (res.ok) {
        setShowcase((prev) =>
          prev
            ? {
                // Taxonomy and cursor always come from the newest page; only
                // the items are appended. A later page that (unexpectedly)
                // omits the taxonomy must not blank the filter chips.
                categories: res.data.categories.length ? res.data.categories : prev.categories,
                types: res.data.types.length ? res.data.types : prev.types,
                items: [...prev.items, ...res.data.items],
                next: res.data.next,
              }
            : res.data,
        );
      }
    } finally {
      moreInFlight.current = false;
      setLoadingMore(false);
    }
  }, [userId, showcase]);

  return {
    profile,
    stats,
    showcase,
    errors,
    loading,
    loadingMore,
    hasMore: showcase?.next != null,
    refresh: load,
    loadMore,
  };
}

// ─── Privacy ───────────────────────────────────────────────────────────────

export interface UsePrivacy {
  settings: FriendVisibility | null;
  loading: boolean;
  error: FriendsFailure | null;
  saving: boolean;
  save: (next: FriendVisibility) => Promise<FriendsResult<FriendVisibility>>;
  reload: () => Promise<void>;
}

export function usePrivacy(): UsePrivacy {
  const [settings, setSettings] = useState<FriendVisibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FriendsFailure | null>(null);

  const reload = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("unauthorized");
      return;
    }
    setLoading(true);
    const res = await fetchPrivacy(supabase);
    if (res.ok) {
      setSettings(res.data);
      setError(null);
    } else {
      setError(res.reason);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Writes are queued, not parallel. Every `privacy_set` sends the WHOLE set,
  // so two switches flipped quickly must reach the server in the order they
  // were flipped: otherwise the earlier request can land last and the account
  // keeps the OLD value while the UI shows the new one. Same reasoning for the
  // echo: `settings` follows the newest response, which is now the newest
  // request.
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  const save = useCallback(
    async (next: FriendVisibility): Promise<FriendsResult<FriendVisibility>> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, reason: "unauthorized" };
      pending.current += 1;
      setSaving(true);
      const run = writes.current.then(async () => {
        const res = await savePrivacy(supabase, next);
        // The server echoes what it stored; trust that, not the local guess.
        if (res.ok) setSettings(res.data);
        return res;
      });
      writes.current = run.catch(() => undefined);
      try {
        return await run;
      } finally {
        pending.current -= 1;
        if (pending.current === 0) setSaving(false);
      }
    },
    [],
  );

  return { settings, loading, error, saving, save, reload };
}

// ─── Handle ────────────────────────────────────────────────────────────────

export interface UseHandle {
  busy: boolean;
  claim: (raw: string) => Promise<HandleClaimResult>;
}

/**
 * Claim this account's public handle through the engine.
 *
 * The engine owns the write because the local row must carry the SERVER's
 * stamp (see `@cubalyze/sync-engine/handle.ts`) — a view that wrote the
 * profile row itself would produce an identity that only exists in the cloud.
 * After a successful claim the profile store is re-read so every avatar chip
 * in the app shows the new handle immediately, and a sync is scheduled so the
 * row (and any pending local profile edit) travels.
 */
export function useHandle(): UseHandle {
  const [busy, setBusy] = useState(false);

  const claim = useCallback(async (raw: string): Promise<HandleClaimResult> => {
    const engine = await getSyncEngine();
    if (!engine) return { ok: false, reason: "offline" };
    setBusy(true);
    try {
      const res = await engine.claimHandle(raw);
      if (res.ok) {
        await refreshProfile();
        void requestSync();
      }
      return res;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, claim };
}
