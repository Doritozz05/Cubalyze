import { describe, it, expect, vi } from 'vitest';
import { ProgressTracker, normalizeAlgorithmProgress } from '../progress-tracker.js';
import type {
  ITrainingProgressRepo,
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
} from '../progress-tracker.js';

/** In-memory fake repo (same pattern as progress-tracker.test.ts). */
function createFakeRepo(overrides: Partial<ITrainingProgressRepo> = {}): {
  repo: ITrainingProgressRepo;
  savedAlgorithmProgress: (AlgorithmProgressRecord | null)[];
  savedExerciseProgress: (ExerciseProgressRecord | null)[];
} {
  const algState = new Map<string, AlgorithmProgressRecord>();
  const exState = new Map<string, ExerciseProgressRecord>();
  const savedAlgorithmProgress: (AlgorithmProgressRecord | null)[] = [];
  const savedExerciseProgress: (ExerciseProgressRecord | null)[] = [];

  const repo: ITrainingProgressRepo = {
    insertAttempt: vi.fn(async (attempt) => ({ ...attempt, id: 'a1' })),
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

  return { repo, savedAlgorithmProgress, savedExerciseProgress };
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

describe('Invariant metric — execution and recognition are orthogonal', () => {
  it('recognition attempts NEVER touch exec counters, times or accuracy', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'incorrect', metricKind: 'recognition' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest).toMatchObject({
      execAttempts: 2,
      execCorrect: 2,
      accuracy: 100,
      bestTimeMs: 1000,
      avgTimeMs: 1000,
      recognitionAttempts: 3,
      recognitionCorrect: 2,
      recognitionAccuracy: 67,
      totalAttempts: 5,
    });
  });

  it('exact counters never drift regardless of attempt ordering', async () => {
    // Order A: all executions, then all recognitions.
    const { repo, savedAlgorithmProgress: savedA } = createFakeRepo();
    const tracker = new ProgressTracker(repo);
    const execs: Array<{ verdict: 'correct' | 'incorrect'; timeMs: number }> = [
      { verdict: 'correct', timeMs: 1000 },
      { verdict: 'incorrect', timeMs: 1500 },
      { verdict: 'correct', timeMs: 1100 },
      { verdict: 'correct', timeMs: 1050 },
    ];
    const recs: Array<{ verdict: 'correct' | 'incorrect' }> = [
      { verdict: 'correct' },
      { verdict: 'incorrect' },
      { verdict: 'correct' },
    ];
    for (const e of execs) {
      await tracker.recordAttempt({ ...baseParams, ...e, metricKind: 'execution' });
    }
    for (const r of recs) {
      await tracker.recordAttempt({ ...baseParams, timeMs: 0, ...r, metricKind: 'recognition' });
    }
    const a = savedA[savedA.length - 1];

    // Order B: the same multiset fully interleaved.
    const { repo: repo2, savedAlgorithmProgress: savedB } = createFakeRepo();
    const tracker2 = new ProgressTracker(repo2);
    const sequence: Array<{ metricKind: 'execution' | 'recognition'; verdict: 'correct' | 'incorrect'; timeMs: number }> = [
      { metricKind: 'execution', verdict: 'correct', timeMs: 1000 },
      { metricKind: 'recognition', verdict: 'correct', timeMs: 0 },
      { metricKind: 'execution', verdict: 'incorrect', timeMs: 1500 },
      { metricKind: 'recognition', verdict: 'incorrect', timeMs: 0 },
      { metricKind: 'execution', verdict: 'correct', timeMs: 1100 },
      { metricKind: 'recognition', verdict: 'correct', timeMs: 0 },
      { metricKind: 'execution', verdict: 'correct', timeMs: 1050 },
    ];
    for (const s of sequence) {
      await tracker2.recordAttempt({ ...baseParams, ...s });
    }
    const b = savedB[savedB.length - 1];

    expect(b).toMatchObject({
      execAttempts: a?.execAttempts,
      execCorrect: a?.execCorrect,
      accuracy: a?.accuracy,
      recognitionAttempts: a?.recognitionAttempts,
      recognitionCorrect: a?.recognitionCorrect,
      recognitionAccuracy: a?.recognitionAccuracy,
      totalAttempts: a?.totalAttempts,
      mastery: a?.mastery,
    });
    // Exact expected values for this multiset.
    expect(b?.execAttempts).toBe(4);
    expect(b?.execCorrect).toBe(3);
    expect(b?.accuracy).toBe(75);
    expect(b?.recognitionAttempts).toBe(3);
    expect(b?.recognitionCorrect).toBe(2);
    expect(b?.recognitionAccuracy).toBe(67);
    expect(b?.totalAttempts).toBe(7);
  });

  it('a correct fast execution attempt never lowers mastery', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    const m1 = savedAlgorithmProgress[0]?.mastery ?? 0;
    await tracker.recordAttempt({ ...baseParams, timeMs: 1100, verdict: 'correct', metricKind: 'execution' });
    const m2 = savedAlgorithmProgress[1]?.mastery ?? 0;
    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    const m3 = savedAlgorithmProgress[2]?.mastery ?? 0;

    expect(m1).toBeGreaterThan(0);
    expect(m2).toBeGreaterThanOrEqual(m1);
    expect(m3).toBeGreaterThanOrEqual(m2);
  });

  it('recognition misses never erode execution-driven mastery', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    const execMastery = savedAlgorithmProgress[1]?.mastery ?? 0;

    // A missed recognition right after must not lower mastery.
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'incorrect', metricKind: 'recognition' });
    const afterMiss = savedAlgorithmProgress[2]?.mastery ?? 0;
    expect(afterMiss).toBe(execMastery);

    // A later drill correct still raises it (the rec miss did not reset the exec streak).
    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    const final = savedAlgorithmProgress[3]?.mastery ?? 0;
    expect(final).toBeGreaterThanOrEqual(execMastery);
    expect(final).toBeGreaterThan(afterMiss);
  });

  it('execution and recognition streaks are tracked independently', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 1200, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'incorrect', metricKind: 'recognition' });
    const afterRecMiss = savedAlgorithmProgress[2];
    expect(afterRecMiss?.correctStreak).toBe(2); // exec streak untouched by rec miss
    expect(afterRecMiss?.recognitionStreak).toBe(0);

    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });
    const afterRecHit = savedAlgorithmProgress[3];
    expect(afterRecHit?.recognitionStreak).toBe(1);
    expect(afterRecHit?.correctStreak).toBe(2);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1400, verdict: 'incorrect', metricKind: 'execution' });
    const afterExecMiss = savedAlgorithmProgress[4];
    expect(afterExecMiss?.correctStreak).toBe(0);
    expect(afterExecMiss?.recognitionStreak).toBe(1); // rec streak untouched by exec miss
  });

  it('mastery accuracy component uses the execution-only denominator', async () => {
    const { repo, savedAlgorithmProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    // 3 correct + 1 incorrect executions (75%), plus 5 correct recognitions.
    for (let i = 0; i < 3; i++) {
      await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    }
    await tracker.recordAttempt({ ...baseParams, timeMs: 1500, verdict: 'incorrect', metricKind: 'execution' });
    for (let i = 0; i < 5; i++) {
      await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });
    }

    const latest = savedAlgorithmProgress[savedAlgorithmProgress.length - 1];
    expect(latest?.execAttempts).toBe(4);
    expect(latest?.accuracy).toBe(75); // NOT diluted by the 5 recognitions (8/9 ≈ 89%)
    expect(latest?.recognitionAccuracy).toBe(100);
    expect(latest?.totalAttempts).toBe(9);
  });
});

