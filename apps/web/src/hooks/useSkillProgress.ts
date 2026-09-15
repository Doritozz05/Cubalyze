"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initDB, SkillProgressRepository } from "@cubalyze/database";
import { requestSync } from "@/services/sync";
import { useDataRevision } from "@/hooks/useDataRevision";

// Legacy localStorage key that this hook replaces (single source of truth = DB).
const LEGACY_STORAGE_KEY = "cubeforge_completed_skills_v2";
const MIGRATED_FLAG = "cubeforge:skills-migrated";

/**
 * Presentational default for a brand-new user (no data anywhere).
 *
 * These are NOT persisted anywhere (not localStorage, not the DB): they only
 * make the skill tree look non-empty on first paint. The first real user
 * interaction flips the hook into "owned data" mode and persists from there.
 */
const DEFAULT_COMPLETED = ["cube-anatomy", "standard-notation", "first-cross"];

/**
 * Read the legacy localStorage cache.
 *
 * Returns `null` when no real data exists (brand-new user) so callers can
 * distinguish "legacy data to migrate" from "nothing at all". The previous
 * implementation returned the default set here, which silently persisted fake
 * completion state for every new user.
 */
function loadLegacySkillIds(): string[] | null {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    }
  } catch {
    // fall through to null
  }
  return null;
}

function saveToLocalStorage(completedIds: string[]) {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(completedIds));
  } catch {
    // ignore — DB is the source of truth
  }
}

export interface UseSkillProgressResult {
  /** Completed skill IDs (seeded from localStorage for instant paint, then DB truth). */
  completedIds: string[];
  /** Replace-or-update setter. Accepts functional updates like React setState. */
  setCompletedIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** True once the DB is initialized and the one-time migration has run. */
  ready: boolean;
}

/**
 * Skill-tree completion backed by SQLite (single source of truth).
 *
 * Same guarantees as `useCalendarTasks`: instant paint from the legacy
 * localStorage cache, one-time flag-guarded migration, DB wins after init, and
 * cache always kept in sync — EXCEPT that the brand-new-user default set is
 * presentational only and is never written to localStorage or the DB.
 */
export function useSkillProgress(): UseSkillProgressResult {
  const [completedIds, setCompletedIdsState] = useState<string[]>(() =>
    loadLegacySkillIds() ?? DEFAULT_COMPLETED,
  );
  const [ready, setReady] = useState(false);
  const repoRef = useRef<SkillProgressRepository | null>(null);
  const dbLoadedRef = useRef(false);
  // True once there is real data (DB rows, legacy cache, or a user action).
  // While false, the state only holds the presentational default set.
  const hasRealDataRef = useRef(false);

  // Init DB + one-time migration from localStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) =>
          await dbClient.execute(sql, bind);
        const repo = new SkillProgressRepository(dbExecutor);

        const legacy = loadLegacySkillIds();
        const migrated = localStorage.getItem(MIGRATED_FLAG) === "1";
        if (!migrated) {
          const dbCount = await repo.count();
          // Only migrate when there is REAL legacy data — never the default set.
          if (dbCount === 0 && legacy && legacy.length > 0) {
            await repo.replaceAll(legacy);
          }
          localStorage.setItem(MIGRATED_FLAG, "1");
        }

        const dbIds = await repo.findAll();
        if (!cancelled) {
          repoRef.current = repo;
          dbLoadedRef.current = true;
          hasRealDataRef.current = dbIds.length > 0 || legacy !== null;
          // DB is authoritative. A brand-new DB (empty) uses the default set
          // only as a presentational fallback (never persisted).
          setCompletedIdsState(dbIds.length > 0 ? dbIds : (legacy ?? DEFAULT_COMPLETED));
          if (dbIds.length > 0 || legacy !== null) {
            saveToLocalStorage(dbIds.length > 0 ? dbIds : (legacy as string[]));
          }
          setReady(true);
        }
      } catch {
        // DB unavailable — keep the legacy localStorage behavior.
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Live cross-tab refresh: when the shared data revision bumps (a local
  // write, a completed sync cycle, or another tab's change via
  // BroadcastChannel), re-read the DB. Only sets state when the set actually
  // differs, so an identical reload neither re-renders nor re-triggers the
  // persist effect (no loop).
  const revision = useDataRevision();
  useEffect(() => {
    const repo = repoRef.current;
    if (!repo || !dbLoadedRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const dbIds = await repo.findAll();
        if (cancelled) return;
        setCompletedIdsState((prev) => {
          const same =
            prev.length === dbIds.length &&
            prev.every((x, i) => x === dbIds[i]);
          if (same) return prev;
          if (dbIds.length > 0) saveToLocalStorage(dbIds);
          return dbIds;
        });
      } catch {
        // DB read failed — keep the current state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [revision]);

  // Persist every change to DB + cache as a DIFF (never replaceAll): a
  // wholesale delete+reinsert would fire the migration-028 DELETE triggers
  // and fabricate tombstones for every skill — the sync engine would push
  // them (noise) and re-bump every completed_at on each toggle (churn on
  // every other device). Only skills that actually changed are written, and
  // `requestSync` runs only when something was written (an identical reload
  // stays silent — no loop).
  useEffect(() => {
    if (!hasRealDataRef.current) return;
    saveToLocalStorage(completedIds);
    const repo = repoRef.current;
    if (repo && dbLoadedRef.current) {
      void (async () => {
        try {
          const existing = await repo.findAll();
          const next = new Set(completedIds);
          const prev = new Set(existing);
          let wrote = false;
          for (const id of completedIds) {
            if (!prev.has(id)) {
              await repo.setCompleted(id);
              wrote = true;
            }
          }
          for (const id of existing) {
            if (!next.has(id)) {
              await repo.setIncomplete(id);
              wrote = true;
            }
          }
          if (wrote) void requestSync();
        } catch {
          // DB write failed — cache still holds the data.
        }
      })();
    }
  }, [completedIds]);

  const setCompletedIds = useCallback<
    React.Dispatch<React.SetStateAction<string[]>>
  >((updater) => {
    // A user interaction means the user owns their skill data from now on.
    hasRealDataRef.current = true;
    setCompletedIdsState((prev) =>
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater,
    );
  }, []);

  return { completedIds, setCompletedIds, ready };
}
