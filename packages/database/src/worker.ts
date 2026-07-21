import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import * as Comlink from 'comlink';
import { MIGRATIONS } from './migrations/index.js';

// The @sqlite.org/sqlite-wasm package exposes a runtime API that is not
// fully typed by the bundled type declarations. We use `any` for the `db`
// reference and the sqlite3 factory result because the public types do not
// cover the OPFS-backed OpfsDb constructor or the oo1 namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
/** Whether the database is backed by OPFS (persistent) or memory (volatile). */
let _storageType: 'opfs' | 'memory' = 'memory';

function runMigrations(): void {
  if (!db) throw new Error('Database not initialized');

  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');

  const applied = new Set(
    db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'object', resultRows: [] })
      .resultRows?.map((r: { id: string }) => r.id) ?? []
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sqlite3 as any).opfs) {
        console.log('[DB Worker] OPFS is available. Using OpfsDb (PERSISTENT).');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          db = new (sqlite3 as any).oo1.OpfsDb('/cubeforge.sqlite3');
          _storageType = 'opfs';
        } catch (e) {
          console.warn('[DB Worker] OPFS database failed to open (likely locked by another tab or HMR). Falling back to memory.', e);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          db = new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
          _storageType = 'memory';
        }
      } else {
        // Fallback to memory — DATA WILL BE LOST ON RELOAD
        console.warn('[DB Worker] OPFS NOT available. Using in-memory DB (DATA LOST ON RELOAD).');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db = new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
        _storageType = 'memory';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  /** Returns the storage backend type so the UI can warn if data won't persist. */
  getStorageType() {
    return _storageType;
  },
};

Comlink.expose(DBWorker);
