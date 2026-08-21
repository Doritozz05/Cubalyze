/**
 * Push — upload everything edited since the last push to the cloud.
 *
 * One `sync_apply` RPC call carries every table's changed rows plus the
 * pending tombstones in a single JSON payload. The server-side function
 * (security definer) verifies `user_id = auth.uid()` for every row and
 * applies LWW (`INSERT ... ON CONFLICT DO UPDATE WHERE excluded.updated_at
 * >= table.updated_at`), so a stale device can never clobber a newer row.
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
import type { SyncContext, SyncTotals } from "./types";
import { getWatermark, pushWatermarkKey, setWatermark } from "./watermarks";

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
  const payload: Record<string, unknown[]> = {};
  // Watermark advances are COLLECTED here and only committed after the RPC
  // succeeds. Advancing before the write would lose rows on a network error
  // (they'd never be re-picked next cycle).
  const watermarkUpdates: Array<[string, number]> = [];

  // ── Solves ──────────────────────────────────────────────────────────
  const solvesWm = await getWatermark(ctx.meta, pushWatermarkKey("solves", uid));
  const solves = await ctx.solves.findAllSince(solvesWm);
  if (solves.length > 0) {
    payload.solves = solves.map((s) => solveToCloudRow(s, uid));
    watermarkUpdates.push([
      pushWatermarkKey("solves", uid),
      Math.max(...solves.map((s) => s.updatedAt ?? s.createdAt ?? 0)),
    ]);
    totals.pushed.solves = solves.length;
  }

  // ── Sessions ────────────────────────────────────────────────────────
  const sessionsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("sessions", uid),
  );
  const sessions = await ctx.sessions.findAllSince(sessionsWm);
  if (sessions.length > 0) {
    payload.sessions = sessions.map((s) => sessionToCloudRow(s, uid));
    watermarkUpdates.push([
      pushWatermarkKey("sessions", uid),
      Math.max(...sessions.map((s) => s.updatedAt ?? s.createdAt ?? 0)),
    ]);
    totals.pushed.sessions = sessions.length;
  }

  // ── Profile (single row) ────────────────────────────────────────────
  const profilesWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("profiles", uid),
  );
  const profile = await ctx.profiles.findById(uid);
  if (profile && (profile.updatedAt ?? 0) > profilesWm) {
    payload.profiles = [profileToCloudRow(profile, uid)];
    watermarkUpdates.push([
      pushWatermarkKey("profiles", uid),
      profile.updatedAt ?? 0,
    ]);
    totals.pushed.profiles = 1;
  }

  // ── Training attempts ───────────────────────────────────────────────
  const attemptsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("training_attempts", uid),
  );
  const attempts = await ctx.training.findAttemptsSince(attemptsWm);
  if (attempts.length > 0) {
    payload.training_attempts = attempts.map((a) => attemptToCloudRow(a, uid));
    watermarkUpdates.push([
      pushWatermarkKey("training_attempts", uid),
      Math.max(...attempts.map((a) => a.updatedAt ?? a.timestamp ?? 0)),
    ]);
    totals.pushed.training_attempts = attempts.length;
  }

  // ── Training sessions ───────────────────────────────────────────────
  const tsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("training_sessions", uid),
  );
  const trainingSessions = (await ctx.training.findTrainingSessionsAll()).filter(
    (s) => (s.updatedAt ?? s.startedAt ?? 0) > tsWm,
  );
  if (trainingSessions.length > 0) {
    payload.training_sessions = trainingSessions.map((s) =>
      trainingSessionToCloudRow(s, uid),
    );
    watermarkUpdates.push([
      pushWatermarkKey("training_sessions", uid),
      Math.max(
        ...trainingSessions.map((s) => s.updatedAt ?? s.startedAt ?? 0),
      ),
    ]);
    totals.pushed.training_sessions = trainingSessions.length;
  }

  // ── Training tasks (calendar) ───────────────────────────────────────
  const tasksWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("training_tasks", uid),
  );
  const tasks = await ctx.calendar.findAllSince(tasksWm);
  if (tasks.length > 0) {
    payload.training_tasks = tasks.map((t) => taskToCloudRow(t, uid));
    watermarkUpdates.push([
      pushWatermarkKey("training_tasks", uid),
      Math.max(...tasks.map((t) => t.updatedAt ?? 0)),
    ]);
    totals.pushed.training_tasks = tasks.length;
  }

  // ── Skill progress ──────────────────────────────────────────────────
  const skillsWm = await getWatermark(
    ctx.meta,
    pushWatermarkKey("skill_progress", uid),
  );
  const skillRows = await ctx.skills.findAllRows();
  const changedSkills = skillRows.filter((s) => s.completedAt > skillsWm);
  if (changedSkills.length > 0) {
    payload.skill_progress = changedSkills.map((s) =>
      skillToCloudRow(s.skillId, s.completedAt, uid),
    );
    watermarkUpdates.push([
      pushWatermarkKey("skill_progress", uid),
      Math.max(...changedSkills.map((s) => s.completedAt)),
    ]);
    totals.pushed.skill_progress = changedSkills.length;
  }

  // ── Tombstones ──────────────────────────────────────────────────────
  const tombstones = await readLocalTombstones(ctx.db);
  if (tombstones.length > 0) {
    payload.tombstones = tombstones.map((t) => ({
      user_id: uid,
      entity: t.entity,
      entity_id: t.entityId,
      deleted_at: t.deletedAt,
    }));
  }

  if (Object.keys(payload).length === 0) return totals;

  const { error } = await ctx.supabase.rpc("sync_apply", { payload });
  if (error) throw error;

  // RPC succeeded — rows are durable in the cloud. Now it is safe to
  // advance every cursor and drop the local tombstones.
  for (const [key, value] of watermarkUpdates) {
    await setWatermark(ctx.meta, key, value);
  }
  if (tombstones.length > 0) {
    totals.pushedTombstones = tombstones.length;
    await purgeLocalTombstones(ctx.db);
  }

  return totals;
}
