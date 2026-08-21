import * as Comlink from 'comlink';
import type { DBWorker } from './worker.js';

let worker: Worker | SharedWorker | null = null;
let db: Comlink.Remote<typeof DBWorker> | null = null;
let initPromise: Promise<Comlink.Remote<typeof DBWorker>> | null = null;
/** True when `worker` is a SharedWorker (shared with other tabs). */
let shared = false;

/**
 * Log the storage type in the main-thread console so the user can see it.
 */
async function logStorageType(dbClient: Comlink.Remote<typeof DBWorker>): Promise<void> {
  const storageType = await dbClient.getStorageType();
  if (storageType === 'opfs') {
    console.log(
      '%c[Database]%c Storage: OPFS (persistent) — data survives reloads.',
      'color:#4ade80;font-weight:bold',
      'color:inherit',
    );
  } else {
    console.warn(
      '%c[Database]%c Storage: MEMORY (volatile) — data WILL BE LOST on page reload! %cOPFS not available in this browser/context.',
      'color:#f87171;font-weight:bold',
      'color:inherit',
      'color:#f87171',
    );
  }
}

/**
 * Race a promise against a hard timeout. A worker that boots but never
 * answers its init request (silent hang — no rejection, no error event)
 * would otherwise freeze initDB forever: no fallback, empty console, app
 * stuck on skeletons. The timeout converts that hang into a rejection so
 * the caller can degrade to the dedicated worker.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export const initDB = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Web Workers are only available in the browser');
    }

    // Prefer a SharedWorker: every tab of this origin then talks to ONE
    // SQLite instance holding a single OPFS handle. Without this, each tab
    // spawns its own worker and sqlite-wasm's OPFS cross-tab lock makes the
    // second tab fall back to a volatile in-memory DB — silently losing
    // everything written there on reload and diverging its sync state.
    if (typeof SharedWorker !== 'undefined') {
      let sharedWorker: SharedWorker | null = null;
      try {
        sharedWorker = new SharedWorker(
          new URL('./worker.ts', import.meta.url),
          { type: 'module', name: 'cubeforge-db' },
        );
        const proxied = Comlink.wrap<typeof DBWorker>(sharedWorker.port);
        // Timeout guard: a booted-but-silent worker (e.g. a misbundled
        // worker that never wires its message port) must degrade to the
        // dedicated worker instead of hanging the whole app on skeletons.
        const success = await withTimeout(
          proxied.init(),
          15_000,
          'SharedWorker init timed out (no response)' ,
        );
        if (success) {
          worker = sharedWorker;
          shared = true;
          db = proxied;
          await logStorageType(proxied);
          return db;
        }
        console.warn('[Database] SharedWorker init reported failure; retrying with a dedicated worker.');
      } catch (err) {
        // e.g. the browser refuses SharedWorker for this origin, or the
        // worker booted but never answered (timeout) — fall back to a
        // dedicated worker (previous behavior).
        console.warn('[Database] SharedWorker unavailable; using a dedicated worker:', err);
      }
      sharedWorker = null;
      worker = null;
      shared = false;
      db = null;
    }

    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    db = Comlink.wrap<typeof DBWorker>(worker);

    const success = await db.init();
    if (!success) {
      db = null;
      initPromise = null;
      throw new Error('Database worker failed to initialize SQLite (see console for details)');
    }

    await logStorageType(db);
    return db;
  })();

  return initPromise;
};

export const getDB = () => {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
};

/**
 * Whether the database is backed by OPFS (persistent) or volatile memory.
 * Returns 'unknown' when the DB has not been initialized yet.
 */
export const getStorageType = async (): Promise<'opfs' | 'memory' | 'unknown'> => {
  try {
    const client = await initDB();
    return await client.getStorageType();
  } catch {
    return 'unknown';
  }
};

export const closeDB = async () => {
  if (db) {
    await db.close();
    db[Comlink.releaseProxy]();
    db = null;
  }
  if (worker) {
    // A SharedWorker is shared with other tabs — never terminate it, just
    // drop this tab's port (the worker outlives the tab that opened it).
    if (!shared) (worker as Worker).terminate();
    worker = null;
  }
  shared = false;
  initPromise = null;
};
