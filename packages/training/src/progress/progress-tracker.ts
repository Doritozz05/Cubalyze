/**
 * @cubeforge/training — Progress Tracker
 *
 * Pure computation layer for training progress. Takes a repository
 * interface (so it works with the web DB or any storage backend).
 *
 * Key responsibilities:
 * - Compute mastery from attempt history
 * - Calculate SRS (Spaced Repetition System) intervals using SM-2
 * - Aggregate per-method, per-phase, and per-exercise stats
 */

import type { AttemptVerdict, PlayMode } from "../types";

// ─── Repository Interface (caller provides the implementation) ────────────

export interface ITrainingProgressRepo {
  insertAttempt(attempt: Omit<TrainingAttemptRecord, "id">): Promise<TrainingAttemptRecord>;
  getAttemptsByCase(caseId: string, limit?: number): Promise<TrainingAttemptRecord[]>;
  getAttemptsByExercise(exerciseId: string, limit?: number): Promise<TrainingAttemptRecord[]>;
  getAttemptsByMethod(methodId: string, limit?: number): Promise<TrainingAttemptRecord[]>;
  getAlgorithmProgress(algorithmId: string): Promise<AlgorithmProgressRecord | null>;
  upsertAlgorithmProgress(progress: AlgorithmProgressRecord): Promise<AlgorithmProgressRecord>;
  getAlgorithmProgressBySubset(subsetId: string): Promise<AlgorithmProgressRecord[]>;
  getWeakestAlgorithms(subsetId: string, limit?: number): Promise<AlgorithmProgressRecord[]>;
  getDueForReview(limit?: number): Promise<AlgorithmProgressRecord[]>;
  getExerciseProgress(exerciseId: string, methodId: string, phaseId?: string): Promise<ExerciseProgressRecord | null>;
  upsertExerciseProgress(progress: ExerciseProgressRecord): Promise<ExerciseProgressRecord>;
  getMethodExerciseProgress(methodId: string): Promise<ExerciseProgressRecord[]>;
  getMethodMastery(methodId: string): Promise<number>;
  /** Per-phase aggregate stats (avg time, accuracy, efficiency) for phase weakness detection. */
  getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStatsRecord | null>;
}

// ─── Record Types (what comes from the DB) ────────────────────────────────

export interface TrainingAttemptRecord {
  id: string;
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  caseId?: string;
  scramble: string;
  timeMs: number;
  verdict: AttemptVerdict;
  playMode: PlayMode;
  moveCount?: number;
  optimalMoves?: number;
  tps?: number;
  rotationCount?: number;
  timestamp: number;
}

export interface AlgorithmProgressRecord {
  algorithmId: string;
  mastery: number;
  accuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  totalAttempts: number;
  correctStreak: number;
  lastPracticedAt: number;
  srsNextReviewAt: number;
  srsIntervalDays: number;
  srsEaseFactor: number;
  recognitionAccuracy: number;
  recognitionAttempts: number;
  /** FSRS-lite: memory stability in days (0 = not yet FSRS-tracked). */
  srsStability: number;
  /** FSRS-lite: intrinsic difficulty 1-10. */
  srsDifficulty: number;
  /** FSRS-lite: new | learning | review | relearning. */
  srsState: "new" | "learning" | "review" | "relearning";
  /** FSRS-lite: total forgotten reviews. */
  srsLapses: number;
  /** FSRS-lite: total graded reviews. */
  srsReviewCount: number;
  /** Epoch ms of the last SRS review (≠ lastPracticedAt). */
  lastReviewAt: number;
}

export interface ExerciseProgressRecord {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  totalSessions: number;
  totalAttempts: number;
  bestAccuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  lastPracticedAt: number;
}

/** Per-phase aggregate stats derived from training attempts. */
export interface PhaseStatsRecord {
  methodId: string;
  phaseId: string;
  totalAttempts: number;
  accuracy: number;   // 0-100
  avgTimeMs: number;
  bestTimeMs: number;
  failRate: number;   // 0-1
  efficiency: number; // 0-1 (optimal_moves / move_count)
  lastPracticedAt: number;
}

