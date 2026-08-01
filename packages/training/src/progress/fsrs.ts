/**
 * @cubeforge/training — FSRS-lite scheduler
 *
 * A faithful, dependency-free implementation of the FSRS-4 model
 * (Free Spaced Repetition Scheduler — the algorithm powering Anki 23.10+).
 *
 * Instead of SM-2's fixed ease factor, FSRS models each case with two
 * hidden quantities and derives a third:
 *
 *   - Stability (S): how long the memory lasts (in days).
 *   - Difficulty (D): how intrinsically hard the case is (1-10).
 *   - Retrievability (R): probability of recalling it today,
 *     R(t) = (1 + FACTOR·t/S)^DECAY
 *
 * Scheduling happens exactly when R drops to the target retention (0.9),
 * which produces the empirically-validated "spacing effect" curve
 * (Cepeda et al. 2006): each successful review lands just before the
 * predicted forgetting point, growing the interval at the case's own pace.
 *
 * References:
 * - Ye, S., et al. "A stochastic shortest path algorithm for optimizing
 *   spaced repetition scheduling" (2022) — the FSRS-4 paper.
 * - ts-fsrs / Anki 23.10+ implementation of the same formulas.
 *
 * This module is pure logic (no I/O): it works with any storage backend
 * via the ProgressTracker repository interface.
 */

export type SRSGrade = "again" | "hard" | "good" | "easy";
export type SRSState = "new" | "learning" | "review" | "relearning";

/** Persisted FSRS state of one algorithm case. */
export interface FSRSRecord {
  /** Memory stability — expected days until R decays to ~90%. */
  stability: number;
  /** Intrinsic difficulty of the case, 1 (easy) – 10 (hard). */
  difficulty: number;
  /** FSRS state-machine state. */
  state: SRSState;
  /** Total forgotten reviews (Again on a mature/relearning card). */
  lapses: number;
  /** Total graded reviews performed. */
  reviewCount: number;
  /** Epoch ms of the last review. */
  lastReviewAt: number;
  /** Scheduled interval in days. */
  intervalDays: number;
  /** Epoch ms when this case becomes due again. */
  nextReviewAt: number;
}

export const FSRS_DEFAULTS: FSRSRecord = {
  stability: 0,
  difficulty: 5,
  state: "new",
  lapses: 0,
  reviewCount: 0,
  lastReviewAt: 0,
  intervalDays: 0,
  nextReviewAt: 0,
};

// ─── FSRS-4 constants ─────────────────────────────────────────────────────

/** Scale factor derived from the 0.9 request-retention anchor. */
const FACTOR = 19 / 81; // ≈ 0.2346
/** Retrievability decay exponent. */
const DECAY = -0.5;
/**
 * Target retention: schedule the next review when R ≈ 0.9.
 * Public constant consumed by the Phase B scheduler (buildDailyQueue priority)
 * and exposed so future interval math can use it. `intervalFor` currently
 * derives intervals from stability with fixed grade multipliers instead.
 */
export const REQUEST_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MAX_INTERVAL_DAYS = 365;
const DAY_MS = 86_400_000;

/** Initial stability (days) assigned on the very first review, per grade. */
const INITIAL_STABILITY: Record<SRSGrade, number> = {
  again: 0.4,
  hard: 1.5,
  good: 3.0,
  easy: 5.0,
};

const GRADE_INDEX: Record<SRSGrade, number> = { again: 0, hard: 1, good: 2, easy: 3 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Core formulas ────────────────────────────────────────────────────────

/**
 * Retrievability — probability of recall `elapsedDays` after a review.
 * R(S, S) === 0.9 exactly by construction (the retention anchor).
 */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0 || elapsedDays <= 0) return 1;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/**
 * FSRS-4 difficulty update: D' = clamp(D − 6·(g − 2), 1, 10)
 * with g ∈ {0=again, 1=hard, 2=good, 3=easy}.
 */
export function nextDifficulty(difficulty: number, grade: SRSGrade): number {
  const g = GRADE_INDEX[grade];
  return clamp(difficulty - 6 * (g - 2), MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/**
 * FSRS-4 stability update:
 *   S' = S·(1 + e^F·(11−D)·S^(−DECAY)·(e^((1−R)·F) − 1)·hardPenalty·easyBonus)
 * Hard reviews apply a 0.8 penalty; easy reviews a 1.3 bonus.
 */
export function nextStability(
  stability: number,
  difficulty: number,
  r: number,
  grade: SRSGrade,
): number {
  const hardPenalty = grade === "hard" ? 0.8 : 1;
  const easyBonus = grade === "easy" ? 1.3 : 1;
  const delta =
    Math.exp(FACTOR) *
    (11 - difficulty) *
    Math.pow(Math.max(stability, 0.1), -DECAY) *
    (Math.exp((1 - r) * FACTOR) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(stability * (1 + delta), 0.1);
}

/** Whole-day interval for a grade, given the new stability (1-365). */
export function intervalFor(grade: SRSGrade, stability: number): number {
  if (grade === "again") return 1;
  const multiplier = grade === "hard" ? 1.2 : grade === "easy" ? 1.3 : 1;
  return clamp(Math.round(stability * multiplier), 1, MAX_INTERVAL_DAYS);
}

// ─── State machine ────────────────────────────────────────────────────────

function nextState(state: SRSState, grade: SRSGrade): SRSState {
  const passed = grade === "good" || grade === "easy";
  switch (state) {
    case "new":
      return passed ? "review" : "learning";
    case "learning":
      return passed ? "review" : "learning";
    case "review":
      return grade === "again" ? "relearning" : "review";
    case "relearning":
      return passed ? "review" : "relearning";
  }
}

/** Whether the case is due for review at `now`. */
export function isDue(record: FSRSRecord, now: number): boolean {
  return record.nextReviewAt > 0 && record.nextReviewAt <= now;
}

/**
 * Apply one graded review and return the updated FSRS record.
 * Pure — computes the next schedule; does not persist.
 */
export function review(record: FSRSRecord, grade: SRSGrade, now: number): FSRSRecord {
  const isFirst = record.reviewCount === 0;
  const elapsedDays = record.lastReviewAt > 0 ? (now - record.lastReviewAt) / DAY_MS : 0;
  const r = record.stability > 0 ? retrievability(record.stability, elapsedDays) : 1;

  const stability = isFirst
    ? INITIAL_STABILITY[grade]
    : nextStability(record.stability, record.difficulty, r, grade);
  const difficulty = isFirst
    ? record.difficulty
    : nextDifficulty(record.difficulty, grade);
  const state = nextState(record.state, grade);
  // One lapse per lapse cycle: only the review → relearning transition counts.
  // An "again" while already in relearning is the same lapse, not a new one.
  const lapses = record.lapses + (record.state === "review" && grade === "again" ? 1 : 0);
  // Learning phase: force daily reviews until the card graduates. A "hard" on a
  // learning card must NOT stretch the interval — short, frequent spacing is
  // what builds the initial memory trace (spacing effect, Cepeda et al. 2006).
  const intervalDays = state === "learning" ? 1 : intervalFor(grade, stability);

  return {
    stability,
    difficulty,
    state,
    lapses,
    reviewCount: record.reviewCount + 1,
    lastReviewAt: now,
    intervalDays,
    nextReviewAt: now + intervalDays * DAY_MS,
  };
}
