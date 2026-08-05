/**
 * Execution-level regression tests for the migration runner.
 *
 * These run the REAL migration SQL against an in-memory sqlite-wasm database
 * (the same engine the web worker uses), so they catch SQL errors the static
 * `migrations.test.ts` invariants cannot, and they reproduce the wedged-DB
 * bug that blocked app startup ("table training_exercises already exists").
 *
 * The migration loop below mirrors `runMigrations()` in ../worker.ts — keep
 * them in sync.
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

let dbSeq = 0;
/** Open a fresh, uniquely-named in-memory database. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  return new sqlite3.oo1.DB(`/mem-${dbSeq}.sqlite3`, 'c');
}

/**
 * Mirrors `runMigrations()` in ../worker.ts: each migration (plus its
 * `_migrations` record) runs inside a transaction so a failure can never
 * leave partial state behind.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runMigrations(db: any, migrations: Migration[] = MIGRATIONS): void {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'array' }) as any[][];
  const applied = new Set((rows || []).map((r) => r[0]));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec('INSERT OR IGNORE INTO _migrations (id) VALUES (?)', { bind: [migration.id] });
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tableNames(db: any): string[] {
  const rows = db.exec({
    sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    rowMode: 'array',
  }) as string[][];
  return (rows || []).map((r) => r[0]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appliedIds(db: any): string[] {
  const rows = db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'array' }) as string[][];
  return (rows || []).map((r) => r[0]);
}

describe('migration runner (execution against real sqlite)', () => {
  it('applies every migration on a fresh database', () => {
    const db = openDb();
    try {
      runMigrations(db);
      const tables = tableNames(db);
      for (const t of [
        'solves',
        'sessions',
        'training_exercises',
        'training_attempts',
        'algorithm_progress',
        'exercise_progress',
        'training_sessions',
        'profiles',
        'app_meta',
        'algorithm_cases',
        'algorithm_subsets',
        'algorithm_methods',
        'algorithm_records',
        'training_tasks',
        'skill_progress',
        '_migrations',
      ]) {
        expect(tables).toContain(t);
      }
      expect(appliedIds(db).sort()).toEqual(MIGRATIONS.map((m) => m.id).sort());
    } finally {
      db.close();
    }
  });

  it('is a no-op when re-run over an already-migrated database', () => {
    const db = openDb();
    try {
      runMigrations(db);
      expect(() => runMigrations(db)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('self-heals a wedged database: orphan training_exercises with no 022 record', () => {
    const db = openDb();
    try {
      runMigrations(db);
      // Reproduce the reported bug: a worker killed mid-migration left the
      // table behind without recording the migration id.
      db.exec('DELETE FROM _migrations WHERE id = ?', { bind: ['022_baseline_v2'] });
      // Re-running used to throw "table training_exercises already exists",
      // failing init and cascading into profile/session/onboarding failures.
      expect(() => runMigrations(db)).not.toThrow();
      expect(appliedIds(db)).toContain('022_baseline_v2');
      expect(tableNames(db)).toContain('training_exercises');
    } finally {
      db.close();
    }
  });

  it('heals a database that only has the orphan table (no migrations recorded)', () => {
    const db = openDb();
    try {
      // A DB created by an interrupted first run: orphan registry table with
      // no `_migrations` bookkeeping at all.
      db.exec(
        "CREATE TABLE training_exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'drill', method_id TEXT, created_at INTEGER NOT NULL DEFAULT 0)",
      );
      expect(() => runMigrations(db)).not.toThrow();
      // The registry survives with its canonical columns.
      const cols = db.exec({ sql: 'PRAGMA table_info(training_exercises)', rowMode: 'array' }) as string[][];
      const names = cols.map((c) => c[1]);
      expect(names).toContain('kind');
      expect(names).toContain('method_id');
      expect(appliedIds(db).length).toBe(MIGRATIONS.length);
    } finally {
      db.close();
    }
  });

  it('rolls a failed migration back atomically (no orphan tables, no record)', () => {
    const db = openDb();
    try {
      const bad: Migration = {
        id: '999_bad_migration',
        description: 'intentionally broken migration',
        sql: `
          CREATE TABLE should_rollback (id INTEGER PRIMARY KEY);
          CREATE TABLE uniq (id INTEGER NOT NULL UNIQUE);
          INSERT INTO uniq (id) VALUES (1);
          INSERT INTO uniq (id) VALUES (1);
        `,
      };
      expect(() => runMigrations(db, [bad])).toThrow();
      // Nothing from the failed migration may survive — including its record.
      expect(tableNames(db)).not.toContain('should_rollback');
      expect(tableNames(db)).not.toContain('uniq');
      expect(appliedIds(db)).not.toContain('999_bad_migration');
    } finally {
      db.close();
    }
  });
});
