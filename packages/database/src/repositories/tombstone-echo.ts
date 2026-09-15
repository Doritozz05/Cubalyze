/**
 * @cubalyze/database — Tombstone echoes
 *
 * Why the versioned (remote) deletes must not announce themselves.
 *
 * The sync pull applies a remote tombstone through the repositories' versioned
 * deletes (`deleteIfNotNewer` and friends). Every one of those DELETEs fires
 * the table's AFTER DELETE trigger, which records a tombstone with
 * `deleted_at = MAX(now, OLD.updated_at + 1)` — a FRESHER stamp than the
 * tombstone that caused it.
 *
 * Pushed back, that echo escalates the deletion. The whole point of the
 * versioned delete is that a row edited AFTER the delete survives
 * (`updated_at <= deleted_at` spares it) and is re-uploaded. But the echo
 * carries `now`, so by the time it reaches the cloud the still-alive newer row
 * satisfies `updated_at <= deleted_at` and is physically destroyed there —
 * permanently, for every device. The cloud already owns the original
 * tombstone, and every device receives it directly, so the echo is pure noise
 * that can only do damage.
 *
 * The rule that fixes it: only the device whose USER deleted the row announces
 * the deletion. Applying a remote tombstone deletes locally and says nothing.
 * That is what these helpers do — and the `deleted` guard is load-bearing: a
 * device that had ALREADY deleted the row on its own (its tombstone still
 * waiting to be pushed) must keep it, or the deletion would never reach the
 * cloud and the row would resurrect on the next pull.
 */

export type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Max ids per IN () clause — far below SQLite's variable limit. */
const ID_BATCH = 400;

/**
 * `true` when the versioned delete will actually remove a row: one exists and
 * it was not edited after the tombstone. Call it BEFORE deleting — it is what
 * distinguishes "this apply deleted the row" (an echo to drop) from "the row
 * was already gone" (a local tombstone that must be preserved).
 */
export async function rowIsDoomed(
  db: DBExecutor,
  table: string,
  idColumn: string,
  id: string,
  stampColumn: string,
  deletedAt: number,
): Promise<boolean> {
  const rows = await db(
    `SELECT 1 AS hit FROM ${table} WHERE ${idColumn} = ? AND ${stampColumn} <= ? LIMIT 1`,
    [id, deletedAt],
  );
  return rows.length > 0;
}

/** Ids of the rows of `table` that a versioned delete would remove. */
export async function doomedIds(
  db: DBExecutor,
  table: string,
  idColumn: string,
  whereSql: string,
  bind: unknown[],
  stampColumn: string,
  deletedAt: number,
): Promise<string[]> {
  const rows = await db(
    `SELECT ${idColumn} AS id FROM ${table} WHERE ${whereSql} AND ${stampColumn} <= ?`,
    [...bind, deletedAt],
  );
  return rows.map((r) => String(r.id));
}

/**
 * Drop the tombstone rows the DELETE triggers just wrote for `ids` — the echo
 * of a remote tombstone, which must never be pushed (see the file header).
 */
export async function purgeTombstoneEchoes(
  db: DBExecutor,
  entity: string,
  ids: string[],
): Promise<void> {
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const chunk = ids.slice(i, i + ID_BATCH);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(', ');
    await db(
      `DELETE FROM sync_tombstones WHERE entity = ? AND entity_id IN (${placeholders})`,
      [entity, ...chunk],
    );
  }
}
