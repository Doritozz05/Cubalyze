import * as Comlink from 'comlink';
import type { DBWorker } from './worker.js';

let worker: Worker | null = null;
let db: Comlink.Remote<typeof DBWorker> | null = null;
let initPromise: Promise<Comlink.Remote<typeof DBWorker>> | null = null;

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
  } else if (storageType === 'sahpool') {
    console.log(
      '%c[Database]%c Storage: OPFS (shared-access pool, persistent) — data survives reloads.',
      'color:#4ade80;font-weight:bold',
      'color:inherit',
    );
  } else if (storageType === 'memory-snapshot') {
    console.warn(
      '%c[Database]%c Storage: MEMORY+snapshot (IndexedDB) — data survives via byte snapshots.',
      'color:#facc15;font-weight:bold',
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

    // NOTE: ALWAYS a DEDICATED worker. sqlite-wasm's OPFS persistence is
    // only available in dedicated worker threads (see worker.ts); booting a
    // SharedWorker would silently downgrade the storage layer to volatile
    // memory on every engine whose OPFS VFS needs a dedicated scope.
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    db = Comlink.wrap<typeof DBWorker>(worker);

    // Timeout guard: a booted-but-silent dedicated worker must surface as a
    // readable error instead of leaving the app on skeletons with an empty
    // console forever.
    const success = await withTimeout(
      db.init(),
      15_000,
      'Database worker init timed out (no response)',
    );
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
 * Which storage backend the database uses. Returns 'unknown' when the DB has
 * not been initialized yet.
 */
export const getStorageType = async (): Promise<'opfs' | 'sahpool' | 'memory-snapshot' | 'unknown'> => {
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
    worker.terminate();
    worker = null;
  }
  initPromise = null;
};