/** What a training attempt measures. Recognition quizzes must NOT touch execution time metrics. */
export type MetricKind = 'execution' | 'recognition';

// ─── SM-2 Spaced Repetition Algorithm ─────────────────────────────────────

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

function computeSM2(
  quality: number, // 0-5 (0=complete blackout, 5=perfect)
  previousEase: number,
  previousInterval: number,
): { ease: number; interval: number } {
  // SM-2 formula
  let ease = previousEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < MIN_EASE_FACTOR) ease = MIN_EASE_FACTOR;

  let interval: number;
  if (quality < 3) {
    // Failed — reset interval
    interval = 1;
  } else if (previousInterval === 0) {
    interval = 1; // First review
  } else if (previousInterval === 1) {
    interval = 6; // Second review (6 days)
  } else {
    interval = Math.round(previousInterval * ease);
  }

  return { ease, interval };
}

function verdictToQuality(verdict: AttemptVerdict, timeMs: number, bestTimeMs: number): number {
  if (verdict === "skipped" || verdict === "dnf") return 1;
  if (verdict === "incorrect") return 2;

  // Correct — quality depends on time relative to best
  if (bestTimeMs <= 0) return 4;
  const ratio = timeMs / bestTimeMs;
  if (ratio <= 1.0) return 5; // New best!
  if (ratio <= 1.3) return 4;
  if (ratio <= 1.8) return 3;
  return 3;
}

// ─── Mastery Calculation ──────────────────────────────────────────────────

function computeMastery(
  correctCount: number,
  totalAttempts: number,
  currentStreak: number,
  avgTimeRatio: number, // avgTimeMs / bestTimeMs (1.0 = at best, higher = slower)
): number {
  if (totalAttempts === 0) return 0;

  const accuracyWeight = 0.5;
  const streakWeight = 0.2;
  const speedWeight = 0.3;

  const accuracyScore = (correctCount / totalAttempts) * 100;
  const streakScore = Math.min(currentStreak, 10) * 10; // 0-100, caps at 10 streak
  const speedScore = Math.max(0, Math.min(100, (2 - avgTimeRatio) * 100)); // 1.0 ratio = 100, 2.0+ = 0

  return Math.round(
    accuracyScore * accuracyWeight + streakScore * streakWeight + speedScore * speedWeight,
  );
}

// ─── Progress Tracker ─────────────────────────────────────────────────────

export class ProgressTracker {
  constructor(private repo: ITrainingProgressRepo) {}

