// ─────────────────────────────────────────────────────────────────────────
// Core domain types for the Speedcubing timer UI.
// These are intentionally framework-agnostic so they can be wired to any
// `timer-engine` implementation without changes.
// ─────────────────────────────────────────────────────────────────────────

/** Penalty applied to a solve. */
export type Penalty = "none" | "+2" | "DNF";

/** A single recorded solve. */
export interface Solve {
  /** Stable unique id (used as React key + for mutations). */
  id: string;
  /** Raw solve time in milliseconds (before penalty). */
  time: number;
  /** Penalty applied to the solve. */
  penalty: Penalty;
  /** The scramble that was solved. */
  scramble: string;
  /** Epoch milliseconds when the solve finished. */
  timestamp: number;
  /** Optional free-form note. */
  note?: string;
}

/**
 * Effective time of a solve after applying penalties.
 * - `none` -> raw time
 * - `+2`   -> raw time + 2000ms
 * - `DNF`  -> Infinity (sentinel for "did not finish")
 */
export function effectiveTime(solve: Solve): number {
  switch (solve.penalty) {
    case "+2":
      return solve.time + 2000;
    case "DNF":
      return Number.POSITIVE_INFINITY;
    case "none":
    default:
      return solve.time;
  }
}

/** Aggregated statistics for the current session. */
export interface SessionStats {
  /** Number of solves counted (excludes DNFs for averages). */
  count: number;
  /** Total solves including DNFs. */
  total: number;
  /** Best effective time in ms (Infinity if all DNF). */
  best: number;
  /** Worst effective time in ms (Infinity if all DNF). */
  worst: number;
  /** Arithmetic mean of effective times (DNF excluded). */
  mean: number | null;
  /** Average of 5 (current, trimming best/worst). null if not enough solves. */
  ao5: number | null;
  /** Average of 12. null if not enough solves. */
  ao12: number | null;
  /** Average of 100. null if not enough solves. */
  ao100: number | null;
  /** Sum of all effective times (DNF excluded). */
  sessionTime: number;
}

/**
 * Finite state machine for the timer.
 *  idle     -> waiting to start, shows last/zero time
 *  holding  -> pointer/space held but not yet "armed"
 *  ready    -> held long enough, release to launch
 *  running  -> counting up
 *  stopped  -> just finished (brief), then back to idle
 */
export type TimerState =
  | "idle"
  | "holding"
  | "ready"
  | "running"
  | "stopped";

/** Cube categories supported by the UI (mock). */
export type PuzzleCategory =
  | "2x2"
  | "3x3"
  | "4x4"
  | "5x5"
  | "6x6"
  | "7x7"
  | "3x3 OH"
  | "Megaminx"
  | "Pyraminx"
  | "Skewb";
