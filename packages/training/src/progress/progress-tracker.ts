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
import { buildDailyQueue, toFSRSRecord } from "./scheduler";
import type { QueueCandidate, QueueItem } from "./scheduler";
import { review as fsrsReview, FSRS_DEFAULTS } from "./fsrs";
import type { FSRSRecord, SRSGrade } from "./fsrs";
import { computeSRSInsights } from "./insights";
import type { SRSInsights } from "./insights";

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
  /** Enumerate catalog cases + FSRS progress (null for never-practiced). */
  getQueueCandidates(methodId?: string): Promise<QueueCandidateRecord[]>;
  getExerciseProgress(exerciseId: string, methodId: string, phaseId?: string): Promise<ExerciseProgressRecord | null>;
  upsertExerciseProgress(progress: ExerciseProgressRecord): Promise<ExerciseProgressRecord>;
  getMethodExerciseProgress(methodId: string): Promise<ExerciseProgressRecord[]>;
  getMethodMastery(methodId: string): Promise<number>;
  /** Method mastery with coverage/performance breakdown (dashboards). */
  getMethodProgress?(methodId: string): Promise<MethodProgressBreakdown | null>;
  /** Per-phase aggregate stats (avg time, accuracy, efficiency) for phase weakness detection. */
  getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStatsRecord | null>;
  createTrainingSession?(session: Omit<TrainingSessionProgressRecord, "completedAt" | "durationMs" | "status" | "totalAttempts" | "correctCount" | "accuracy" | "avgTimeMs">): Promise<TrainingSessionProgressRecord>;
  completeTrainingSession?(id: string, completedAt?: number): Promise<TrainingSessionProgressRecord | null>;
  getTrainingSessions?(methodId: string, phaseId?: string, limit?: number): Promise<TrainingSessionProgressRecord[]>;
  /** Stamp the FSRS grade onto the most recent attempt for a case (SRS review flow). */
  updateAttemptReviewGrade?(caseId: string, reviewGrade: string): Promise<void>;
  /** Delete all training progress (attempts, algorithm/exercise progress, training sessions). */
  clearAllData?(): Promise<void>;
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
  /** FSRS review grade (again|hard|good|easy) — set only by the SRS review flow. */
  reviewGrade?: string;
  metricKind?: MetricKind;
  sessionId?: string;
  timestamp: number;
}

