import { useMemo } from "react";
import { averageOf, computeStats, stdDeviation } from "@cubeforge/statistics";
import type { Solve } from "@/types";
import { formatDuration, statLabel } from "@/utils/formatTime";
import type { BottomLayoutStatId } from "./types";

/**
 * Compute every stat a bottom layout cell can display, formatted for UI.
 *
 * All values are derived from the same filtered solve list in one pass via
 * `computeStats`; Ao50 uses the generic `averageOf` (the statistics package
 * already supports it even though `SessionStats` does not surface it) and the
 * deviation uses `stdDeviation`. Returns a lookup keyed by `BottomLayoutStatId`.
 */
export function useBottomLayoutStats(
  solves: Solve[],
  puzzleFilter?: string,
): Record<BottomLayoutStatId, string> {
  return useMemo(() => {
    const filtered = puzzleFilter
      ? solves.filter((s) => (s.puzzleType ?? "3x3x3") === puzzleFilter)
      : solves;
    const statSolves = filtered.map((s) => ({ time: s.time ?? 0, penalty: s.penalty }));
    const stats = computeStats(statSolves);

    return {
      ao5: statLabel(stats.ao5),
      ao12: statLabel(stats.ao12),
      ao50: statLabel(averageOf(statSolves, 50)),
      ao100: statLabel(stats.ao100),
      best: statLabel(stats.best),
      worst: statLabel(stats.worst),
      mean: statLabel(stats.mean),
      deviation: statLabel(stdDeviation(statSolves, stats.mean)),
      count: String(stats.count),
      sessionTime: formatDuration(stats.sessionTime),
    };
  }, [solves, puzzleFilter]);
}
