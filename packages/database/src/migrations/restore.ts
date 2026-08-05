/**
 * Shared v1 → v2 data-restore statements.
 *
 * Migration 022 (baseline v2) DROPs the legacy `solves`/`sessions` tables
 * and recreates them empty. Before that happens, `backupLegacyTables()`
 * snapshots the old rows into `_backup_v1_*` tables. These statements copy
 * those snapshots back into the v2 schema, converting v1 TEXT ISO dates →
 * v2 INTEGER epoch-milliseconds.
 *
 * A `_backup_v1_*` snapshot can be one of two shapes:
 *  - REAL v1 data (pre-022 schema): `solves` has a TEXT `date` column and
 *    `sessions.created_at` is TEXT ISO → use `RESTORE_*_SQL` (converts).
 *  - A STALE v2-shaped snapshot: created when the backup gate ran against a
 *    DB that was already on the v2 schema but lacked the 022 marker (e.g. a
 *    dev DB that went through an earlier refactor iteration). Those rows
 *    already store INTEGER epoch-ms → use `RESTORE_*_V2_SNAPSHOT_SQL` (copies
 *    straight across; the `julianday` conversion would corrupt them).
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

/** Copy a v2-shaped `_backup_v1_solves` snapshot straight across (no conversion). */
export const RESTORE_SOLVES_V2_SNAPSHOT_SQL = `
  INSERT OR IGNORE INTO solves (
    id, session_id, time_ms, timestamp, scramble, penalty, method, source,
    note, moves, orientation_timeline, analysis_engine_version, analysis,
    puzzle_type, is_demo, created_at, updated_at
  )
  SELECT
    id,
    session_id,
    time_ms,
    timestamp,
    scramble,
    penalty,
    method,
    source,
    note,
    moves,
    orientation_timeline,
    analysis_engine_version,
    analysis,
    puzzle_type,
    is_demo,
    created_at,
    updated_at
  FROM _backup_v1_solves;
`;

/** Copy a v2-shaped `_backup_v1_sessions` snapshot straight across (no conversion). */
export const RESTORE_SESSIONS_V2_SNAPSHOT_SQL = `
  INSERT OR IGNORE INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo)
  SELECT
    id,
    name,
    puzzle_type,
    created_at,
    updated_at,
    is_demo
  FROM _backup_v1_sessions;
`;

/**
 * Probe SQL: is the snapshot a REAL v1 table (has the TEXT `date` column)?
 * Stale v2-shaped snapshots lack `date` (v2 renamed it to `timestamp`).
 */
export function backupHasDateColumnSql(backupTable: string): string {
  return `SELECT COUNT(*) AS c FROM pragma_table_info('${backupTable}') WHERE name = 'date'`;
}

/**
 * Probe SQL: what data shape does the snapshot store for `created_at`?
 * Returns `'text'` for v1 ISO strings, `'integer'`/`'real'` for v2 epoch-ms,
 * and `null` when the table is empty (either restore path is then a no-op).
 */
export function backupCreatedAtTypeSql(backupTable: string): string {
  return `SELECT typeof(created_at) AS t FROM "${backupTable}" LIMIT 1`;
}

/**
 * Count rows in a `_backup_v1_*` table that did NOT make it into the v2
 * target (no row with the same id exists). Used to decide whether dropping
 * the snapshot is safe.
 */
export function restoreMissingCountSql(backupTable: string, targetTable: string): string {
  return `SELECT COUNT(*) FROM "${backupTable}" b WHERE NOT EXISTS (SELECT 1 FROM "${targetTable}" s WHERE s.id = b.id)`;
}
