import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { loadSnapshot, saveSnapshot, clearSnapshot } from './indexeddb-snapshot.js';
import { resetPushWatermarkForMigrated } from './migrated-upload.js';
import * as Comlink from 'comlink';
import { MIGRATIONS } from './migrations/index.js';
import { RESTORE_SESSIONS_SQL, RESTORE_SOLVES_SQL, RESTORE_SESSIONS_V2_SNAPSHOT_SQL, RESTORE_SOLVES_V2_SNAPSHOT_SQL, backupHasDateColumnSql, backupCreatedAtTypeSql, restoreMissingCountSql } from './migrations/restore.js';

// The @sqlite.org/sqlite-wasm package exposes a runtime API that is not
// fully typed by the bundled type declarations. We use `any` for the `db`
// reference and the sqlite3 factory result because the public types do not
// cover the OPFS-backed OpfsDb constructor or the oo1 namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
/** Which storage backend the database is backed by. */
let _storageType: 'opfs' | 'sahpool' | 'memory-snapshot' = 'memory-snapshot';

/** The sqlite3 factory result (module-level so snapshot helpers can reach capi). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: any = null;

/**
 * Export the whole SQLite database as bytes.
 *
 * NOTE: the oo1 DB API of sqlite-wasm 3.53 does NOT have an `export()`
 * method — the export lives in `capi.sqlite3_js_db_export(db.pointer)`, which
 * returns a fresh Uint8Array owned by JS (no wasm memory cleanup needed).
 */
function exportDbBytes(): Uint8Array {
  if (!db || !sqlite) return new Uint8Array(0);
  const out = sqlite.capi.sqlite3_js_db_export(db.pointer);
  return out instanceof Uint8Array ? out : new Uint8Array(0);
}

/** Debounce timer for the memory-snapshot persistence. */
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let snapshotPromise: Promise<void> | null = null;
let snapshotNeedsSave = false;
let snapshotSaveFailed = false;

/**
 * Queue a full-DB snapshot write to IndexedDB (memory-snapshot tier only).
 * Debounced so bursts of writes coalesce into one snapshot. A failed snapshot
 * is re-queued on the next write (never silently lost).
 */
function scheduleSnapshot(): void {
  if (_storageType !== 'memory-snapshot' || !db) return;
  snapshotNeedsSave = true;
  if (snapshotPromise || snapshotTimer || snapshotSaveFailed) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    snapshotNeedsSave = false;
    snapshotPromise = (async () => {
      if (!db) return;
      const bytes = exportDbBytes();
      if (bytes.byteLength > 0) await saveSnapshot(bytes);
    })().catch((err) => {
      console.warn('[DB Worker] snapshot save failed (will retry on next write):', err);
      // Re-queue: the dirty flag stays set so the next write retries.
      snapshotSaveFailed = true;
      snapshotNeedsSave = true;
    }).finally(() => {
      snapshotPromise = null;
      if (!snapshotSaveFailed && snapshotNeedsSave) scheduleSnapshot();
      snapshotSaveFailed = false;
    });
  }, 500);
}

