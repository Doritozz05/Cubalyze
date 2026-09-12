/**
 * Migration 033 — `solves.method` scope repair (execution against real sqlite).
 *
 * The bug: `method` was a blind copy of the global method preference, so every
 * event persisted "CFOP" — a 2×2 or Pyraminx solve claims a method that does not
 * exist for that event. Only the events whose registry spec declares analysis
 * methods (333, 333oh) keep a method.
 *
 * These tests run the REAL migration SQL against an in-memory sqlite-wasm
 * database (the same engine the worker uses), because the two things that can
 * silently break the repair are execution details, not shapes:
 *
 *   1. the rows must take a NEW monotonic stamp, or the correction never leaves
 *      the device (push selects `updated_at > watermark`);
 *   2. `local_clock_solves` must end up ahead of those stamps, or the next local
 *      edit of a repaired row is born below its own `updated_at` and loses the
 *      cloud LWW guard (`excluded.updated_at >= solves.updated_at`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import type { Migration } from '../migrations/migrations.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

const REPAIR_ID = '033_repair_method_scope';
const BEFORE_REPAIR: Migration[] = MIGRATIONS.filter((m) => m.id !== REPAIR_ID);

const REPAIR = MIGRATIONS.find((m) => m.id === REPAIR_ID);
if (!REPAIR) throw new Error(`Migration ${REPAIR_ID} is missing`);

let dbSeq = 0;
/** Open a fresh, uniquely-named in-memory database. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  return new sqlite3.oo1.DB(`/method-repair-${dbSeq}.sqlite3`, 'c');
}

/** Mirrors `runMigrations()` in ../worker.ts (transactions + `_migrations`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runMigrations(db: any, migrations: Migration[]): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'array' }) as any[][];
  const applied = new Set((rows || []).map((r) => r[0]));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec('INSERT OR IGNORE INTO _migrations (id) VALUES (?)', {
        bind: [migration.id],
      });
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Transaction already gone — nothing left to unwind.
      }
      throw err;
    }
  }
}

interface SeedSolve {
  id: string;
  puzzleType: string;
  method: string | null;
  updatedAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function seedSolve(db: any, solve: SeedSolve): void {
  db.exec(
    `INSERT INTO solves
       (id, session_id, time_ms, timestamp, scramble, penalty, method, source,
        note, moves, orientation_timeline, analysis_engine_version, analysis,
        puzzle_type, is_demo, created_at, updated_at)
     VALUES (?, 'session-1', 12345, ?, 'R U R', 'none', ?, 'manual',
        NULL, '[]', NULL, NULL, NULL, ?, 0, ?, ?)`,
    {
      bind: [
        solve.id,
        solve.updatedAt,
        solve.method,
        solve.puzzleType,
        solve.updatedAt,
        solve.updatedAt,
      ],
    },
  );
}

/** Open a DB with the full pre-repair schema, one session and the given rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openSeededDb(solves: SeedSolve[], localClock?: number): any {
  const db = openDb();
  runMigrations(db, BEFORE_REPAIR);
  db.exec(
    `INSERT INTO sessions (id, name, created_at, updated_at, is_demo)
     VALUES ('session-1', 'Main session', 1, 1, 0)`,
  );
  for (const solve of solves) seedSolve(db, solve);
  if (localClock !== undefined) {
    db.exec("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('local_clock_solves', ?)", {
      bind: [String(localClock)],
    });
  }
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSolves(db: any): Record<string, unknown>[] {
  return db.exec({
    sql: 'SELECT id, method, puzzle_type, updated_at FROM solves ORDER BY id',
    rowMode: 'object',
  }) as Record<string, unknown>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readLocalClock(db: any): number {
  const rows = db.exec({
    sql: "SELECT value FROM app_meta WHERE key = 'local_clock_solves'",
    rowMode: 'array',
  }) as unknown[][];
  return Number(rows?.[0]?.[0] ?? 0);
}

/** A fixed past stamp so the repair's wall-clock floor is always higher. */
const PAST = Date.UTC(2026, 0, 1);

