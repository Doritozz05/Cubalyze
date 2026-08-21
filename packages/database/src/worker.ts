import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import * as Comlink from 'comlink';
import { MIGRATIONS } from './migrations/index.js';
import { RESTORE_SESSIONS_SQL, RESTORE_SOLVES_SQL, RESTORE_SESSIONS_V2_SNAPSHOT_SQL, RESTORE_SOLVES_V2_SNAPSHOT_SQL, backupHasDateColumnSql, backupCreatedAtTypeSql, restoreMissingCountSql } from './migrations/restore.js';

// The @sqlite.org/sqlite-wasm package exposes a runtime API that is not
// fully typed by the bundled type declarations. We use `any` for the `db`
// reference and the sqlite3 factory result because the public types do not
// cover the OPFS-backed OpfsDb constructor or the oo1 namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
/** Whether the database is backed by OPFS (persistent) or memory (volatile). */
let _storageType: 'opfs' | 'memory' = 'memory';

/**
 * Data safety net for the baseline v2 wipe (migration 022): before the
 * legacy tables are dropped and recreated, copy any existing rows into
 * `_backup_v1_*` tables so nothing is silently lost.
 *
 * Runs ONLY while the DB still predates v2 (migration 022 not yet applied).
 * After v2 is applied the backups are restored and dropped by
 * `restoreLegacyData()`, so gating here prevents re-snapshotting v2 tables
 * as "v1 backups" on every subsequent page load.
 */
function backupLegacyTables(): void {
  if (!db) throw new Error('Database not initialized');

  // Gate: once 022 (baseline v2) has been applied, there is nothing v1 left
  // to preserve — snapshotting the v2 tables would be a wasted full-table
  // copy on every init.
  if (tableExists('_migrations') && migrationApplied('022_baseline_v2')) {
    return;
  }

  const tables = [
    'solves',
    'sessions',
    'training_attempts',
    'algorithm_progress',
    'exercise_progress',
    'training_sessions',
    'algorithms',
  ];
  for (const t of tables) {
    if (!tableExists(t)) continue;
    const backupName = `_backup_v1_${t}`;
    if (tableExists(backupName)) continue;
    try {
      db.exec(`CREATE TABLE "${backupName}" AS SELECT * FROM "${t}"`);
      console.log(`[DB Worker] Backed up legacy table ${t} → ${backupName}`);
    } catch (e) {
      // Non-fatal: a backup failure must never block migrations.
      console.warn(`[DB Worker] backup of ${t} failed (non-fatal):`, e);
    }
  }
}

/** True when a table exists in sqlite_master. */
function tableExists(name: string): boolean {
  if (!db) throw new Error('Database not initialized');
  const rows = db.exec({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    bind: [name],
    rowMode: 'array',
  }) as unknown[][];
  return !!rows && rows.length > 0;
}

/** True when the given migration id is recorded in `_migrations`. */
function migrationApplied(id: string): boolean {
  if (!db) throw new Error('Database not initialized');
  const rows = db.exec({
    sql: 'SELECT id FROM _migrations WHERE id = ?',
    bind: [id],
    rowMode: 'array',
  }) as unknown[][];
  return !!rows && rows.length > 0;
}

/** True when a `_backup_v1_*` snapshot is REAL v1 data (has a `date` column). */
function backupIsV1(backupTable: string): boolean {
  if (!db) throw new Error('Database not initialized');
  const rows = db.exec({
    sql: backupHasDateColumnSql(backupTable),
    rowMode: 'array',
  }) as unknown[][];
  return Number(rows?.[0]?.[0]) > 0;
}

/**
 * True when a `_backup_v1_*` snapshot stores v1-style dates (TEXT ISO or
 * NULL): anything that is NOT a numeric epoch-ms value routes to the v1
 * conversion path, whose COALESCE repairs NULL timestamps — the v2 snapshot
 * path cannot (v2 `created_at` is NOT NULL).
 */
function backupHasTextDates(backupTable: string): boolean {
  if (!db) throw new Error('Database not initialized');
  const rows = db.exec({
    sql: backupCreatedAtTypeSql(backupTable),
    rowMode: 'array',
  }) as unknown[][];
  const type = rows?.[0]?.[0];
  return type !== 'integer' && type !== 'real';
}

