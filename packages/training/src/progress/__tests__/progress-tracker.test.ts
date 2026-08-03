import { describe, it, expect, vi } from 'vitest';
import { ProgressTracker } from '../progress-tracker.js';
import type {
  ITrainingProgressRepo,
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  PhaseStatsRecord,
} from '../progress-tracker.js';

/** In-memory fake repo to verify ProgressTracker behavior without SQL. */
function createFakeRepo(overrides: Partial<ITrainingProgressRepo> = {}): {
  repo: ITrainingProgressRepo;
  insertedAttempts: Record<string, unknown>[];
  savedAlgorithmProgress: (AlgorithmProgressRecord | null)[];
  savedExerciseProgress: (ExerciseProgressRecord | null)[];
} {
  const algState = new Map<string, AlgorithmProgressRecord>();
  const exState = new Map<string, ExerciseProgressRecord>();
  const insertedAttempts: Record<string, unknown>[] = [];
  const savedAlgorithmProgress: (AlgorithmProgressRecord | null)[] = [];
  const savedExerciseProgress: (ExerciseProgressRecord | null)[] = [];

  const repo: ITrainingProgressRepo = {
    insertAttempt: vi.fn(async (attempt) => {
      insertedAttempts.push({ ...attempt } as unknown as Record<string, unknown>);
      return { ...attempt, id: 'a1' };
    }),
    getAttemptsByCase: vi.fn(async () => []),
    getAttemptsByExercise: vi.fn(async () => []),
    getAttemptsByMethod: vi.fn(async () => []),
    getAlgorithmProgress: vi.fn(async (algorithmId: string) => algState.get(algorithmId) ?? null),
    upsertAlgorithmProgress: vi.fn(async (p) => {
      algState.set(p.algorithmId, p);
      savedAlgorithmProgress.push(p);
      return p;
    }),
    getAlgorithmProgressBySubset: vi.fn(async () => []),
    getWeakestAlgorithms: vi.fn(async () => []),
    getDueForReview: vi.fn(async () => []),
    getQueueCandidates: vi.fn(async () => []),
    getExerciseProgress: vi.fn(async (exerciseId: string, methodId: string) =>
      exState.get(`${exerciseId}:${methodId}`) ?? null),
    upsertExerciseProgress: vi.fn(async (p) => {
      exState.set(`${p.exerciseId}:${p.methodId}`, p);
      savedExerciseProgress.push(p);
      return p;
    }),
    getMethodExerciseProgress: vi.fn(async () => []),
    getMethodMastery: vi.fn(async () => 0),
    getPhaseStats: vi.fn(async () => null),
    ...overrides,
  };

  return { repo, insertedAttempts, savedAlgorithmProgress, savedExerciseProgress };
}

const baseParams = {
  exerciseId: 'drill-pll',
  methodId: 'cfop',
  phaseId: 'pll',
  caseId: 'case-ua',
  timeMs: 1200,
  verdict: 'correct' as const,
  playMode: 'manual' as const,
  scramble: "R U' R'",
};