/** Flush any pending snapshot immediately (used on close). */
async function flushSnapshot(): Promise<void> {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  if (snapshotPromise) await snapshotPromise;
  if (snapshotNeedsSave) {
    snapshotNeedsSave = false;
    if (db) {
      const bytes = exportDbBytes();
      if (bytes.byteLength > 0) await saveSnapshot(bytes);
    }
  }
}

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
 * Count non-demo solves in the CURRENT db (the UI's real data).
 * Used to decide whether a tier migration should bring data over.
 */
function countRealSolves(): number {
  if (!db) return 0;
  try {
    const rows = db.exec({
      sql: 'SELECT COUNT(*) AS c FROM solves WHERE is_demo = 0',
      rowMode: 'array',
    }) as unknown[][];
    return Number(rows?.[0]?.[0]) || 0;
  } catch {
    // Table may not exist yet (pre-migration) — treat as empty.
    return 0;
  }
}

/**
 * If the freshly-opened backend is EMPTY but another storage tier holds real
 * data (a stale IndexedDB snapshot, or the OTHER OPFS directory), bring those
 * rows into the active tier BEFORE migrations run. This is the recovery path
 * for the case where a device's backend changed (e.g. OPFS classic →
 * opfs-sahpool after a browser update dropped cross-origin isolation): the
 * solves are not lost, they just live in a directory sqlite-wasm considers
 * invisible to the current one.
 *
 * Sources are tried in order (safest first):
 *   1. IndexedDB byte-snapshot (memory tier's last-resort store) — restore
 *      it into a throwaway in-memory handle and copy its sessions/solves.
 *   2. The OTHER OPFS directory (classic `OpfsDb` if we are on sahnpool, and
 *      vice-versa) — open it read-only and copy its sessions/solves.
 *
 * Only sessions + solves are migrated (the UI's data). Other tables
 * (training catalog, profiles, app_meta) are re-seeded/migrated fresh on the
 * active tier, so copying them would risk FK/id collisions. Idempotent:
 * INSERT OR IGNORE + re-running is a no-op, and once the active tier holds
 * data the gate (empty check) stops it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function migrateFromOtherTier(sqlite3: any): Promise<void> {
  if (!db) return;
  // Only when the active tier is empty — never overwrite existing data.
  if (countRealSolves() > 0) return;

  // ── Source 1: IndexedDB snapshot (memory tier) ────────────────────────
  const snapshot = await loadSnapshot();
  if (snapshot && snapshot.byteLength > 0) {
    try {
      // Open a throwaway in-memory DB and deserialize the snapshot.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src: any = new (sqlite3 as any).oo1.DB('/migration-source.sqlite3', 'c');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capi = (sqlite3 as any).capi;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pData = (sqlite3 as any).wasm.allocFromTypedArray(snapshot);
      const rc = capi.sqlite3_deserialize(
        src.pointer,
        'main',
        pData,
        snapshot.byteLength,
        snapshot.byteLength,
        capi.SQLITE_DESERIALIZE_RESIZEABLE | capi.SQLITE_DESERIALIZE_FREEONCLOSE,
      );
      if (rc === 0) {
        const { sessions, solves } = readAndCopySessions(src);
        console.log(
          `[DB Worker] Migrated ${solves} solve(s) / ${sessions} session(s) from IndexedDB snapshot.`,
        );
        // If a real account is linked on this device, let the next sync
        // re-upload the rescued rows (server-side LWW keeps the cloud safe
        // from stale overwrites — see migrated-upload.ts).
        if (sessions > 0 || solves > 0) {
          await resetPushWatermarkForMigrated(dbExec);
        }
        // The snapshot is now consumed — drop it so a later downgrade can't
        // resurrect it over the fresher active-tier copy.
        await clearSnapshot();
        try {
          src.close();
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        src.close();
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.warn('[DB Worker] snapshot migration failed (non-fatal):', e);
    }
  }

  // ── Source 2: the OTHER OPFS directory ────────────────────────────────
  const otherCtor = _storageType === 'sahpool' ? 'OpfsDb' : 'OpfsSAHPoolDb';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherCtor = (sqlite3 as any).oo1?.[otherCtor];
    if (!OtherCtor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const src: any = new OtherCtor('/cubeforge.sqlite3');
    const { sessions, solves } = readAndCopySessions(src);
    if (sessions > 0 || solves > 0) {
      console.log(`[DB Worker] Migrated ${solves} solve(s) / ${sessions} session(s) from ${otherCtor} (other OPFS directory).`);
      // Same rescue as the snapshot path: let the next sync re-upload.
      await resetPushWatermarkForMigrated(dbExec);
    }
    try {
      src.close();
    } catch {
      /* ignore */
    }
  } catch (e) {
    // The other VFS may not be installed in this context (e.g. no COI → no
    // classic OpfsDb) — expected and non-fatal.
    console.warn(`[DB Worker] ${otherCtor} migration unavailable (non-fatal):`, e);
  }
}

