/**
 * Gear trigger self-heal (migration 039) — execution tests against real
 * sqlite-wasm.
 *
 * Failure signature, reproduced byte-for-byte: when the `sync_dirty` triggers
 * on the gear tables carry the stale `INSERT OR REPLACE INTO app_meta` body,
 * the SECOND upsert of the same row throws
 * `SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key`
 * (rc 1555) on the OUTER `INSERT INTO gear_items … ON CONFLICT(id)` step.
 * SQLite refuses to resolve any conflict inside a trigger fired by the DO
 * UPDATE arm of an UPSERT — even one the sub-statement would resolve itself.
 * The write is lost, and in the sync pull the throw aborts the whole cycle
 * while the watermark never advances, so the device re-fails on the same rows
 * forever (locker frozen, no refs, no photos).
 *
 * Migration 039 re-applies the six gear triggers with the UPSERT-safe
 * `ON CONFLICT(key) DO UPDATE` spelling. These tests pin both halves: the
 * stale bodies fail exactly this way, and 039 heals them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import { GearRepository } from '../repositories/gear.repository.js';
import type { GearItem } from '../repositories/gear.repository.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openMigratedDb(): any {
  dbSeq += 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = new sqlite3.oo1.DB(`/gear-heal-${dbSeq}.sqlite3`, 'c');
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  for (const migration of MIGRATIONS) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec('INSERT OR IGNORE INTO _migrations (id) VALUES (?)', {
        bind: [migration.id],
      });
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repoFor(db: any): GearRepository {
  return new GearRepository(async (sql: string, bind?: unknown[]) => {
    const rows = db.exec({ sql, bind, rowMode: 'object' });
    return (rows ?? []) as Record<string, unknown>[];
  });
}

const DIRTY_TRIGGERS = [
  ['trg_dirty_gear_categories', 'gear_categories', 'INSERT'],
  ['trg_dirty_gear_categories_upd', 'gear_categories', 'UPDATE'],
  ['trg_dirty_gear_types', 'gear_types', 'INSERT'],
  ['trg_dirty_gear_types_upd', 'gear_types', 'UPDATE'],
  ['trg_dirty_gear_items', 'gear_items', 'INSERT'],
  ['trg_dirty_gear_items_upd', 'gear_items', 'UPDATE'],
] as const;

/** Install the stale 028-style bodies under the same trigger names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function installStaleBodies(db: any): void {
  for (const [name, table, event] of DIRTY_TRIGGERS) {
    db.exec(`DROP TRIGGER IF EXISTS ${name};`);
    db.exec(
      `CREATE TRIGGER ${name} AFTER ${event} ON ${table} BEGIN
         INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
       END;`,
    );
  }
}

const item = (overrides: Partial<GearItem> = {}): GearItem => ({
  id: 'i1',
  categoryId: 'c1',
  typeId: null,
  name: 'Item',
  palette: [],
  links: [],
  photos: [],
  tags: [],
  status: 'owned',
  primary: false,
  favorite: false,
  quantity: 1,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemName(db: any): unknown {
  const rows = db.exec({
    sql: 'SELECT name FROM gear_items WHERE id = ?',
    bind: ['i1'],
    rowMode: 'object',
  });
  return rows[0]?.name;
}

describe('gear trigger self-heal (039)', () => {
  it('fails exactly with 1555 on stale bodies, then heals after 039', async () => {
    const db = openMigratedDb();
    const repo = repoFor(db);
    await repo.upsertCategory({
      id: 'c1',
      name: 'C',
      kind: 'cube',
      icon: 'Box',
      createdAt: 1,
      updatedAt: 1,
    });
    await repo.upsertItem(item());

    installStaleBodies(db);

    // Second write, same id → ON CONFLICT(id) DO UPDATE arm, sync_dirty set.
    let thrown: unknown = null;
    try {
      await repo.upsertItem(item({ name: 'Item v2', updatedAt: 2 }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(String(thrown)).toContain('app_meta.key');
    // The write is lost — this is what froze the pull.
    expect(itemName(db)).toBe('Item');

    // Migration 039, applied the way the worker applies pending migrations.
    const heal = MIGRATIONS.find((m) => m.id === '039_gear_trigger_self_heal');
    expect(heal).toBeDefined();
    db.exec(heal!.sql);

    await repo.upsertItem(item({ name: 'Item v2', updatedAt: 2 }));
    await repo.upsertItem(item({ name: 'Item v3', updatedAt: 3 }));
    expect(itemName(db)).toBe('Item v3');
  });

  it('039 exists and is ordered after 038', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(ids).toContain('039_gear_trigger_self_heal');
    expect(ids.indexOf('039_gear_trigger_self_heal')).toBeGreaterThan(
      ids.indexOf('038_upsert_safe_dirty_triggers'),
    );
  });
});
