/**
 * IndexedDB snapshot persistence — the LAST-RESORT storage backend for the
 * SQLite database.
 *
 * OPFS backends (the classic "opfs" VFS and the "opfs-sahpool" VFS) are the
 * preferred persistent stores, but they need the File System Access API
 * (createSyncAccessHandle). On engines where that API is absent (older
 * browsers, stripped-down contexts) the worker falls back to an in-memory
 * SQLite DB — which would silently lose every solve on reload.
 *
 * This module closes that gap: it holds a full byte-snapshot of the SQLite
 * file in IndexedDB (available in every worker context worth supporting).
 * The worker takes a snapshot after each write batch and on close; on boot
 * it restores those bytes into the fresh in-memory database. Storage space
 * is bounded by the DB size and writes are debounced, so impact is minimal.
 *
 * IndexedDB is exposed on WorkerGlobalScope, so the caller here is expected
 * to run inside a (dedicated) worker where `indexedDB` is the global object.
 */

const SNAPSHOT_DB = 'cube-forge-db';
const SNAPSHOT_STORE = 'snapshot';
const SNAPSHOT_KEY = 'main';

function openSnapshotStore(
  mode: IDBTransactionMode = 'readwrite',
): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this context'));
      return;
    }
    const req = indexedDB.open(SNAPSHOT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve(db.transaction(SNAPSHOT_STORE, mode).objectStore(SNAPSHOT_STORE));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Load the last full-DB snapshot, or null when there is none. */
export async function loadSnapshot(): Promise<Uint8Array | null> {
  try {
    const store = await openSnapshotStore('readonly');
    return await new Promise((resolve, reject) => {
      const get = store.get(SNAPSHOT_KEY);
      get.onsuccess = () => resolve((get.result as Uint8Array | undefined) ?? null);
      get.onerror = () => reject(get.error);
    });
  } catch {
    return null;
  }
}

/** Persist a full-DB byte snapshot. Best-effort: never throws to callers. */
export async function saveSnapshot(bytes: Uint8Array): Promise<void> {
  try {
    const store = await openSnapshotStore();
    await new Promise<void>((resolve, reject) => {
      const put = store.put(bytes, SNAPSHOT_KEY);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    });
  } catch {
    // Best-effort: a failed snapshot must never break the app.
  }
}

/**
 * Remove the stored snapshot. Best-effort, never throws.
 *
 * Used when the worker upgrades to a real OPFS backend and wants to drop the
 * stale byte-snapshot so a later downgrade can't resurrect older data over
 * the OPFS copy (which is now the source of truth).
 */
export async function clearSnapshot(): Promise<void> {
  try {
    const store = await openSnapshotStore();
    await new Promise<void>((resolve, reject) => {
      const del = store.delete(SNAPSHOT_KEY);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
  } catch {
    // Best-effort.
  }
}