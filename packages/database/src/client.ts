import * as Comlink from 'comlink';
import type { DBWorker } from './worker.js';

let worker: Worker | null = null;
let db: Comlink.Remote<typeof DBWorker> | null = null;

export const initDB = async () => {
  if (db) return db;
  
  if (typeof window === 'undefined') {
    throw new Error('Web Workers are only available in the browser');
  }

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  db = Comlink.wrap<typeof DBWorker>(worker);
  
  await db.init();
  return db;
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
};