  /**
   * Record a training attempt and update algorithm + exercise progress.
   *
   * - Exercise progress is ALWAYS updated (every training view contributes).
   * - Algorithm progress is updated when `caseId` is present.
   * - Recognition attempts (`metricKind: 'recognition'`) update only
   *   `recognitionAccuracy`/`recognitionAttempts` and mastery — they
   *   never touch execution time metrics (fixes Recognize corrupting
   *   best/avg time with timeMs=0).
   *
   * Returns updated algorithm progress (null when no caseId).
   */
  async recordAttempt(params: {
    exerciseId: string;
    methodId: string;
    phaseId?: string;
    caseId?: string;
    timeMs: number;
    verdict: AttemptVerdict;
    playMode: PlayMode;
    scramble: string;
    metricKind?: MetricKind;
    moveCount?: number;
    optimalMoves?: number;
    tps?: number;
    rotationCount?: number;
  }): Promise<AlgorithmProgressRecord | null> {
    const {
      exerciseId, methodId, phaseId, caseId, timeMs, verdict, playMode, scramble,
      metricKind = 'execution', moveCount, optimalMoves, tps, rotationCount,
    } = params;

    // Insert the raw attempt record (with efficiency metadata when available)
    const now = Date.now();
    await this.repo.insertAttempt({
      exerciseId,
      methodId,
      phaseId,
      caseId,
      scramble,
      timeMs,
      verdict,
      playMode,
      moveCount,
      optimalMoves,
      tps,
      rotationCount,
      timestamp: now,
    });

    // Update exercise progress — ALWAYS (even without caseId).
    // Recognition quizzes persist timeMs=0; guard time fields so they never
    // corrupt exercise best/avg time.
    const exPrev = await this.repo.getExerciseProgress(exerciseId, methodId, phaseId);
    const hasTime = timeMs > 0;
    const exProgress: ExerciseProgressRecord = {
      exerciseId,
      methodId,
      phaseId,
      totalSessions: exPrev?.totalSessions ?? 1,
      totalAttempts: (exPrev?.totalAttempts ?? 0) + 1,
      bestAccuracy: Math.max(exPrev?.bestAccuracy ?? 0, verdict === "correct" ? 100 : 0),
      bestTimeMs: hasTime
        ? exPrev && exPrev.bestTimeMs > 0 ? Math.min(exPrev.bestTimeMs, timeMs) : timeMs
        : (exPrev?.bestTimeMs ?? 0),
      avgTimeMs: hasTime
        ? exPrev
          ? Math.round((exPrev.avgTimeMs * (exPrev.totalAttempts) + timeMs) / ((exPrev.totalAttempts) + 1))
          : timeMs
        : (exPrev?.avgTimeMs ?? 0),
      lastPracticedAt: now,
    };
    await this.repo.upsertExerciseProgress(exProgress);

    if (!caseId) return null;

    // Update algorithm progress
    const prev = await this.repo.getAlgorithmProgress(caseId);
    const correctStreak = verdict === "correct" ? (prev?.correctStreak ?? 0) + 1 : 0;
    const totalAttempts = (prev?.totalAttempts ?? 0) + 1;

    if (metricKind === 'recognition') {
      // Recognition: only accuracy + SRS. Preserve execution time metrics untouched.
      const recAttempts = (prev?.recognitionAttempts ?? 0) + 1;
      const recCorrect = prev
        ? Math.round((prev.recognitionAccuracy / 100) * prev.recognitionAttempts) + (verdict === "correct" ? 1 : 0)
        : (verdict === "correct" ? 1 : 0);
      const recognitionAccuracy = Math.round((recCorrect / recAttempts) * 100);

      const quality = verdictToQuality(verdict, 0, 0); // no time signal → 4/2
      const { ease, interval } = computeSM2(
        quality,
        prev?.srsEaseFactor ?? DEFAULT_EASE_FACTOR,
        prev?.srsIntervalDays ?? 0,
      );

      // Mastery blends recognition accuracy (speed weight neutralized).
      const mastery = computeMastery(recCorrect, recAttempts, correctStreak, 1);

      const progress: AlgorithmProgressRecord = {
        algorithmId: caseId,
        mastery,
        accuracy: prev?.accuracy ?? 0, // execution accuracy untouched
        bestTimeMs: prev?.bestTimeMs ?? 0,
        avgTimeMs: prev?.avgTimeMs ?? 0,
        totalAttempts,
        correctStreak,
        lastPracticedAt: now,
        srsNextReviewAt: verdict !== "skipped" ? now + interval * 86400000 : prev?.srsNextReviewAt ?? now,
        srsIntervalDays: interval,
        srsEaseFactor: ease,
        recognitionAccuracy,
        recognitionAttempts: recAttempts,
        srsStability: prev?.srsStability ?? 0,
        srsDifficulty: prev?.srsDifficulty ?? 5,
        srsState: prev?.srsState ?? "new",
        srsLapses: prev?.srsLapses ?? 0,
        srsReviewCount: prev?.srsReviewCount ?? 0,
        lastReviewAt: prev?.lastReviewAt ?? 0,
      };

      await this.repo.upsertAlgorithmProgress(progress);
      return progress;
    }

    // Execution path. Reconstruct counts over EXECUTION-ONLY attempts so that
    // interleaved recognition attempts (which share totalAttempts) never
    // corrupt execution accuracy or average time.
    const execAttempts = prev ? Math.max((prev.totalAttempts ?? 0) - (prev.recognitionAttempts ?? 0), 0) : 0;
    const bestTimeMs = prev ? (prev.bestTimeMs > 0 ? Math.min(prev.bestTimeMs, timeMs) : timeMs) : timeMs;
    const correctCount = prev && execAttempts > 0
      ? Math.round((prev.accuracy / 100) * execAttempts) + (verdict === "correct" ? 1 : 0)
      : (verdict === "correct" ? 1 : 0);
    const execTotal = execAttempts + 1;
    const accuracy = Math.round((correctCount / execTotal) * 100);
    const avgTimeMs = prev && execAttempts > 0
      ? Math.round((prev.avgTimeMs * execAttempts + timeMs) / execTotal)
      : timeMs;

    const quality = verdictToQuality(verdict, timeMs, bestTimeMs);
    const avgTimeRatio = bestTimeMs > 0 ? avgTimeMs / bestTimeMs : 1;
    const mastery = computeMastery(correctCount, totalAttempts, correctStreak, avgTimeRatio);

    const { ease, interval } = computeSM2(
      quality,
      prev?.srsEaseFactor ?? DEFAULT_EASE_FACTOR,
      prev?.srsIntervalDays ?? 0,
    );

    const progress: AlgorithmProgressRecord = {
      algorithmId: caseId,
      mastery,
      accuracy,
      bestTimeMs,
      avgTimeMs,
      totalAttempts,
      correctStreak,
      lastPracticedAt: now,
      srsNextReviewAt: verdict !== "skipped" ? now + interval * 86400000 : prev?.srsNextReviewAt ?? now,
      srsIntervalDays: interval,
      srsEaseFactor: ease,
      recognitionAccuracy: prev?.recognitionAccuracy ?? 0,
      recognitionAttempts: prev?.recognitionAttempts ?? 0,
      srsStability: prev?.srsStability ?? 0,
      srsDifficulty: prev?.srsDifficulty ?? 5,
      srsState: prev?.srsState ?? "new",
      srsLapses: prev?.srsLapses ?? 0,
      srsReviewCount: prev?.srsReviewCount ?? 0,
      lastReviewAt: prev?.lastReviewAt ?? 0,
    };

    await this.repo.upsertAlgorithmProgress(progress);
    return progress;
  }

