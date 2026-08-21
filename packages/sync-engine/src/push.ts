/**
 * Push — upload everything edited since the last push to the cloud.
 *
 * One `sync_apply` RPC call carries every table's changed rows plus the
 * pending tombstones in a single JSON payload. The server-side function
 * (security definer) verifies `user_id = auth.uid()` for every row and
 * applies LWW (`INSERT ... ON CONFLICT DO UPDATE WHERE excluded.updated_at
 * >= table.updated_at`), so a stale device can never clobber a newer row.
 *
 * Rows are pushed in bounded batches (500 per RPC) using an (updated_at, id)
 * keyset cursor, so a first-login merge of a 100k-solve history neither
 * builds an unbounded JSON payload nor hits `Math.max(...spread)` stack
 * limits, and a network failure mid-way only re-sends the failed batch.
 *
 * Watermarks advance to the max updated_at actually pushed (never
 * Date.now()), which keeps the cursor immune to device clock skew.
 */

import {
  attemptToCloudRow,
  profileToCloudRow,
  sessionToCloudRow,
  skillToCloudRow,
  solveToCloudRow,
  taskToCloudRow,
  trainingSessionToCloudRow,
} from "./mappers";
import {
  purgeLocalTombstones,
  readLocalTombstones,
} from "./tombstones";
import type { SyncContext, SyncTotals, SyncableEntity } from "./types";
import { getWatermark, pushWatermarkKey, setWatermark } from "./watermarks";

/** Max rows per sync_apply RPC — bounds payload size and memory. */
const BATCH = 500;

/** `Math.max(...)` without the spread — safe for 100k+ element arrays. */
export function maxOf(values: number[]): number {
  let max = -Infinity;
  for (const v of values) {
    if (v > max) max = v;
  }
  return max === -Infinity ? 0 : max;
}

export async function pushChanges(
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

  // ── Tombstones (read once; pushed in a final RPC after every table) ───
  const tombstones = await readLocalTombstones(ctx.db);

  // ── Solves (paged) ────────────────────────────────────────────────────
  await pushPageable(
    ctx,
    totals,
    "solves",
    pushWatermarkKey("solves", uid),
    async (wm, opts) => ctx.solves.findAllSince(wm, opts),
    (s) => solveToCloudRow(s, uid),
    (s) => s.updatedAt ?? s.createdAt ?? 0,
  );

  // ── Sessions (paged) ──────────────────────────────────────────────────
  await pushPageable(
    ctx,
    totals,
    "sessions",
    pushWatermarkKey("sessions", uid),
    async (wm, opts) => ctx.sessions.findAllSince(wm, opts),
    (s) => sessionToCloudRow(s, uid),
    (s) => s.updatedAt ?? s.createdAt ?? 0,
  );

  // ── Profile (single row) ──────────────────────────────────────────────
  const profilesWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("profiles", uid),
  );
  const profile = await ctx.profiles.findById(uid);
  if (profile && (profile.updatedAt ?? 0) > profilesWm) {
    await pushSingle(
      ctx,
      totals,
      "profiles",
      pushWatermarkKey("profiles", uid),
      [profileToCloudRow(profile, uid)],
      profile.updatedAt ?? 0,
    );
  }

  // ── Training attempts (paged) ─────────────────────────────────────────
  await pushPageable(
    ctx,
    totals,
    "training_attempts",
    pushWatermarkKey("training_attempts", uid),
    async (wm, opts) => ctx.training.findAttemptsSince(wm, opts),
    (a) => attemptToCloudRow(a, uid),
    (a) => a.updatedAt ?? a.timestamp ?? 0,
  );

  // ── Training sessions (small, one-shot) ───────────────────────────────
  const tsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("training_sessions", uid),
  );
  const trainingSessions = (await ctx.training.findTrainingSessionsAll()).filter(
    (s) => (s.updatedAt ?? s.startedAt ?? 0) > tsWm,
  );
  if (trainingSessions.length > 0) {
    await pushSingle(
      ctx,
      totals,
      "training_sessions",
      pushWatermarkKey("training_sessions", uid),
      trainingSessions.map((s) => trainingSessionToCloudRow(s, uid)),
      maxOf(trainingSessions.map((s) => s.updatedAt ?? s.startedAt ?? 0)),
    );
  }

  // ── Training tasks (calendar, paged) ──────────────────────────────────
  await pushPageable(
    ctx,
    totals,
    "training_tasks",
    pushWatermarkKey("training_tasks", uid),
    async (wm, opts) => ctx.calendar.findAllSince(wm, opts),
    (t) => taskToCloudRow(t, uid),
    (t) => t.updatedAt ?? 0,
  );

  // ── Skill progress (small, one-shot) ──────────────────────────────────
  const skillsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("skill_progress", uid),
  );
  const skillRows = await ctx.skills.findAllRows();
  const changedSkills = skillRows.filter((s) => s.completedAt > skillsWm);
  if (changedSkills.length > 0) {
    await pushSingle(
      ctx,
      totals,
      "skill_progress",
      pushWatermarkKey("skill_progress", uid),
      changedSkills.map((s) => skillToCloudRow(s.skillId, s.completedAt, uid)),
      maxOf(changedSkills.map((s) => s.completedAt)),
    );
  }

  // ── Tombstones (final RPC, then purge) ────────────────────────────────
  if (tombstones.length > 0) {
    const { error } = await ctx.supabase.rpc("sync_apply", {
      payload: {
        tombstones: tombstones.map((t) => ({
          user_id: uid,
          entity: t.entity,
          entity_id: t.entityId,
          deleted_at: t.deletedAt,
        })),
      },
    });
    if (error) throw error;
    totals.pushedTombstones = tombstones.length;
    await purgeLocalTombstones(ctx.db);
  }

  return totals;
}

