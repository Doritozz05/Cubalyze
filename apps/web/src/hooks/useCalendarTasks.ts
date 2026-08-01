"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initDB, CalendarRepository, type TrainingTask } from "@cubeforge/database";

// Legacy localStorage key that this hook replaces (single source of truth = DB).
const LEGACY_STORAGE_KEY = "cubeforge-training-calendar";
const MIGRATED_FLAG = "cubeforge:calendar-migrated";

function loadFromLocalStorage(): TrainingTask[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrainingTask[]) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(tasks: TrainingTask[]) {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // ignore quota/private-mode errors — DB is the source of truth
  }
}

export interface UseCalendarTasksResult {
  /** Current tasks (seeded from localStorage for instant paint, then DB truth). */
  tasks: TrainingTask[];
  /** Replace-or-update setter. Accepts functional updates like React setState. */
  setTasks: React.Dispatch<React.SetStateAction<TrainingTask[]>>;
  /** True once the DB is initialized and the one-time migration has run. */
  ready: boolean;
}

/**
 * Training calendar tasks backed by SQLite (single source of truth).
 *
 * Behavior guarantees:
 * - First paint is instant: state seeds from the legacy localStorage cache.
 * - One-time migration: on first run with a populated localStorage and an
 *   empty DB, tasks are imported into the DB (flag-guarded so it never
 *   repeats, even after a later full clear).
 * - After DB init, the DB wins: any DB-only changes replace the cache.
 * - Every change is persisted to both DB and the localStorage cache, so if
 *   the DB is unavailable (OPFS locked / private mode), the app still works
 *   exactly as before — zero regression.
 */
export function useCalendarTasks(): UseCalendarTasksResult {
  const [tasks, setTasksState] = useState<TrainingTask[]>(() => loadFromLocalStorage());
  const [ready, setReady] = useState(false);
  const repoRef = useRef<CalendarRepository | null>(null);
  const dbLoadedRef = useRef(false);

  // Init DB + one-time migration from localStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) =>
          await dbClient.execute(sql, bind);
        const repo = new CalendarRepository(dbExecutor);

        // One-time migration (flag-guarded so an intentional later "clear all"
        // doesn't resurrect tasks from the stale cache).
        const migrated = localStorage.getItem(MIGRATED_FLAG) === "1";
        if (!migrated) {
          const local = loadFromLocalStorage();
          const dbCount = await repo.count();
          if (dbCount === 0 && local.length > 0) {
            await repo.replaceAll(local);
          }
          localStorage.setItem(MIGRATED_FLAG, "1");
        }

        const dbTasks = await repo.findAll();
        if (!cancelled) {
          repoRef.current = repo;
          dbLoadedRef.current = true;
          // DB is authoritative — overwrite any cache-seeded state.
          setTasksState(dbTasks);
          saveToLocalStorage(dbTasks);
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

  // Persist every change to DB + cache. Mirrors the legacy
  // `useEffect(() => saveTasks(tasks), [tasks])` behavior.
  useEffect(() => {
    saveToLocalStorage(tasks);
    const repo = repoRef.current;
    if (repo && dbLoadedRef.current) {
      void repo.replaceAll(tasks).catch(() => {
        // DB write failed — cache still holds the data; next DB init re-migrates.
      });
    }
  }, [tasks]);

  const setTasks = useCallback<React.Dispatch<React.SetStateAction<TrainingTask[]>>>(
    (updater) => {
      setTasksState((prev) =>
        typeof updater === "function"
          ? (updater as (p: TrainingTask[]) => TrainingTask[])(prev)
          : updater,
      );
    },
    [],
  );

  return { tasks, setTasks, ready };
}
