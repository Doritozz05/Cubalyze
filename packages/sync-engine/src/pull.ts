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
  // Order matters: SQLite enforces FKs (PRAGMA foreign_keys ON), and
  // solves.session_id references sessions(id) — so sessions MUST be inserted
  // before the solves pointing at them. Pulling solves first made every
  // first-login pull fail with SQLITE_CONSTRAINT_FOREIGNKEY and blocked sync
  // forever (the pull re-failed on the same rows each cycle).
  sessions: { watermarkColumn: "updated_at" },
  solves: { watermarkColumn: "updated_at" },
  profiles: { watermarkColumn: "updated_at" },
  training_sessions: { watermarkColumn: "updated_at" },
  training_attempts: { watermarkColumn: "updated_at" },
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
  // M4: tombstones have their own pull watermark (like every table), so a
  // device only downloads the deletes it has not seen yet — without it, every
  // pull re-fetched the user's ENTIRE tombstone history forever (network +
  // apply cost growing without bound).
  const tombWm = await getWatermark(
    ctx.meta,
    pullWatermarkKey("sync_tombstones", uid),
  );
  const tombResult = await ctx.supabase
    .from("sync_tombstones")
    .select("*")
    .eq("user_id", uid)
    .gt("deleted_at", tombWm)
    .order("deleted_at", { ascending: true });
  if (tombResult.error) throw tombResult.error;
  const tombstones = (tombResult.data ?? []).filter(isCloudTombstone);
  if (tombstones.length > 0) {
    totals.appliedTombstones = await applyRemoteTombstones(ctx, tombstones);
    const maxT = tombstones.reduce(
      (max, t) => Math.max(max, Number(t.deleted_at) || 0),
      tombWm,
    );
    await setWatermark(
      ctx.meta,
      pullWatermarkKey("sync_tombstones", uid),
      maxT,
    );
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
      let toInsert: ReturnType<typeof cloudRowToSolve>[] = [];
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
      if (toInsert.length > 0) {
        // Drop orphaned solves: the cloud has NO solves.session_id FK, so a
        // solve can legitimately reference a session that was deleted
        // cloud-side. Locally the FK is enforced, and one bad row would
        // fail the whole insertMany and block sync forever. Sessions are
        // pulled first (TABLE_DEFS order), so a solve only ends up here when
        // its session genuinely no longer exists anywhere — skip it. The
        // watermark still advances past it (computed over all rows), so it
        // never re-pulls.
        const sessionIds = [
          ...new Set(toInsert.map((s) => s.sessionId)),
        ];
        const existingSessions = await ctx.sessions.findExistingIds(sessionIds);
        const before = toInsert.length;
        toInsert = toInsert.filter((s) => existingSessions.has(s.sessionId));
        if (toInsert.length < before) {
          console.warn(
            `[sync-engine] pull: skipped ${before - toInsert.length} orphaned solve(s) whose session no longer exists`,
          );
        }
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
      // Local FK guard: training_attempts.case_id references algorithm_cases(id),
      // but the catalog is bundled per app version — a pull can receive an
      // attempt for a case this device doesn't know (or hasn't seeded yet).
      // Unlink those attempts (keep the data, drop the case) instead of
      // failing the whole pull on one unknown case.
      const caseIds = [
        ...new Set(
          rows
            .map((r) => cloudRowToAttempt(r).caseId)
            .filter((id): id is string => id != null),
        ),
      ];
      const existingCases =
        caseIds.length > 0
          ? await ctx.training.findExistingCaseIds(caseIds)
          : new Set<string>();
      let unlinked = 0;
      for (const row of rows) {
        const attempt = cloudRowToAttempt(row);
        const local = await ctx.training.findAttemptById(attempt.id);
        if (!local) {
          if (attempt.caseId != null && !existingCases.has(attempt.caseId)) {
            unlinked += 1;
            await ctx.training.insertAttemptWithId({
              ...attempt,
              caseId: undefined,
            });
          } else {
            await ctx.training.insertAttemptWithId(attempt);
          }
        } else if ((local.updatedAt ?? 0) < (attempt.updatedAt ?? 0)) {
          await ctx.training.updateAttemptFromCloud(
            attempt.id,
            attempt.reviewGrade ?? null,
            attempt.updatedAt ?? 0,
          );
        }
      }
      if (unlinked > 0) {
        console.warn(
          `[sync-engine] pull: unlinked ${unlinked} training attempt(s) referencing cases unknown to this device`,
        );
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
