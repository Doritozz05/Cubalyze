/**
 * Per-device monotonic write clock (M9 fix).
 *
 * Sync watermarks select rows with a strict `updated_at > watermark` cursor,
 * so a local write whose stamp equals the cursor would be skipped forever
 * (and a write stamped by a clock that jumped backwards loses every LWW
 * battle). Instead of stamping with a bare `Date.now()`, local writes take
 * their stamp from this clock:
 *
 *     stamp = max(now, previous local stamp + 1, floor + 1)
 *
 * which guarantees stamps are strictly increasing per table AND at least the
 * wall-clock time. The state lives in `app_meta` (`local_clock_<table>`), so
 * it survives reloads and is invisible to sync (it never starts with
 * `sync_`).
 *
 * IMPORTANT: this is ONLY for local user writes. Rows applied by a pull
 * carry the cloud's timestamp and MUST be written as-is (the repos only call
 * this when the caller did not supply a timestamp, or when a write opts in
 * with `{ local: true }`).
 */

type DBExecutor = (
  sql: string,
  bind?: unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Reserve `count` strictly-increasing stamps for `table`, all >= the wall
 * clock and >= `floor + 1` (so editing a row always moves it forward past its
 * own previous stamp, even when that stamp came from another device's
 * faster clock). Returns the first stamp; callers add `i` for the rest.
 */
export async function nextLocalStamps(
  db: DBExecutor,
  table: string,
  count = 1,
  opts?: { floor?: number },
): Promise<number> {
  const key = `local_clock_${table}`;
  const rows = await db("SELECT value FROM app_meta WHERE key = ?", [key]);
  const prev = Number((rows[0] as { value?: unknown })?.value) || 0;
  const floor = (opts?.floor ?? 0) + 1;
  const start = Math.max(Date.now(), prev + 1, floor);
  if (count > 0) {
    await db(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      [key, String(start + count - 1)],
    );
  }
  return start;
}