describe('ProgressTracker — recordAttempt', () => {
  it('updates exercise progress even WITHOUT caseId (every training contributes)', async () => {
    const { repo, savedExerciseProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    const result = await tracker.recordAttempt({
      exerciseId: 'cross-trainer-cross',
      methodId: 'cfop',
      phaseId: 'cross',
      timeMs: 2500,
      verdict: 'correct',
      playMode: 'manual',
      scramble: 'scramble',
    });

    expect(result).toBeNull(); // no caseId → no algorithm progress
    expect(savedExerciseProgress).toHaveLength(1);
    expect(savedExerciseProgress[0]).toMatchObject({
      exerciseId: 'cross-trainer-cross',
      methodId: 'cfop',
      phaseId: 'cross',
      totalAttempts: 1,
    });
  });

  it('passes efficiency metadata (moveCount/optimalMoves) into the raw attempt', async () => {
    const { repo, insertedAttempts } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({
      ...baseParams,
      moveCount: 12,
      optimalMoves: 8,
      tps: 4.2,
      rotationCount: 0,
    });

    expect(insertedAttempts[0]).toMatchObject({
      moveCount: 12,
      optimalMoves: 8,
      tps: 4.2,
      rotationCount: 0,
    });
  });

  it('recognition attempts update recognitionAccuracy but NEVER touch best/avg time', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    // Seed with an execution attempt first (bestTimeMs = 1200)
    await tracker.recordAttempt({ ...baseParams, metricKind: 'execution' });

    // Now a recognition attempt with timeMs 0 — must NOT reset time metrics
    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 0,
      verdict: 'correct',
      metricKind: 'recognition',
    });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest?.bestTimeMs).toBe(1200);
    expect(latest?.avgTimeMs).toBe(1200);
    expect(latest?.recognitionAccuracy).toBe(100);
    expect(latest?.recognitionAttempts).toBe(1);
  });

  it('recognition misses accumulate into recognitionAccuracy', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'incorrect', metricKind: 'recognition' });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest?.recognitionAccuracy).toBe(50);
    expect(latest?.recognitionAttempts).toBe(2);
  });

  it('execution attempts preserve existing recognition fields', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 1500, verdict: 'correct', metricKind: 'execution' });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest?.recognitionAccuracy).toBe(100);
    expect(latest?.recognitionAttempts).toBe(1);
    expect(latest?.bestTimeMs).toBe(1500);
  });

  it('interleaved recognition attempts do not corrupt execution accuracy/time', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    // 2 correct executions at 1000ms → execution accuracy 100%, best 1000
    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });

    // 1 correct recognition (timeMs 0) — must not reset time nor dilute execution accuracy
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });

    // 1 incorrect execution at 1500ms
    await tracker.recordAttempt({ ...baseParams, timeMs: 1500, verdict: 'incorrect', metricKind: 'execution' });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    // 3 executions: 2 correct + 1 incorrect → accuracy 67, NOT diluted by recognition
    expect(latest?.accuracy).toBe(67);
    expect(latest?.totalAttempts).toBe(4); // 3 execution + 1 recognition
    expect(latest?.recognitionAttempts).toBe(1);
    expect(latest?.bestTimeMs).toBe(1000);
    // avg over 3 executions: (1000 + 1000 + 1500) / 3
    expect(latest?.avgTimeMs).toBe(1167);
  });

  it('recognition with advanceSRS advances the FSRS state machine (correct → good)', async () => {
    const { repo } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;

    const result = await tracker.recordAttempt({
      ...baseParams,
      timeMs: 0,
      verdict: 'correct',
      metricKind: 'recognition',
      advanceSRS: true,
    });

    // First FSRS review with grade "good": new → review, stability 3, interval 3.
    expect(result?.srsState).toBe('review');
    expect(result?.srsReviewCount).toBe(1);
    expect(result?.srsStability).toBe(3);
    expect(result?.srsIntervalDays).toBe(3);
    expect(result?.srsLapses).toBe(0);
    expect(result?.lastReviewAt).toBeGreaterThan(0);
    expect(result?.srsNextReviewAt).toBeGreaterThan(now);
    // Recognition metrics still tracked; execution times untouched.
    expect(result?.recognitionAccuracy).toBe(100);
    expect(result?.bestTimeMs).toBe(0);
  });

  it('recognition with advanceSRS maps a miss to grade again (learning, 1d interval)', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 0,
      verdict: 'incorrect',
      metricKind: 'recognition',
      advanceSRS: true,
    });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    // First FSRS review with grade "again": new → learning, 1-day interval.
    expect(latest?.srsState).toBe('learning');
    expect(latest?.srsReviewCount).toBe(1);
    expect(latest?.srsIntervalDays).toBe(1);
    expect(latest?.srsStability).toBe(0.4);
    expect(latest?.recognitionAccuracy).toBe(0);
  });

  it('recognition WITHOUT advanceSRS leaves the FSRS state machine untouched', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 0,
      verdict: 'correct',
      metricKind: 'recognition',
    });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    // Legacy recognition path: only recognition accuracy + a light SM-2 schedule;
    // srsState/reviewCount/stability must NOT advance (grading owns FSRS there).
    expect(latest?.srsState).toBe('new');
    expect(latest?.srsReviewCount).toBe(0);
    expect(latest?.srsStability).toBe(0);
    expect(latest?.recognitionAccuracy).toBe(100);
  });

  it('recognition attempt as the very first attempt does not set bestTimeMs=0', async () => {
    const { repo, savedAlgorithmProgress, savedExerciseProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest?.bestTimeMs).toBe(0);
    expect(latest?.avgTimeMs).toBe(0);
    expect(latest?.recognitionAccuracy).toBe(100);

    // exercise_progress bestTimeMs must stay 0 (no fake time), not become negative/invalid
    const ex = savedExerciseProgress[savedExerciseProgress.length - 1];
    expect(ex?.bestTimeMs).toBe(0);
  });
});

