/**
 * Desktop database override — replaces sqlite-wasm + OPFS with
 * native SQLite via tauri-plugin-sql.
 *
 * On desktop, the Tauri custom protocol (tauri://localhost) does NOT
 * send the Cross-Origin-Isolation headers required for OPFS, so
 * sqlite-wasm always falls back to in-memory storage (DATA LOST ON
 * RELOAD). This adapter uses the Tauri SQL plugin which writes to a
 * real .db file in the user's AppData folder — persistent and fast.
 *
 * Zero changes to apps/web/ or packages/database/.
 */

import Database from '@tauri-apps/plugin-sql';
import { MIGRATIONS } from '../../../packages/database/src/migrations/index.js';
import { RESTORE_SESSIONS_SQL, RESTORE_SOLVES_SQL, RESTORE_SESSIONS_V2_SNAPSHOT_SQL, RESTORE_SOLVES_V2_SNAPSHOT_SQL, backupHasDateColumnSql, backupCreatedAtTypeSql, restoreMissingCountSql } from '../../../packages/database/src/migrations/restore.js';

// ── Re-export repositories (pure logic, unchanged) ────────────────────
// NOTE: keep in sync with packages/database/src/repositories/index.js —
// the desktop aliases @cubeforge/database to this file, so any repository
// added upstream must be listed here too. `apps/../desktop` is NOT a
// TypeScript project reference (tsconfig does not alias the package), so
// `tsc` resolves the real module and never notices a name missing here —
// only `vite build` fails, at bundle time, with MISSING_EXPORT. The guard
// test packages/database/src/__tests__/desktop-override.test.ts walks the
// package's public surface and fails when this list falls behind.
export { SolvesRepository, SessionsRepository, AlgorithmsRepository, TrainingRepository, CalendarRepository, SkillProgressRepository, AppMetaRepository, ProfilesRepository, GearRepository, USER_ID_KEY, ONBOARDING_KEY, DEVICE_ID_KEY, IDENTICON_SEED_KEY, generateUuid } from '../../../packages/database/src/repositories/index.js';
export type { Solve, Session, TrainingAttempt, AlgorithmProgress, ExerciseProgress, TrainingTask, TaskRepeat, TaskColor, Profile, ProfileRow, AppMetaRow, GearCategory, GearCategoryKind, GearType, GearItem, GearItemStatus, GearItemCondition, GearPrice, GearLink, GearPhotoRef, GearCollectionSnapshot, GearTable, GearPhotoSyncState, GearPhotoSyncStatus } from '../../../packages/database/src/repositories/index.js';

// ── Re-export smart-cube identity helpers ─────────────────────────────
// Pure string logic (no wasm, no OPFS), so the desktop uses the very same
// canonicalisation as web: a cube linked on one must still match on the other.
export { normalizeSmartId, formatSmartId, reverseSmartIdBytes, smartIdsMatch } from '../../../packages/database/src/smart-cube-id.js';
export type { NormalizedSmartId } from '../../../packages/database/src/smart-cube-id.js';

// ── Types ─────────────────────────────────────────────────────────────

type StorageType = 'desktop' | 'opfs' | 'memory';

interface DBClient {
  execute(sql: string, bind?: unknown[]): Promise<Record<string, unknown>[]>;
  getStorageType(): StorageType;
  close(): Promise<void>;
}

// ── State ─────────────────────────────────────────────────────────────

let db: Awaited<ReturnType<typeof Database.load>> | null = null;
let initPromise: Promise<DBClient> | null = null;

/**
 * Data safety net for the baseline v2 wipe (migration 022): before the
 * legacy tables are dropped and recreated, copy any existing rows into
 * `_backup_v1_*` tables so nothing is silently lost.
 *
 * Runs ONLY while the DB still predates v2 (migration 022 not yet applied).
 * After v2 is applied the backups are restored and dropped by
 * `restoreLegacyData()`, so gating here prevents re-snapshotting v2 tables
 * as "v1 backups" on every subsequent app launch.
 */
async function backupLegacyTables(): Promise<void> {
  const database = db;
  if (!database) throw new Error('Database not initialized');

  // Gate: once 022 (baseline v2) has been applied, there is nothing v1 left
  // to preserve — snapshotting the v2 tables would be a wasted full-table
  // copy on every launch.
  if ((await tableExists('_migrations')) && (await migrationApplied('022_baseline_v2'))) {
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
    if (!(await tableExists(t))) continue;
    const backupName = `_backup_v1_${t}`;
    if (await tableExists(backupName)) continue;
    try {
      await database.execute(`CREATE TABLE "${backupName}" AS SELECT * FROM "${t}"`);
      console.log(`[Database] Backed up legacy table ${t} → ${backupName}`);
    } catch (e) {
      // Non-fatal: a backup failure must never block migrations.
      console.warn(`[Database] backup of ${t} failed (non-fatal):`, e);
    }
  }
}

