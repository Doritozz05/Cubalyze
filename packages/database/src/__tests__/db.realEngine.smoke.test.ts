/**
 * Real-engine smoke test — NO comlink mocks.
 *
 * Drives the ACTUAL sqlite-wasm WASM engine and the REAL worker bootstrap
 * (worker.ts: sqlite3InitModule → storage detection → pragmas → migrations)
 * plus the REAL repositories and transaction helper, in-process.
 *
 * What is NOT exercised: the Web Worker transport itself. Node has no
 * `Worker`, so we import worker.ts directly after stubbing a minimal inert
 * `self` (Comlink.expose only registers a message listener on it, which we
 * never fire). OPFS is browser-only, so the backend resolves to the worker's
 * own in-memory fallback — which uses the same SQLite core and therefore the
 * same transaction semantics.
 *
 * This covers the gap left by db.test.ts (which mocks the executor):
 *   1. BEGIN/INSERT×N/COMMIT and BEGIN/INSERT×N/ROLLBACK work across separate
 *      `execute()` calls on the real WASM engine.
 *   2. A mid-batch failure (PK violation at insert #499 of 500) leaves ZERO
 *      rows — imports are all-or-nothing on a real database.
 *   3. findAll returns timestamp ASC regardless of insertion order (the order
 *      the UI reverses to newest-first).
 *   4. deleteBySession removes 500 rows in a single statement.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SolvesRepository, SessionsRepository, type Solve, type Session } from '../repositories/index.js';

// --- Real worker bootstrap (no comlink mocks) --------------------------------

// Comlink.expose(obj, ep) defaults to `globalThis` and registers a `message`
// listener on it. Node has no such listener on globalThis, so provide an inert
// one to let the REAL worker module load. No messages are ever exchanged — we
// call DBWorker's methods in-process.
vi.stubGlobal('addEventListener', vi.fn());

type DBWorkerType = typeof import('../worker.js').DBWorker;
type Executor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

let DBWorker: DBWorkerType;
let exec: Executor;
let solvesRepo: SolvesRepository;
let sessionsRepo: SessionsRepository;

/** Deterministic UUID-shaped ids keep the smoke batch reproducible. */
const UUID = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FACES = ['R', 'U', 'F', 'L', 'D', 'B'] as const;

function randomScramble(length = 20): string {
  const moves: string[] = [];
  let last = '';
  for (let i = 0; i < length; i++) {
    let face = FACES[Math.floor(Math.random() * FACES.length)];
    while (face === last) face = FACES[Math.floor(Math.random() * FACES.length)];
    last = face;
    const suffix = Math.random() < 0.25 ? '2' : Math.random() < 0.5 ? "'" : '';
    moves.push(face + suffix);
  }
  return moves.join(' ');
}

/** Build a realistic solve with moves, method, note and mixed penalties. */
function makeSolve(i: number, sessionId: string, timestampBase: number): Solve {
  const scramble = randomScramble(20);
  const moves: Solve['moves'] = scramble
    .split(/\s+/)
    .slice(0, 6)
    .map((t, idx) => ({
      face: t[0] as Solve['moves'][number]['face'],
      direction: (t.endsWith('2') ? 2 : t.endsWith("'") ? -1 : 1) as 1 | -1 | 2,
      cubeTimestamp: 1000 + idx * 120,
      hostTimestamp: timestampBase + idx * 120,
    }));
  return {
    id: UUID(i),
    sessionId,
    timeMs: 8000 + i,
    timestamp: timestampBase + i * 60_000,
    scramble,
    penalty: i % 10 === 9 ? '+2' : i % 17 === 16 ? 'DNF' : 'none',
    method: 'CFOP',
    source: i % 2 === 0 ? 'smart' : 'manual',
    note: i % 7 === 0 ? `note-${i}` : undefined,
    moves,
    puzzleType: '3x3x3',
  };
}