describe('migration 033 — method scope repair', () => {
  it('clears the method on events with no method and keeps it on 333 / 333oh', () => {
    const db = openSeededDb([
      { id: 's-222', puzzleType: '222', method: 'CFOP', updatedAt: PAST },
      { id: 's-pyram', puzzleType: 'pyram', method: 'CFOP', updatedAt: PAST },
      { id: 's-333', puzzleType: '333', method: 'CFOP', updatedAt: PAST },
      { id: 's-oh', puzzleType: '333oh', method: 'Roux', updatedAt: PAST },
    ]);
    try {
      runMigrations(db, [REPAIR]);

      const byId = new Map(readSolves(db).map((r) => [String(r.id), r]));
      expect(byId.get('s-222')?.method).toBeNull();
      expect(byId.get('s-pyram')?.method).toBeNull();
      expect(byId.get('s-333')?.method).toBe('CFOP');
      expect(byId.get('s-oh')?.method).toBe('Roux');
    } finally {
      db.close();
    }
  });

  it('leaves rows that already had no method untouched, stamp included', () => {
    const db = openSeededDb([
      { id: 's-empty', puzzleType: '222', method: null, updatedAt: PAST },
      { id: 's-333', puzzleType: '333', method: 'CFOP', updatedAt: PAST },
    ]);
    try {
      runMigrations(db, [REPAIR]);

      const byId = new Map(readSolves(db).map((r) => [String(r.id), r]));
      expect(Number(byId.get('s-empty')?.updated_at)).toBe(PAST);
      expect(Number(byId.get('s-333')?.updated_at)).toBe(PAST);
    } finally {
      db.close();
    }
  });

  it('gives every repaired row a NEWER stamp so the fix can actually sync', () => {
    const db = openSeededDb([
      { id: 's-222', puzzleType: '222', method: 'CFOP', updatedAt: PAST },
      // A stamp ahead of the wall clock: the floor must still move it forward,
      // exactly like migration 031 learned for tombstones.
      { id: 's-future', puzzleType: 'pyram', method: 'CFOP', updatedAt: 9_999_999_999_999 },
    ]);
    try {
      runMigrations(db, [REPAIR]);

      const byId = new Map(readSolves(db).map((r) => [String(r.id), r]));
      expect(Number(byId.get('s-222')?.updated_at)).toBeGreaterThan(PAST);
      expect(Number(byId.get('s-future')?.updated_at)).toBeGreaterThan(9_999_999_999_999);
    } finally {
      db.close();
    }
  });

  it('advances the local write clock past every repair stamp', () => {
    const db = openSeededDb(
      [{ id: 's-222', puzzleType: '222', method: 'CFOP', updatedAt: PAST }],
      1,
    );
    try {
      runMigrations(db, [REPAIR]);

      const maxStamp = Math.max(...readSolves(db).map((r) => Number(r.updated_at)));
      expect(readLocalClock(db)).toBeGreaterThanOrEqual(maxStamp);
    } finally {
      db.close();
    }
  });

  it('never rewinds the local write clock', () => {
    const ahead = Date.now() + 60_000;
    const db = openSeededDb([{ id: 's-222', puzzleType: '222', method: 'CFOP', updatedAt: PAST }], ahead);
    try {
      runMigrations(db, [REPAIR]);

      expect(readLocalClock(db)).toBeGreaterThanOrEqual(ahead);
    } finally {
      db.close();
    }
  });

  it('is idempotent: re-running the SQL changes nothing', () => {
    const db = openSeededDb([
      { id: 's-222', puzzleType: '222', method: 'CFOP', updatedAt: PAST },
      { id: 's-333', puzzleType: '333', method: 'CFOP', updatedAt: PAST },
    ]);
    try {
      runMigrations(db, [REPAIR]);
      const afterFirst = readSolves(db);

      // The migration runner records the id and skips it, so execute the SQL
      // directly: the repair must be a no-op from any starting point.
      db.exec(REPAIR.sql);

      expect(readSolves(db)).toEqual(afterFirst);
    } finally {
      db.close();
    }
  });

  it('records itself and leaves the schema valid', () => {
    const db = openSeededDb([]);
    try {
      runMigrations(db, [REPAIR]);
      const rows = db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'array' }) as string[][];
      expect((rows || []).map((r) => r[0])).toContain(REPAIR_ID);
    } finally {
      db.close();
    }
  });
});