/** True when a table exists in sqlite_master. */
async function tableExists(name: string): Promise<boolean> {
  const database = db;
  if (!database) throw new Error('Database not initialized');
  const rows = await database.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=$1",
    [name],
  );
  return rows.length > 0;
}

/** True when the given migration id is recorded in `_migrations`. */
async function migrationApplied(id: string): Promise<boolean> {
  const database = db;
  if (!database) throw new Error('Database not initialized');
  const rows = await database.select<{ id: string }[]>(
    'SELECT id FROM _migrations WHERE id = $1',
    [id],
  );
  return rows.length > 0;
}

/** True when a `_backup_v1_*` snapshot is REAL v1 data (has a `date` column). */
async function backupIsV1(backupTable: string): Promise<boolean> {
  const database = db;
  if (!database) throw new Error('Database not initialized');
  const rows = await database.select<{ c: number }[]>(backupHasDateColumnSql(backupTable));
  return Number(rows?.[0]?.c) > 0;
}

/**
 * True when a `_backup_v1_*` snapshot stores v1-style dates (TEXT ISO or
 * NULL): anything that is NOT a numeric epoch-ms value routes to the v1
 * conversion path, whose COALESCE repairs NULL timestamps — the v2 snapshot
 * path cannot (v2 `created_at` is NOT NULL).
 */
async function backupHasTextDates(backupTable: string): Promise<boolean> {
  const database = db;
  if (!database) throw new Error('Database not initialized');
  const rows = await database.select<{ t: string | null }[]>(backupCreatedAtTypeSql(backupTable));
  const type = rows?.[0]?.t;
  return type !== 'integer' && type !== 'real';
}

/**
 * Restore user data that migration 022 (baseline v2) dropped and recreated
 * empty: copies `_backup_v1_sessions`/`_backup_v1_solves` back into the new
 * v2 schema, converting v1 TEXT ISO dates → v2 INTEGER epoch-milliseconds.
 * Runs AFTER migrations so the v2 tables exist. Idempotent. Drops the v1
 * snapshot only once every row is verified to exist in v2.
 *
 * Schema-aware: a snapshot with a `date` column (or TEXT `created_at`) is
 * REAL v1 data and goes through the conversion path. A stale v2-shaped
 * snapshot (created when the backup gate ran against an already-v2 DB that
 * lacked the 022 marker) is copied straight across — converting its INTEGER
 * timestamps with `julianday` would corrupt them.
 *
 * NOTE: only `_backup_v1_sessions`/`_backup_v1_solves` are restored. The
 * other snapshots (`_backup_v1_training_attempts`, `_backup_v1_algorithm_progress`,
 * `_backup_v1_exercise_progress`, `_backup_v1_training_sessions`, `_backup_v1_algorithms`)
 * are intentionally left in place as a manual-recovery net: the v2 training
 * catalog was re-seeded with new ids, so those rows cannot be mapped across
 * without breaking FKs.
 */
