import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolvesRepository } from '../repositories/solves.repository.js';
import { SessionsRepository } from '../repositories/sessions.repository.js';
import { AlgorithmsRepository } from '../repositories/algorithms.repository.js';

vi.mock('comlink', () => ({
  wrap: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return [{ key: 'theme', value: 'dark' }];
      return [];
    }),
    getStorageType: vi.fn().mockResolvedValue('opfs'),
    close: vi.fn().mockResolvedValue(undefined),
    [Symbol.for('comlink.releaseProxy')]: vi.fn(),
  })),
  releaseProxy: Symbol.for('comlink.releaseProxy'),
}));

vi.mock('../worker.js', () => ({ DBWorker: {} }));

function mockDb(rows: Record<string, unknown>[] = []) {
  return vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>[]>>().mockResolvedValue(rows);
}

describe('SolvesRepository', () => {
  let repo: SolvesRepository;

  beforeEach(() => {
    repo = new SolvesRepository(mockDb());
  });

  it('findAll returns empty array when no solves', async () => {
    const solves = await repo.findAll();
    expect(solves).toEqual([]);
  });

  it('findAll returns mapped solves', async () => {
    const db = mockDb([
      { id: 's1', session_id: 'ses1', time_ms: 12345, timestamp: 1767225600000, scramble: "R U R'", penalty: 'none', method: null, source: 'manual', note: null, moves: "[]", orientation_timeline: null, analysis_engine_version: null, analysis: null, puzzle_type: '333', created_at: 1767225600000, updated_at: 1767225600000 },
    ]);
    repo = new SolvesRepository(db);
    const solves = await repo.findAll();
    expect(solves).toHaveLength(1);
    expect(solves[0].id).toBe('s1');
    expect(solves[0].sessionId).toBe('ses1');
    expect(solves[0].timeMs).toBe(12345);
    expect(solves[0].penalty).toBe('none');
    expect(solves[0].source).toBe('manual');
  });

  it('findAll with sessionId filters by session and excludes demo solves', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    await repo.findAll('ses1');
    expect(db).toHaveBeenCalledWith(
      'SELECT * FROM solves WHERE is_demo = 0 AND session_id = ? ORDER BY timestamp ASC',
      ['ses1']
    );
  });

  it('findById returns null for missing solve', async () => {
    const solve = await repo.findById('nonexistent');
    expect(solve).toBeNull();
  });

  it('findById returns mapped solve', async () => {
    const db = mockDb([
      { id: 's1', session_id: 'ses1', time_ms: 5000, timestamp: 1767484800000, scramble: 'U', penalty: '+2', method: 'CFOP', source: 'smart', note: null, moves: "[]", orientation_timeline: null, analysis_engine_version: null, analysis: null, puzzle_type: '333', created_at: 1767225600000, updated_at: 1767225600000 },
    ]);
    repo = new SolvesRepository(db);
    const solve = await repo.findById('s1');
    expect(solve).not.toBeNull();
    expect(solve!.method).toBe('CFOP');
    expect(solve!.penalty).toBe('+2');
    expect(solve!.source).toBe('smart');
  });

  it('insert calls INSERT SQL', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    await repo.insert({
      id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000, scramble: '', penalty: 'none', source: 'manual', moves: [], puzzleType: '333',
    });
    expect(db).toHaveBeenCalledOnce();
    const call = db.mock.calls[0];
    expect(call[0]).toContain('INSERT INTO solves');
    // source is now part of the INSERT column list
    expect(call[0]).toContain('source');
  });

  it('update calls UPDATE SQL', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    await repo.update({ id: 's1', sessionId: 'ses1', timeMs: 2000, timestamp: 1767225600000, scramble: '', penalty: '+2', source: 'manual', moves: [], puzzleType: '333' });
    expect(db).toHaveBeenCalledOnce();
    const call = db.mock.calls[0];
    expect(call[0]).toContain('UPDATE solves SET');
    expect(call[0]).toContain('source');
  });

  it('delete calls DELETE SQL', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    await repo.delete('s1');
    expect(db).toHaveBeenCalledWith('DELETE FROM solves WHERE id = ?', ['s1']);
  });

  it('count returns number', async () => {
    const db = mockDb([{ cnt: 5 }]);
    repo = new SolvesRepository(db);
    const cnt = await repo.count();
    expect(cnt).toBe(5);
  });

  it('rowToSolve defaults source to manual when column missing', async () => {
    // Simulates a pre-migration row that has no `source` column value.
    const db = mockDb([
      { id: 's9', session_id: 'ses1', time_ms: 9000, timestamp: 1767225600000, scramble: 'U', penalty: 'none', method: null, source: 'manual', note: null, moves: "[]", orientation_timeline: null, analysis_engine_version: null, analysis: null, puzzle_type: '333', created_at: 1767225600000, updated_at: 1767225600000 },
    ]);
    repo = new SolvesRepository(db);
    const solve = await repo.findById('s9');
    expect(solve).not.toBeNull();
    expect(solve!.source).toBe('manual');
  });

  it('insert with method includes method field', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    await repo.insert({
      id: 's2', sessionId: 'ses1', timeMs: 1500, timestamp: 1767225600000, scramble: "R U R' U'", penalty: 'none', method: 'CFOP', source: 'smart', moves: [], puzzleType: '333',
    });
    const bind = db.mock.calls[0][1] as unknown[];
    expect(bind[6]).toBe('CFOP'); // method
    expect(bind[7]).toBe('smart'); // source (column order: ..., method, source, moves, ...)
  });

  it('insertMany wraps the batch in a transaction (BEGIN → inserts → COMMIT)', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    const count = await repo.insertMany([
      { id: 'b1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000, scramble: 'U', penalty: 'none', source: 'manual', moves: [], puzzleType: '333' },
      { id: 'b2', sessionId: 'ses1', timeMs: 2000, timestamp: 1767225600000, scramble: "U'", penalty: 'none', source: 'manual', moves: [], puzzleType: '333' },
    ]);
    expect(count).toBe(2);
    expect(db.mock.calls[0][0]).toBe('BEGIN');
    // Both rows land in ONE multi-row INSERT (batched to cut worker round-trips).
    expect(db.mock.calls[1][0]).toContain('INSERT INTO solves');
    expect(db.mock.calls[1][0]).toContain('VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    expect(db.mock.calls[2][0]).toBe('COMMIT');
  });

  it('insertMany is a no-op for an empty batch', async () => {
    const db = mockDb();
    repo = new SolvesRepository(db);
    expect(await repo.insertMany([])).toBe(0);
    expect(db).not.toHaveBeenCalled();
  });

  it('insertMany rolls back when a statement fails (all-or-nothing)', async () => {
    const db = mockDb();
    db.mockImplementation(async (...args: unknown[]) => {
      const bind = args[1] as unknown[] | undefined;
      if (bind && bind.includes('fail')) throw new Error('boom');
      return [];
    });
    repo = new SolvesRepository(db);
    await expect(repo.insertMany([{ id: 'x1', sessionId: 'ses1', timeMs: 1, timestamp: 1, scramble: 'fail', penalty: 'none', source: 'manual', moves: [], puzzleType: '333' }])).rejects.toThrow('boom');
    expect(db.mock.calls[0][0]).toBe('BEGIN');
    expect(db.mock.calls[db.mock.calls.length - 1][0]).toBe('ROLLBACK');
  });

  it('deleteBySession deletes all solves of a session in one statement', async () => {
    const db = mockDb([{ cnt: 3 }]);
    repo = new SolvesRepository(db);
    const removed = await repo.deleteBySession('ses1');
    expect(removed).toBe(3);
    expect(db).toHaveBeenCalledWith('SELECT COUNT(*) as cnt FROM solves WHERE session_id = ?', ['ses1']);
    expect(db).toHaveBeenCalledWith('DELETE FROM solves WHERE session_id = ?', ['ses1']);
  });

  it('deleteBySession skips the DELETE when the session has no solves', async () => {
    const db = mockDb([{ cnt: 0 }]);
    repo = new SolvesRepository(db);
    const removed = await repo.deleteBySession('empty');
    expect(removed).toBe(0);
    expect(db).toHaveBeenCalledTimes(1);
  });
});

