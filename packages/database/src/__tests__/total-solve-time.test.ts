/**
 * `SolvesRepository.totalEffectiveTimeMs` — execution tests against real
 * sqlite-wasm.
 *
 * The profile shows ONE number for "total solve time", and a total is easy to
 * get quietly wrong in ways no type can catch: counting a solve twice, missing
 * a session, adding a DNF that never finished, ignoring a +2, or swallowing
 * history written with an older penalty spelling. These tests pin each of
 * those, plus the invariant that matters most — the SQL aggregate and the app's
 * per-solve rule (`effectiveTime`, DNF included as "no time") must agree.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import { SolvesRepository } from '../repositories/solves.repository.js';
import type { Solve } from '@cubalyze/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 0;

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  const db = new sqlite3.oo1.DB(`/total-solve-time-${dbSeq}.sqlite3`, 'c');
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  for (const migration of MIGRATIONS) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec('INSERT OR IGNORE INTO _migrations (id) VALUES (?)', { bind: [migration.id] });
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`INSERT INTO sessions (id, name) VALUES ('${SESSION_A}', 'Main')`);
  db.exec(`INSERT INTO sessions (id, name) VALUES ('${SESSION_B}', '2x2')`);
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repoFor(db: any): SolvesRepository {
  return new SolvesRepository(async (sql, bind) => {
    const rows = db.exec({ sql, bind, rowMode: 'object' });
    return (rows ?? []) as Record<string, unknown>[];
  });
}

let idSeq = 0;
function solve(overrides: Partial<Solve> = {}): Solve {
  idSeq += 1;
  return {
    id: `solve-${idSeq}`,
    sessionId: SESSION_A,
    timeMs: 10_000,
    timestamp: 1767225600000 + idSeq,
    scramble: "R U R'",
    penalty: 'none',
    source: 'smart',
    moves: [],
    puzzleType: '333',
    ...overrides,
  } as Solve;
}

/** The app's own rule, re-stated here so the SQL cannot drift from it. */
function effectiveMs(solve: Solve): number | null {
  const penalty = String(solve.penalty ?? '').toUpperCase().trim();
  if (penalty === 'DNF') return null;
  const plus2 = penalty === '+2' || penalty === 'PLUS2' || penalty === 'PLUS_TWO';
  return solve.timeMs + (plus2 ? 2000 : 0);
}

describe('totalEffectiveTimeMs', () => {
  it('is 0 for an empty history', async () => {
    expect(await repoFor(openDb()).totalEffectiveTimeMs()).toBe(0);
  });

  it('sums EVERY session and EVERY puzzle type, once each', async () => {
    const repo = repoFor(openDb());
    // 10000 + 20000 + 30000 + 40000 — four solves, two sessions, four puzzles,
    // including a virtual one that also has a physical-event puzzle type.
    await repo.insert(solve({ sessionId: SESSION_A, puzzleType: '333', timeMs: 10_000 }));
    await repo.insert(solve({ sessionId: SESSION_A, puzzleType: '222', timeMs: 20_000 }));
    await repo.insert(solve({ sessionId: SESSION_B, puzzleType: 'pyram', timeMs: 30_000 }));
    await repo.insert(
      solve({ sessionId: SESSION_B, puzzleType: '333', timeMs: 40_000, source: 'virtual' }),
    );

    expect(await repo.totalEffectiveTimeMs()).toBe(100_000);
  });

  it('adds the +2 to the time it was applied to', async () => {
    const repo = repoFor(openDb());
    await repo.insert(solve({ timeMs: 10_000, penalty: 'none' }));
    await repo.insert(solve({ timeMs: 10_000, penalty: '+2' }));
    expect(await repo.totalEffectiveTimeMs()).toBe(22_000);
  });

  it('leaves DNFs out entirely — a failed attempt has no time to add', async () => {
    const repo = repoFor(openDb());
    await repo.insert(solve({ timeMs: 10_000 }));
    await repo.insert(solve({ timeMs: 9_999_999, penalty: 'DNF' }));
    expect(await repo.totalEffectiveTimeMs()).toBe(10_000);
  });

  it('treats the legacy lowercase `dnf` spelling as a DNF, not as a time', async () => {
    // The schema CHECK only admits 'none' | '+2' | 'dnf' | 'DNF', so lowercase
    // `dnf` is the one legacy spelling that can actually sit in a local row —
    // the SQL must not count it as a finished solve. The other spellings the
    // app's `normalizePenalty` understands ('plus2', 'PLUS_TWO') cannot be
    // written here at all, so a case-insensitive comparison is enough.
    const repo = repoFor(openDb());
    await repo.insert(solve({ timeMs: 10_000 }));
    await repo.insert(solve({ timeMs: 8_000, penalty: 'dnf' }));

    expect(await repo.totalEffectiveTimeMs()).toBe(10_000);
  });

  it('excludes demo solves, like every other profile statistic', async () => {
    const repo = repoFor(openDb());
    await repo.insert(solve({ timeMs: 10_000 }));
    await repo.insert(solve({ timeMs: 500_000 }), { isDemo: true });
    expect(await repo.totalEffectiveTimeMs()).toBe(10_000);
  });

  it('agrees with the per-solve rule applied to the same rows', async () => {
    // The one invariant that keeps the total honest: whatever the SQL does, it
    // must equal what the app would get by walking the history itself.
    const repo = repoFor(openDb());
    const history: Solve[] = [
      solve({ sessionId: SESSION_A, puzzleType: '333', timeMs: 12_345 }),
      solve({ sessionId: SESSION_A, puzzleType: '222', timeMs: 4_321, penalty: '+2' }),
      solve({ sessionId: SESSION_B, puzzleType: '333', timeMs: 33_333, penalty: 'DNF' }),
      solve({ sessionId: SESSION_B, puzzleType: '333oh', timeMs: 21_000, penalty: '+2' }),
      solve({ sessionId: SESSION_B, puzzleType: 'pyram', timeMs: 7_000 }),
    ];
    for (const row of history) await repo.insert(row);

    const expected = history.reduce((sum, row) => sum + (effectiveMs(row) ?? 0), 0);
    expect(await repo.totalEffectiveTimeMs()).toBe(expected);
    // And it is NOT the raw sum: the +2s and the DNF really did change it.
    const rawSum = history.reduce((sum, row) => sum + row.timeMs, 0);
    expect(expected).not.toBe(rawSum);
  });
});