async function restoreLegacyData(): Promise<void> {
  const database = db;
  if (!database) throw new Error('Database not initialized');

  const hasSessions = await tableExists('_backup_v1_sessions');
  const hasSolves = await tableExists('_backup_v1_solves');
  if (!hasSessions && !hasSolves) return;

  // Sessions first: v2 solves has a real FK on sessions.id.
  if (hasSessions) {
    await database.execute(
      (await backupHasTextDates('_backup_v1_sessions')) ? RESTORE_SESSIONS_SQL : RESTORE_SESSIONS_V2_SNAPSHOT_SQL,
    );
  }

  if (hasSolves) {
    await database.execute(
      (await backupIsV1('_backup_v1_solves')) ? RESTORE_SOLVES_SQL : RESTORE_SOLVES_V2_SNAPSHOT_SQL,
    );
  }

  // Cleanup: drop the v1 snapshot only after proving every row landed in v2.
  const dropIfFullyRestored = async (backup: string, target: string) => {
    const missing = await database.select<{ c: number }[]>(
      restoreMissingCountSql(backup, target),
    );
    const count = Number(missing?.[0]?.c);
    if (count === 0) {
      await database.execute(`DROP TABLE IF EXISTS "${backup}"`);
      console.log(`[Database] Restored ${backup} → ${target}; dropped v1 snapshot.`);
    } else {
      console.warn(`[Database] ${count} row(s) from ${backup} could not be restored — keeping backup table.`);
    }
  };
  if (hasSessions) await dropIfFullyRestored('_backup_v1_sessions', 'sessions');
  if (hasSolves) await dropIfFullyRestored('_backup_v1_solves', 'solves');
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Detect whether a SQL statement is a read query (SELECT, WITH, PRAGMA)
 * vs a write query (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP).
 *
 * tauri-plugin-sql's Database uses `select()` for reads (returns rows)
 * and `execute()` for writes (returns {rowsAffected, lastInsertId}).
 */
function isReadQuery(sql: string): boolean {
  const trimmed = sql.trimStart().toUpperCase();
  return (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('PRAGMA')
  );
}

// ── Public API (matches DBWorker interface from worker.ts) ────────────

async function initDB(): Promise<DBClient> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Open (or create) the SQLite database in the user's AppData folder.
    // On Windows: C:\Users\<user>\AppData\Roaming\com.cubeforge.desktop\cubeforge.db
    db = await Database.load('sqlite:cubeforge.db');

    // CRITICAL: `foreign_keys` must stay OFF while migrations run (see the
    // same note in packages/database/src/worker.ts). Migrations 026/027 drop
    // the legacy `sessions` table while `solves` still references it; with FK
    // enforcement ON, that DROP fires ON DELETE CASCADE and deletes every
    // solve. Enable it only AFTER migrations + restore.

    // Preserve v1 data before the baseline v2 migration wipes it.
    await backupLegacyTables();

    // Create the migrations tracking table if it doesn't exist
    await db.execute(
      `CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      )`,
    );

    // Check which migrations have already been applied
    const appliedRows = await db.select<{ id: string }[]>(
      'SELECT id FROM _migrations',
    );
    const applied = new Set(appliedRows.map((r) => r.id));

    // Apply pending migrations in order. Each migration runs in its own
    // transaction: a failure (or the app being killed mid-run) can never
    // leave a partially-applied migration behind — the migration and its
    // _migrations record are committed (or rolled back) atomically.
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await db.execute('BEGIN');
      try {
        await db.execute(migration.sql);
        await db.execute(
          'INSERT OR IGNORE INTO _migrations (id) VALUES ($1)',
          [migration.id],
        );
        await db.execute('COMMIT');
      } catch (err) {
        try {
          await db.execute('ROLLBACK');
        } catch {
          // Transaction already gone — nothing left to unwind.
        }
        throw err;
      }
    }

    // Migration 022 drops + recreates solves/sessions empty; bring the
    // backed-up v1 rows back into the v2 schema (no-op when no backup).
    // Non-fatal: a restore failure must never block app startup — the v1
    // snapshots stay in place as the recovery net.
    try {
      await restoreLegacyData();
    } catch (e) {
      console.warn('[Database] v1→v2 restore failed (non-fatal, backups kept):', e);
    }

    // Enforce the FKs declared in the baseline v2 schema for normal app
    // operation (per-connection pragma — set only after migration DDL).
    await db.execute('PRAGMA foreign_keys = ON');

    console.log(
      '%c[Database]%c Storage: tauri-plugin-sql (persistent) — data saved to AppData folder.',
      'color:#4ade80;font-weight:bold',
      'color:inherit',
    );

    // Return a client compatible with the DBExecutor type used by repositories
    const client: DBClient = {
      async execute(sql: string, bind?: unknown[]) {
        if (!db) throw new Error('Database not initialized');
        if (isReadQuery(sql)) {
          return (await db.select<Record<string, unknown>[]>(sql, bind)) ?? [];
        }
        await db.execute(sql, bind);
        return [] as Record<string, unknown>[];
      },
      getStorageType(): StorageType {
        // Honest report: this backend is file-backed (Tauri plugin), equally
        // persistent as OPFS — the UI treats any non-'memory' value as safe.
        return 'desktop';
      },
      async close() {
        if (db) {
          await db.close();
          db = null;
        }
      },
    };

    return client;
  })();

  return initPromise;
}

function getDB(): DBClient {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return {
    async execute(sql: string, bind?: unknown[]) {
      if (!db) throw new Error('Database not initialized');
      if (isReadQuery(sql)) {
        return (await db.select<Record<string, unknown>[]>(sql, bind)) ?? [];
      }
      await db.execute(sql, bind);
      return [] as Record<string, unknown>[];
    },
    getStorageType(): StorageType {
      return 'desktop';
    },
    async close() {
      if (db) {
        await db.close();
        db = null;
      }
    },
  };
}

async function closeDB(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
  initPromise = null;
}

export { initDB, getDB, closeDB };
