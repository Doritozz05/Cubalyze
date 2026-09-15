"use client";

/**
 * Web-side sync service — the single wiring point between the UI and
 * @cubalyze/sync-engine.
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

import { initDB } from "@cubalyze/database";
import { syncStore } from "@cubalyze/state";
import {
  createSupabaseClient,
  readSupabaseEnv,
  SyncEngine,
  type SyncTotals,
} from "@cubalyze/sync-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshProfile } from "@/hooks/useProfile";
import { clearAllPhotos } from "@/views/Collection/collectionPhotos";
import { runPhotoSync } from "@/views/Collection/collectionPhotoSync";

let engine: SyncEngine | null = null;
let client: SupabaseClient | null = null;

// ── Cross-tab live refresh ─────────────────────────────────────────────────
// Every tab shares ONE SQLite database (the SharedWorker), so a write in one
// tab is immediately visible at the DB level. React state is per-tab, so the
// remaining problem is telling the OTHER tabs to re-read the DB. We do that
// with a BroadcastChannel: `notifyDataChanged()` bumps this tab's revision
// (its own hooks re-read) and posts a message; every other tab bumps its own
// revision on receipt. Data hooks subscribe via `useDataRevision`.
const syncChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("cubeforge-sync")
    : null;

if (syncChannel) {
  syncChannel.addEventListener("message", (ev) => {
    if ((ev.data as { type?: string })?.type === "data-changed") {
      syncStore.getState().bumpDataRevision();
    }
  });
}

/** True when a cycle actually moved rows (nothing to broadcast otherwise). */
function movedRows(totals: SyncTotals): boolean {
  return (
    totals.pushedTombstones > 0 ||
    totals.appliedTombstones > 0 ||
    Object.keys(totals.pushed).length > 0 ||
    Object.keys(totals.pulled).length > 0
  );
}

/** Bump the local revision and tell every other tab to do the same. */
function notifyDataChanged(): void {
  syncStore.getState().bumpDataRevision();
  syncChannel?.postMessage({ type: "data-changed" });
}

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
  engine = new SyncEngine(
    dbExecutor,
    supabase,
    (status) => {
      syncStore.getState().setStatus(status);
      if (status === "idle") {
        syncStore.getState().setLastSyncedAt(Date.now());
        // A completed sync may have pulled a newer profile from the cloud
        // (name/country/avatar edited on another device). useProfile reads the
        // row once at boot, so re-read it after every cycle — otherwise the UI
        // keeps showing the stale identity until a hard reload.
        void refreshProfile();
      }
    },
    (totals) => {
      // A cycle that moved rows (local push or a pull of another device's
      // edits) means every tab's cached UI state is stale — including THIS
      // tab's, which may hold rows the pull just replaced.
      if (movedRows(totals)) notifyDataChanged();
      // Fase 6 — the row cycle is the trigger for the photo channel: refs that
      // just arrived need their bytes downloaded, refs that just left need
      // their bytes uploaded. It runs AFTER the rows so a fresh device can see
      // what to fetch.
      void runPhotoSync({ supabase, userId: engine?.userId ?? null }).catch((err) => {
        console.warn("[sync] photo sync failed:", err);
      });
    },
    // Fase 6 — a "start fresh" claim must also drop the Locker's photo bytes
    // (IndexedDB), which this package cannot reach on its own.
    { clearLocalPhotos: clearAllPhotos },
  );
  return engine;
}

/**
 * Debounced "something changed" — the write hooks call this after every
 * mutation. Also broadcasts the change to the other tabs so their UI refreshes
 * live (the shared SQLite DB already holds the new row).
 */
export async function requestSync(): Promise<void> {
  notifyDataChanged();
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

  const poll = () => {
    void getSyncEngine().then((engine) => {
      if (!engine?.userId) return;
      // Always run a full cycle on the tick. The local dirty flag cannot
      // know about edits made on OTHER devices, so gating on it would mean
      // this device never pulls their changes (stale profile, missing
      // solves). The watermark pull is cheap, so unconditional polling is
      // how multi-device freshness happens. `hasPendingChanges` remains
      // useful for the UI's "Sync now" affordance.
      void engine.syncNow().catch(() => {
        /* status already surfaced via the store */
      });
    });
  };

  window.setInterval(() => poll(), 45_000);
  window.addEventListener("online", () => poll());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll();
  });
}
