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
import { RESTORE_SESSIONS_SQL, RESTORE_SOLVES_SQL, restoreMissingCountSql } from '../../../packages/database/src/migrations/restore.js';

// ── Re-export repositories (pure logic, unchanged) ────────────────────
// NOTE: keep in sync with packages/database/src/repositories/index.js —
// the desktop aliases @cubeforge/database to this file, so any repository
// added upstream must be listed here too.
export { SolvesRepository, SessionsRepository, AlgorithmsRepository, TrainingRepository, CalendarRepository, SkillProgressRepository, AppMetaRepository, ProfilesRepository, USER_ID_KEY, ONBOARDING_KEY, generateUuid } from '../../../packages/database/src/repositories/index.js';
export type { Solve, Session, TrainingAttempt, AlgorithmProgress, ExerciseProgress, TrainingTask, TaskRepeat, TaskColor, Profile, ProfileRow, AppMetaRow } from '../../../packages/database/src/repositories/index.js';

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

/**
 * Restore user data that migration 022 (baseline v2) dropped and recreated
 * empty: copies `_backup_v1_sessions`/`_backup_v1_solves` back into the new
 * v2 schema, converting v1 TEXT ISO dates → v2 INTEGER epoch-milliseconds.
 * Runs AFTER migrations so the v2 tables exist. Idempotent. Drops the v1
 * snapshot only once every row is verified to exist in v2.
 */
async function restoreLegacyData(): Promise<void> {
  const database = db;
  if (!database) throw new Error('Database not initialized');

  const hasSessions = await tableExists('_backup_v1_sessions');
  const hasSolves = await tableExists('_backup_v1_solves');
  if (!hasSessions && !hasSolves) return;

  if (hasSessions) {
    await database.execute(RESTORE_SESSIONS_SQL);
  }

  if (hasSolves) {
    await database.execute(RESTORE_SOLVES_SQL);
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

    // Enforce the FKs declared in the baseline v2 schema (per-connection pragma).
    await db.execute('PRAGMA foreign_keys = ON');

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

    // Apply pending migrations in order
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await db.execute(migration.sql);
      await db.execute(
        'INSERT OR IGNORE INTO _migrations (id) VALUES ($1)',
        [migration.id],
      );
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
