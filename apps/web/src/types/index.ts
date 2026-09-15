// ─────────────────────────────────────────────────────────────────────────
// Core domain types for the Speedcubing timer UI.
// These are intentionally framework-agnostic so they can be wired to any
// `timer-engine` implementation without changes.
// ─────────────────────────────────────────────────────────────────────────

/** Penalty applied to a solve. */
export type Penalty = "none" | "+2" | "DNF";

/** Solving method identifier. */
export type SolveMethod = 'CFOP' | 'Roux' | 'ZZ' | 'Petrus';

/** How the solve was recorded: smart cube hardware, manual entry, or the
 *  virtual cube simulator (Cube tab). Virtual solves carry full move +
 *  orientation data — same shape as smart-cube solves — so they run the
 *  same analysis pipeline and replay. */
export type SolveSource = "smart" | "manual" | "virtual";

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
  /** Solving method used for this solve. */
  method?: SolveMethod;
  /**
   * The Locker item this solve was done with (a `gear_items.id`), when the
   * active cube belonged to the event. `label` is the name at solve time, kept
   * on the row so history and exports survive a rename or a deletion.
   */
  cubeId?: string;
  cubeLabel?: string;
  /** How the solve was recorded: "smart" (cube hardware) or "manual". */
  source?: SolveSource;
  /** Raw moves captured from Smart Cube during the solve. */
  moves?: import('@cubalyze/types').CubeMoveEvent[];
  /** Post-solve analysis metrics (computed after solve completes). */
  analysis?: import('@cubalyze/types').SolveMetrics;
  /** Compact orientation timeline for smart cube solves with IMU. */
  orientationTimeline?: import('@cubalyze/types').OrientationTimeline;
  /**
   * Whether `moves` are pre-conjugated to the cube-fixed frame.
   *
   * - `true` (reconstruction records): the moves are CONJUGATED base-frame
   *   letters (rotations folded in) that solve the cube in the cube's own
   *   frame. The 3D replay rotates the cube ROOT by `orientationTimeline`
   *   (the solver's grip: inspection pre-roll + mid-solve keyframes) so the
   *   cube follows the solver's perspective and ends solved in it; per-event
   *   `displayNotation` overrides show the writer's raw notation.
   * - `undefined` (smart-cube solves): physical moves + an IMU timeline;
   *   the cube root follows the timeline.
   */
  replayMovesConjugated?: boolean;
  /** Puzzle type for this solve (e.g. '333', '222'). */
  puzzleType?: string;
}

/** Normalize penalty input (handles case mismatches like "dnf" -> "DNF"). */
export function normalizePenalty(raw: string | null | undefined): Penalty {
  if (!raw) return "none";
  const u = raw.toUpperCase().trim();
  if (u === "DNF") return "DNF";
  if (u === "+2" || u === "PLUS2" || u === "PLUS_TWO") return "+2";
  return "none";
}

/**
 * Effective time of a solve after applying penalties.
 * - `none` -> raw time
 * - `+2`   -> raw time + 2000ms
 * - `DNF`  -> Infinity (sentinel for "did not finish")
 */
export function effectiveTime(solve: Solve): number {
  const p = normalizePenalty(solve.penalty);
  switch (p) {
    case "+2":
      return solve.time + 2000;
    case "DNF":
      return Number.POSITIVE_INFINITY;
    case "none":
    default:
      return solve.time;
  }
}

/**
 * Finite state machine for the timer.
 *  idle           -> waiting to start, shows last/zero time
 *  inspection     -> 15s WCA inspection countdown (when enabled)
 *  ready_for_move -> Smart Cube is connected and the next physical move
 *                    will start the solve (M2 auto-arm, M4 explicit arm)
 *  holding        -> pointer/space held but not yet past the hold delay
 *  ready          -> held long enough, release to launch
 *  running        -> counting up
 *  stopped        -> just finished (brief), then back to idle
 */
export type TimerState =
  | "idle"
  | "inspection"
  | "ready_for_move"
  | "holding"
  | "ready"
  | "running"
  | "stopped";

/**
 * Cube categories exposed by the UI. Kept in sync with the event registry
 * (phase A6): the selector is generated from the registry, so these are the
 * categories the app can render labels for. Ghost categories (no provider)
 * are NOT offered anywhere.
 */
export type PuzzleCategory =
  | "2x2"
  | "3x3"
  | "3x3 OH"
  | "4x4"
  | "5x5"
  | "6x6"
  | "7x7"
  | "Megaminx"
  | "Pyraminx"
  | "Skewb"
  | "FTO";