/**
 * Read sessions/solves from a GIVEN source DB handle and copy them into the
 * ACTIVE `db`, adapting to the source's schema. Returns the row counts
 * copied (for logging).
 *
 * Schema-aware (the source may be a snapshot of an OLD tier that predates
 * migration 022/026/027):
 *  - `sessions.created_at` may be TEXT ISO (v1) or INTEGER ms (v2).
 *  - `solves.timestamp` may be absent — v1 used `date TEXT` — and the other
 *    columns have v1/v2 shapes. We detect the source shape ONCE and build
 *    per-shape SELECTs; every row is INSERTed into the (already migrated)
 *    v2 target with normalized values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readAndCopySessions(src: any): { sessions: number; solves: number } {
  const hasTimestamp = src.exec({
    sql: "SELECT COUNT(*) AS c FROM pragma_table_info('solves') WHERE name = 'timestamp'",
    rowMode: 'array',
  }) as unknown[][];
  const isV2 = Number(hasTimestamp?.[0]?.[0]) > 0;

  // Sessions always exist; their created_at may be TEXT (v1) or INTEGER (v2).
  const sessionsSql = isV2
    ? 'SELECT id, name, created_at, updated_at, is_demo FROM sessions'
    : "SELECT id, name, CASE WHEN typeof(created_at) = 'text' THEN CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER) ELSE created_at END AS created_at, CASE WHEN typeof(updated_at) = 'text' THEN CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER) ELSE updated_at END AS updated_at, COALESCE(is_demo, 0) AS is_demo FROM sessions";
  const solvesSql = isV2
    ? 'SELECT id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at FROM solves'
    : "SELECT id, session_id, time_ms, CASE WHEN typeof(date) = 'text' THEN CAST((julianday(date) - 2440587.5) * 86400000 AS INTEGER) ELSE CAST(date AS INTEGER) END AS timestamp, scramble, penalty, method, source, note, moves, NULL AS orientation_timeline, NULL AS analysis_engine_version, NULL AS analysis, COALESCE(puzzle_type, '3x3x3') AS puzzle_type, COALESCE(is_demo, 0) AS is_demo, CASE WHEN typeof(created_at) = 'text' THEN CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER) ELSE created_at END AS created_at, CASE WHEN typeof(updated_at) = 'text' THEN CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER) ELSE updated_at END AS updated_at FROM solves";

  const sessions = src.exec({ sql: sessionsSql, rowMode: 'object' }) as Record<string, unknown>[];
  for (const s of sessions) {
    db.exec(
      'INSERT OR IGNORE INTO sessions (id, name, created_at, updated_at, is_demo) VALUES (?, ?, ?, ?, ?)',
      {
        bind: [
          s.id,
          s.name,
          Number(s.created_at) || 0,
          Number(s.updated_at) || 0,
          Number(s.is_demo) || 0,
        ],
      },
    );
  }

  const solves = src.exec({ sql: solvesSql, rowMode: 'object' }) as Record<string, unknown>[];
  for (const r of solves) {
    db.exec(
      'INSERT OR IGNORE INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      {
        bind: [
          r.id,
          r.session_id,
          Number(r.time_ms) || 0,
          Number(r.timestamp) || 0,
          r.scramble ?? '',
          r.penalty ?? 'none',
          r.method ?? null,
          r.source ?? 'manual',
          r.note ?? null,
          r.moves ?? '[]',
          r.orientation_timeline ?? null,
          r.analysis_engine_version ?? null,
          r.analysis ?? null,
          r.puzzle_type ?? '333',
          Number(r.is_demo) || 0,
          Number(r.created_at) || 0,
          Number(r.updated_at) || 0,
        ],
      },
    );
  }
  return { sessions: sessions.length, solves: solves.length };
}

/**
 * Minimal executor adapter for the migrated-row upload helper
 * (`resetPushWatermarkForMigrated`, see migrated-upload.ts): runs a
 * statement against the active `db` and resolves with its rows. The helper
 * is best-effort by design, so a failure resolves to an empty row list
 * instead of throwing.
 */
