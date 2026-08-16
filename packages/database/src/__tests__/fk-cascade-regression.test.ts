/**
 * Regression: migrations 026/027 must never cascade-delete solves.
 *
 * The web worker and desktop override enable `PRAGMA foreign_keys = ON`.
 * When 026/027 rebuild `sessions` (parent) and `solves` (child) via
 * RENAME + DROP, the RENAME rewrites the solves FK to point at the legacy
 * sessions table — so dropping that legacy table with FK enforcement ON
 * fired the solves FK's ON DELETE CASCADE and silently deleted EVERY solve.
 *
 * The original tests did not enable foreign_keys, so they missed it. These
 * tests run the migrations with foreign_keys ON (matching the app) and assert
 * row counts are preserved.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

/** Mirror of the worker's runMigrations, but with foreign_keys left ON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runMigrations(db: any, migrations: any[] = MIGRATIONS): void {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))");
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
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }
}

describe('FK cascade safety on rebuild migrations (foreign_keys=ON)', () => {
  it('026+027 preserve every solve with foreign_keys ON', () => {
    const db = new sqlite3.oo1.DB('/mem-fkcascade.sqlite3', 'c');
    try {
      db.exec('PRAGMA foreign_keys = ON;');
      const upTo025 = MIGRATIONS.filter(
        (m) => m.id !== '026_add_puzzle_type_check' && m.id !== '027_puzzle_type_wca_codes',
      );
      runMigrations(db, upTo025);

      db.exec("INSERT INTO sessions (id, name, puzzle_type) VALUES ('ses-a','Main','3x3x3'), ('ses-b','2x2','2x2x2')");
      db.exec(
        "INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, puzzle_type) VALUES " +
          "('sv-1','ses-a',1000,1700000000000,'R U R','3x3x3'), " +
          "('sv-2','ses-a',2000,1700000000000,'R U R U','3x3x3'), " +
          "('sv-3','ses-b',3000,1700000000000,'R U F','2x2x2')",
      );

      const count = () => Number(db.exec({ sql: 'SELECT COUNT(*) FROM solves', rowMode: 'array' })[0][0]);

      const a2 = MIGRATIONS.filter(
        (m) => m.id === '026_add_puzzle_type_check' || m.id === '027_puzzle_type_wca_codes',
      );
      runMigrations(db, a2);

      // The core regression: no solve may be cascade-deleted.
      expect(count()).toBe(3);

      // And the conversion still happened correctly.
      const pt = (id: string) =>
        String(db.exec({ sql: `SELECT puzzle_type FROM solves WHERE id='${id}'`, rowMode: 'array' })[0][0]);
      expect(pt('sv-1')).toBe('333');
      expect(pt('sv-3')).toBe('222');

      // FK enforcement is still active after the rebuilds (bad session_id fails).
      expect(() =>
        db.exec("INSERT INTO solves (id, session_id, time_ms, timestamp, puzzle_type) VALUES ('sv-x','nope',1,1700000000000,'333')"),
      ).toThrow();
    } finally {
      db.close();
    }
  });
});