  /**
   * Get progress for a specific algorithm case.
   * Returns default values if no progress exists yet.
   */
  async getCaseProgress(algorithmId: string): Promise<AlgorithmProgressRecord> {
    const progress = await this.repo.getAlgorithmProgress(algorithmId);
    return (
      progress ?? {
        algorithmId,
        mastery: 0,
        accuracy: 0,
        bestTimeMs: 0,
        avgTimeMs: 0,
        totalAttempts: 0,
        correctStreak: 0,
        lastPracticedAt: 0,
        srsNextReviewAt: 0,
        srsIntervalDays: 0,
        srsEaseFactor: DEFAULT_EASE_FACTOR,
        recognitionAccuracy: 0,
        recognitionAttempts: 0,
        srsStability: 0,
        srsDifficulty: 5,
        srsState: "new",
        srsLapses: 0,
        srsReviewCount: 0,
        lastReviewAt: 0,
      }
    );
  }

  /**
   * Get all algorithm progress for a subset, sorted by weakest first.
   */
  async getSubsetProgress(subsetId: string): Promise<AlgorithmProgressRecord[]> {
    return this.repo.getAlgorithmProgressBySubset(subsetId);
  }

  /**
   * Get the weakest algorithms in a subset (for targeted practice).
   */
  async getWeakestCases(subsetId: string, limit = 5): Promise<AlgorithmProgressRecord[]> {
    return this.repo.getWeakestAlgorithms(subsetId, limit);
  }

  /**
   * Get algorithms due for SRS review.
   */
  async getDueForReview(limit = 20): Promise<AlgorithmProgressRecord[]> {
    return this.repo.getDueForReview(limit);
  }

  /**
   * Get overall method mastery (average of all algorithm masteries).
   */
  async getMethodMastery(methodId: string): Promise<number> {
    return this.repo.getMethodMastery(methodId);
  }

  /**
   * Get per-phase aggregate stats for phase-level weakness detection.
   */
  async getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStatsRecord | null> {
    return this.repo.getPhaseStats(methodId, phaseId);
  }

  /**
   * Get exercise progress for a method.
   */
  async getMethodExerciseProgress(methodId: string): Promise<ExerciseProgressRecord[]> {
    return this.repo.getMethodExerciseProgress(methodId);
  }
}
