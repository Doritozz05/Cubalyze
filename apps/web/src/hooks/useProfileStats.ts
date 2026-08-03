"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initDB, SessionsRepository, SolvesRepository } from "@cubeforge/database";
import { computeStats } from "@cubeforge/statistics";
import type { SessionStats } from "@cubeforge/statistics";
import type { Solve as UISolve } from "@/types";
import { effectiveTime } from "@/types";

/** Normalize DB puzzle values ('3x3', '3x3x3') to a display key. */
export function normalizePuzzleKey(puzzle?: string): string {
  const p = (puzzle ?? "3x3x3").toLowerCase().replace(/\s+/g, "");
  if (p === "3x3" || p === "3x3x3") return "3x3x3";
  if (p === "2x2" || p === "2x2x2") return "2x2x2";
  return p || "3x3x3";
}

export interface PuzzleStats {
  puzzle: string;
  count: number;
  stats: SessionStats;
  /** All non-DNF solves for this puzzle, newest first (for trend/PB charts). */
  solves: UISolve[];
}

export interface ProfileStats {
  /** Every non-demo solve across all sessions, newest first. */
  solves: UISolve[];
  /** Per-puzzle aggregation, sorted by solve count desc. */
  byPuzzle: PuzzleStats[];
  /** Daily solve counts for the last 365 days, oldest first (ActivityHeatmap). */
  heatmapCounts: number[];
  /** Consecutive days with ≥1 solve ending today (or the last active day). */
  streakDays: number;
  /** Overall stats across all puzzles. */
  overall: SessionStats;
}

export interface UseProfileStatsResult {
  stats: ProfileStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DAY_MS = 86_400_000;

/** Consecutive active days up to `anchor` (defaults to today). */
export function computeStreak(
  dayCounts: Map<string, number>,
  now = Date.now(),
): number {
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  let cursor = new Date(now);
  // If today has no solves yet, the streak counts from yesterday (a streak is
  // only "broken" once a full day passes without activity).
  if ((dayCounts.get(key(cursor.getTime())) ?? 0) === 0) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  let streak = 0;
  while ((dayCounts.get(key(cursor.getTime())) ?? 0) > 0) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** Daily counts for the last 365 days (oldest first), keyed by local date. */
export function buildHeatmapCounts(solves: UISolve[]): {
  counts: number[];
  dayCounts: Map<string, number>;
} {
  const dayCounts = new Map<string, number>();
  for (const solve of solves) {
    const date = new Date(solve.timestamp).toISOString().slice(0, 10);
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
  }
  const counts: number[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    counts.push(dayCounts.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  return { counts, dayCounts };
}

// Local adapter mirroring usePersistentSession's mapping (kept minimal).
type DBSolveLike = {
  id: string;
  timeMs: number;
  penalty: string;
  scramble: string;
  date: string;
  note?: string | null;
  method?: string | null;
  source?: string | null;
  puzzleType?: string;
};
function toUISolveSafe(dbSolve: DBSolveLike): UISolve {
  const raw = dbSolve.penalty?.toUpperCase();
  const penalty: UISolve["penalty"] =
    raw === "+2" || raw === "PLUS2" ? "+2" : raw === "DNF" ? "DNF" : "none";
  return {
    id: dbSolve.id,
    time: dbSolve.timeMs,
    penalty,
    scramble: dbSolve.scramble,
    timestamp: new Date(dbSolve.date).getTime(),
    note: dbSolve.note ?? undefined,
    method: dbSolve.method as UISolve["method"] | undefined,
    source: (dbSolve.source as UISolve["source"]) ?? "manual",
    puzzleType: dbSolve.puzzleType ?? "3x3x3",
  };
}

/** Aggregate solves into per-puzzle stats using the shared statistics engine. */
export function aggregateByPuzzle(solves: UISolve[]): PuzzleStats[] {
  const byPuzzle = new Map<string, UISolve[]>();
  for (const solve of solves) {
    const key = normalizePuzzleKey(solve.puzzleType);
    const list = byPuzzle.get(key) ?? [];
    list.push(solve);
    byPuzzle.set(key, list);
  }
  return [...byPuzzle.entries()]
    .map(([puzzle, list]) => {
      // Newest first — computeStats expects that ordering for rolling averages.
      const sorted = [...list].sort((a, b) => b.timestamp - a.timestamp);
      return {
        puzzle,
        count: sorted.length,
        stats: computeStats(sorted.map((s) => ({ time: s.time, penalty: s.penalty }))),
        solves: sorted,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * F4 (docs/plan_profile) — profile-wide solve aggregation.
 *
 * Loads every non-demo solve across ALL sessions (the profile is the identity
 * center, not a single session), then computes per-puzzle stats with the
 * shared `computeStats` engine, the activity heatmap and the current streak.
 */
export function useProfileStats(): UseProfileStatsResult {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reposRef = useRef<{ sessions: SessionsRepository; solves: SolvesRepository } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const dbClient = await initDB();
      const dbExecutor = async (sql: string, bind?: unknown[]) =>
        await dbClient.execute(sql, bind);
      if (!reposRef.current) {
        reposRef.current = {
          sessions: new SessionsRepository(dbExecutor),
          solves: new SolvesRepository(dbExecutor),
        };
      }
      const { sessions, solves: solvesRepo } = reposRef.current;
      const allSessions = await sessions.findAllNonDemo();
      const raw: DBSolveLike[] = [];
      for (const session of allSessions) {
        const rows = await solvesRepo.findAll(session.id);
        raw.push(...(rows as unknown as DBSolveLike[]));
      }
      const uiSolves = raw.map(toUISolveSafe).sort((a, b) => b.timestamp - a.timestamp);

      const byPuzzle = aggregateByPuzzle(uiSolves);
      const { counts, dayCounts } = buildHeatmapCounts(uiSolves);
      const overall = computeStats(
        uiSolves.map((s) => ({ time: s.time, penalty: s.penalty })),
      );

      setStats({
        solves: uiSolves,
        byPuzzle,
        heatmapCounts: counts,
        streakDays: computeStreak(dayCounts),
        overall,
      });
      setError(null);
    } catch (err) {
      console.error("[useProfileStats] Failed to load:", err);
      setError(err instanceof Error ? err.message : "Failed to load profile stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

/** Effective best time across solves (DNF ignored). Exported for tests. */
export function bestEffectiveTime(solves: UISolve[]): number | null {
  let best: number | null = null;
  for (const s of solves) {
    const t = effectiveTime(s);
    if (Number.isFinite(t) && (best === null || t < best)) best = t;
  }
  return best;
}
