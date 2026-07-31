import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrainingRepository } from '../repositories/training.repository.js';

function mockDb(rows: Record<string, unknown>[] = []) {
  return vi
    .fn<(...args: unknown[]) => Promise<Record<string, unknown>[]>>()
    .mockResolvedValue(rows);
}

function attemptRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'attempt-1',
    exercise_id: 'ex1',
    method_id: 'method1',
    phase_id: null,
    subset_id: null,
    case_id: null,
    scramble: "R U R'",
    time_ms: 12345,
    verdict: 'correct',
    play_mode: 'manual',
    expected_moves: null,
    executed_moves: null,
    tps: 2.5,
    move_count: 12,
    rotation_count: 0,
    inspection_ms: 15000,
    timestamp: 1700000000000,
    ...overrides,
  };
}

function progressRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'progress-1',
    algorithm_id: 'alg1',
    mastery: 5,
    accuracy: 0.85,
    best_time_ms: 9000,
    avg_time_ms: 11000,
    total_attempts: 20,
    correct_streak: 4,
    last_practiced_at: 1700000000000,
    srs_next_review_at: 1700000864000,
    srs_interval_days: 1,
    srs_ease_factor: 2.5,
    ...overrides,
  };
}

function exerciseRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'ex-progress-1',
    exercise_id: 'ex1',
    method_id: 'method1',
    phase_id: null,
    total_sessions: 5,
    total_attempts: 50,
    best_accuracy: 0.9,
    best_time_ms: 8500,
    avg_time_ms: 10500,
    last_practiced_at: 1700000000000,
    ...overrides,
  };
}

describe('TrainingRepository — Attempts', () => {
  let repo: TrainingRepository;

  beforeEach(() => {
    repo = new TrainingRepository(mockDb());
  });

  it('insertAttempt generates an id and INSERTs with all columns', async () => {
    const db = mockDb();
    repo = new TrainingRepository(db);
    const attempt = await repo.insertAttempt({
      exerciseId: 'ex1',
      methodId: 'method1',
      scramble: "R U R'",
      timeMs: 12345,
      verdict: 'correct',
      playMode: 'manual',
      timestamp: 1700000000000,
    });
    expect(attempt.id).toBeDefined();
    expect(db.mock.calls[0][0]).toContain('INSERT INTO training_attempts');
    const bind = db.mock.calls[0][1] as unknown[];
    expect(bind[1]).toBe('ex1');
    expect(bind[2]).toBe('method1');
  });

  it('insertAttempt with all optional fields preserves them', async () => {
    const db = mockDb();
    repo = new TrainingRepository(db);
    await repo.insertAttempt({
      exerciseId: 'ex1',
      methodId: 'method1',
      phaseId: 'cross',
      subsetId: 'f2l',
      caseId: 'case1',
      scramble: 'U',
      timeMs: 5000,
      verdict: 'incorrect',
      playMode: 'smart-cube',
      expectedMoves: ['R', 'U'],
      executedMoves: [
        { face: 'R' as never, direction: 1, cubeTimestamp: 100, hostTimestamp: 100 },
      ],
      tps: 3.0,
      moveCount: 2,
      rotationCount: 1,
      inspectionMs: 20000,
      timestamp: 1700000000000,
    });
    const bind = db.mock.calls[0][1] as unknown[];
    // Column order in INSERT: id, exercise_id, method_id, phase_id, subset_id,
    //   case_id, scramble, time_ms, verdict, play_mode, expected_moves,
    //   executed_moves, tps, move_count, rotation_count, inspection_ms, timestamp
    expect(bind[3]).toBe('cross'); // phase_id
    expect(bind[4]).toBe('f2l'); // subset_id
    expect(bind[5]).toBe('case1'); // case_id
    expect(bind[7]).toBe(5000); // time_ms
    expect(bind[8]).toBe('incorrect'); // verdict
    expect(bind[9]).toBe('smart-cube'); // play_mode
    expect(typeof bind[10]).toBe('string'); // expected_moves JSON
    expect(typeof bind[11]).toBe('string'); // executed_moves JSON
    expect(bind[12]).toBe(3.0); // tps
    expect(bind[13]).toBe(2); // move_count
    expect(bind[14]).toBe(1); // rotation_count
    expect(bind[15]).toBe(20000); // inspection_ms
    expect(bind[16]).toBe(1700000000000); // timestamp
  });

  it('insertAttempt with missing optional fields stores NULL', async () => {
    const db = mockDb();
    repo = new TrainingRepository(db);
    await repo.insertAttempt({
      exerciseId: 'ex1',
      methodId: 'method1',
      scramble: 'U',
      timeMs: 5000,
      verdict: 'correct',
      playMode: 'manual',
      timestamp: 1700000000000,
    });
    const bind = db.mock.calls[0][1] as unknown[];
    // Column order in INSERT: id(0), exercise_id(1), method_id(2), phase_id(3),
    //   subset_id(4), case_id(5), scramble(6), time_ms(7), verdict(8), play_mode(9),
    //   expected_moves(10), executed_moves(11), tps(12), move_count(13),
    //   rotation_count(14), inspection_ms(15), timestamp(16)
    expect(bind[3]).toBeNull(); // phase_id
    expect(bind[4]).toBeNull(); // subset_id
    expect(bind[5]).toBeNull(); // case_id
    expect(bind[8]).toBe('correct'); // verdict
    expect(bind[9]).toBe('manual'); // play_mode
    expect(bind[10]).toBeNull(); // expected_moves
    expect(bind[11]).toBeNull(); // executed_moves
    expect(bind[12]).toBeNull(); // tps
    expect(bind[13]).toBeNull(); // move_count
    expect(bind[14]).toBeNull(); // rotation_count
    expect(bind[15]).toBeNull(); // inspection_ms
  });

  it('insertAttempt with no timestamp defaults to current time', async () => {
    const db = mockDb();
    repo = new TrainingRepository(db);
    const before = Date.now();
    await repo.insertAttempt({
      exerciseId: 'ex1',
      methodId: 'method1',
      scramble: 'U',
      timeMs: 5000,
      verdict: 'correct',
      playMode: 'manual',
      // intentionally omit timestamp
      timestamp: 0,
    });
    const bind = db.mock.calls[0][1] as unknown[];
    expect(bind[16]).toBeGreaterThanOrEqual(before); // timestamp
  });

  it('getAttemptsByCase queries by case_id with limit', async () => {
    const db = mockDb([attemptRow()]);
    repo = new TrainingRepository(db);
    await repo.getAttemptsByCase('case1', 25);
    expect(db).toHaveBeenCalledWith(
      'SELECT * FROM training_attempts WHERE case_id = ? ORDER BY timestamp DESC LIMIT ?',
      ['case1', 25],
    );
  });

  it('getAttemptsByCase uses default limit 50', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getAttemptsByCase('case1');
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      ['case1', 50],
    );
  });

  it('getAttemptsByExercise queries by exercise_id', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getAttemptsByExercise('ex1');
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('exercise_id = ?'),
      ['ex1', 50],
    );
  });

  it('getAttemptsByMethod uses method-specific limit 200', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getAttemptsByMethod('method1');
    expect(db).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), ['method1', 200]);
  });

  it('getAttemptsInRange filters by timestamp range', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getAttemptsInRange(100, 200);
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('timestamp >= ? AND timestamp <= ?'),
      [100, 200],
    );
  });

  it('maps attempt row with all fields present', async () => {
    const db = mockDb([attemptRow()]);
    repo = new TrainingRepository(db);
    const attempts = await repo.getAttemptsByExercise('ex1');
    expect(attempts[0]).toMatchObject({
      id: 'attempt-1',
      exerciseId: 'ex1',
      methodId: 'method1',
      scramble: "R U R'",
      timeMs: 12345,
      verdict: 'correct',
      playMode: 'manual',
      timestamp: 1700000000000,
    });
  });
});

