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
   * Returns updated algorithm progress.
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
  }): Promise<AlgorithmProgressRecord | null> {
    const { exerciseId, methodId, phaseId, caseId, timeMs, verdict, playMode, scramble } = params;

    // Insert the raw attempt record
    await this.repo.insertAttempt({
      exerciseId,
      methodId,
      phaseId,
      caseId,
      scramble,
      timeMs,
      verdict,
      playMode,
      timestamp: Date.now(),
    });

    if (!caseId) return null;

    // Update algorithm progress
    const prev = await this.repo.getAlgorithmProgress(caseId);
    const bestTimeMs = prev ? (prev.bestTimeMs > 0 ? Math.min(prev.bestTimeMs, timeMs) : timeMs) : timeMs;
    const totalAttempts = (prev?.totalAttempts ?? 0) + 1;
    const correctCount = prev
      ? prev.totalAttempts > 0
        ? Math.round((prev.accuracy / 100) * prev.totalAttempts) + (verdict === "correct" ? 1 : 0)
        : verdict === "correct" ? 1 : 0
      : verdict === "correct" ? 1 : 0;
    const accuracy = Math.round((correctCount / totalAttempts) * 100);
    const avgTimeMs = prev
      ? Math.round((prev.avgTimeMs * (prev.totalAttempts) + timeMs) / totalAttempts)
      : timeMs;
    const correctStreak = verdict === "correct" ? (prev?.correctStreak ?? 0) + 1 : 0;

    const quality = verdictToQuality(verdict, timeMs, bestTimeMs);
    const avgTimeRatio = bestTimeMs > 0 ? avgTimeMs / bestTimeMs : 1;
    const mastery = computeMastery(correctCount, totalAttempts, correctStreak, avgTimeRatio);

    const { ease, interval } = computeSM2(
      quality,
      prev?.srsEaseFactor ?? DEFAULT_EASE_FACTOR,
      prev?.srsIntervalDays ?? 0,
    );

    const now = Date.now();
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
    };

    await this.repo.upsertAlgorithmProgress(progress);

    // Update exercise progress
    const exPrev = await this.repo.getExerciseProgress(exerciseId, methodId, phaseId);
    const exProgress: ExerciseProgressRecord = {
      exerciseId,
      methodId,
      phaseId,
      totalSessions: exPrev?.totalSessions ?? 1,
      totalAttempts: (exPrev?.totalAttempts ?? 0) + 1,
      bestAccuracy: Math.max(exPrev?.bestAccuracy ?? 0, accuracy),
      bestTimeMs: exPrev && exPrev.bestTimeMs > 0 ? Math.min(exPrev.bestTimeMs, timeMs) : timeMs,
      avgTimeMs: exPrev
        ? Math.round((exPrev.avgTimeMs * (exPrev.totalAttempts) + timeMs) / ((exPrev.totalAttempts) + 1))
        : timeMs,
      lastPracticedAt: now,
    };
    await this.repo.upsertExerciseProgress(exProgress);

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
   * Get exercise progress for a method.
   */
  async getMethodExerciseProgress(methodId: string): Promise<ExerciseProgressRecord[]> {
    return this.repo.getMethodExerciseProgress(methodId);
  }
}
