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
 * `_backup_v1_*` tables so nothing is silently lost. Idempotent.
 */
async function backupLegacyTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
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
    const exists = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=$1",
      [t],
    );
    if (exists.length === 0) continue;
    const backupName = `_backup_v1_${t}`;
    const hasBackup = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=$1",
      [backupName],
    );
    if (hasBackup.length > 0) continue;
    try {
      await db.execute(`CREATE TABLE "${backupName}" AS SELECT * FROM "${t}"`);
      console.log(`[Database] Backed up legacy table ${t} → ${backupName}`);
    } catch (e) {
      // Non-fatal: a backup failure must never block migrations.
      console.warn(`[Database] backup of ${t} failed (non-fatal):`, e);
    }
  }
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
