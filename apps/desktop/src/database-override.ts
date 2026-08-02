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
export { SolvesRepository, SessionsRepository, AlgorithmsRepository, TrainingRepository, CalendarRepository, SkillProgressRepository } from '../../../packages/database/src/repositories/index.js';
export type { Solve, Session, Algorithm, TrainingAttempt, AlgorithmProgress, ExerciseProgress, TrainingTask, TaskRepeat, TaskColor } from '../../../packages/database/src/repositories/index.js';

// ── Types ─────────────────────────────────────────────────────────────

type StorageType = 'opfs' | 'memory';

interface DBClient {
  execute(sql: string, bind?: unknown[]): Promise<Record<string, unknown>[]>;
  getStorageType(): StorageType;
  close(): Promise<void>;
}

// ── State ─────────────────────────────────────────────────────────────

let db: Awaited<ReturnType<typeof Database.load>> | null = null;
let initPromise: Promise<DBClient> | null = null;

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
        return 'opfs'; // Report as OPFS so the UI shows the green "persistent" message
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
      return 'opfs';
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