export interface AlgorithmProgressRecord {
  algorithmId: string;
  mastery: number;
  accuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  /** Total attempts (execution + recognition). Derived: execAttempts + recognitionAttempts. */
  totalAttempts: number;
  /** Exact execution attempt count (time-based drills). */
  execAttempts: number;
  /** Exact execution correct count (drives `accuracy`). */
  execCorrect: number;
  /** Exact recognition correct count (drives `recognitionAccuracy`). */
  recognitionCorrect: number;
  /** Consecutive correct execution attempts. Recognition misses never reset it. */
  correctStreak: number;
  lastPracticedAt: number;
  srsNextReviewAt: number;
  srsIntervalDays: number;
  srsEaseFactor: number;
  recognitionAccuracy: number;
  recognitionAttempts: number;
  /** Consecutive correct recognition attempts (independent of the exec streak). */
  recognitionStreak: number;
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

/** One catalog case + its FSRS progress (progress null if never practiced). */
export interface QueueCandidateRecord {
  caseId: string;
  subsetId: string;
  caseNumber: string;
  caseName: string;
  methodId: string;
  subsetName: string;
  progress: AlgorithmProgressRecord | null;
}

export interface ExerciseProgressRecord {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  totalSessions: number;
  totalAttempts: number;
  /** Exact execution attempt count (time-bearing drills). */
  execAttempts: number;
  /** Exact execution correct count (drives exercise-level accuracy). */
  execCorrect: number;
  bestAccuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  lastPracticedAt: number;
}

/** Per-phase aggregate stats derived from training attempts. */
export interface TrainingSessionProgressRecord {
  id: string;
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  startedAt: number;
  completedAt?: number;
  durationMs: number;
  smartCubeUsed: boolean;
  status: "active" | "completed";
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  avgTimeMs: number;
}

export interface PhaseStatsRecord {
  methodId: string;
  phaseId: string;
  /** Total attempts (execution + recognition). */
  totalAttempts: number;
  /** EXECUTION-ONLY accuracy 0-100 — recognition attempts never dilute it. */
  accuracy: number;
  /** Exact execution attempt count. */
  execAttempts: number;
  /** Execution-only accuracy 0-100 (same as `accuracy`, kept explicit). */
  execAccuracy: number;
  /** Exact recognition attempt count. */
  recAttempts: number;
  /** Recognition-only accuracy 0-100. */
  recAccuracy: number;
  avgTimeMs: number;
  bestTimeMs: number;
  /** Execution fail rate 0-1 (incorrect + dnf / execution attempts). */
  failRate: number;   // 0-1
  efficiency: number; // 0-1 (optimal_moves / move_count)
  lastPracticedAt: number;
}

/** Method-level mastery breakdown: breadth (coverage) × depth (performance). */
export interface MethodProgressBreakdown {
  methodId: string;
  /** Weighted mastery 0-100 = round(performance × coverage). */
  mastery: number;
  /** Fraction of the method's cases practiced (0-1). */
  coverage: number;
  /** Average mastery of PRACTICED cases only (0-100). */
  performance: number;
  totalCases: number;
  practicedCases: number;
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

/**
 * Mastery weights — single source of truth for how mastery balances
 * accuracy, consistency (streak) and speed. Exported so the UI renders
 * the exact same numbers the tracker computes.
 */
export const MASTERY_WEIGHTS = {
  accuracy: 0.5,
  streak: 0.2,
  speed: 0.3,
} as const;

/**
 * Compute a 0-100 mastery score from per-kind counters.
 *
 * - accuracyScore: correct / attempts (the caller passes EXECUTION-ONLY or
 *   RECOGNITION-ONLY counters — never a mixed denominator).
 * - streakScore: capped at 10 consecutive correct (0-100).
 * - speedScore: 100 at the best time, 0 at 2× best or slower.
 */
export function computeMastery(
  correctCount: number,
  totalAttempts: number,
  currentStreak: number,
  avgTimeRatio: number, // avgTimeMs / bestTimeMs (1.0 = at best, higher = slower)
): number {
  if (totalAttempts <= 0) return 0;

  const accuracyScore = (correctCount / totalAttempts) * 100;
  const streakScore = Math.min(currentStreak, 10) * 10; // 0-100, caps at 10 streak
  const speedScore = Math.max(0, Math.min(100, (2 - avgTimeRatio) * 100)); // 1.0 ratio = 100, 2.0+ = 0

  return Math.round(
    accuracyScore * MASTERY_WEIGHTS.accuracy +
      streakScore * MASTERY_WEIGHTS.streak +
      speedScore * MASTERY_WEIGHTS.speed,
  );
}

// ─── Counter normalization (pre-v2 records lack exact exec/rec counters) ──

/**
 * Derive exact execution/recognition counters from a possibly-legacy record
 * (rows persisted before the counter columns existed). Idempotent — records
 * that already carry exact counters pass through untouched.
 */
export function normalizeAlgorithmProgress(p: AlgorithmProgressRecord): AlgorithmProgressRecord {
  const recAttempts = p.recognitionAttempts ?? 0;
  const execAttempts = p.execAttempts ?? Math.max((p.totalAttempts ?? 0) - recAttempts, 0);
  return {
    ...p,
    execAttempts,
    execCorrect: p.execCorrect ?? Math.round(((p.accuracy ?? 0) / 100) * execAttempts),
    recognitionCorrect:
      p.recognitionCorrect ?? Math.round(((p.recognitionAccuracy ?? 0) / 100) * recAttempts),
    recognitionStreak: p.recognitionStreak ?? 0,
    totalAttempts: execAttempts + recAttempts,
  };
}

/** Derive exact exercise-level counters from a possibly-legacy record. */
export function normalizeExerciseProgress(p: ExerciseProgressRecord): ExerciseProgressRecord {
  return {
    ...p,
    execAttempts: p.execAttempts ?? (p.totalAttempts ?? 0),
    execCorrect: p.execCorrect ?? 0,
  };
}

function execCountersOf(prev?: AlgorithmProgressRecord | null): {
  execAttempts: number;
  execCorrect: number;
} {
  const p = prev ? normalizeAlgorithmProgress(prev) : null;
  return { execAttempts: p?.execAttempts ?? 0, execCorrect: p?.execCorrect ?? 0 };
}

function recCountersOf(prev?: AlgorithmProgressRecord | null): {
  recAttempts: number;
  recCorrect: number;
} {
  const p = prev ? normalizeAlgorithmProgress(prev) : null;
  return { recAttempts: p?.recognitionAttempts ?? 0, recCorrect: p?.recognitionCorrect ?? 0 };
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
    sessionId?: string;
    timeMs: number;
    verdict: AttemptVerdict;
    playMode: PlayMode;
    scramble: string;
    metricKind?: MetricKind;
    /** Standalone recognition also advances the FSRS state machine (Recognize quiz). */
    advanceSRS?: boolean;
    moveCount?: number;
    optimalMoves?: number;
    tps?: number;
    rotationCount?: number;
    /** Optional FSRS review grade to tag this attempt (SRS review flow). */
    reviewGrade?: SRSGrade;
  }): Promise<AlgorithmProgressRecord | null> {
    const {
      exerciseId, methodId, phaseId, caseId, timeMs, verdict, playMode, scramble,
      metricKind = 'execution', advanceSRS = false, moveCount, optimalMoves, tps, rotationCount, reviewGrade,
    } = params;
    const isExecutionAttempt = metricKind === 'execution';

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
      reviewGrade,
      metricKind,
      sessionId: params.sessionId,
      timestamp: now,
    });

    // Update exercise progress — ALWAYS (even without caseId).
    // Only EXECUTION attempts with a real time carry the time metrics: avg is
    // computed over exec-only attempts so recognition quizzes (timeMs=0) can
    // never dilute exercise best/avg time. totalSessions starts at 0 — it is
    // incremented when a training session completes, never per attempt.
    const rawEx = await this.repo.getExerciseProgress(exerciseId, methodId, phaseId);
    const exPrev = rawEx ? normalizeExerciseProgress(rawEx) : null;
    const hasTime = timeMs > 0 && isExecutionAttempt;
    const exPrevExecAttempts = exPrev?.execAttempts ?? 0;
    const exExecAttempts = exPrevExecAttempts + (hasTime ? 1 : 0);
    const exProgress: ExerciseProgressRecord = {
      exerciseId,
      methodId,
      phaseId,
      totalSessions: exPrev?.totalSessions ?? 0,
      totalAttempts: (exPrev?.totalAttempts ?? 0) + 1,
      execAttempts: exExecAttempts,
      execCorrect: (exPrev?.execCorrect ?? 0) + (hasTime && verdict === "correct" ? 1 : 0),
      bestAccuracy: Math.max(exPrev?.bestAccuracy ?? 0, verdict === "correct" ? 100 : 0),
      bestTimeMs: hasTime
        ? exPrev && exPrev.bestTimeMs > 0 ? Math.min(exPrev.bestTimeMs, timeMs) : timeMs
        : (exPrev?.bestTimeMs ?? 0),
      avgTimeMs: hasTime
        ? exPrev && exPrevExecAttempts > 0
          ? Math.round((exPrev.avgTimeMs * exPrevExecAttempts + timeMs) / exExecAttempts)
          : timeMs
        : (exPrev?.avgTimeMs ?? 0),
      lastPracticedAt: now,
    };
    await this.repo.upsertExerciseProgress(exProgress);

    if (!caseId) return null;

    // Update algorithm progress
    const prevRaw = await this.repo.getAlgorithmProgress(caseId);
    const prev = prevRaw ? normalizeAlgorithmProgress(prevRaw) : null;
    // A practice attempt must never clobber an existing FSRS schedule with
    // SM-2 math: drilling a case only updates mastery/accuracy/time. Once a
    // case has been graded (or entered an FSRS state), its review date,
    // interval and ease belong to the FSRS state machine (recordReview /
    // advanceSRS). Only never-graded cases get the SM-2 bootstrap below so
    // they can enter the daily queue.
    const hasFSRS = prev
      ? (prev.srsReviewCount ?? 0) > 0 || (prev.srsStability ?? 0) > 0 || (prev.srsState ?? "new") !== "new"
      : false;

    if (metricKind === 'recognition') {
      // Recognition: only accuracy + SRS. Preserve execution time metrics untouched.
      const { recAttempts: prevRecAttempts, recCorrect: prevRecCorrect } = recCountersOf(prev);
      const recAttempts = prevRecAttempts + 1;
      const recCorrect = prevRecCorrect + (verdict === "correct" ? 1 : 0);
      const recognitionAccuracy = Math.round((recCorrect / recAttempts) * 100);
      const recognitionStreak = verdict === "correct" ? (prev?.recognitionStreak ?? 0) + 1 : 0;

      const quality = verdictToQuality(verdict, 0, 0); // no time signal → 4/2
      const { ease, interval } = computeSM2(
        quality,
        prev?.srsEaseFactor ?? DEFAULT_EASE_FACTOR,
        prev?.srsIntervalDays ?? 0,
      );

      // Mastery = max(recognition mastery, execution mastery). Recognition uses
      // its own counters + its own streak; execution mastery (recomputed from
      // prev counters) is preserved, so a recognition miss can never erode
      // drill progress and vice versa.
      const recMastery = computeMastery(recCorrect, recAttempts, recognitionStreak, 1);
      const { execAttempts: prevExecAttempts, execCorrect: prevExecCorrect } = execCountersOf(prev);
      const execMastery = prevExecAttempts > 0
        ? computeMastery(
            prevExecCorrect,
            prevExecAttempts,
            prev?.correctStreak ?? 0,
            prev && prev.bestTimeMs > 0 ? prev.avgTimeMs / prev.bestTimeMs : 1,
          )
        : 0;
      const mastery = Math.max(execMastery, recMastery);

      // When advanceSRS is set (standalone Recognize quiz), a recognition also
      // advances the FSRS state machine — correct → "good", miss → "again" —
      // so recognizing cases moves the SRS stats, not just recognitionAccuracy.
      // In the SRS review flow this stays OFF: grading (recordReview) owns FSRS.
      let fsrs: {
        srsNextReviewAt?: number;
        srsIntervalDays?: number;
        srsStability?: number;
        srsDifficulty?: number;
        srsState?: AlgorithmProgressRecord["srsState"];
        srsLapses?: number;
        srsReviewCount?: number;
        lastReviewAt?: number;
      } = {};
      if (advanceSRS) {
        const grade: SRSGrade = verdict === "correct" ? "good" : "again";
        const record: FSRSRecord = prev ? toFSRSRecord(prev) : { ...FSRS_DEFAULTS };
        const next = fsrsReview(record, grade, now);
        fsrs = {
          srsNextReviewAt: next.nextReviewAt,
          srsIntervalDays: next.intervalDays,
          srsStability: next.stability,
          srsDifficulty: next.difficulty,
          srsState: next.state,
          srsLapses: next.lapses,
          srsReviewCount: next.reviewCount,
          lastReviewAt: next.lastReviewAt,
        };
      }

      const progress: AlgorithmProgressRecord = {
        algorithmId: caseId,
        mastery,
        accuracy: prev?.accuracy ?? 0, // execution accuracy untouched
        bestTimeMs: prev?.bestTimeMs ?? 0,
        avgTimeMs: prev?.avgTimeMs ?? 0,
        totalAttempts: prevExecAttempts + recAttempts,
        execAttempts: prevExecAttempts,
        execCorrect: prevExecCorrect,
        correctStreak: prev?.correctStreak ?? 0, // exec streak preserved
        lastPracticedAt: now,
        // advanceSRS writes the FSRS schedule; otherwise preserve an existing
        // FSRS schedule, only bootstrapping SM-2 for never-graded cases.
        srsNextReviewAt: fsrs.srsNextReviewAt ?? (hasFSRS
          ? (prev?.srsNextReviewAt ?? now)
          : (verdict !== "skipped" ? now + interval * 86400000 : prev?.srsNextReviewAt ?? now)),
        srsIntervalDays: fsrs.srsIntervalDays ?? (hasFSRS ? (prev?.srsIntervalDays ?? interval) : interval),
        srsEaseFactor: hasFSRS ? (prev?.srsEaseFactor ?? ease) : ease,
        recognitionAccuracy,
        recognitionAttempts: recAttempts,
        recognitionCorrect: recCorrect,
        recognitionStreak,
        srsStability: fsrs.srsStability ?? prev?.srsStability ?? 0,
        srsDifficulty: fsrs.srsDifficulty ?? prev?.srsDifficulty ?? 5,
        srsState: fsrs.srsState ?? prev?.srsState ?? "new",
        srsLapses: fsrs.srsLapses ?? prev?.srsLapses ?? 0,
        srsReviewCount: fsrs.srsReviewCount ?? prev?.srsReviewCount ?? 0,
        lastReviewAt: fsrs.lastReviewAt ?? prev?.lastReviewAt ?? 0,
      };

      await this.repo.upsertAlgorithmProgress(progress);
      return progress;
    }

    // Execution path — exact counters with an EXECUTION-ONLY denominator, so
    // interleaved recognition attempts (which share totalAttempts) can never
    // dilute execution accuracy, average time, or mastery.
    const { execAttempts: prevExecAttempts, execCorrect: prevExecCorrect } = execCountersOf(prev);
    const execAttempts = prevExecAttempts + 1;
    const execCorrect = prevExecCorrect + (verdict === "correct" ? 1 : 0);
    const accuracy = Math.round((execCorrect / execAttempts) * 100);
    const bestTimeMs = prev ? (prev.bestTimeMs > 0 ? Math.min(prev.bestTimeMs, timeMs) : timeMs) : timeMs;
    const avgTimeMs = prev && prevExecAttempts > 0
      ? Math.round((prev.avgTimeMs * prevExecAttempts + timeMs) / execAttempts)
      : timeMs;

    const correctStreak = verdict === "correct" ? (prev?.correctStreak ?? 0) + 1 : 0;
    const quality = verdictToQuality(verdict, timeMs, bestTimeMs);
    const avgTimeRatio = bestTimeMs > 0 ? avgTimeMs / bestTimeMs : 1;
    const execMastery = computeMastery(execCorrect, execAttempts, correctStreak, avgTimeRatio);
    const { recAttempts: prevRecAttempts, recCorrect: prevRecCorrect } = recCountersOf(prev);
    const recMastery = prevRecAttempts > 0
      ? computeMastery(prevRecCorrect, prevRecAttempts, prev?.recognitionStreak ?? 0, 1)
      : 0;
    // Persisted mastery = best of both dimensions: an improving drill never
    // drops because a recognition quiz went badly, and vice versa.
    const mastery = Math.max(execMastery, recMastery);

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
      totalAttempts: execAttempts + prevRecAttempts,
      execAttempts,
      execCorrect,
      correctStreak,
      lastPracticedAt: now,
      // Drilling a graded case must not move its review date: the FSRS
      // schedule is owned by recordReview. Only brand-new cases get the
      // SM-2 bootstrap so they can enter the daily queue.
      srsNextReviewAt: hasFSRS
        ? (prev?.srsNextReviewAt ?? now)
        : (verdict !== "skipped" ? now + interval * 86400000 : prev?.srsNextReviewAt ?? now),
      srsIntervalDays: hasFSRS ? (prev?.srsIntervalDays ?? interval) : interval,
      srsEaseFactor: hasFSRS ? (prev?.srsEaseFactor ?? ease) : ease,
      recognitionAccuracy: prev?.recognitionAccuracy ?? 0,
      recognitionAttempts: prev?.recognitionAttempts ?? 0,
      recognitionCorrect: prevRecCorrect,
      recognitionStreak: prev?.recognitionStreak ?? 0,
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
   * Apply one graded FSRS review (again|hard|good|easy) to a case and
   * persist the updated SRS schedule.
   *
   * This is the ONLY path that advances the FSRS state machine
   * (new → learning → review → relearning) and updates stability /
   * difficulty / lapses. Practice attempts recorded via `recordAttempt`
   * intentionally preserve the SRS fields (they bridge `prev.srs*`), so
   * the review flow composes as:
   *   recordAttempt({ ... })  → metrics + attempt history
   *   recordReview({ grade }) → the FSRS schedule itself
   *
   * Returns the updated algorithm progress.
   */
  async recordReview(params: {
    caseId: string;
    grade: SRSGrade;
    now?: number;
  }): Promise<AlgorithmProgressRecord> {
    const now = params.now ?? Date.now();
    const prevRaw = await this.repo.getAlgorithmProgress(params.caseId);
    const prev = prevRaw ? normalizeAlgorithmProgress(prevRaw) : null;

    // Bootstrap an FSRS record from whatever we know (defaults for never-reviewed cases).
    const record: FSRSRecord = prev ? toFSRSRecord(prev) : { ...FSRS_DEFAULTS };
    const next = fsrsReview(record, params.grade, now);

    const progress: AlgorithmProgressRecord = {
      algorithmId: params.caseId,
      mastery: prev?.mastery ?? 0,
      accuracy: prev?.accuracy ?? 0,
      bestTimeMs: prev?.bestTimeMs ?? 0,
      avgTimeMs: prev?.avgTimeMs ?? 0,
      totalAttempts: prev?.totalAttempts ?? 0,
      execAttempts: prev?.execAttempts ?? 0,
      execCorrect: prev?.execCorrect ?? 0,
      recognitionCorrect: prev?.recognitionCorrect ?? 0,
      recognitionStreak: prev?.recognitionStreak ?? 0,
      correctStreak: prev?.correctStreak ?? 0,
      lastPracticedAt: prev?.lastPracticedAt ?? now,
      srsNextReviewAt: next.nextReviewAt,
      srsIntervalDays: next.intervalDays,
      srsEaseFactor: prev?.srsEaseFactor ?? DEFAULT_EASE_FACTOR,
      recognitionAccuracy: prev?.recognitionAccuracy ?? 0,
      recognitionAttempts: prev?.recognitionAttempts ?? 0,
      srsStability: next.stability,
      srsDifficulty: next.difficulty,
      srsState: next.state,
      srsLapses: next.lapses,
      srsReviewCount: next.reviewCount,
      lastReviewAt: next.lastReviewAt,
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
    return normalizeAlgorithmProgress(
      progress ?? {
        algorithmId,
        mastery: 0,
        accuracy: 0,
        bestTimeMs: 0,
        avgTimeMs: 0,
        totalAttempts: 0,
        execAttempts: 0,
        execCorrect: 0,
        recognitionCorrect: 0,
        recognitionStreak: 0,
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
   * Build the daily SRS review queue (FSRS priority + new-cases cap +
   * contextual interference). Uses the real catalog + progress data.
   */
  async getTodayQueue(options: { methodId?: string; limit?: number; newPerDay?: number } = {}): Promise<QueueItem[]> {
    const raw = await this.repo.getQueueCandidates(options.methodId);
    const candidates: QueueCandidate[] = raw.map((r) => ({
      case: {
        algorithmId: r.caseId,
        subsetId: r.subsetId,
        caseNumber: r.caseNumber,
        name: r.caseName || undefined,
      },
      subset: r.methodId
        ? { subsetId: r.subsetId, methodId: r.methodId, name: r.subsetName || undefined }
        : null,
      progress: r.progress,
    }));
    return buildDailyQueue(candidates, options);
  }

  /**
   * Aggregate SRS insights (retention distribution, interval growth,
   * state breakdown, due projection) from the catalog + FSRS progress.
   */
  async getSRSInsights(methodId?: string): Promise<SRSInsights> {
    const candidates = await this.repo.getQueueCandidates(methodId);
    return computeSRSInsights(candidates);
  }

  /**
   * Get overall method mastery (coverage × performance of practiced cases).
   */
  async getMethodMastery(methodId: string): Promise<number> {
    return this.repo.getMethodMastery(methodId);
  }

  /**
   * Method mastery with the coverage/performance breakdown for dashboards.
   * Returns null when the backend does not expose the breakdown.
   */
  async getMethodProgress(methodId: string): Promise<MethodProgressBreakdown | null> {
    if (!this.repo.getMethodProgress) return null;
    return this.repo.getMethodProgress(methodId);
  }

  /**
   * Get per-phase aggregate stats for phase-level weakness detection.
   */
  async getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStatsRecord | null> {
    return this.repo.getPhaseStats(methodId, phaseId);
  }

  async createTrainingSession(session: Omit<TrainingSessionProgressRecord, "completedAt" | "durationMs" | "status" | "totalAttempts" | "correctCount" | "accuracy" | "avgTimeMs">): Promise<TrainingSessionProgressRecord> {
    if (!this.repo.createTrainingSession) throw new Error("Training session persistence is unavailable");
    return this.repo.createTrainingSession(session);
  }

  async completeTrainingSession(id: string, completedAt?: number): Promise<TrainingSessionProgressRecord | null> {
    if (!this.repo.completeTrainingSession) throw new Error("Training session persistence is unavailable");
    return this.repo.completeTrainingSession(id, completedAt);
  }

  async updateAttemptReviewGrade(caseId: string, reviewGrade: SRSGrade): Promise<void> {
    if (!this.repo.updateAttemptReviewGrade) throw new Error("Attempt grade persistence is unavailable");
    return this.repo.updateAttemptReviewGrade(caseId, reviewGrade);
  }

  async getTrainingSessions(methodId: string, phaseId?: string, limit = 50): Promise<TrainingSessionProgressRecord[]> {
    if (!this.repo.getTrainingSessions) return [];
    return this.repo.getTrainingSessions(methodId, phaseId, limit);
  }

  /**
   * Get exercise progress for a method.
   */
  async getMethodExerciseProgress(methodId: string): Promise<ExerciseProgressRecord[]> {
    return this.repo.getMethodExerciseProgress(methodId);
  }

  /**
   * Delete ALL training progress (attempts, algorithm/exercise progress,
   * training sessions). Exposes the repo's reset so the web layer can attach
   * a dev console helper without reaching into the repo directly.
   */
  async clearAllData(): Promise<void> {
    if (!this.repo.clearAllData) throw new Error("Training data reset is unavailable");
    return this.repo.clearAllData();
  }
}