/**
 * Restore user data that migration 022 (baseline v2) dropped and recreated
 * empty: copies `_backup_v1_sessions`/`_backup_v1_solves` back into the new
 * v2 schema, converting v1 TEXT ISO dates → v2 INTEGER epoch-milliseconds.
 *
 * Runs AFTER migrations so the v2 tables exist. Idempotent (INSERT OR
 * IGNORE + re-running is a no-op). Once every backup row is verified to
 * exist in the v2 table, the v1 snapshot is dropped so the DB stays clean;
 * otherwise the backup is kept as a recovery net.
 *
 * Schema-aware: a snapshot with a `date` column (or TEXT `created_at`) is
 * REAL v1 data and goes through the conversion path. A stale v2-shaped
 * snapshot (created when the backup gate ran against an already-v2 DB that
 * lacked the 022 marker — e.g. a dev DB from an earlier refactor iteration)
 * is copied straight across; converting its INTEGER timestamps with
 * `julianday` would corrupt them (and previously failed with
 * "no such column: date").
 *
 * NOTE: only `_backup_v1_sessions`/`_backup_v1_solves` are restored. The
 * other snapshots (`_backup_v1_training_attempts`, `_backup_v1_algorithm_progress`,
 * `_backup_v1_exercise_progress`, `_backup_v1_training_sessions`, `_backup_v1_algorithms`)
 * are intentionally left in place as a manual-recovery net: the v2 training
 * catalog was re-seeded with new ids, so those rows cannot be mapped across
 * without breaking FKs.
 */
function restoreLegacyData(): void {
  if (!db) throw new Error('Database not initialized');

  const hasSessions = tableExists('_backup_v1_sessions');
  const hasSolves = tableExists('_backup_v1_solves');
  if (!hasSessions && !hasSolves) return;

  // Sessions first: v2 solves has a real FK on sessions.id.
  if (hasSessions) {
    db.exec(backupHasTextDates('_backup_v1_sessions') ? RESTORE_SESSIONS_SQL : RESTORE_SESSIONS_V2_SNAPSHOT_SQL);
  }

  if (hasSolves) {
    db.exec(backupIsV1('_backup_v1_solves') ? RESTORE_SOLVES_SQL : RESTORE_SOLVES_V2_SNAPSHOT_SQL);
  }

  // Cleanup: drop the v1 snapshot only after proving every row landed in
  // v2. Otherwise keep the backups as a recovery net.
  const dropIfFullyRestored = (backup: string, target: string) => {
    const missing = db.exec({
      sql: restoreMissingCountSql(backup, target),
      rowMode: 'array',
    }) as unknown[][];
    const count = Number(missing?.[0]?.[0]);
    if (count === 0) {
      db.exec(`DROP TABLE IF EXISTS "${backup}"`);
      console.log(`[DB Worker] Restored ${backup} → ${target}; dropped v1 snapshot.`);
    } else {
      console.warn(`[DB Worker] ${count} row(s) from ${backup} could not be restored — keeping backup table.`);
    }
  };
  if (hasSessions) dropIfFullyRestored('_backup_v1_sessions', 'sessions');
  if (hasSolves) dropIfFullyRestored('_backup_v1_solves', 'solves');
}

