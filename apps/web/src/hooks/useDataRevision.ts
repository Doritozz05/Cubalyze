"use client";

import { useSyncExternalStore } from "react";
import { syncStore } from "@cubeforge/state";

/**
 * Subscribe to the shared data revision counter.
 *
 * Every data change bumps `syncStore.dataRevision`: local writes (via
 * `requestSync` in services/sync) and sync cycles that moved rows (local or
 * from another tab via BroadcastChannel). Data hooks that cache rows in React
 * state read this revision and re-read the shared SQLite DB when it changes —
 * that is how one tab's edits appear live in every other tab.
 *
 * The store notifies on ALL sync state changes (status, lastSyncedAt…), but
 * useSyncExternalStore only re-renders when the returned snapshot (the
 * revision number) actually changes, so unrelated store updates are free.
 */
export function useDataRevision(): number {
  return useSyncExternalStore(
    (cb) => syncStore.subscribe(cb),
    () => syncStore.getState().dataRevision,
  );
}
