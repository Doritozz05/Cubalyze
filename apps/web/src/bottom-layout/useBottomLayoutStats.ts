import { useMemo } from "react";
import {
  averageOf,
  computeBpaWpa,
  computeStats,
  effectiveTime,
  stdDeviation,
  type StatSolve,
} from "@cubalyze/statistics";
import { deriveTpsSeries } from "@cubalyze/analysis-engine";
import type { Solve } from "@/types";
import { formatDuration, statLabel } from "@/utils/formatTime";
import type { BottomLayoutStatId } from "./types";

/** Mean of the most recent `n` solves with WCA Mo3 semantics (any DNF → DNF). */
function meanOfN(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null;
  const slice = solves.slice(0, n).map(effectiveTime);
  if (slice.some((t) => !Number.isFinite(t))) return Number.POSITIVE_INFINITY;
  return slice.reduce((acc, t) => acc + t, 0) / n;
}

/** Best rolling AoN across the session (newest-first window slide). */
function bestRollingAverage(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null;
  let best: number | null = null;
  for (let i = 0; i <= solves.length - n; i++) {
    const avg = averageOf(solves.slice(i, i + n), n);
    if (avg !== null && Number.isFinite(avg) && (best === null || avg < best)) {
      best = avg;
    }
  }
  return best;
}

/** Robust median calculation of finite effective times. */
function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Interquartile range (IQR = Q3 - Q1) for consistency analysis. */
function iqrOf(values: number[]): number | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

/**
 * Compute every stat a bottom layout cell can display, formatted for UI.
 *
 * All values are derived from the same filtered solve list in one pass via
 * `computeStats`; Ao50/Ao500/Ao1000 use `averageOf`, the deviation uses
 * `stdDeviation`, Mo3/Best-Ao5/Best-Ao12 roll over the session, and TPS is the
 * mean of the analysed solves' global TPS (reusing `deriveTpsSeries`).
 * Returns a lookup keyed by `BottomLayoutStatId`.
 */
export function useBottomLayoutStats(
  solves: Solve[],
  puzzleFilter?: string,
  subXThreshold: number = 20,
): Record<BottomLayoutStatId, string> {
  return useMemo(() => {
    const filtered = puzzleFilter
      ? solves.filter((s) => (s.puzzleType ?? "333") === puzzleFilter)
      : solves;
    const statSolves = filtered.map((s) => ({ time: s.time ?? 0, penalty: s.penalty }));
    const stats = computeStats(statSolves);

    // Finite times (excluding DNFs)
    const effectiveTimes = statSolves.map(effectiveTime);
    const finiteTimes = effectiveTimes.filter((t) => Number.isFinite(t));

    // Median & IQR
    const median = medianOf(finiteTimes);
    const iqr = iqrOf(finiteTimes);

    // DNF Rate
    const dnfCount = statSolves.filter((s) => s.penalty === "DNF").length;
    const dnfRate = statSolves.length > 0 ? (dnfCount / statSolves.length) * 100 : 0;

    // Sub-X count and percentage (subXThreshold in seconds, e.g. 20 -> 20000ms)
    const thresholdMs = Math.max(1, subXThreshold) * 1000;
    const subXSolves = finiteTimes.filter((t) => t < thresholdMs).length;
    const subXPct = statSolves.length > 0 ? ((subXSolves / statSolves.length) * 100).toFixed(0) : "0";

    // TPS: average global TPS across analysed solves (smart/virtual). Manual
    // solves without move data are excluded by `deriveTpsSeries`.
    const tpsPoints = deriveTpsSeries(filtered);
    const tps =
      tpsPoints.length > 0
        ? tpsPoints.reduce((acc, p) => acc + p.tps, 0) / tpsPoints.length
        : null;

    // BPA/WPA projection for the NEXT solve of the pending average, as plain
    // stats (no toggles): prefers the Ao12 window when it is about to
    // complete, otherwise the Ao5 of the most recent 4 solves.
    let bpa: number | null = null;
    let wpa: number | null = null;
    if (statSolves.length >= 11 && statSolves.length % 12 === 11) {
      const proj = computeBpaWpa(statSolves.slice(-11), 12);
      bpa = proj?.bpa ?? null;
      wpa = proj?.wpa ?? null;
    } else if (statSolves.length >= 4) {
      const proj = computeBpaWpa(statSolves.slice(-4), 5);
      bpa = proj?.bpa ?? null;
      wpa = proj?.wpa ?? null;
    }

    return {
      ao5: statLabel(stats.ao5),
      ao12: statLabel(stats.ao12),
      ao50: statLabel(averageOf(statSolves, 50)),
      ao100: statLabel(stats.ao100),
      ao500: statLabel(averageOf(statSolves, 500)),
      ao1000: statLabel(averageOf(statSolves, 1000)),
      mo3: statLabel(meanOfN(statSolves, 3)),
      best: statLabel(stats.best),
      worst: statLabel(stats.worst),
      mean: statLabel(stats.mean),
      median: statLabel(median),
      deviation: statLabel(stdDeviation(statSolves, stats.mean)),
      iqr: statLabel(iqr),
      dnfRate: statSolves.length > 0 ? `${dnfRate.toFixed(1)}%` : "0%",
      count: String(stats.count),
      sessionTime: formatDuration(stats.sessionTime),
      tps: tps !== null ? tps.toFixed(2) : "—",
      bpa: statLabel(bpa),
      wpa: statLabel(wpa),
      bestAo5: statLabel(bestRollingAverage(statSolves, 5)),
      bestAo12: statLabel(bestRollingAverage(statSolves, 12)),
      subX: statSolves.length > 0 ? `${subXSolves} (${subXPct}%)` : "—",
    };
  }, [solves, puzzleFilter, subXThreshold]);
}

