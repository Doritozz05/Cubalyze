/**
 * Migrated-row upload rescue.
 *
 * When the cross-tier migration (worker.ts, `migrateFromOtherTier`) rescues
 * sessions/solves that were stranded in another storage tier (IndexedDB
 * snapshot or the other OPFS directory), those rows carry their ORIGINAL
 * `updated_at` — usually days/weeks old. The device's push watermark has
 * long since advanced past them, so the next sync would never upload them.
 *
 * This module resets the push watermark of `solves`/`sessions` to 0 for every
 * account linked on this device (`app_meta.sync_linked_* = '1'`). The next
 * push cycle then re-evaluates ALL local rows of those tables:
 *
 *   - Rows already in the cloud: the server-side LWW
 *     (`sync_apply` → `... ON CONFLICT DO UPDATE WHERE
 *     excluded.updated_at >= table.updated_at`) sees an equal-or-older stamp
 *     and does NOT overwrite — a newer cloud edit can never be clobbered.
 *   - Rows that are truly new (the rescued ones): uploaded normally.
 *
 * This is deliberately NOT a local timestamp bump: bumping `updated_at` on
 * rescued rows would make an outdated local copy WIN every LWW battle against
 * a newer cloud edit of the same id. Resetting the cursor instead lets the
 * database's own LWW decide — the same rule the whole sync system uses.
 */

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

const LINKED_PREFIX = 'sync_linked_';
const PUSH_SOLVES_PREFIX = 'sync_watermark_push_solves_';
const PUSH_SESSIONS_PREFIX = 'sync_watermark_push_sessions_';

/**
 * Drop the `solves`/`sessions` push watermark for every account linked on
 * this device, so a post-migration sync re-uploads the rescued rows. Returns
 * true when at least one watermark was touched (a linked account existed).
 * Best-effort and non-fatal: a failure only means the rescued rows stay
 * local-only until the user edits them.
 */
export async function resetPushWatermarkForMigrated(
  db: DBExecutor,
): Promise<boolean> {
  try {
    const rows: Record<string, unknown>[] = await db(
      "SELECT key FROM app_meta WHERE key LIKE 'sync_linked_%' AND value = '1'",
    );
    const uids = new Set<string>();
    for (const row of rows) {
      const key = String(row.key ?? '');
      if (key.startsWith(LINKED_PREFIX) && key.length > LINKED_PREFIX.length) {
        uids.add(key.slice(LINKED_PREFIX.length));
      }
    }
    if (uids.size === 0) return false;

    const bind: unknown[] = [];
    const placeholders: string[] = [];
    for (const uid of uids) {
      placeholders.push('?', '?');
      bind.push(PUSH_SOLVES_PREFIX + uid, PUSH_SESSIONS_PREFIX + uid);
    }
    await db(`DELETE FROM app_meta WHERE key IN (${placeholders.join(', ')})`, bind);
    return true;
  } catch (e) {
    console.warn(
      '[DB Worker] failed to reset push watermarks for migrated rows (non-fatal):',
      e,
    );
    return false;
  }
}