function dbExec(sql: string, bind?: unknown[]): Promise<Record<string, unknown>[]> {
  if (!db) return Promise.resolve([]);
  try {
    const rows = db.exec({
      sql,
      bind: (bind ?? []) as never[],
      rowMode: 'object',
    }) as Record<string, unknown>[];
    return Promise.resolve(rows ?? []);
  } catch {
    return Promise.resolve([]);
  }
}

/**
 * Open the OPFS-backed database, retrying transient failures (the cross-tab
 * WebLock is briefly held by another tab or by a Vite HMR reload). Only after
 * every attempt fails do we give up and let the caller fall back to the next
 * tier (sahpool → memory+IndexedDB).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openOpfsDbWithRetry(sqlite3: any, ctorName: 'OpfsDb' | 'OpfsSAHPoolDb'): Promise<any | null> {
  const attempts = 3;
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (sqlite3 as any).oo1[ctorName]('/cubeforge.sqlite3');
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        console.warn(`[DB Worker] ${ctorName} open failed (attempt ${i + 1}/${attempts}) — retrying…`, e);
        await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
      }
    }
  }
  console.warn(`[DB Worker] ${ctorName} open failed after ${attempts} attempts — falling back to the next storage tier.`, lastError);
  return null;
}

/**
 * Try the "opfs-sahpool" VFS — an OPFS-backed store which, unlike the
 * classic "opfs" VFS, does NOT require SharedArrayBuffer / COOP-COEP
 * cross-origin isolation. It only needs the File System Access API
 * (createSyncAccessHandle), which every Chromium/Firefox/Safari >= 16.4
 * worker provides. sqlite-wasm exposes it via `sqlite3.installOpfsSAHPoolVfs()`
 * and registers `oo1.OpfsSAHPoolDb` on success.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryOpenSahpoolDb(sqlite3: any): Promise<any | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poolUtil = await (sqlite3 as any).installOpfsSAHPoolVfs?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = poolUtil?.OpfsSAHPoolDb ?? (sqlite3 as any).oo1?.OpfsSAHPoolDb;
    if (!Ctor) return null;
    return await openOpfsDbWithRetry(sqlite3, 'OpfsSAHPoolDb');
  } catch (e) {
    console.warn('[DB Worker] opfs-sahpool unavailable; falling back to memory+IndexedDB:', e);
    return null;
  }
}

/**
 * Restore a full-database byte snapshot (from IndexedDB) into a fresh
 * in-memory SQLite handle using sqlite3_deserialize. Returns the new handle
 * or null when there is nothing to restore (first run).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openMemoryWithSnapshot(sqlite3: any): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
  const snapshot = await loadSnapshot();
  if (snapshot && snapshot.byteLength > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capi = (sqlite3 as any).capi;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pData = (sqlite3 as any).wasm.allocFromTypedArray(snapshot);
      const rc = capi.sqlite3_deserialize(
        db.pointer,
        'main',
        pData,
        snapshot.byteLength,
        snapshot.byteLength,
        capi.SQLITE_DESERIALIZE_RESIZEABLE | capi.SQLITE_DESERIALIZE_FREEONCLOSE,
      );
      if (rc !== 0) {
        console.warn('[DB Worker] snapshot restore failed; starting empty.', rc);
        db.close();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
      }
    } catch (e) {
      console.warn('[DB Worker] snapshot restore threw; starting empty.', e);
      try {
        db.close();
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
    }
  }
  return db;
}

export const DBWorker = {
  async init() {
    if (db) return true;

    try {
      const sqlite3 = await sqlite3InitModule();
      sqlite = sqlite3;

      // NOTE: sqlite-wasm 3.53.0 DELETES sqlite3.opfs during internal
      // asyncPostInit cleanup (line 4405 of index.mjs). Therefore checking
      // `(sqlite3 as any).opfs` ALWAYS returns undefined, even when OPFS
      // IS available. The correct availability check is:
      //   sqlite3.oo1?.OpfsDb  ← only exists if OPFS VFS was installed
      //
      // ── Storage tiers (best → last resort) ─────────────────────────────
      //   1. classic "opfs" VFS (OpfsDb)   — needs SharedArrayBuffer/COI
      //   2. "opfs-sahpool" VFS            — OPFS WITHOUT COI
      //   3. memory + IndexedDB snapshot   — works everywhere
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sqlite3 as any).oo1?.OpfsDb && !(sqlite3 as any).config?.disable?.vfs?.['opfs']) {
        console.log('[DB Worker] OPFS VFS available. Using OpfsDb (PERSISTENT).');
        const opfsDb = await openOpfsDbWithRetry(sqlite3, 'OpfsDb');
        if (opfsDb) {
          db = opfsDb;
          _storageType = 'opfs';
        } else {
          const sahpoolDb = await tryOpenSahpoolDb(sqlite3);
          if (sahpoolDb) {
            db = sahpoolDb;
            _storageType = 'sahpool';
          } else {
            db = await openMemoryWithSnapshot(sqlite3);
            _storageType = 'memory-snapshot';
          }
        }
      } else {
        // No OPFS VFS installed: try the no-COI sahpools, then memory+snapshot.
        const sahpoolDb = await tryOpenSahpoolDb(sqlite3);
        if (sahpoolDb) {
          db = sahpoolDb;
          _storageType = 'sahpool';
        } else {
          db = await openMemoryWithSnapshot(sqlite3);
          _storageType = 'memory-snapshot';
        }
      }

      // NOTE: the legacy ad-hoc kv_store table was removed here — its role is
      // covered by the versioned app_meta table created in migration 020.
      // Keeping schema changes inside migrations keeps the schema auditable.

      // Use WAL where the backend uses it (OPFS does; in-memory falls
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

      // Recover data when the active tier opened EMPTY but another tier
      // (IndexedDB snapshot or the other OPFS directory) still holds the
      // user's sessions/solves — e.g. after the backend changed on a device
      // (classic OPFS → opfs-sahpool, or a fresh install reusing a legacy
      // snapshot). Runs AFTER migrations so `app_meta` (used by the monotonic
      // clock) and the target tables exist; the rows are copied with their
      // original timestamps, so they sync exactly like the data that was
      // always there. Non-fatal: a failure must never block app startup.
      try {
        await migrateFromOtherTier(sqlite3);
      } catch (e) {
        console.warn('[DB Worker] cross-tier migration failed (non-fatal):', e);
      }

      // Enforce the FKs declared in the baseline schema for normal app
      // operation. `foreign_keys` is a per-connection pragma — must be set on
      // every open, and only after the migration DDL has finished (see above).
      db.exec('PRAGMA foreign_keys = ON;');

      // The LAST-RESORT tier (memory + IndexedDB snapshot) must capture the
      // freshly-migrated DB so a reload restores it instead of starting empty.
      if (_storageType === 'memory-snapshot') {
        try {
          const bytes = exportDbBytes();
          if (bytes.byteLength > 0) await saveSnapshot(bytes);
        } catch (e) {
          console.warn('[DB Worker] initial snapshot save failed (non-fatal):', e);
        }
      }

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
    // Trace the memory-snapshot tier after every write (writes imply dirty).
    if (_storageType === 'memory-snapshot' && /\b(insert|update|delete|create|drop|begin|commit|rollback)\b/i.test(sql)) {
      scheduleSnapshot();
    }
    return results;
  },

  async close() {
    if (db) {
      await flushSnapshot();
      db.close();
      db = null;
    }
    sqlite = null;
  },

  /** Returns the storage backend type so the UI can warn if data won't persist. */
  getStorageType() {
    return _storageType;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Comlink wiring — dedicated worker only.
//
// IMPORTANT (root cause of the production regression): sqlite-wasm's OPFS
// VFS is deliberately supported ONLY in dedicated workers ("The OPFS features
// used here are only available in dedicated Worker threads" — dist/index.mjs
// of @sqlite.org/sqlite-wasm). A SharedWorker pulls the whole storage layer
// back to volatile memory. So we always boot a DEDICATED worker here and
// never a SharedWorker.
//
// `typeof self !== 'undefined'` guards the Node/test environment, where the
// module is imported without a worker global.
if (typeof self !== 'undefined') {
  // Dedicated worker: `self` receives `message` events directly.
  Comlink.expose(DBWorker);
}
