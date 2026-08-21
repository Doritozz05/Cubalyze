/**
 * @cubeforge/training — Deterministic aggregate replay
 *
 * `algorithm_progress` / `exercise_progress` are INCREMENTAL aggregates:
 * the live tracker read-modify-writes them on every attempt. Two devices
 * syncing those rows raw would fight (LWW on counters loses increments).
 *
 * The sync architecture instead NEVER syncs aggregates: only the immutable
 * attempt log is synced, and every device rebuilds the aggregates from it
 * via `replayProgress`. Because the replay drives the REAL ProgressTracker
 * (the same code the live app uses) through an in-memory repository, the
 * rebuilt state is bit-for-bit identical to what the live tracker would
 * have produced — no drift, no duplicated merge logic.
 *
 * Replay semantics (mirrors the live flows):
 *  - attempts are replayed in `timestamp` order;
 *  - an attempt carries its own timestamp as `now`, so FSRS spacing between
 *    attempts (elapsed days → retrievability) is reproduced exactly;
 *  - an attempt with a `reviewGrade` is a graded SRS review: `recordAttempt`
 *    (advanceSRS=false) followed by `recordReview(grade)` — the same two
 *    calls the review flow performs;
 *  - a recognition attempt WITHOUT a grade is a standalone Recognize quiz:
 *    `recordAttempt({ metricKind: 'recognition', advanceSRS: true })`.
 */

import { ProgressTracker } from "./progress-tracker";
import type {
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  ITrainingProgressRepo,
  PhaseStatsRecord,
  QueueCandidateRecord,
  TrainingAttemptRecord,
} from "./progress-tracker";
import type { SRSGrade } from "./fsrs";

/**
 * In-memory repository: the replay never touches disk or the network.
 * Only the attempt/progress methods are implemented — the read-only query
 * methods the ProgressTracker exposes (but recordAttempt does not call)
 * return empty/zero values.
 */
class InMemoryTrainingRepo implements ITrainingProgressRepo {
  readonly attempts = new Map<string, TrainingAttemptRecord>();
  readonly algorithmProgress = new Map<string, AlgorithmProgressRecord>();
  readonly exerciseProgress = new Map<string, ExerciseProgressRecord>();

  private sequence = 0;

  async insertAttempt(
    attempt: Omit<TrainingAttemptRecord, "id">,
  ): Promise<TrainingAttemptRecord> {
    const id = `replay-${++this.sequence}-${attempt.timestamp}`;
    const record: TrainingAttemptRecord = { ...attempt, id };
    this.attempts.set(id, record);
    return record;
  }

  async getExerciseProgress(
    exerciseId: string,
    methodId: string,
    phaseId?: string,
  ): Promise<ExerciseProgressRecord | null> {
    return (
      this.exerciseProgress.get(
        `${exerciseId}|${methodId}|${phaseId ?? ""}`,
      ) ?? null
    );
  }

  async upsertExerciseProgress(
    progress: ExerciseProgressRecord,
  ): Promise<ExerciseProgressRecord> {
    this.exerciseProgress.set(
      `${progress.exerciseId}|${progress.methodId}|${progress.phaseId ?? ""}`,
      progress,
    );
    return progress;
  }

  async getAlgorithmProgress(
    algorithmId: string,
  ): Promise<AlgorithmProgressRecord | null> {
    return this.algorithmProgress.get(algorithmId) ?? null;
  }

  async upsertAlgorithmProgress(
    progress: AlgorithmProgressRecord,
  ): Promise<AlgorithmProgressRecord> {
    this.algorithmProgress.set(progress.algorithmId, progress);
    return progress;
  }