describe('TrainingRepository — Algorithm Progress', () => {
  let repo: TrainingRepository;
  beforeEach(() => {
    repo = new TrainingRepository(mockDb());
  });

  it('getAlgorithmProgress returns null when no row', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    const result = await repo.getAlgorithmProgress('alg1');
    expect(result).toBeNull();
  });

  it('getAlgorithmProgress maps row to domain', async () => {
    const db = mockDb([progressRow()]);
    repo = new TrainingRepository(db);
    const result = await repo.getAlgorithmProgress('alg1');
    expect(result).toMatchObject({
      algorithmId: 'alg1',
      mastery: 5,
      accuracy: 0.85,
      bestTimeMs: 9000,
      avgTimeMs: 11000,
      totalAttempts: 20,
      correctStreak: 4,
      srsEaseFactor: 2.5,
    });
  });

  it('upsertAlgorithmProgress INSERTs when missing', async () => {
    const db = mockDb([]); // getAlgorithmProgress → empty → INSERT path
    repo = new TrainingRepository(db);
    await repo.upsertAlgorithmProgress({
      algorithmId: 'alg1',
      mastery: 3,
      accuracy: 0.7,
      bestTimeMs: 12000,
      avgTimeMs: 13000,
      totalAttempts: 10,
      correctStreak: 2,
      lastPracticedAt: 1700000000000,
      srsNextReviewAt: 1700000864000,
      srsIntervalDays: 1,
      srsEaseFactor: 2.5,
    });
    const lastCall = db.mock.calls[db.mock.calls.length - 1];
    expect(lastCall[0]).toContain('INSERT INTO algorithm_progress');
  });

  it('upsertAlgorithmProgress UPDATES when existing', async () => {
    const db = mockDb([progressRow()]); // getAlgorithmProgress → exists → UPDATE
    repo = new TrainingRepository(db);
    await repo.upsertAlgorithmProgress({
      algorithmId: 'alg1',
      mastery: 7,
      accuracy: 0.95,
      bestTimeMs: 7000,
      avgTimeMs: 8500,
      totalAttempts: 50,
      correctStreak: 10,
      lastPracticedAt: 1700000000000,
      srsNextReviewAt: 1700001728000,
      srsIntervalDays: 2,
      srsEaseFactor: 2.8,
    });
    const lastCall = db.mock.calls[db.mock.calls.length - 1];
    expect(lastCall[0]).toContain('UPDATE algorithm_progress SET');
  });

  it('getAlgorithmProgressBySubset joins algorithm_cases', async () => {
    const db = mockDb([progressRow()]);
    repo = new TrainingRepository(db);
    await repo.getAlgorithmProgressBySubset('subset1');
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN algorithm_cases'),
      ['subset1'],
    );
  });

  it('getWeakestAlgorithms orders by mastery ASC with limit', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getWeakestAlgorithms('subset1', 3);
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY ap.mastery ASC'),
      ['subset1', 3],
    );
  });

  it('getDueForReview filters by current timestamp', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    const before = Date.now();
    await repo.getDueForReview(5);
    const after = Date.now();
    const bind = db.mock.calls[0][1] as unknown[];
    expect(bind[0]).toBeGreaterThanOrEqual(before);
    expect(bind[0]).toBeLessThanOrEqual(after);
    expect(bind[1]).toBe(5);
  });
});

