/* eslint-disable @typescript-eslint/no-explicit-any */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import * as Comlink from 'comlink';

let db: any = null;

export const DBWorker = {
  async init() {
    if (db) return true;
    
    try {
      const sqlite3 = await sqlite3InitModule();

      console.log('SQLite WASM loaded', sqlite3.version.libVersion);

      if ((sqlite3 as any).opfs) {
        db = new (sqlite3 as any).oo1.OpfsDb('/cubeforge.sqlite3');
        console.log('OPFS Database connected');
        
        // Initialize skeleton table
        this.execute(`
          CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `);
      } else {
        console.warn('OPFS not available, falling back to memory db');
        db = new (sqlite3 as any).oo1.DB('/memory.sqlite3', 'c');
      }
      return true;
    } catch (err) {
      console.error('Failed to initialize SQLite', err);
      return false;
    }
  },

  execute(sql: string, bind?: unknown[]) {
    if (!db) throw new Error('Database not initialized');
    
    const results: any[] = [];
    db.exec({
      sql,
      bind,
      rowMode: 'object',
      resultRows: results,
    });
    return results;
  },
  
  async close() {
    if (db) {
      db.close();
      db = null;
    }
  }
};

Comlink.expose(DBWorker);
