"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * Idempotent and race-safe: getOrCreateUserId uses INSERT OR IGNORE + re-read,
 * so StrictMode double-mounts and concurrent first runs converge on one id.
 */
export function useProfile(): UseProfileResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reposRef = useRef<{
    meta: AppMetaRepository;
    profiles: ProfilesRepository;
  } | null>(null);

  // Latest-value ref so async callbacks never read a stale closure. Set by
  // the effect once the identity is ensured (render-phase writes avoided).
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) =>
          await dbClient.execute(sql, bind);
        const meta = new AppMetaRepository(dbExecutor);
        const profiles = new ProfilesRepository(dbExecutor);
        reposRef.current = { meta, profiles };

        // First launch: generate (or re-read) the anonymous identity.
        const id = await meta.getOrCreateUserId();
        const row = await profiles.getOrCreate(id);

        if (cancelled) return;
        userIdRef.current = id;
        setUserId(id);
        setProfile(row);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const repos = reposRef.current;
    const id = userIdRef.current;
    if (!repos || !id) return;
    const row = await repos.profiles.findById(id);
    if (row) setProfile(row);
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    const repos = reposRef.current;
    const id = userIdRef.current;
    if (!repos || !id) return;

    const current =
      (await repos.profiles.findById(id)) ?? (await repos.profiles.getOrCreate(id));
    const next: Profile = {
      ...current,
      ...updates,
      userId: id,
      updatedAt: Date.now(),
    };
    await repos.profiles.upsert(next);
    setProfile(next);
  }, []);

  return { userId, profile, loading, refresh, updateProfile };
}
