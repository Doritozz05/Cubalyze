/**
 * Sync watermarks — per (table, direction, account) cursors stored in the
 * local `app_meta` key/value table.
 *
 * Push cursor: rows with `updated_at > watermark` need to go up.
 * Pull cursor: cloud rows with `updated_at > watermark` need to come down.
 *
 * Namespacing by account means switching accounts on the same device starts
 * a fresh link (watermark 0 = full push/pull) without corrupting the other
 * account's cursors.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function pushWatermarkKey(table: string, uid: string): string {
  return `sync_watermark_push_${table}_${uid}`;
}

export function pullWatermarkKey(table: string, uid: string): string {
  return `sync_watermark_pull_${table}_${uid}`;
}

export async function getWatermark(
  store: KeyValueStore,
  key: string,
  fallback = 0,
): Promise<number> {
  const raw = await store.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function setWatermark(
  store: KeyValueStore,
  key: string,
  value: number,
): Promise<void> {
  await store.set(key, String(Math.max(0, Math.floor(value))));
}
