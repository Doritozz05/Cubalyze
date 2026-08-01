"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initDB, SkillProgressRepository } from "@cubeforge/database";

// Legacy localStorage key that this hook replaces (single source of truth = DB).
const LEGACY_STORAGE_KEY = "cubeforge_completed_skills_v2";
const MIGRATED_FLAG = "cubeforge:skills-migrated";

/** Default completion state for a brand-new user (no data anywhere). */
const DEFAULT_COMPLETED = ["cube-anatomy", "standard-notation", "first-cross"];

function loadFromLocalStorage(): string[] {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_COMPLETED;
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
 * Same guarantees as {@link useCalendarTasks}: instant paint from the legacy
 * localStorage cache, one-time flag-guarded migration, DB wins after init,
 * and cache always kept in sync so an unavailable DB degrades gracefully.
 */
export function useSkillProgress(): UseSkillProgressResult {
  const [completedIds, setCompletedIdsState] = useState<string[]>(() =>
    loadFromLocalStorage(),
  );
  const [ready, setReady] = useState(false);
  const repoRef = useRef<SkillProgressRepository | null>(null);
  const dbLoadedRef = useRef(false);

  // Init DB + one-time migration from localStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) =>
          await dbClient.execute(sql, bind);
        const repo = new SkillProgressRepository(dbExecutor);

        const migrated = localStorage.getItem(MIGRATED_FLAG) === "1";
        if (!migrated) {
          const local = loadFromLocalStorage();
          const dbCount = await repo.count();
          if (dbCount === 0 && local.length > 0) {
            await repo.replaceAll(local);
          }
          localStorage.setItem(MIGRATED_FLAG, "1");
        }

        const dbIds = await repo.findAll();
        if (!cancelled) {
          repoRef.current = repo;
          dbLoadedRef.current = true;
          // DB is authoritative. A brand-new DB (empty) uses the default set.
          setCompletedIdsState(dbIds.length > 0 ? dbIds : DEFAULT_COMPLETED);
          saveToLocalStorage(dbIds.length > 0 ? dbIds : DEFAULT_COMPLETED);
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

  // Persist every change to DB + cache.
  useEffect(() => {
    saveToLocalStorage(completedIds);
    const repo = repoRef.current;
    if (repo && dbLoadedRef.current) {
      void repo.replaceAll(completedIds).catch(() => {
        // DB write failed — cache still holds the data.
      });
    }
  }, [completedIds]);

  const setCompletedIds = useCallback<
    React.Dispatch<React.SetStateAction<string[]>>
  >((updater) => {
    setCompletedIdsState((prev) =>
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater,
    );
  }, []);

  return { completedIds, setCompletedIds, ready };
}
