import { describe, expect, it } from "vitest";
import { ProgressTracker } from "../progress-tracker";
import type {
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  ITrainingProgressRepo,
  TrainingAttemptRecord,
} from "../progress-tracker";
import { replayProgress } from "../replay";
import type { SRSGrade } from "../fsrs";

/**
 * A memory repo that mirrors the DB semantics of TrainingRepository closely
 * enough to drive the LIVE tracker: upsert semantics, per-case/exercise keys,
 * and a record of every attempt that lands (the replay input).
 */
class MemoryRepo implements ITrainingProgressRepo {
  attempts: TrainingAttemptRecord[] = [];
  algorithmProgress = new Map<string, AlgorithmProgressRecord>();
  exerciseProgress = new Map<string, ExerciseProgressRecord>();
  private seq = 0;

  async insertAttempt(attempt: Omit<TrainingAttemptRecord, "id">): Promise<TrainingAttemptRecord> {
    const id = `mem-${++this.seq}`;
    const record: TrainingAttemptRecord = { ...attempt, id };
    this.attempts.push(record);
    return record;
  }
  async getAttemptsByCase(): Promise<TrainingAttemptRecord[]> {
    return this.attempts;
  }
  async getAttemptsByExercise(): Promise<TrainingAttemptRecord[]> {
    return this.attempts;
  }
  async getAttemptsByMethod(): Promise<TrainingAttemptRecord[]> {
    return this.attempts;
  }
  async getAlgorithmProgress(algorithmId: string): Promise<AlgorithmProgressRecord | null> {
    return this.algorithmProgress.get(algorithmId) ?? null;
  }
  async upsertAlgorithmProgress(p: AlgorithmProgressRecord): Promise<AlgorithmProgressRecord> {
    this.algorithmProgress.set(p.algorithmId, p);
    return p;
  }
  async getAlgorithmProgressBySubset(): Promise<AlgorithmProgressRecord[]> {
    return [...this.algorithmProgress.values()];
  }
  async getWeakestAlgorithms(): Promise<AlgorithmProgressRecord[]> {
    return [...this.algorithmProgress.values()];
  }
  async getDueForReview(): Promise<AlgorithmProgressRecord[]> {
    return [...this.algorithmProgress.values()];
  }
  async getQueueCandidates(): Promise<never[]> {
    return [];
  }
  async updateAttemptReviewGrade(caseId: string, reviewGrade: string): Promise<void> {
    // Mirror the DB: the grade lands on the LATEST attempt for the case
    // (same subquery as TrainingRepository.updateAttemptReviewGrade).
    const matches = this.attempts.filter((a) => a.caseId === caseId);
    const latest = matches.sort((a, b) => a.timestamp - b.timestamp).at(-1);
    if (latest) latest.reviewGrade = reviewGrade;
  }
  async getExerciseProgress(exerciseId: string, methodId: string, phaseId?: string): Promise<ExerciseProgressRecord | null> {
    return this.exerciseProgress.get(`${exerciseId}|${methodId}|${phaseId ?? ""}`) ?? null;
  }
  async upsertExerciseProgress(p: ExerciseProgressRecord): Promise<ExerciseProgressRecord> {
    this.exerciseProgress.set(`${p.exerciseId}|${p.methodId}|${p.phaseId ?? ""}`, p);
    return p;
  }
  async getMethodExerciseProgress(): Promise<ExerciseProgressRecord[]> {
    return [...this.exerciseProgress.values()];
  }
  async getMethodMastery(): Promise<number> {
    return 0;
  }
  async getPhaseStats(): Promise<null> {
    return null;
  }
}