describe('ProgressTracker — practice preserves the FSRS schedule', () => {
  const DAY_MS = 86_400_000;

  it('execution practice on a graded case must NOT clobber the FSRS schedule with SM-2', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;

    // Grade the case first → real FSRS schedule: review state, 3d interval, stability 3.
    await tracker.recordReview({ caseId: 'case-ua', grade: 'good', now });
    const scheduled = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(scheduled?.srsState).toBe('review');
    expect(scheduled?.srsNextReviewAt).toBe(now + 3 * DAY_MS);

    // Now practice it with a fast time — SM-2 would stretch the interval to ~8d
    // (round(3 × 2.5)); the FSRS schedule must stay untouched.
    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 1100,
      verdict: 'correct',
      metricKind: 'execution',
    });

    const after = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(after?.srsNextReviewAt).toBe(now + 3 * DAY_MS); // unchanged
    expect(after?.srsIntervalDays).toBe(3);
    expect(after?.srsEaseFactor).toBe(2.5);
    expect(after?.srsState).toBe('review');
    expect(after?.srsReviewCount).toBe(1);
    // Practice still updates mastery/accuracy.
    expect(after?.accuracy).toBe(100);
  });

  it('recognition practice on a graded case also preserves the FSRS schedule', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;

    await tracker.recordReview({ caseId: 'case-ua', grade: 'good', now });
    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 0,
      verdict: 'correct',
      metricKind: 'recognition',
      // advanceSRS off → recognition-only practice, must not move the schedule.
    });

    const after = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(after?.srsNextReviewAt).toBe(now + 3 * DAY_MS);
    expect(after?.srsIntervalDays).toBe(3);
    expect(after?.srsState).toBe('review');
    expect(after?.recognitionAccuracy).toBe(100);
  });

  it('execution practice on a never-graded case still bootstraps an SM-2 schedule', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const before = Date.now();

    await tracker.recordAttempt({
      ...baseParams,
      timeMs: 1200,
      verdict: 'correct',
      metricKind: 'execution',
    });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    // Never graded → 'new' state, no FSRS counters, but a future SM-2 bootstrap
    // review date so the case can enter the daily queue.
    expect(latest?.srsState).toBe('new');
    expect(latest?.srsReviewCount).toBe(0);
    expect(latest?.srsStability).toBe(0);
    expect(latest?.srsNextReviewAt ?? 0).toBeGreaterThanOrEqual(before);
  });
});

