"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initDB, CalendarRepository, type TrainingTask } from "@cubeforge/database";
import { requestSync } from "@/services/sync";
import { useDataRevision } from "@/hooks/useDataRevision";

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

  // Live cross-tab refresh: when the shared data revision bumps (a local
  // write, a completed sync cycle, or another tab's change via
  // BroadcastChannel), re-read the DB. Only sets state when the rows actually
  // differ, so an identical reload neither re-renders nor re-triggers the
  // persist effect (no loop).
  const revision = useDataRevision();
  useEffect(() => {
    const repo = repoRef.current;
    if (!repo || !dbLoadedRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const dbTasks = await repo.findAll();
        if (cancelled) return;
        setTasksState((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(dbTasks)) return prev;
          return dbTasks;
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
  // wholesale clear+reinsert would fire the migration-028 DELETE triggers and
  // fabricate tombstones for unchanged tasks — the sync engine would then
  // delete those tasks from the cloud on every other device. New tasks are
  // inserted, changed tasks upserted (bumping only their updated_at), deleted
  // tasks removed. `requestSync` runs only when something was actually
  // written (a reload that matches the DB writes nothing and stays silent).
  useEffect(() => {
    saveToLocalStorage(tasks);
    const repo = repoRef.current;
    if (repo && dbLoadedRef.current) {
      void (async () => {
        try {
          const existing = await repo.findAll();
          const nextIds = new Set(tasks.map((t) => t.id));
          let wrote = false;
          for (const t of existing) {
            if (!nextIds.has(t.id)) {
              await repo.delete(t.id);
              wrote = true;
            }
          }
          for (const t of tasks) {
            const prev = existing.find((e) => e.id === t.id);
            const changed =
              !prev ||
              prev.title !== t.title ||
              prev.description !== t.description ||
              prev.startDate !== t.startDate ||
              prev.repeat !== t.repeat ||
              prev.color !== t.color ||
              JSON.stringify(prev.daysOfWeek) !== JSON.stringify(t.daysOfWeek);
            if (changed) {
              // local: true → the repo stamps updated_at with the monotonic
              // clock, so an edit always advances past the push watermark
              // (M9).
              await repo.upsert(t, { local: true });
              wrote = true;
            }
          }
          if (wrote) void requestSync();
        } catch {
          // DB write failed — cache still holds the data; next DB init re-migrates.
        }
      })();
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