describe('SessionsRepository', () => {
  let repo: SessionsRepository;

  beforeEach(() => {
    repo = new SessionsRepository(mockDb());
  });

  it('findAll returns mapped sessions', async () => {
    const db = mockDb([
      { id: 'ses1', name: 'Practice', puzzle_type: '333', created_at: '2026-01-01' },
    ]);
    repo = new SessionsRepository(db);
    const sessions = await repo.findAll();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].puzzleType).toBe('333');
  });

  it('findById returns null for missing session', async () => {
    const session = await repo.findById('nonexistent');
    expect(session).toBeNull();
  });

  it('insert and update call correct SQL', async () => {
    const db = mockDb();
    repo = new SessionsRepository(db);
    await repo.insert({ id: 'ses1', name: 'Test', puzzleType: '333', createdAt: 1767225600000 });
    expect(db.mock.calls[0][0]).toContain('INSERT INTO sessions');

    db.mockReset();
    db.mockResolvedValue([]);
    await repo.update({ id: 'ses1', name: 'Updated', puzzleType: '444', createdAt: 1767225600000 });
    expect(db.mock.calls[0][0]).toContain('UPDATE sessions');
  });

  it('delete calls DELETE SQL', async () => {
    const db = mockDb();
    repo = new SessionsRepository(db);
    await repo.delete('ses1');
    expect(db).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = ?', ['ses1']);
  });

  it('count returns number', async () => {
    const db = mockDb([{ cnt: 3 }]);
    repo = new SessionsRepository(db);
    const cnt = await repo.count();
    expect(cnt).toBe(3);
  });
});

