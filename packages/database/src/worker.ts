/* eslint-disable @typescript-eslint/no-explicit-any */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import * as Comlink from 'comlink';
import { MIGRATIONS } from './migrations/index.js';

let db: any = null;

function runMigrations(): void {
  if (!db) throw new Error('Database not initialized');

  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');

  const applied = new Set(
    db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'object', resultRows: [] })
      .resultRows?.map((r: any) => r.id) ?? []
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec(migration.sql);
    db.exec('INSERT INTO _migrations (id) VALUES (?)', { bind: [migration.id] });
  }
}

export const DBWorker = {
  async init() {
    if (db) return true;

    try {
      const sqlite3 = await sqlite3InitModule();

      if ((sqlite3 as any).opfs) {
        db = new (sqlite3 as any).oo1.OpfsDb('/cubeforge.sqlite3');
      } else {
        db = new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      runMigrations();

      return true;
    } catch (err) {
      console.error('Failed to initialize SQLite', err);
      return false;
    }
  },

  execute(sql: string, bind?: unknown[]) {
    if (!db) throw new Error('Database not initialized');

    const results: any[] = [];
    db.exec({
      sql,
      bind,
      rowMode: 'object',
      resultRows: results,
    });
    return results;
  },

  async close() {
    if (db) {
      db.close();
      db = null;
    }
  },
};

Comlink.expose(DBWorker);