describe("replayProgress", () => {
  it("reproduces the live tracker state exactly for a drill + graded review sequence", async () => {
    const repo = new MemoryRepo();
    const tracker = new ProgressTracker(repo);

    // Day 0: three drill attempts on case C1 (execution, correct/incorrect mix).
    const t0 = 1_700_000_000_000;
    await tracker.recordAttempt({
      exerciseId: "drill-cfop-cross",
      methodId: "CFOP",
      phaseId: "cross",
      caseId: "case-c1",
      timeMs: 2100,
      verdict: "correct",
      playMode: "manual",
      scramble: "R U R'",
      now: t0,
    });
    await tracker.recordAttempt({
      exerciseId: "drill-cfop-cross",
      methodId: "CFOP",
      phaseId: "cross",
      caseId: "case-c1",
      timeMs: 2400,
      verdict: "incorrect",
      playMode: "manual",
      scramble: "R U R'",
      now: t0 + 60_000,
    });
    await tracker.recordAttempt({
      exerciseId: "drill-cfop-cross",
      methodId: "CFOP",
      phaseId: "cross",
      caseId: "case-c1",
      timeMs: 1900,
      verdict: "correct",
      playMode: "manual",
      scramble: "R U R'",
      now: t0 + 120_000,
    });

    // Day 3: graded SRS review (recordAttempt + recordReview, like the UI).
    await tracker.recordAttempt({
      exerciseId: "review-cfop",
      methodId: "CFOP",
      phaseId: "f2l",
      caseId: "case-c1",
      timeMs: 1800,
      verdict: "correct",
      playMode: "manual",
      scramble: "R U R'",
      now: t0 + 3 * 86_400_000,
    });
    await tracker.updateAttemptReviewGrade("case-c1", "good");
    await tracker.recordReview({ caseId: "case-c1", grade: "good", now: t0 + 3 * 86_400_000 });

    // Day 10: another review, this time "again".
    await tracker.recordAttempt({
      exerciseId: "review-cfop",
      methodId: "CFOP",
      phaseId: "f2l",
      caseId: "case-c1",
      timeMs: 2200,
      verdict: "incorrect",
      playMode: "manual",
      scramble: "R U R'",
      now: t0 + 10 * 86_400_000,
    });
    await tracker.updateAttemptReviewGrade("case-c1", "again");
    await tracker.recordReview({ caseId: "case-c1", grade: "again", now: t0 + 10 * 86_400_000 });

    // Standalone Recognize quiz (advanceSRS) on case-c2.
    await tracker.recordAttempt({
      exerciseId: "recognize-cfop",
      methodId: "CFOP",
      phaseId: "oll",
      caseId: "case-c2",
      timeMs: 0,
      verdict: "correct",
      playMode: "manual",
      scramble: "R U R'",
      metricKind: "recognition",
      advanceSRS: true,
      now: t0 + 5 * 86_400_000,
    });

    const expectedAlgorithm = [...repo.algorithmProgress.values()].sort((a, b) =>
      a.algorithmId.localeCompare(b.algorithmId),
    );
    const expectedExercise = [...repo.exerciseProgress.values()].sort((a, b) =>
      a.exerciseId.localeCompare(b.exerciseId),
    );

    // The replay input is exactly what the live tracker recorded.
    const result = await replayProgress(repo.attempts);

    expect(result.algorithmProgress.sort((a, b) => a.algorithmId.localeCompare(b.algorithmId))).toEqual(
      expectedAlgorithm,
    );
    expect(result.exerciseProgress.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId))).toEqual(
      expectedExercise,
    );
  });

  it("preserves FSRS spacing: replaying with real timestamps differs from Date.now() compression", async () => {
    const repo = new MemoryRepo();
    const tracker = new ProgressTracker(repo);

    const t0 = 1_700_000_000_000;
    // Two reviews 10 days apart.
    for (const [day, grade] of [
      [0, "good"],
      [10, "good"],
    ] as Array<[number, SRSGrade]>) {
      const now = t0 + day * 86_400_000;
      await tracker.recordAttempt({
        exerciseId: "review",
        methodId: "CFOP",
        caseId: "case-srs",
        timeMs: 2000,
        verdict: "correct",
        playMode: "manual",
        scramble: "R",
        now,
      });
      await tracker.updateAttemptReviewGrade("case-srs", grade);
      await tracker.recordReview({ caseId: "case-srs", grade, now });
    }
    const expected = repo.algorithmProgress.get("case-srs");
    const result = await replayProgress(repo.attempts);
    expect(result.algorithmProgress.find((a) => a.algorithmId === "case-srs")).toEqual(expected);

    // Sanity: the schedule really is day-spaced (nextReviewAt ~10 days after t0+10d).
    const replayed = result.algorithmProgress.find((a) => a.algorithmId === "case-srs")!;
    expect(replayed.srsReviewCount).toBe(2);
    expect(replayed.srsNextReviewAt).toBeGreaterThan(t0 + 10 * 86_400_000);
  });

  it("is deterministic: the same input yields the same output twice", async () => {
    const attempts: TrainingAttemptRecord[] = [
      {
        id: "a1",
        exerciseId: "drill",
        methodId: "CFOP",
        caseId: "c1",
        scramble: "R",
        timeMs: 2000,
        verdict: "correct",
        playMode: "manual",
        timestamp: 100,
      },
      {
        id: "a2",
        exerciseId: "drill",
        methodId: "CFOP",
        caseId: "c1",
        scramble: "R",
        timeMs: 2100,
        verdict: "correct",
        playMode: "manual",
        timestamp: 200,
      },
    ];
    const first = await replayProgress(attempts);
    const second = await replayProgress([...attempts].reverse());
    expect(first).toEqual(second);
  });
});