  // ── Read-only queries (unused by the replay; stubbed) ──────────────
  async getAttemptsByCase(): Promise<TrainingAttemptRecord[]> {
    return [];
  }
  async getAttemptsByExercise(): Promise<TrainingAttemptRecord[]> {
    return [];
  }
  async getAttemptsByMethod(): Promise<TrainingAttemptRecord[]> {
    return [];
  }
  async getAlgorithmProgressBySubset(): Promise<AlgorithmProgressRecord[]> {
    return [];
  }
  async getWeakestAlgorithms(): Promise<AlgorithmProgressRecord[]> {
    return [];
  }
  async getDueForReview(): Promise<AlgorithmProgressRecord[]> {
    return [];
  }
  async getQueueCandidates(): Promise<QueueCandidateRecord[]> {
    return [];
  }
  async getMethodExerciseProgress(): Promise<ExerciseProgressRecord[]> {
    return [];
  }
  async getMethodMastery(): Promise<number> {
    return 0;
  }
  async getPhaseStats(): Promise<PhaseStatsRecord | null> {
    return null;
  }
}

/** A completed training session — only used to reconstruct `totalSessions`. */
export interface ReplaySessionRef {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
}

export interface ReplayResult {
  algorithmProgress: AlgorithmProgressRecord[];
  exerciseProgress: ExerciseProgressRecord[];
}

/**
 * Rebuild algorithm/exercise progress by replaying the full attempt log
 * through the real ProgressTracker. Pure and deterministic: same input,
 * same output.
 *
 * @param attempts  every training attempt (any order — sorted by timestamp)
 * @param sessions  completed training sessions, used to fill the
 *                  `totalSessions` counter (the live tracker increments it
 *                  outside recordAttempt, at session completion)
 */
export async function replayProgress(
  attempts: TrainingAttemptRecord[],
  sessions: ReplaySessionRef[] = [],
): Promise<ReplayResult> {
  const repo = new InMemoryTrainingRepo();
  const tracker = new ProgressTracker(repo);

  // Stable sort by timestamp (ties keep insertion order).
  const ordered = [...attempts].sort((a, b) => a.timestamp - b.timestamp);

  // The tracker is STATEful: each attempt builds on the previous one, so the
  // replay MUST await every step in order (no parallelism).
  for (const attempt of ordered) {
    const hasGrade = typeof attempt.reviewGrade === "string";
    const isRecognition = attempt.metricKind === "recognition";

    await tracker.recordAttempt({
      exerciseId: attempt.exerciseId,
      methodId: attempt.methodId,
      phaseId: attempt.phaseId,
      caseId: attempt.caseId,
      sessionId: attempt.sessionId,
      timeMs: attempt.timeMs,
      verdict: attempt.verdict,
      playMode: attempt.playMode,
      scramble: attempt.scramble,
      metricKind: attempt.metricKind,
      // Standalone Recognize quizzes (no grade) advanced the FSRS state
      // machine live via advanceSRS; graded reviews own FSRS via recordReview.
      advanceSRS: isRecognition && !hasGrade,
      reviewGrade: hasGrade ? (attempt.reviewGrade as SRSGrade) : undefined,
      moveCount: attempt.moveCount,
      optimalMoves: attempt.optimalMoves,
      tps: attempt.tps,
      rotationCount: attempt.rotationCount,
      now: attempt.timestamp,
    });

    if (hasGrade && attempt.caseId) {
      await tracker.recordReview({
        caseId: attempt.caseId,
        grade: attempt.reviewGrade as SRSGrade,
        now: attempt.timestamp,
      });
    }
  }

  // totalSessions is incremented at session completion, not per attempt —
  // reconstruct it from the completed training sessions log.
  const sessionCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = `${s.exerciseId}|${s.methodId}|${s.phaseId ?? ""}`;
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
  }
  const exerciseProgress = [...repo.exerciseProgress.values()].map((p) => {
    const key = `${p.exerciseId}|${p.methodId}|${p.phaseId ?? ""}`;
    return { ...p, totalSessions: sessionCounts.get(key) ?? 0 };
  });

  return {
    algorithmProgress: [...repo.algorithmProgress.values()],
    exerciseProgress,
  };
}
