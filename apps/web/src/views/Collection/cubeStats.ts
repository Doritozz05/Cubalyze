"use client";

/**
 * cubeStats.ts — what a cube has actually done for you.
 *
 * The Locker stops being a catalogue here: given the solve history attributed
 * to one item, this answers "how many solves, how fast, and when did I last
 * pick it up".
 *
 * Two rules shape everything below:
 *
 *   • **Derived, never stored.** These numbers are recomputed from the solves
 *     every time (ADR-029): a synced counter would drift the moment a device
 *     edits a penalty offline, and then it would be wrong on both sides.
 *   • **Pure.** It takes plain rows and returns a plain object, so every rule
 *     is testable without a database, a timer or React.
 *
 * The averages reuse the app's own statistics engine (`averageOf`) instead of
 * re-deriving WCA trimming here: a cube's Ao5 must mean exactly what the
 * session Ao5 means, or the two numbers would disagree about the same five
 * solves.
 */

import { averageOf, type Penalty as StatPenalty, type StatSolve } from "@cubeforge/statistics";

/** The only fields this module needs from a solve row. */
export interface CubeSolveRow {
  id: string;
  timeMs: number;
  /** Stored penalty; `dhf`/`DNF` are treated as a DNF. */
  penalty?: string;
  timestamp: number;
}

export interface CubeBest {
  timeMs: number;
  solveId: string;
  timestamp: number;
}

export interface CubeStats {
  /** Every attributed solve, including DNFs. */
  count: number;
  /** Solves that produced a real time. */
  valid: number;
  /** Fastest single (effective time, so a +2 counts). Null when there is none. */
  best: CubeBest | null;
  /** Mean of the valid times. Null when there is none. */
  mean: number | null;
  /**
   * Best rolling average of 5 anywhere in the history — not the average of the
   * latest 5, which is what a session header shows. DNF windows are skipped.
   */
  bestAo5: number | null;
  /** Best rolling average of 12 anywhere in the history. */
  bestAo12: number | null;
  /** Timestamp of the most recent solve, or null when the cube was never used. */
  lastUsedAt: number | null;
}

/** The app's penalties are stored as `none | +2 | dnf | DNF`. */
export function toStatPenalty(penalty: string | undefined): StatPenalty {
  if (penalty === "+2") return "+2";
  if (penalty === "dnf" || penalty === "DNF") return "DNF";
  return "none";
}

/** Effective time in ms after the penalty (+2 seconds, DNF = Infinity). */
export function effectiveMs(row: CubeSolveRow): number {
  if (row.penalty === "+2") return row.timeMs + 2000;
  if (row.penalty === "dnf" || row.penalty === "DNF") return Number.POSITIVE_INFINITY;
  return row.timeMs;
}

function toStat(row: CubeSolveRow): StatSolve {
  return { time: row.timeMs, penalty: toStatPenalty(row.penalty) };
}

/**
 * Best trimmed average of `n` over every contiguous window of the history.
 *
 * Windows are taken in chronological order, and the order inside a window is
 * irrelevant: `averageOf` sorts before trimming, so a WCA Ao5 is the same
 * number whichever direction it is read. A window that is a DNF comes back as
 * Infinity and can never win a minimum.
 */
function bestRollingAverage(chronological: readonly CubeSolveRow[], n: number): number | null {
  if (chronological.length < n) return null;
  let best: number | null = null;
  for (let start = 0; start + n <= chronological.length; start++) {
    const window = chronological.slice(start, start + n).map(toStat);
    const average = averageOf(window, n);
    if (average == null || !Number.isFinite(average)) continue;
    if (best == null || average < best) best = average;
  }
  return best;
}

/**
 * The statistics of one cube.
 *
 * The input order does not matter — this sorts by timestamp once, so a caller
 * cannot get a wrong best-Ao5 by passing the rows newest-first (which is what
 * every other list in the app uses).
 */
export function cubeStatsFor(solves: readonly CubeSolveRow[]): CubeStats {
  if (solves.length === 0) {
    return {
      count: 0,
      valid: 0,
      best: null,
      mean: null,
      bestAo5: null,
      bestAo12: null,
      lastUsedAt: null,
    };
  }

  const chronological = [...solves].sort((a, b) => a.timestamp - b.timestamp);

  let best: CubeBest | null = null;
  let validSum = 0;
  let valid = 0;
  let lastUsedAt = 0;

  for (const row of chronological) {
    if (row.timestamp > lastUsedAt) lastUsedAt = row.timestamp;
    const time = effectiveMs(row);
    if (!Number.isFinite(time)) continue;
    valid += 1;
    validSum += time;
    if (best == null || time < best.timeMs) {
      best = { timeMs: time, solveId: row.id, timestamp: row.timestamp };
    }
  }

  return {
    count: chronological.length,
    valid,
    best,
    mean: valid > 0 ? validSum / valid : null,
    bestAo5: bestRollingAverage(chronological, 5),
    bestAo12: bestRollingAverage(chronological, 12),
    lastUsedAt: lastUsedAt > 0 ? lastUsedAt : null,
  };
}

/** True when there is nothing worth showing (no solve has this cube). */
export function isCubeStatsEmpty(stats: CubeStats): boolean {
  return stats.count === 0;
}

/**
 * "3 days ago" in the user's language, or null when the cube was never used.
 *
 * Uses `Intl.RelativeTimeFormat` rather than translation keys: the browser
 * already knows how to say this in every locale it supports, and hand-written
 * "hace {{count}} días" strings would be one more thing to keep in sync (and
 * wrong for any language we have not translated). `now` is a parameter so the
 * output is testable.
 */
export function formatLastUsed(
  lastUsedAt: number | null,
  now: number,
  locale: string,
): string | null {
  if (lastUsedAt == null) return null;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.floor(Math.max(0, now - lastUsedAt) / 60_000);
  if (minutes < 1) return formatter.format(0, "minute");
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return formatter.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return formatter.format(-months, "month");
  return formatter.format(-Math.floor(days / 365), "year");
}