describe('AlgorithmsRepository', () => {
  let repo: AlgorithmsRepository;

  beforeEach(() => {
    repo = new AlgorithmsRepository(mockDb());
  });

  it('seedAll bulk-inserts the whole catalog in 4 multi-row statements (not ~450 round-trips)', async () => {
    const db = mockDb();
    repo = new AlgorithmsRepository(db);

    const count = await repo.seedAll({
      methods: [{ id: 'm1', name: 'CFOP', description: '', sortOrder: 1, puzzleType: '333' }],
      subsets: [{ id: 's1', methodId: 'm1', name: 'PLL', description: '', sortOrder: 1, puzzleType: '333' }],
      cases: [{
        id: 'c1', subsetId: 's1', caseNumber: 'PLL 1', name: 'Aa', recognitionPatterns: [],
        setupScramble: '', diagramType: '2d-top', difficulty: 'intermediate', tags: [], puzzleType: '333',
      }],
      algorithms: [{
        id: 'a1', caseId: 'c1', moves: ["R", "U"], moveCount: { htm: 2, qtm: 2, stm: 2 },
        isDefault: true, isCustom: false, sortOrder: 0, difficulty: 'intermediate',
        triggers: [], isMirror: false, isInverse: false,
      }],
    });

    expect(count).toBe(4);
    // One statement per table — the Comlink worker boundary is crossed 4 times,
    // not once per row (~450 for the full catalog).
    expect(db.mock.calls).toHaveLength(4);
    expect(db.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO algorithm_methods');
    expect(db.mock.calls[0][0]).toContain('VALUES (?, ?, ?, ?, ?)');
    expect(db.mock.calls[1][0]).toContain('INSERT OR IGNORE INTO algorithm_subsets');
    expect(db.mock.calls[2][0]).toContain('INSERT OR IGNORE INTO algorithm_cases');
    expect(db.mock.calls[3][0]).toContain('INSERT OR IGNORE INTO algorithm_records');
  });
});

describe('Database Client', () => {
  it('initializes db correctly', async () => {
    globalThis.window = {} as unknown as Window & typeof globalThis;
    globalThis.Worker = vi.fn(() => ({ terminate: vi.fn() })) as unknown as typeof Worker;

    const { initDB, getDB, closeDB } = await import('../client.js');
    const db = await initDB();
    expect(db).toBeDefined();
    expect(getDB()).toBe(db);

    const results = await db.execute('SELECT * FROM app_meta;');
    expect(results).toEqual([{ key: 'theme', value: 'dark' }]);

    await closeDB();
  });
});
