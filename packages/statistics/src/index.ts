/**
 * @cubalyze/statistics — Headless statistics engine.
 *
 * Pure calculation functions for speedcubing statistics:
 *   - Rolling averages (Ao5, Ao12, Ao100) — WCA-style for small windows,
 *     5% percentile trim (csTimer convention) for large ones
 *   - Session stats (best, worst, mean, session time)
 *   - Standard deviation
 *
 * This package is framework-agnostic and has zero UI dependencies.
 * It accepts minimal solve-like contracts rather than tying to any
 * specific domain model.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Penalty applied to a solve. */
export type Penalty = "none" | "+2" | "DNF";

/** Minimal solve shape required by statistics functions. */
export interface StatSolve {
  time: number;
  penalty: Penalty;
}

/** Aggregated statistics for a session. */
export interface SessionStats {
  /** Number of solves counted (excludes DNFs for averages). */
  count: number;
  /** Total solves including DNFs. */
  total: number;
  /** Best effective time in ms, null when there are no solves, Infinity if all DNF. */
  best: number | null;
  /** Worst effective time in ms, null when there are no solves, Infinity if all DNF. */
  worst: number | null;
  /** Arithmetic mean of effective times (DNF excluded). */
  mean: number | null;
  /** Average of 5 (current, trimming best/worst). null if not enough solves. */
  ao5: number | null;
  /** Average of 12. null if not enough solves. */
  ao12: number | null;
  /** Average of 100 (5% trim: tolerates up to 5 DNFs). null if not enough solves. */
  ao100: number | null;
  /** Sum of all effective times (DNF excluded). */
  sessionTime: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const INF = Number.POSITIVE_INFINITY;

/** Effective time of a solve after applying penalties. */
export function effectiveTime(solve: StatSolve): number {
  switch (solve.penalty) {
    case "+2":
      return solve.time + 2000;
    case "DNF":
      return INF;
    default:
      return solve.time;
  }
}

/**
 * Number of solves discarded from each side of an average of N, using the
 * 5% percentile convention (csTimer default / Twisty Timer default):
 * `ceil(N / 20)`. For N = 5 and N = 12 this is 1 — the standard WCA-style
 * single best/worst trim. For larger averages it grows, so an Ao50 discards
 * the 3 best and 3 worst solves and an Ao100 discards the 5 best and 5 worst.
 */
function trimSize(n: number): number {
  return Math.ceil(n / 20);
}

/**
 * Average of N — trimmed mean with the 5% percentile convention used by
 * csTimer (and the Twisty Timer default): the best `trim` and worst `trim`
 * solves are discarded, where `trim = ceil(N / 20)`, and the arithmetic mean
 * of the remaining solves is returned.
 *
 * For N = 5 and N = 12 this is the standard WCA Ao5/Ao12 calculation (single
 * best and worst trimmed). For larger averages the trim grows, so an Ao100
 * with up to 5 DNFs is still valid: DNFs count as the worst solves and fall
 * inside the trimmed tail. If more than `trim` DNFs are in the window, the
 * average is DNF.
 *
 * Requires at least N solves (newest first). Returns null when there is not
 * enough data, Infinity when the average is a DNF.
 */
export function averageOf(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null;
  const slice = solves.slice(0, n).map(effectiveTime);
  const trim = trimSize(n);
  // More than `trim` DNFs in the window → the average is DNF.
  const dnfs = slice.filter((t) => !Number.isFinite(t)).length;
  if (dnfs > trim) return INF;

  const sorted = [...slice].sort((a, b) => a - b);
  // Discard the best `trim` (front) and worst `trim` (back; DNFs sort last).
  const trimmed = sorted.slice(trim, n - trim);
  if (trimmed.length === 0) return INF;
  return trimmed.reduce((acc, t) => acc + t, 0) / trimmed.length;
}

/**
 * Compute the full SessionStats object from a solve list (newest first).
 */
export function computeStats(solves: StatSolve[]): SessionStats {
  const total = solves.length;
  if (total === 0) {
    return {
      count: 0,
      total: 0,
      // No solves → no best/worst at all. Null (not Infinity) so UI shows
      // "—" like ao5/ao12/mean instead of a confusing "DNF" best.
      best: null,
      worst: null,
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

/**
 * Compute standard deviation of effective solve times (excluding DNFs).
 * Returns null when fewer than 2 valid solves.
 */
export function stdDeviation(solves: StatSolve[], mean: number | null): number | null {
  if (mean === null || solves.length < 2) return null;

  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => s.time)
    .filter((t) => Number.isFinite(t));

  if (valid.length < 2) return null;

  const sumSq = valid.reduce((acc, t) => acc + (t - mean) ** 2, 0);
  return Math.sqrt(sumSq / valid.length);
}

/**
 * Result of Best Possible Average (BPA) and Worst Possible Average (WPA) calculation.
 */
export interface BpaWpaResult {
  bpa: number | null;
  wpa: number | null;
  targetN: number;
}

/**
 * Compute Best Possible Average (BPA) and Worst Possible Average (WPA)
 * for an in-progress average of N (when solves.length === N - 1).
 */
export function computeBpaWpa(solves: StatSolve[], n: number): BpaWpaResult | null {
  if (solves.length !== n - 1) return null;
  const bestAttempt: StatSolve = { time: 0, penalty: "none" };
  const worstAttempt: StatSolve = { time: 0, penalty: "DNF" };
  const bpa = averageOf([bestAttempt, ...solves], n);
  const wpa = averageOf([worstAttempt, ...solves], n);
  return { bpa, wpa, targetN: n };
}

// ─── Session TECHNICAL stats ────────────────────────────────────────────────

export {
  derivePhaseTimeStats,
  deriveEconomyStats,
  deriveRotationStats,
  deriveLookaheadStats,
  deriveCrossStats,
  deriveRecognitionCosts,
  deriveSessionTechnicalStats,
  deriveMoveMetrics,
  deriveCaseIntelligence,
  deriveSkillRadarProfile,
} from "./technical";
export type {
  TechnicalSolveInput,
  PhaseTechnicalStats,
  EconomyTechnicalStats,
  RotationTechnicalStats,
  LookaheadTechnicalStats,
  CrossTechnicalStats,
  RecognitionCost,
  SessionTechnicalStats,
  MoveMetrics,
  CaseIntelligence,
  CaseIntelligencePhase,
  SkillAxisId,
  SkillAxisData,
  SkillRadarProfile,
} from "./technical";

