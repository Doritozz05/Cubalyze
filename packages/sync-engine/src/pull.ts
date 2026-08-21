/**
 * Pull — download everything the cloud has that is newer than the pull
 * watermark, applying rows locally with LWW (the newer updated_at wins;
 * when local is newer the row is left alone and the next push carries it up).
 *
 * Tombstones are applied first so rows deleted on another device disappear
 * here too. After a pull the engine rebuilds the derived aggregates from the
 * (now complete) attempt log — see rebuild.ts.
 */

import {
  cloudRowToAttempt,
  cloudRowToProfile,
  cloudRowToSession,
  cloudRowToSolve,
  cloudRowToTask,
  cloudRowToTrainingSession,
  type CloudRow,
} from "./mappers";
import {
  applyRemoteTombstones,
  isCloudTombstone,
} from "./tombstones";
import type { SyncContext, SyncTotals } from "./types";
import { getWatermark, pullWatermarkKey, setWatermark } from "./watermarks";

interface TableDef {
  watermarkColumn: string;
}

/** Watermark column per table (the LWW field the pull cursor uses). */
const TABLE_DEFS: Record<string, TableDef> = {
  solves: { watermarkColumn: "updated_at" },
  sessions: { watermarkColumn: "updated_at" },
  profiles: { watermarkColumn: "updated_at" },
  training_attempts: { watermarkColumn: "updated_at" },
  training_sessions: { watermarkColumn: "updated_at" },
  training_tasks: { watermarkColumn: "updated_at" },
  skill_progress: { watermarkColumn: "completed_at" },
};

export async function pullChanges(
  ctx: SyncContext,
  uid: string,
): Promise<SyncTotals> {
  const totals: SyncTotals = {
    pushed: {},
    pulled: {},
    pushedTombstones: 0,
    appliedTombstones: 0,
    rebuilt: false,
  };

  // ── Tombstones first (deletes before rows) ─────────────────────────
  const tombResult = await ctx.supabase
    .from("sync_tombstones")
    .select("*")
    .eq("user_id", uid);
  if (tombResult.error) throw tombResult.error;
  const tombstones = (tombResult.data ?? []).filter(isCloudTombstone);
  if (tombstones.length > 0) {
    totals.appliedTombstones = await applyRemoteTombstones(ctx, tombstones);
  }

  // ── Tables ─────────────────────────────────────────────────────────
  for (const [table, def] of Object.entries(TABLE_DEFS)) {
    const wm = await getWatermark(ctx.meta, pullWatermarkKey(table, uid));
    const result = await ctx.supabase
      .from(table)
      .select("*")
      .eq("user_id", uid)
      .gt(def.watermarkColumn, wm)
      .order(def.watermarkColumn, { ascending: true });
    if (result.error) throw result.error;
    const rows = result.data as CloudRow[] | null;
    if (!rows || rows.length === 0) continue;

    await applyRows(ctx, table, rows);

    const maxWm = rows.reduce(
      (max, r) => Math.max(max, Number(r[def.watermarkColumn]) || 0),
      wm,
    );
    await setWatermark(ctx.meta, pullWatermarkKey(table, uid), maxWm);
    totals.pulled[table as keyof typeof totals.pulled] = rows.length;
  }

  return totals;
}

/** Apply one table's pulled rows locally with per-row LWW. */
async function applyRows(
  ctx: SyncContext,
  table: string,
  rows: CloudRow[],
): Promise<void> {
  switch (table) {
    case "solves": {
      const toInsert: ReturnType<typeof cloudRowToSolve>[] = [];
      const toUpdate: ReturnType<typeof cloudRowToSolve>[] = [];
      const existing = await ctx.solves.findUpdatedAts(
        rows.map((r) => String(r.id)),
      );
      for (const row of rows) {
        const solve = cloudRowToSolve(row);
        const localUpdated = existing.get(solve.id) ?? 0;
        if (localUpdated === 0) toInsert.push(solve);
        else if (localUpdated < (solve.updatedAt ?? 0)) toUpdate.push(solve);
      }
      if (toInsert.length > 0) await ctx.solves.insertMany(toInsert);
      for (const solve of toUpdate) await ctx.solves.update(solve);
      break;
    }
    case "sessions": {
      const toInsert: ReturnType<typeof cloudRowToSession>[] = [];
      const toUpdate: ReturnType<typeof cloudRowToSession>[] = [];
      const existing = await ctx.sessions.findUpdatedAts(
        rows.map((r) => String(r.id)),
      );
      for (const row of rows) {
        const session = cloudRowToSession(row);
        const localUpdated = existing.get(session.id) ?? 0;
        if (localUpdated === 0) toInsert.push(session);
        else if (localUpdated < (session.updatedAt ?? 0)) toUpdate.push(session);
      }
      for (const session of toInsert) await ctx.sessions.insert(session);
      for (const session of toUpdate) await ctx.sessions.update(session);
      break;
    }
    case "profiles": {
      for (const row of rows) {
        const profile = cloudRowToProfile(row);
        const local = await ctx.profiles.findById(profile.userId);
        if (!local || (local.updatedAt ?? 0) < (profile.updatedAt ?? 0)) {
          await ctx.profiles.upsert(profile);
        }
      }
      break;
    }
    case "training_attempts": {
      for (const row of rows) {
        const attempt = cloudRowToAttempt(row);
        const local = await ctx.training.findAttemptById(attempt.id);
        if (!local) {
          await ctx.training.insertAttemptWithId(attempt);
        } else if ((local.updatedAt ?? 0) < (attempt.updatedAt ?? 0)) {
          await ctx.training.updateAttemptFromCloud(
            attempt.id,
            attempt.reviewGrade ?? null,
            attempt.updatedAt ?? 0,
          );
        }
      }
      break;
    }
    case "training_sessions": {
      for (const row of rows) {
        const record = cloudRowToTrainingSession(row);
        const local = await ctx.training.findTrainingSessionById(record.id);
        if (!local) {
          await ctx.training.upsertTrainingSession(record);
        } else if ((local.updatedAt ?? 0) < (record.updatedAt ?? 0)) {
          await ctx.training.upsertTrainingSession(record);
        }
      }
      break;
    }
    case "training_tasks": {
      for (const row of rows) {
        const task = cloudRowToTask(row);
        const local = await ctx.calendar.findById(task.id);
        if (!local || (local.updatedAt ?? 0) < (task.updatedAt ?? 0)) {
          await ctx.calendar.upsert(task);
        }
      }
      break;
    }
    case "skill_progress": {
      for (const row of rows) {
        await ctx.skills.setCompletedAt(
          String(row.skill_id),
          Number(row.completed_at) || 0,
        );
      }
      break;
    }
    default:
      break;
  }
}