function runMigrations(): void {
  if (!db) throw new Error('Database not initialized');

  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');

  // Use the direct return value of exec() instead of the resultRows
  // out-parameter, which may behave unpredictably with OpfsDb.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.exec({ sql: 'SELECT id FROM _migrations', rowMode: 'array' }) as any[][];
  const applied = new Set((rows || []).map((r) => r[0]));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    // Each migration runs in its own transaction. If a statement fails — or
    // the worker is killed mid-run (e.g. a Vite HMR reload while exec() is
    // in flight) — the transaction is left uncommitted and SQLite rolls it
    // back on the next open. Without this, a crash between statements left
    // orphan tables such as `training_exercises` with no _migrations record,
    // wedging every later init with "table ... already exists".
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      // Use INSERT OR IGNORE so that reloads over an already-migrated OPFS
      // database don't crash on the UNIQUE constraint.
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

/**
 * Open the OPFS-backed database, retrying transient failures (the cross-tab
 * WebLock is briefly held by another tab or by a Vite HMR reload). Only after
 * every attempt fails do we give up and let the caller fall back to memory —
 * a fresh in-memory DB silently loses everything written to it on reload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openOpfsDbWithRetry(sqlite3: any): Promise<any | null> {
  const attempts = 3;
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (sqlite3 as any).oo1.OpfsDb('/cubeforge.sqlite3');
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        console.warn(`[DB Worker] OPFS open failed (attempt ${i + 1}/${attempts}) — retrying…`, e);
        await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
      }
    }
  }
  console.warn(`[DB Worker] OPFS open failed after ${attempts} attempts — falling back to memory (data lost on reload).`, lastError);
  return null;
}

export const DBWorker = {
  async init() {
    if (db) return true;

    try {
      const sqlite3 = await sqlite3InitModule();

      // NOTE: sqlite-wasm 3.53.0 DELETES sqlite3.opfs during internal
      // asyncPostInit cleanup (line 4405 of index.mjs). Therefore checking
      // `(sqlite3 as any).opfs` ALWAYS returns undefined, even when OPFS
      // IS available. The correct availability check is:
      //   sqlite3.oo1?.OpfsDb  ← only set if OPFS VFS was installed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sqlite3 as any).oo1?.OpfsDb) {
        console.log('[DB Worker] OPFS is available. Using OpfsDb (PERSISTENT).');
        const opfsDb = await openOpfsDbWithRetry(sqlite3);
        if (opfsDb) {
          db = opfsDb;
          _storageType = 'opfs';
        } else {
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

      // NOTE: the legacy ad-hoc kv_store table was removed here — its role is
      // now covered by the versioned app_meta table created in migration 020.
      // Keeping schema changes inside migrations keeps the schema auditable.

      // Use WAL where the backend supports it (OPFS does; in-memory falls
      // back silently).
      try {
        db.exec('PRAGMA journal_mode = WAL;');
      } catch {
        // In-memory DBs cannot switch to WAL — not an error.
      }

      // CRITICAL: `foreign_keys` must stay OFF while migrations run.
      // Migrations 026/027 rebuild `sessions` (parent) and `solves` (child)
      // via RENAME + DROP of the legacy tables. With FK enforcement ON, the
      // `DROP TABLE sessions_*_legacy` fires the solves FK's ON DELETE
      // CASCADE and deletes EVERY solve. Enable it only AFTER migrations and
      // the v1 restore have completed.

      // Preserve v1 data before the baseline v2 migration wipes it (first run
      // after upgrading from main only; idempotent afterwards).
      backupLegacyTables();

      runMigrations();

      // Migration 022 drops + recreates solves/sessions empty; bring the
      // backed-up v1 rows back into the v2 schema (no-op when no backup).
      // Non-fatal: a restore failure must never block app startup — the v1
      // snapshots stay in place as the recovery net.
      try {
        restoreLegacyData();
      } catch (e) {
        console.warn('[DB Worker] v1→v2 restore failed (non-fatal, backups kept):', e);
      }

      // Enforce the FKs declared in the baseline v2 schema for normal app
      // operation. `foreign_keys` is a per-connection pragma — must be set on
      // every open, and only after the migration DDL has finished (see above).
      db.exec('PRAGMA foreign_keys = ON;');

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

// ─────────────────────────────────────────────────────────────────────────
// Comlink wiring — dedicated AND shared workers.
//
// comlink >= 4.4 dropped SharedWorker support: `expose(obj, ep = globalThis)`
// wires `globalThis.addEventListener("message")`, which NEVER fires inside a
// SharedWorkerGlobalScope — connections arrive as `connect` events carrying a
// MessagePort, never as a global message event. Without explicit wiring the
// SharedWorker boots but never answers the main thread's `init()` request:
// the `await proxied.init()` in client.ts hangs forever (no error, no
// fallback, empty console, app stuck on skeletons).
//
// Detect the context via `onconnect` (SharedWorker-only) and expose on the
// per-connection port instead of globalThis. Dedicated workers keep the
// plain expose (globalThis receives message events directly).
// ─────────────────────────────────────────────────────────────────────────
// `typeof self !== 'undefined'` guards the Node/test environment, where
// the module is imported without a worker global.
if (typeof self !== 'undefined' && 'onconnect' in self) {
  // SharedWorker: one `connect` per tab; each port gets its own exposed
  // instance over the SAME shared SQLite handle (`db` is module state), so
  // every tab reads/writes one persistent database.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).onconnect = (event: MessageEvent & { ports: MessagePort[] }) => {
    const port = event.ports[0];
    Comlink.expose(DBWorker, port);
    // Adding the message listener above already starts the port implicitly;
    // make it explicit so it is robust across engines.
    port.start();
  };
} else {
  // Dedicated worker: `self` receives `message` events directly.
  Comlink.expose(DBWorker);
}
