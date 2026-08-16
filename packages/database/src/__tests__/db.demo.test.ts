import { describe, it, expect, vi } from 'vitest';
import { SolvesRepository } from '../repositories/solves.repository.js';
import { SessionsRepository } from '../repositories/sessions.repository.js';

function mockDb(rows: Record<string, unknown>[] = []) {
  return vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>[]>>().mockResolvedValue(rows);
}

describe('SolvesRepository — demo data isolation (is_demo)', () => {
  const baseSolve = {
    id: 's1',
    sessionId: 'ses1',
    timeMs: 1000,
    timestamp: 1767225600000,
    scramble: '',
    penalty: 'none' as const,
    source: 'manual' as const,
    moves: [] as never[],
    puzzleType: '333',
  };

  it('insert without options binds is_demo = 0', async () => {
    const db = mockDb();
    const repo = new SolvesRepository(db);
    await repo.insert({ ...baseSolve });
    const call = db.mock.calls[0];
    expect(call[0]).toContain('is_demo');
    // Column order: … analysis, puzzle_type, is_demo, created_at, updated_at
    expect((call[1] as unknown[])[14]).toBe(0);
  });

  it('insert with { isDemo: true } binds is_demo = 1', async () => {
    const db = mockDb();
    const repo = new SolvesRepository(db);
    await repo.insert({ ...baseSolve }, { isDemo: true });
    const call = db.mock.calls[0];
    expect(call[0]).toContain('is_demo');
    expect((call[1] as unknown[])[14]).toBe(1);
  });

  it('countNonDemo counts only real (non-demo) solves', async () => {
    const db = mockDb([{ cnt: 7 }]);
    const repo = new SolvesRepository(db);
    const n = await repo.countNonDemo();
    expect(n).toBe(7);
    expect(db).toHaveBeenCalledWith('SELECT COUNT(*) as cnt FROM solves WHERE is_demo = 0');
  });

  it('deleteDemoData deletes only demo rows and returns the count', async () => {
    const db = mockDb([{ cnt: 3 }]);
    const repo = new SolvesRepository(db);
    const removed = await repo.deleteDemoData();
    expect(removed).toBe(3);
    expect(db.mock.calls[0][0]).toContain('SELECT COUNT(*)');
    expect(db.mock.calls[1]).toEqual(['DELETE FROM solves WHERE is_demo = 1']);
  });

  it('deleteDemoData skips the DELETE when there is nothing to remove', async () => {
    const db = mockDb([{ cnt: 0 }]);
    const repo = new SolvesRepository(db);
    const removed = await repo.deleteDemoData();
    expect(removed).toBe(0);
    expect(db).toHaveBeenCalledTimes(1);
  });
});

describe('SessionsRepository — demo session isolation (is_demo)', () => {
  const baseSession = { id: 'ses1', name: 'Main', puzzleType: '333', createdAt: 1767225600000 };

  it('insert without options binds is_demo = 0', async () => {
    const db = mockDb();
    const repo = new SessionsRepository(db);
    await repo.insert({ ...baseSession });
    const call = db.mock.calls[0];
    expect(call[0]).toContain('is_demo');
    // Column order: id, name, puzzle_type, created_at, updated_at, is_demo
    expect((call[1] as unknown[])[5]).toBe(0);
  });

  it('insert with { isDemo: true } binds is_demo = 1', async () => {
    const db = mockDb();
    const repo = new SessionsRepository(db);
    await repo.insert({ ...baseSession }, { isDemo: true });
    const call = db.mock.calls[0];
    expect((call[1] as unknown[])[5]).toBe(1);
  });

  it('findAllNonDemo filters out demo sessions', async () => {
    const db = mockDb([
      { id: 'ses1', name: 'Main', puzzle_type: '333', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);
    const repo = new SessionsRepository(db);
    const sessions = await repo.findAllNonDemo();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe('Main');
    expect(db).toHaveBeenCalledWith('SELECT * FROM sessions WHERE is_demo = 0 ORDER BY created_at ASC');
  });

  it('deleteDemoSessions deletes only demo sessions and returns the count', async () => {
    const db = mockDb([{ cnt: 2 }]);
    const repo = new SessionsRepository(db);
    const removed = await repo.deleteDemoSessions();
    expect(removed).toBe(2);
    expect(db.mock.calls[1]).toEqual(['DELETE FROM sessions WHERE is_demo = 1']);
  });
});
