/**
 * Shared v1 → v2 data-restore statements.
 *
 * Migration 022 (baseline v2) DROPs the legacy `solves`/`sessions` tables
 * and recreates them empty. Before that happens, `backupLegacyTables()`
 * snapshots the old rows into `_backup_v1_*` tables. These statements copy
 * those snapshots back into the v2 schema, converting v1 TEXT ISO dates →
 * v2 INTEGER epoch-milliseconds.
 *
 * Used by BOTH storage backends:
 *  - `packages/database/src/worker.ts` (web: sqlite-wasm / OPFS)
 *  - `apps/desktop/src/database-override.ts` (Tauri: native SQLite)
 *
 * Kept here so the SQL conversion logic lives in exactly one testable place.
 */

const ISO_MS = (col: string) =>
  `COALESCE(CAST((julianday(${col}) - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))`;

/** Copy `_backup_v1_sessions` → `sessions` (sessions first: solves FK depends on it). */
export const RESTORE_SESSIONS_SQL = `
  INSERT OR IGNORE INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo)
  SELECT
    id,
    name,
    COALESCE(puzzle_type, '3x3x3'),
    ${ISO_MS('created_at')},
    ${ISO_MS('updated_at')},
    COALESCE(is_demo, 0)
  FROM _backup_v1_sessions;
`;

/** Copy `_backup_v1_solves` → `solves` (v1 `date` TEXT → v2 `timestamp` INTEGER). */
export const RESTORE_SOLVES_SQL = `
  INSERT OR IGNORE INTO solves (
    id, session_id, time_ms, timestamp, scramble, penalty, method, source,
    note, moves, orientation_timeline, analysis_engine_version, analysis,
    puzzle_type, is_demo, created_at, updated_at
  )
  SELECT
    id,
    session_id,
    time_ms,
    COALESCE(CAST((julianday(date) - 2440587.5) * 86400000 AS INTEGER), 0),
    scramble,
    penalty,
    method,
    source,
    note,
    moves,
    orientation_timeline,
    analysis_engine_version,
    analysis,
    COALESCE(puzzle_type, '3x3x3'),
    COALESCE(is_demo, 0),
    ${ISO_MS('created_at')},
    ${ISO_MS('updated_at')}
  FROM _backup_v1_solves;
`;

/**
 * Count rows in a `_backup_v1_*` table that did NOT make it into the v2
 * target (no row with the same id exists). Used to decide whether dropping
 * the snapshot is safe.
 */
export function restoreMissingCountSql(backupTable: string, targetTable: string): string {
  return `SELECT COUNT(*) FROM "${backupTable}" b WHERE NOT EXISTS (SELECT 1 FROM "${targetTable}" s WHERE s.id = b.id)`;
}