describe('Invariant metric — exercise', () => {
  it('exercise avg time is not diluted by recognition attempts', async () => {
    const { repo, savedExerciseProgress } = createFakeRepo();
    const tracker = new ProgressTracker(repo);

    await tracker.recordAttempt({ ...baseParams, timeMs: 1000, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 2000, verdict: 'correct', metricKind: 'execution' });
    await tracker.recordAttempt({ ...baseParams, timeMs: 0, verdict: 'correct', metricKind: 'recognition' });

    const ex = savedExerciseProgress[savedExerciseProgress.length - 1];
    expect(ex?.avgTimeMs).toBe(1500); // (1000+2000)/2, NOT diluted by the 0ms recognition
    expect(ex?.totalAttempts).toBe(3);
    expect(ex?.execAttempts).toBe(2);
    expect(ex?.execCorrect).toBe(2);
    expect(ex?.totalSessions).toBe(0); // sessions count on completion, never per attempt
  });
});

describe('normalizeAlgorithmProgress — legacy records without exact counters', () => {
  it('derives exact counters from rounded aggregate fields', () => {
    const legacy = {
      algorithmId: 'case-x',
      mastery: 50,
      accuracy: 67,
      bestTimeMs: 1000,
      avgTimeMs: 1500,
      totalAttempts: 4,
      correctStreak: 1,
      lastPracticedAt: 0,
      srsNextReviewAt: 0,
      srsIntervalDays: 0,
      srsEaseFactor: 2.5,
      recognitionAccuracy: 67,
      recognitionAttempts: 3,
      srsStability: 0,
      srsDifficulty: 5,
      srsState: 'new',
      srsLapses: 0,
      srsReviewCount: 0,
      lastReviewAt: 0,
    } as unknown as AlgorithmProgressRecord;

    const n = normalizeAlgorithmProgress(legacy);
    expect(n.execAttempts).toBe(1); // 4 - 3
    expect(n.execCorrect).toBe(1); // round(67% × 1)
    expect(n.recognitionCorrect).toBe(2); // round(67% × 3)
    expect(n.totalAttempts).toBe(4);
    // Idempotent: normalizing the normalized record changes nothing.
    expect(normalizeAlgorithmProgress(n)).toEqual(n);
  });
});
