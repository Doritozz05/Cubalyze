// ─────────────────────────────────────────────────────────────────────────
// Time formatting + statistics helpers.
// All formatting targets centisecond precision (mm:ss.cs) so the monospaced
// timer never "jumps" width while counting.
// ─────────────────────────────────────────────────────────────────────────

import type { Solve, SessionStats } from "@/types";
import { effectiveTime } from "@/types";

const INF = Number.POSITIVE_INFINITY;

/**
 * Format milliseconds as a monospaced-friendly string.
 *  - < 60s  -> "12.34"
 *  - >= 60s -> "1:23.45"
 *  - DNF    -> "DNF"
 */
export function formatTime(ms: number): string {
  if (ms === INF || !Number.isFinite(ms)) return "DNF";
  if (ms < 0 || Number.isNaN(ms)) return "0.00";

  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const csStr = cs.toString().padStart(2, "0");
  const secStr = seconds.toString().padStart(2, "0");

  if (minutes > 0) return `${minutes}:${secStr}.${csStr}`;
  return `${seconds}.${csStr}`;
}

/** Compact session duration, e.g. "12m 04s" or "1h 05m". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  return `${seconds}s`;
}

/**
 * Average of N (WCA-style): trim best & worst, arithmetic mean of the rest.
 * Requires at least N solves; DNFs count as worst.
 * Returns null when not enough data.
 */
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const slice = solves.slice(0, n).map(effectiveTime);
  // If more than one DNF in the window, the average is DNF.
  const dnfs = slice.filter((t) => !Number.isFinite(t)).length;
  if (dnfs > 1) return INF;

  const sorted = [...slice].sort((a, b) => a - b);
  // trim best (first) and worst (last)
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((acc, t) => acc + t, 0);
  return sum / (n - 2);
}

/** Compute the full SessionStats object from a solve list (newest first). */
export function computeStats(solves: Solve[]): SessionStats {
  const total = solves.length;
  if (total === 0) {
    return {
      count: 0,
      total: 0,
      best: INF,
      worst: INF,
      mean: null,
      ao5: null,
      ao12: null,
      ao100: null,
      sessionTime: 0,
    };
  }

  const effective = solves.map(effectiveTime);
  const finite = effective.filter((t) => Number.isFinite(t));

  const best = Math.min(...effective);
  const worst = finite.length > 0 ? Math.max(...finite) : INF;
  const mean = finite.length > 0 ? finite.reduce((a, b) => a + b, 0) / finite.length : null;
  const sessionTime = finite.reduce((a, b) => a + b, 0);

  return {
    count: finite.length,
    total,
    best,
    worst,
    mean,
    ao5: averageOf(solves, 5),
    ao12: averageOf(solves, 12),
    ao100: averageOf(solves, 100),
    sessionTime,
  };
}

/** Short label for a stat value, handling DNF/null gracefully. */
export function statLabel(value: number | null): string {
  if (value === null) return "—";
  return formatTime(value);
}