interface PageableRow {
  id: string;
}

/**
 * Push one table in bounded batches with an (updated_at, id) keyset cursor.
 * The watermark advances after EVERY successful batch, so a mid-way network
 * failure only re-sends the failed batch on the next cycle.
 */
async function pushPageable<T extends PageableRow>(
  ctx: SyncContext,
  totals: SyncTotals,
  table: SyncableEntity,
  wmKey: string,
  fetchPage: (
    wm: number,
    opts: { limit: number; afterUpdatedAt?: number; afterId?: string },
  ) => Promise<T[]>,
  toRow: (row: T) => Record<string, unknown>,
  stamp: (row: T) => number,
): Promise<void> {
  let wm = await getWatermark(ctx.meta, wmKey);
  let afterUpdatedAt: number | undefined;
  let afterId: string | undefined;
  for (;;) {
    const page = await fetchPage(wm, {
      limit: BATCH,
      afterUpdatedAt,
      afterId,
    });
    if (page.length === 0) break;
    const payload = page.map((row) => toRow(row));
    const { error } = await ctx.supabase.rpc("sync_apply", {
      payload: { [table]: payload },
    });
    if (error) throw error;

    const pageMax = maxOf(page.map(stamp));
    await setWatermark(ctx.meta, wmKey, pageMax);
    totals.pushed[table] = (totals.pushed[table] ?? 0) + page.length;

    const last = page[page.length - 1];
    afterUpdatedAt = stamp(last);
    afterId = last.id;
    wm = pageMax;
    if (page.length < BATCH) break;
  }
}

/** Push a small, already-loaded set of rows in one RPC and advance the cursor. */
async function pushSingle(
  ctx: SyncContext,
  totals: SyncTotals,
  table: SyncableEntity,
  wmKey: string,
  rows: Record<string, unknown>[],
  maxUpdatedAt: number,
): Promise<void> {
  const { error } = await ctx.supabase.rpc("sync_apply", {
    payload: { [table]: rows },
  });
  if (error) throw error;
  await setWatermark(ctx.meta, wmKey, maxUpdatedAt);
  totals.pushed[table] = (totals.pushed[table] ?? 0) + rows.length;
}
