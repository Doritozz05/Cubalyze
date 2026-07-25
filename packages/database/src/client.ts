import * as Comlink from 'comlink';
import type { DBWorker } from './worker.js';

let worker: Worker | null = null;
let db: Comlink.Remote<typeof DBWorker> | null = null;
let initPromise: Promise<Comlink.Remote<typeof DBWorker>> | null = null;

export const initDB = async () => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Web Workers are only available in the browser');
    }

    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    db = Comlink.wrap<typeof DBWorker>(worker);
    
    const success = await db.init();
    if (!success) {
      db = null;
      initPromise = null;
      throw new Error('Database worker failed to initialize SQLite (see console for details)');
    }

    // Log storage type in main-thread console so the user can see it
    const storageType = await db.getStorageType();
    if (storageType === 'opfs') {
      console.log('%c[Database]%c Storage: OPFS (persistent) — data survives reloads.', 'color:#4ade80;font-weight:bold', 'color:inherit');
    } else {
      console.warn('%c[Database]%c Storage: MEMORY (volatile) — data WILL BE LOST on page reload! %cOPFS not available in this browser/context.', 'color:#f87171;font-weight:bold', 'color:inherit', 'color:#f87171');
    }

    return db;
  })();

  return initPromise;
};

export const getDB = () => {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
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