describe('TrainingRepository — Exercise Progress', () => {
  let repo: TrainingRepository;
  beforeEach(() => {
    repo = new TrainingRepository(mockDb());
  });

  it('getExerciseProgress without phaseId uses IS NULL', async () => {
    const db = mockDb([exerciseRow()]);
    repo = new TrainingRepository(db);
    await repo.getExerciseProgress('ex1', 'method1');
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('AND phase_id IS NULL'),
      ['ex1', 'method1'],
    );
  });

  it('getExerciseProgress with phaseId parameterizes correctly', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    await repo.getExerciseProgress('ex1', 'method1', 'f2l');
    expect(db).toHaveBeenCalledWith(
      expect.stringContaining('AND phase_id = ?'),
      ['ex1', 'method1', 'f2l'],
    );
  });

  it('getExerciseProgress returns null for missing row', async () => {
    const db = mockDb([]);
    repo = new TrainingRepository(db);
    const result = await repo.getExerciseProgress('ex1', 'method1');
    expect(result).toBeNull();
  });

  it('upsertExerciseProgress INSERTs when missing', async () => {
    const db = mockDb([]); // getExerciseProgress → empty → INSERT path
    repo = new TrainingRepository(db);
    await repo.upsertExerciseProgress({
      exerciseId: 'ex1',
      methodId: 'method1',
      totalSessions: 1,
      totalAttempts: 10,
      bestAccuracy: 0.8,
      bestTimeMs: 9000,
      avgTimeMs: 11000,
      lastPracticedAt: 1700000000000,
    });
    const lastCall = db.mock.calls[db.mock.calls.length - 1];
    expect(lastCall[0]).toContain('INSERT INTO exercise_progress');
  });

  it('upsertExerciseProgress UPDATES when existing', async () => {
    const db = mockDb([exerciseRow()]); // getExerciseProgress → exists → UPDATE
    repo = new TrainingRepository(db);
    await repo.upsertExerciseProgress({
      exerciseId: 'ex1',
      methodId: 'method1',
      totalSessions: 2,
      totalAttempts: 20,
      bestAccuracy: 0.9,
      bestTimeMs: 8000,
      avgTimeMs: 10000,
      lastPracticedAt: 1700000000000,
    });
    const lastCall = db.mock.calls[db.mock.calls.length - 1];
    expect(lastCall[0]).toContain('UPDATE exercise_progress SET');
  });

  it('getMethodExerciseProgress returns array mapped', async () => {
    const db = mockDb([exerciseRow()]);
    repo = new TrainingRepository(db);
    const result = await repo.getMethodExerciseProgress('method1');
    expect(result).toHaveLength(1);
    expect(result[0].exerciseId).toBe('ex1');
  });
});

describe('TrainingRepository — Aggregates', () => {
  let repo: TrainingRepository;
  beforeEach(() => {
    repo = new TrainingRepository(mockDb());
  });

  it('getMethodMastery rounds the AVG(mastery) result', async () => {
    const db = mockDb([{ avg_mastery: 4.6 }]);
    repo = new TrainingRepository(db);
    expect(await repo.getMethodMastery('m1')).toBe(5);
  });

  it('getMethodMastery returns 0 when COALESCE returns 0', async () => {
    const db = mockDb([{ avg_mastery: 0 }]);
    repo = new TrainingRepository(db);
    expect(await repo.getMethodMastery('m1')).toBe(0);
  });

  it('getMethodBestTime returns MIN(time_ms) for the method', async () => {
    const db = mockDb([{ best: 8500 }]);
    repo = new TrainingRepository(db);
    expect(await repo.getMethodBestTime('m1')).toBe(8500);
  });

  it('getMethodBestTime returns 0 when no rows', async () => {
    const db = mockDb([{ best: null }]);
    repo = new TrainingRepository(db);
    expect(await repo.getMethodBestTime('m1')).toBe(0);
  });
});
