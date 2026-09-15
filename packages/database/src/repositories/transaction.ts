/**
 * @cubalyze/database — transaction helper
 *
 * SQLite transactions over the shared executor used by every repository.
 * The worker (web) and the Tauri plugin (desktop) keep ONE persistent
 * connection, so issuing BEGIN/COMMIT/ROLLBACK through the same executor
 * makes the wrapped statements atomic.
 */

export type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Run `fn` inside a single transaction. On any error the transaction is
 * rolled back and the error re-thrown. Nested calls are not supported —
 * keep transactions short and flat.
 */
export async function withTransaction<T>(
  db: DBExecutor,
  fn: (exec: DBExecutor) => Promise<T>,
): Promise<T> {
  await db('BEGIN');
  try {
    const result = await fn(db);
    await db('COMMIT');
    return result;
  } catch (err) {
    try {
      await db('ROLLBACK');
    } catch {
      // The connection may already be unusable — the original error matters.
    }
    throw err;
  }
}
