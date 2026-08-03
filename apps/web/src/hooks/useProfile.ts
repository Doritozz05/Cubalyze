"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  initDB,
  AppMetaRepository,
  ProfilesRepository,
  type Profile,
} from "@cubeforge/database";
import { isDev } from "@/utils/env";

/** Editable profile fields (identity keys are owned by the system). */
export type ProfileUpdates = Partial<Omit<Profile, "userId" | "createdAt">>;

export interface UseProfileResult {
  /** Stable anonymous local identity (persisted in app_meta). null until DB ready. */
  userId: string | null;
  /** The user's identity row. null until DB ready. */
  profile: Profile | null;
  /** True while the identity is being ensured on first launch. */
  loading: boolean;
  /** Re-read the profile row from the DB. */
  refresh: () => Promise<void>;
  /** Persist partial profile edits (keeps userId/createdAt stable). */
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
}

/**
 * Identity hook (Fase F0 of docs/plan_profile).
 *
 * On first launch it generates (or re-reads) the anonymous local `user_id`
 * — persisted in `app_meta` — and ensures a default `profiles` row exists.
 * The `user_id` is the stable seed for the CubeMark identicon (D2: it never
 * changes when the display name does).
 *
 * The identity lives in a MODULE-LEVEL SINGLETON backed by
 * `useSyncExternalStore`: every consumer (App header/sidebar chip, Profile
 * view, Settings → Profile) shares ONE state object, so an avatar upload or
 * profile save propagates live everywhere — no per-component copies that go
 * stale (the previous per-instance implementation).
 *
 * Idempotent and race-safe: `ensureInitialized` runs once (shared promise);
 * getOrCreateUserId uses INSERT OR IGNORE + re-read, so StrictMode
 * double-mounts and concurrent first runs converge on one id.
 */

interface ProfileState {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
}

let state: ProfileState = { userId: null, profile: null, loading: true };
const listeners = new Set<() => void>();

let reposRef: {
  meta: AppMetaRepository;
  profiles: ProfilesRepository;
} | null = null;
let userIdRef: string | null = null;
let initPromise: Promise<void> | null = null;

function setState(partial: Partial<ProfileState>): void {
  state = { ...state, ...partial };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ProfileState {
  return state;
}

/** Initialize the identity once (shared across all hook consumers). */
function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const dbClient = await initDB();
      const dbExecutor = async (sql: string, bind?: unknown[]) =>
        await dbClient.execute(sql, bind);
      reposRef = {
        meta: new AppMetaRepository(dbExecutor),
        profiles: new ProfilesRepository(dbExecutor),
      };

      // First launch: generate (or re-read) the anonymous identity.
      const id = await reposRef.meta.getOrCreateUserId();
      const row = await reposRef.profiles.getOrCreate(id);

      userIdRef = id;
      setState({ userId: id, profile: row, loading: false });
      if (isDev()) {
        console.log(
          "%c[useProfile]%c Identity ready: %s",
          "color:#38bdf8;font-weight:bold",
          "color:inherit",
          id.slice(0, 8),
        );
      }
    } catch (err) {
      console.error("[useProfile] Failed to initialize identity:", err);
      // Allow a later mount to retry (the previous call can't be recovered).
      initPromise = null;
      setState({ loading: false });
    }
  })();

  return initPromise;
}

/** Re-read the profile row from the DB. */
async function refresh(): Promise<void> {
  if (!reposRef || !userIdRef) {
    await ensureInitialized();
    return;
  }
  const row = await reposRef.profiles.findById(userIdRef);
  if (row) setState({ profile: row });
}

/**
 * Serializes read→merge→write so two concurrent edits (e.g. an avatar upload
 * racing a profile save) can never interleave and lose an update.
 */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(task, task);
  // Keep the chain alive even when a task fails; callers still receive it.
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Persist partial profile edits (keeps userId/createdAt stable). */
async function updateProfile(updates: ProfileUpdates): Promise<void> {
  await ensureInitialized();
  if (!reposRef || !userIdRef) {
    throw new Error("Identity is not ready yet — try again in a moment");
  }

  const id = userIdRef;
  await enqueueWrite(async () => {
    const current =
      (await reposRef!.profiles.findById(id)) ??
      (await reposRef!.profiles.getOrCreate(id));
    const next: Profile = {
      ...current,
      ...updates,
      userId: id,
      updatedAt: Date.now(),
    };
    await reposRef!.profiles.upsert(next);
    setState({ profile: next });
  });
}

export function useProfile(): UseProfileResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized();
  }, []);

  // Module-level functions are stable — callers can safely depend on them.
  return {
    userId: snapshot.userId,
    profile: snapshot.profile,
    loading: snapshot.loading,
    refresh,
    updateProfile,
  };
}