describe('Real sqlite-wasm engine (smoke, no mocks)', () => {
  beforeAll(async () => {
    // Import AFTER the `self` stub is installed (module body runs Comlink.expose).
    DBWorker = (await import('../worker.js')).DBWorker;
    const ok = await DBWorker.init();
    expect(ok).toBe(true);
    // Same executor shape the repositories receive from the Comlink client.
    exec = (sql, bind) => Promise.resolve(DBWorker.execute(sql, bind));
    solvesRepo = new SolvesRepository(exec);
    sessionsRepo = new SessionsRepository(exec);
  }, 60_000);

  afterAll(async () => {
    // Unstub first so a failing beforeAll (DBWorker undefined) cannot leak the
    // global stub; the close() is guarded for the same reason.
    vi.unstubAllGlobals();
    if (DBWorker) await DBWorker.close();
  });

  it('boots the real engine and applies migrations (memory backend in Node)', async () => {
    // OPFS is browser-only — the worker must fall back to the in-memory DB.
    expect(DBWorker.getStorageType()).toBe('memory');
    // The real migrations ran: the core tables exist and queries work
    // (array check only — order-independent within this shared-DB suite).
    expect(Array.isArray(await solvesRepo.findAll())).toBe(true);
  }, 30_000);

  it('inserts 500 solves in one transaction and reads them back timestamp ASC', async () => {
    const session: Session = {
      id: UUID(1),
      name: 'Smoke 500',
      puzzleType: '3x3x3',
      createdAt: 1_700_000_000_000,
    };
    await sessionsRepo.insert(session);

    const batch = Array.from({ length: 500 }, (_, i) =>
      makeSolve(10 + i, session.id, 1_700_000_000_000),
    );

    const inserted = await solvesRepo.insertMany(batch);
    expect(inserted).toBe(500);

    const all = await solvesRepo.findAll(session.id);
    expect(all).toHaveLength(500);
    for (let i = 1; i < all.length; i++) {
      expect(all[i]!.timestamp).toBeGreaterThanOrEqual(all[i - 1]!.timestamp);
    }

    // Full column round-trip on a rich solve.
    const rich = all[0]!;
    expect(Array.isArray(rich.moves)).toBe(true);
    expect(rich.moves.length).toBeGreaterThan(0);
    expect(rich.method).toBe('CFOP');
    expect(['none', '+2', 'DNF']).toContain(rich.penalty);
  }, 30_000);

  it('rolls back the WHOLE batch on a mid-import PK violation (all-or-nothing)', async () => {
    const sessionId = UUID(2);
    await sessionsRepo.insert({
      id: sessionId,
      name: 'Rollback',
      puzzleType: '3x3x3',
      createdAt: 1_700_000_000_000,
    });
    // Seed one solve whose id will be duplicated at insert #499 of the batch.
    await solvesRepo.insert(makeSolve(900, sessionId, 1_700_000_000_000));
    const countBefore = await solvesRepo.count();

    const batch: Solve[] = [];
    for (let i = 0; i < 500; i++) {
      // 499 fresh solves; index 498 duplicates the seeded id → UNIQUE violation.
      const source = i === 498 ? makeSolve(900, sessionId, 1_700_000_000_000) : makeSolve(1000 + i, sessionId, 1_700_000_000_000);
      batch.push(i === 498 ? { ...source, id: UUID(900) } : source);
    }

    await expect(solvesRepo.insertMany(batch)).rejects.toThrow();

    // All-or-nothing: none of the 499 fresh solves may exist.
    expect(await solvesRepo.count()).toBe(countBefore);
    const all = await solvesRepo.findAll(sessionId);
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(UUID(900));
  }, 30_000);

  it('deleteBySession removes 500 rows in a single statement', async () => {
    const sessionId = UUID(3);
    await sessionsRepo.insert({
      id: sessionId,
      name: 'Delete batch',
      puzzleType: '3x3x3',
      createdAt: 1_700_000_000_000,
    });
    const batch = Array.from({ length: 500 }, (_, i) =>
      makeSolve(2000 + i, sessionId, 1_700_000_000_000),
    );
    await solvesRepo.insertMany(batch);
    // Session-scoped asserts: the suite shares one in-memory DB, so global
    // counts include solves left by earlier tests.
    expect(await solvesRepo.findAll(sessionId)).toHaveLength(500);

    const removed = await solvesRepo.deleteBySession(sessionId);
    expect(removed).toBe(500);
    expect(await solvesRepo.findAll(sessionId)).toEqual([]);
  }, 30_000);

  it('returns timestamp ASC even when solves are inserted out of order', async () => {
    const sessionId = UUID(4);
    await sessionsRepo.insert({
      id: sessionId,
      name: 'Order',
      puzzleType: '3x3x3',
      createdAt: 1_700_000_000_000,
    });
    const base = 1_700_000_000_000;
    // Shuffled minutes: 0, 5, 2, 4, 1, 3.
    const timestamps = [0, 5, 2, 4, 1, 3].map((m) => base + m * 60_000);
    const batch = timestamps.map((t, i) => ({
      ...makeSolve(3000 + i, sessionId, base),
      timestamp: t,
    }));
    await solvesRepo.insertMany(batch);

    const all = await solvesRepo.findAll(sessionId);
    expect(all.map((s) => s.timestamp)).toEqual([...timestamps].sort((a, b) => a - b));
  }, 30_000);

  it('insertMany([]) is a no-op on the real engine', async () => {
    const countBefore = await solvesRepo.count();
    expect(await solvesRepo.insertMany([])).toBe(0);
    expect(await solvesRepo.count()).toBe(countBefore);
  });
});