describe('ProgressTracker — recordReview (FSRS grading)', () => {
  it('first good review on a brand-new case graduates to review with a 3-day interval', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;

    const result = await tracker.recordReview({ caseId: 'case-ua', grade: 'good', now });

    expect(result.srsState).toBe('review');
    expect(result.srsStability).toBe(3); // INITIAL_STABILITY.good
    expect(result.srsIntervalDays).toBe(3);
    expect(result.srsReviewCount).toBe(1);
    expect(result.srsLapses).toBe(0);
    expect(result.lastReviewAt).toBe(now);
    expect(result.srsNextReviewAt).toBe(now + 3 * 86_400_000);
    expect(savedAlgorithmProgress).toHaveLength(1);
  });

  it('again on a review-state case moves to relearning and counts a lapse', async () => {
    const { repo } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;

    await tracker.recordReview({ caseId: 'case-ua', grade: 'good', now });
    const later = now + 3 * 86_400_000;
    const result = await tracker.recordReview({ caseId: 'case-ua', grade: 'again', now: later });

    expect(result.srsState).toBe('relearning');
    expect(result.srsLapses).toBe(1);
    expect(result.srsReviewCount).toBe(2);
    // Relearning after 'again' schedules a 0-day interval: re-review the
    // same day instead of waiting a full day (FSRS standard, plan §2.8).
    expect(result.srsIntervalDays).toBe(0);
  });

  it('hard review penalizes stability growth and raises difficulty vs good', async () => {
    const { repo } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const now = 1_700_000_000_000;
    const later = now + 3 * 86_400_000;

    // Same history on two independent cases, differing only in the 2nd grade.
    await tracker.recordReview({ caseId: 'case-a', grade: 'good', now });
    await tracker.recordReview({ caseId: 'case-b', grade: 'good', now });
    const hard = await tracker.recordReview({ caseId: 'case-a', grade: 'hard', now: later });
    const good = await tracker.recordReview({ caseId: 'case-b', grade: 'good', now: later });

    // Hard review applies a 0.8 stability penalty and difficulty +6 (clamped 10).
    expect(hard.srsStability).toBeLessThan(good.srsStability);
    expect(hard.srsDifficulty).toBe(10);
    expect(good.srsDifficulty).toBe(5);
  });

  it('recordReview preserves practice metrics (mastery/accuracy/time) untouched', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    const before = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(before?.mastery).toBeGreaterThan(0);

    const result = await tracker.recordReview({ caseId: 'case-ua', grade: 'good', now: 1_700_000_000_000 });

    expect(result.mastery).toBe(before?.mastery);
    expect(result.accuracy).toBe(before?.accuracy);
    expect(result.bestTimeMs).toBe(before?.bestTimeMs);
    expect(result.totalAttempts).toBe(before?.totalAttempts);
    // But the SRS schedule IS advanced.
    expect(result.srsState).toBe('review');
    expect(result.srsReviewCount).toBe(1);
  });

  it('recordAttempt forwards reviewGrade to the raw attempt row', async () => {
    const { repo, insertedAttempts } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, reviewGrade: 'good' });

    expect(insertedAttempts[0]).toMatchObject({ reviewGrade: 'good' });
    expect(insertedAttempts[0]).not.toHaveProperty('reviewGrade', undefined);
  });
});

describe('ProgressTracker — delegates', () => {
  it('getPhaseStats delegates to the repo', async () => {
    const phase: PhaseStatsRecord = {
      methodId: 'cfop',
      phaseId: 'cross',
      totalAttempts: 10,
      accuracy: 80,
      execAttempts: 8,
      execAccuracy: 80,
      recAttempts: 2,
      recAccuracy: 50,
      avgTimeMs: 2500,
      bestTimeMs: 1800,
      failRate: 0.2,
      efficiency: 0.75,
      lastPracticedAt: 1700000000000,
    };
    const { repo } = createFakeRepo({
      getPhaseStats: vi.fn(async () => phase),
    });
    const tracker = new ProgressTracker(repo);

    const result = await tracker.getPhaseStats('cfop', 'cross');
    expect(result).toEqual(phase);
  });

  it('clearAllData delegates to the repo reset', async () => {
    const clearAllData = vi.fn(async () => undefined);
    const { repo } = createFakeRepo({ clearAllData });
    const tracker = new ProgressTracker(repo);

    await tracker.clearAllData();
    expect(clearAllData).toHaveBeenCalledTimes(1);
  });

  it('clearAllData throws when the repo does not support resets', async () => {
    const { repo } = createFakeRepo({ clearAllData: undefined });
    const tracker = new ProgressTracker(repo);

    await expect(tracker.clearAllData()).rejects.toThrow("Training data reset is unavailable");
  });
});
