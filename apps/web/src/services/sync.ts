"use client";

/**
 * Web-side sync service — the single wiring point between the UI and
 * @cubeforge/sync-engine.
 *
 * - `getSupabaseClient()` — lazy Supabase client from Vite env vars.
 * - `getSyncEngine()`     — lazy SyncEngine over the shared SQLite client
 *   (initDB is a singleton, so this never opens a second worker).
 * - `requestSync()`       — debounced "something changed" signal; the data
 *   hooks call it after writes and the engine's dirty triggers guarantee no
 *   change is ever missed (migration 028).
 * - `startSyncService()`  — periodic dirty-flag poller + online/visibility
 *   listeners so calendar/skills/widget edits sync even if a future writer
 *   forgets to call requestSync().
 */

import { initDB } from "@cubeforge/database";
import { syncStore } from "@cubeforge/state";
import {
  createSupabaseClient,
  readSupabaseEnv,
  SyncEngine,
} from "@cubeforge/sync-engine";
import type { SupabaseClient } from "@supabase/supabase-js";

let engine: SyncEngine | null = null;
let client: SupabaseClient | null = null;

/** The env bag Vite provides (import.meta.env) — typed loosely on purpose. */
function envBag(): Record<string, unknown> {
  return (import.meta as unknown as { env: Record<string, unknown> }).env;
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv(envBag()) !== null;
}

export function getSupabaseUrl(): string | null {
  return readSupabaseEnv(envBag())?.url ?? null;
}

/** The anon key (public by design) — used for the `apikey` header. */
export function getSupabaseAnonKey(): string | null {
  return readSupabaseEnv(envBag())?.anonKey ?? null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  const env = readSupabaseEnv(envBag());
  if (!env) return null;
  client = createSupabaseClient(env);
  return client;
}

export async function getSyncEngine(): Promise<SyncEngine | null> {
  if (engine) return engine;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const dbClient = await initDB();
  const dbExecutor = async (sql: string, bind?: unknown[]) =>
    await dbClient.execute(sql, bind);
  engine = new SyncEngine(dbExecutor, supabase, (status) => {
    syncStore.getState().setStatus(status);
    if (status === "idle") syncStore.getState().setLastSyncedAt(Date.now());
  });
  return engine;
}

/** Debounced "something changed" — the write hooks call this. */
export async function requestSync(): Promise<void> {
  (await getSyncEngine())?.scheduleSync();
}

/** Immediate sync (login, manual "Sync now", online event). */
export async function syncNow(): Promise<void> {
  const engine = await getSyncEngine();
  if (!engine) return;
  try {
    await engine.syncNow();
  } catch (err) {
    console.error("[sync] syncNow failed:", err);
  }
}

let pollerStarted = false;

/**
 * Start the background poller. Call once from App. Polls the dirty flag
 * (set by SQLite triggers on every syncable write) so ANY write path syncs,
 * even ones that never call requestSync(). Also syncs on reconnect and when
 * the tab becomes visible again.
 */
export function startSyncService(): void {
  if (pollerStarted) return;
  pollerStarted = true;

  const poll = (force = false) => {
    void getSyncEngine().then((engine) => {
      if (!engine?.userId) return;
      void (async () => {
        if (force || (await engine.hasPendingChanges())) {
          await engine.syncNow().catch(() => {
            /* status already surfaced via the store */
          });
        }
      })();
    });
  };

  window.setInterval(() => poll(false), 45_000);
  window.addEventListener("online", () => poll(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll(false);
  });
}
