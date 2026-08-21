/**
 * Tombstones — the delete channel of the row-sync model.
 *
 * Local deletes are captured by SQLite AFTER DELETE triggers (migration 028)
 * into `sync_tombstones`; the engine pushes them and purges them locally.
 * Remote tombstones are applied as plain deletes: deleting a row that does
 * not exist is a no-op, so re-applying the same tombstone on every pull
 * terminates naturally (the trigger only fires when a row is actually
 * deleted — after the first apply there is nothing left to delete).
 */

import type { CloudRow } from "./mappers";
import type { DBExecutor, SyncContext } from "./types";

export interface LocalTombstone {
  entity: string;
  entityId: string;
  deletedAt: number;
}

export async function readLocalTombstones(
  db: DBExecutor,
): Promise<LocalTombstone[]> {
  const rows = await db(
    "SELECT entity, entity_id, deleted_at FROM sync_tombstones ORDER BY deleted_at ASC",
  );
  return rows.map((r) => ({
    entity: String(r.entity),
    entityId: String(r.entity_id),
    deletedAt: Number(r.deleted_at) || 0,
  }));
}

/** Remove every local tombstone after a successful push. */
export async function purgeLocalTombstones(db: DBExecutor): Promise<void> {
  await db("DELETE FROM sync_tombstones");
}

/** Cloud tombstones come back with the user_id partition column. */
export interface CloudTombstone extends CloudRow {
  user_id: string;
  entity: string;
  entity_id: string;
  deleted_at: number;
}

/**
 * Apply remote tombstones locally with LWW: a tombstone only deletes a row
 * when the row was NOT edited after the tombstone's deleted_at (a newer
 * offline edit survives and is re-pushed, resurrecting the row). The deletes
 * fire the local triggers and re-create tombstones — idempotent, and the
 * natural termination (a second apply deletes nothing) prevents any loop.
 */
export async function applyRemoteTombstones(
  ctx: SyncContext,
  rows: CloudTombstone[],
): Promise<number> {
  let applied = 0;
  for (const t of rows) {
    switch (t.entity) {
      case "solves":
        await ctx.solves.deleteIfNotNewer(t.entity_id, t.deleted_at);
        break;
      case "sessions":
        await ctx.sessions.deleteIfNotNewer(t.entity_id, t.deleted_at);
        break;
      case "training_tasks":
        await ctx.calendar.deleteIfNotNewer(t.entity_id, t.deleted_at);
        break;
      case "skill_progress":
        await ctx.skills.setIncompleteIfNotNewer(t.entity_id, t.deleted_at);
        break;
      case "training_sessions":
        await ctx.training.deleteTrainingSessionIfNotNewer(
          t.entity_id,
          t.deleted_at,
        );
        break;
      default:
        continue; // unknown entity — ignore defensively
    }
    applied += 1;
  }
  return applied;
}

/** Shape guard for the tombstones returned by PostgREST. */
export function isCloudTombstone(row: CloudRow): row is CloudTombstone {
  return (
    typeof row.entity === "string" &&
    typeof row.entity_id === "string" &&
    typeof row.user_id === "string"
  );
}
