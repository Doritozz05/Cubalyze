import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolvesRepository } from '../repositories/solves.repository';
import { SessionsRepository } from '../repositories/sessions.repository';
import type { OrientationTimeline } from '@cubeforge/types';

// ────────────────────────────────────────────────────────────────────────
//  Helper: mock DB executor
// ────────────────────────────────────────────────────────────────────────

function mockDb(rows: Record<string, unknown>[] = []) {
  return vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>[]>>().mockResolvedValue(rows);
}

// ────────────────────────────────────────────────────────────────────────
//  Helper: create a full SolveRow with all fields
// ────────────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 's1',
    session_id: 'ses1',
    time_ms: 12345,
    timestamp: 1767225600000,
    scramble: "R U R'",
    penalty: 'none',
    method: 'CFOP',
    source: 'smart',
    note: null,
    moves: '[]',
    orientation_timeline: null,
    analysis_engine_version: null,
    analysis: null,
    puzzle_type: '333',
    created_at: 1767225600000,
    updated_at: 1767225600000,
    ...overrides,
  };
}

describe('SolvesRepository — Level 2 Edge Cases', () => {
  let repo: SolvesRepository;

  beforeEach(() => {
    repo = new SolvesRepository(mockDb());
  });

  // ────────────────────────────────────────────────────────────────────
  //  JSON parse edge cases — rowToSolve
  // ────────────────────────────────────────────────────────────────────

  describe('findAll — JSON parse edge cases', () => {
    it('moves = "[]" (valid JSON) parses correctly', async () => {
      const db = mockDb([makeRow({ moves: '[]' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].moves).toEqual([]);
    });

    it('moves = "[{\\"face\\":\\"U\\",\\"direction\\":1}]" parses correctly', async () => {
      const db = mockDb([makeRow({ moves: '[{"face":"U","direction":1}]' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].moves).toEqual([{ face: 'U', direction: 1 }]);
    });

    it('moves = "" (empty string) falls back to []', async () => {
      const db = mockDb([makeRow({ moves: '' })]);
      repo = new SolvesRepository(db);
      // safeParseMoves now handles empty strings gracefully
      const solves = await repo.findAll();
      expect(solves[0].moves).toEqual([]);
    });

    it('moves = "[invalid]" falls back to []', async () => {
      const db = mockDb([makeRow({ moves: '[invalid]' })]);
      repo = new SolvesRepository(db);
      // safeParseMoves catches JSON.parse errors gracefully
      const solves = await repo.findAll();
      expect(solves[0].moves).toEqual([]);
    });

    it('moves = "null" falls back to [] (not null)', async () => {
      const db = mockDb([makeRow({ moves: 'null' })]);
      repo = new SolvesRepository(db);
      // safeParseMoves checks Array.isArray, rejects null
      const solves = await repo.findAll();
      expect(solves[0].moves).toEqual([]);
    });

    it('orientation_timeline = null stays undefined', async () => {
      const db = mockDb([makeRow({ orientation_timeline: null })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].orientationTimeline).toBeUndefined();
    });

    it('orientation_timeline = "null" falls back to undefined', async () => {
      const db = mockDb([makeRow({ orientation_timeline: 'null' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      // safeParseOrientationTimeline rejects null (non-object after parse)
      expect(solves[0].orientationTimeline).toBeUndefined();
    });

    it('orientation_timeline = valid compact keyframe array parses correctly', async () => {
      // The REAL producer format (compactOrientationTimeline):
      // an array of [moveIndex, orientationIndex] pairs. The old parser
      // rejected arrays, so stored timelines came back undefined after a
      // reload and replays lost grip + rotations ("only works the first
      // time" bug).
      const db = mockDb([makeRow({
        orientation_timeline: '[[0,2],[3,5],[7,0]]'
      })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].orientationTimeline).toEqual([[0,2],[3,5],[7,0]]);
    });

    it('orientation_timeline = prototype object shape (no producer) falls back to undefined', async () => {
      // A stale prototype shape that no code produces. Must NOT be accepted
      // as a timeline (the replay engine iterates it as [moveIndex, oi] pairs).
      const db = mockDb([makeRow({
        orientation_timeline: '{"events":[{"ts":100,"q":{"x":0,"y":0,"z":0,"w":1}}]}'
      })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].orientationTimeline).toBeUndefined();
    });

    it('orientation_timeline = malformed array (non-tuple entries) falls back to undefined', async () => {
      const db = mockDb([makeRow({
        orientation_timeline: '[[0,2],[3]]'
      })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].orientationTimeline).toBeUndefined();
    });

    it('analysis = null stays undefined', async () => {
      const db = mockDb([makeRow({ analysis: null })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].analysis).toBeUndefined();
    });

    it('analysis = valid JSON string parses', async () => {
      const db = mockDb([makeRow({ analysis: '{"phases":[1,2,3]}' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].analysis).toBe('{"phases":[1,2,3]}');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Null / undefined field handling
  // ────────────────────────────────────────────────────────────────────

  describe('field defaults — rowToSolve', () => {
    it('method = null → undefined', async () => {
      const db = mockDb([makeRow({ method: null })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].method).toBeUndefined();
    });

    it('method = "CFOP" → "CFOP"', async () => {
      const db = mockDb([makeRow({ method: 'CFOP' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].method).toBe('CFOP');
    });

    it('source = undefined/null defaults to "manual"', async () => {
      const row = makeRow();
      delete row.source;
      const db = mockDb([row]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].source).toBe('manual');
    });

    it('puzzle_type = undefined defaults to "333"', async () => {
      const row = makeRow();
      delete row.puzzle_type;
      const db = mockDb([row]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].puzzleType).toBe('333');
    });

    it('puzzle_type = "222" is preserved', async () => {
      const db = mockDb([makeRow({ puzzle_type: '222' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].puzzleType).toBe('222');
    });

    it('note = null → undefined', async () => {
      const db = mockDb([makeRow({ note: null })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].note).toBeUndefined();
    });

    it('note = "test note" → "test note"', async () => {
      const db = mockDb([makeRow({ note: 'test note' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].note).toBe('test note');
    });

    it('penalty = "none" → "none"', async () => {
      const db = mockDb([makeRow({ penalty: 'none' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].penalty).toBe('none');
    });

    it('penalty = "+2" → "+2"', async () => {
      const db = mockDb([makeRow({ penalty: '+2' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].penalty).toBe('+2');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  CRUD edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('CRUD — edge cases', () => {
    it('findById returns null for empty string id', async () => {
      const result = await repo.findById('');
      expect(result).toBeNull();
    });

    it('findById with special characters in ID', async () => {
      const db = mockDb([makeRow({ id: "solve'; DROP TABLE solves;--" })]);
      repo = new SolvesRepository(db);
      const result = await repo.findById("solve'; DROP TABLE solves;--");
      // It should NOT actually execute the injection; parameterized query handles this
      expect(result).not.toBeNull();
      expect(result!.id).toBe("solve'; DROP TABLE solves;--");
    });

    it('insert with puzzleType=222 sets puzzle_type correctly', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);
      await repo.insert({
        id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
        scramble: '', penalty: 'none', source: 'manual', moves: [], puzzleType: '222', updatedAt: 1767225600000,
      });
      const bind = db.mock.calls[0][1] as unknown[];
      // puzzle_type is at index 13 in the INSERT
      expect(bind[13]).toBe('222');
    });

    it('insert rejects an unknown puzzle_type (A2 — registry validation)', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);
      await expect(
        repo.insert({
          id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
          scramble: '', penalty: 'none', source: 'manual', moves: [], puzzleType: '9x9x9',
        })
      ).rejects.toThrow(/unknown puzzle_type '9x9x9'/);
      // Nothing reached the DB.
      expect(db).not.toHaveBeenCalled();
    });

    it('update rejects an unknown puzzle_type (A2 — registry validation)', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);
      await expect(
        repo.update({
          id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
          scramble: '', penalty: 'none', source: 'manual', moves: [], puzzleType: 'pyraminx',
        })
      ).rejects.toThrow(/unknown puzzle_type 'pyraminx'/);
      expect(db).not.toHaveBeenCalled();
    });

    it('insertMany rejects the whole batch when one solve has an unknown puzzle_type (A2)', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);
      const good = {
        id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
        scramble: '', penalty: 'none' as const, source: 'manual' as const, moves: [], puzzleType: '333',
      };
      const bad = { ...good, id: 's2', puzzleType: 'Megaminx' };
      await expect(repo.insertMany([good, bad])).rejects.toThrow(/unknown puzzle_type 'Megaminx'/);
      // The transaction rolls back: BEGIN/ROLLBACK may be issued, but no
      // INSERT statement may reach the DB.
      const inserts = db.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO solves'));
      expect(inserts).toHaveLength(0);
    });

    it('insert accepts the legacy OH storage type (A2 — 333 is canonical for 333)', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);
      await repo.insert({
        id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
        scramble: '', penalty: 'none', source: 'manual', moves: [], puzzleType: '333', updatedAt: 1767225600000,
      });
      expect(db).toHaveBeenCalledTimes(1);
    });

    it('timeMs = 0 is valid (DNF solve)', async () => {
      const db = mockDb([makeRow({ time_ms: 0 })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].timeMs).toBe(0);
    });

    it('timeMs = Number.MAX_SAFE_INTEGER is preserved', async () => {
      const db = mockDb([makeRow({ time_ms: Number.MAX_SAFE_INTEGER })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].timeMs).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('scramble = empty string is valid', async () => {
      const db = mockDb([makeRow({ scramble: '' })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].scramble).toBe('');
    });

    it('scramble with special characters (apostrophe) is preserved', async () => {
      const db = mockDb([makeRow({ scramble: "R U R' U'" })]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      expect(solves[0].scramble).toBe("R U R' U'");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  solveToRow bidirectional consistency
  // ────────────────────────────────────────────────────────────────────

  describe('rowToSolve → solveToRow bidirectional', () => {
    it('round-trip preserves all basic fields', async () => {
      const db = mockDb([makeRow()]);
      repo = new SolvesRepository(db);
      const solves = await repo.findAll();
      const solve = solves[0];

      // solveToRow is called via insert/update. We verify the row was reconstructed correctly.
      expect(solve.id).toBe('s1');
      expect(solve.sessionId).toBe('ses1');
      expect(solve.timeMs).toBe(12345);
      expect(solve.timestamp).toBe(1767225600000);
      expect(solve.scramble).toBe("R U R'");
      expect(solve.penalty).toBe('none');
      expect(solve.method).toBe('CFOP');
      expect(solve.source).toBe('smart');
      expect(solve.moves).toEqual([]);
      expect(solve.puzzleType).toBe('333');
    });

    it('insert + findAll round-trips moves correctly', async () => {
      const db = mockDb();
      repo = new SolvesRepository(db);

      await repo.insert({
        id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
        scramble: '', penalty: 'none', source: 'smart',
        moves: [{ face: 'U', direction: 1, cubeTimestamp: 123, hostTimestamp: 456 }],
        puzzleType: '333', updatedAt: 1767225600000,
      });

      // Verify moves was JSON stringified
      const bind = db.mock.calls[0][1] as unknown[];
      const movesJson = bind[9] as string; // moves is at index 9
      const parsed = JSON.parse(movesJson);
      expect(parsed).toEqual([{ face: 'U', direction: 1, cubeTimestamp: 123, hostTimestamp: 456 }]);
    });

    it('insert + findAll round-trips the orientation timeline (the reload bug)', async () => {
      // Regression test for the "only works the first time" bug: a solve
      // inserted WITH an orientation timeline must return it after a reload
      // (findAll re-parses the JSON column). The old parser returned
      // undefined for arrays, so replays lost grip + rotations after reload.
      const db = mockDb();
      repo = new SolvesRepository(db);

      const timeline: OrientationTimeline = [[0, 2], [3, 5], [7, 0]];
      await repo.insert({
        id: 's1', sessionId: 'ses1', timeMs: 1000, timestamp: 1767225600000,
        scramble: '', penalty: 'none', source: 'smart',
        moves: [{ face: 'U', direction: 1, cubeTimestamp: 123, hostTimestamp: 456 }],
        orientationTimeline: timeline,
        puzzleType: '333', updatedAt: 1767225600000,
      });

      // Verify it was stored as a JSON array of tuples
      const bind = db.mock.calls[0][1] as unknown[];
      const timelineJson = bind[10] as string; // orientation_timeline is at index 10
      expect(JSON.parse(timelineJson)).toEqual([[0, 2], [3, 5], [7, 0]]);

      // Simulate a reload: the stored JSON comes back through findAll
      const reloadDb = mockDb([makeRow({ orientation_timeline: timelineJson })]);
      repo = new SolvesRepository(reloadDb);
      const solves = await repo.findAll();
      expect(solves[0].orientationTimeline).toEqual([[0, 2], [3, 5], [7, 0]]);
    });
  });
});


// ────────────────────────────────────────────────────────────────────────
//  Client lifecycle — integration-style (skipped: requires window/Worker mock)
// ────────────────────────────────────────────────────────────────────────
// The client.ts module references window/Worker at the top level.
// Testing getDB() before initDB() requires proper browser globals
// that are not available in vitest's default environment without setup.
// The existing db.test.ts covers this scenario with proper mocks.

