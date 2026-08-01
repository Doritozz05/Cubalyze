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
  const state: { alg: AlgorithmProgressRecord | null; ex: ExerciseProgressRecord | null } = {
    alg: null,
    ex: null,
  };
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
    getAlgorithmProgress: vi.fn(async () => state.alg),
    upsertAlgorithmProgress: vi.fn(async (p) => {
      state.alg = p;
      savedAlgorithmProgress.push(p);
      return p;
    }),
    getAlgorithmProgressBySubset: vi.fn(async () => []),
    getWeakestAlgorithms: vi.fn(async () => []),
    getDueForReview: vi.fn(async () => []),
    getExerciseProgress: vi.fn(async () => state.ex),
    upsertExerciseProgress: vi.fn(async (p) => {
      state.ex = p;
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

  it('getPhaseStats delegates to the repo', async () => {
    const phase: PhaseStatsRecord = {
      methodId: 'cfop',
      phaseId: 'cross',
      totalAttempts: 10,
      accuracy: 80,
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
});
