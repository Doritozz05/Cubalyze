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
 * Apply remote tombstones locally. The deletes fire the local triggers and
 * re-create tombstones — that is fine: they are idempotent and the natural
 * termination (a second apply deletes nothing) prevents any loop.
 */
export async function applyRemoteTombstones(
  ctx: SyncContext,
  rows: CloudTombstone[],
): Promise<number> {
  let applied = 0;
  for (const t of rows) {
    switch (t.entity) {
      case "solves":
        await ctx.solves.delete(t.entity_id);
        break;
      case "sessions":
        await ctx.sessions.delete(t.entity_id);
        break;
      case "training_tasks":
        await ctx.calendar.delete(t.entity_id);
        break;
      case "skill_progress":
        await ctx.skills.setIncomplete(t.entity_id);
        break;
      case "training_sessions":
        await ctx.training.deleteTrainingSession(t.entity_id);
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
