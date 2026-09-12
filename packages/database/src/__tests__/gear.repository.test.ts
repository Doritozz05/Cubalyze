/**
 * GearRepository (Locker) — execution tests against real sqlite-wasm.
 *
 * The repository is the persistence half of the Locker; the pure half is the
 * model in apps/web (its own tests). What can silently break here is the SQL:
 * the cascades that replace `removeCategory` / `removeType`, the JSON columns,
 * and the monotonic stamping that decides whether an edit is ever picked up by
 * the sync push cursor. All of that is exercised against the real engine, not a
 * mock, and with `PRAGMA foreign_keys = ON` — the same state the worker enables
 * after migrations, without which the cascades are dead code.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import { GearRepository } from '../repositories/gear.repository.js';
import type {
  GearCategory,
  GearItem,
  GearType,
} from '../repositories/gear.repository.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  const db = new sqlite3.oo1.DB(`/gear-${dbSeq}.sqlite3`, 'c');
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  for (const migration of MIGRATIONS) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec('INSERT OR IGNORE INTO _migrations (id) VALUES (?)', { bind: [migration.id] });
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
  // The worker turns foreign keys ON once migrations are done (worker.ts);
  // the cascades under test only exist from that point on.
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repoFor(db: any): GearRepository {
  return new GearRepository(async (sql, bind) => {
    const rows = db.exec({ sql, bind, rowMode: 'object' });
    return (rows ?? []) as Record<string, unknown>[];
  });
}

const category = (id: string, overrides: Partial<GearCategory> = {}): GearCategory => ({
  id,
  name: `Category ${id}`,
  kind: 'cube',
  icon: 'Box',
  createdAt: 1000,
  ...overrides,
});

const type = (id: string, categoryId: string, overrides: Partial<GearType> = {}): GearType => ({
  id,
  categoryId,
  name: `Type ${id}`,
  puzzleCategory: null,
  createdAt: 1000,
  ...overrides,
});

const item = (id: string, categoryId: string, overrides: Partial<GearItem> = {}): GearItem => ({
  id,
  categoryId,
  typeId: null,
  name: `Item ${id}`,
  palette: ['#fff', '#ff0'],
  links: [],
  photos: [],
  tags: [],
  status: 'owned',
  primary: false,
  favorite: false,
  quantity: 1,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('GearRepository', () => {
  it('round-trips every field, including the optional ones and the JSON columns', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1', { kind: 'gear', accent: '#ff0000', icon: 'Wrench' }));
      await repo.upsertType(type('t1', 'c1', { puzzleCategory: '3x3 OH' }));
      await repo.upsertItem(
        item('i1', 'c1', {
          typeId: 't1',
          name: 'GAN 12 UI',
          brand: 'GAN',
          model: '12 UI FreePlay',
          finish: 'Stickerless',
          serial: 'SN-123',
          palette: ['#111', '#222', '#333'],
          acquiredAt: '2026-01-15',
          price: { amount: 64.95, currency: 'EUR' },
          notes: 'MagLev, tensioned 3.5',
          links: [{ label: 'Shop', url: 'https://example.com/gan12' }],
          photos: [{ id: 'p1', width: 1280, height: 1280, addedAt: 42 }],
          tags: ['ballcore', 'maglev'],
          status: 'wishlist',
          primary: true,
          favorite: true,
          rating: 4.5,
          quantity: 2,
          condition: 'mint',
          createdAt: 111,
          updatedAt: 222,
        }),
      );

      const snapshot = await repo.loadAll();
      expect(snapshot.categories).toEqual([
        { id: 'c1', name: 'Category c1', kind: 'gear', icon: 'Wrench', accent: '#ff0000', createdAt: 1000 },
      ]);
      expect(snapshot.types).toEqual([
        { id: 't1', categoryId: 'c1', name: 'Type t1', puzzleCategory: '3x3 OH', createdAt: 1000 },
      ]);
      expect(snapshot.items).toHaveLength(1);
      expect(snapshot.items[0]).toMatchObject({
        id: 'i1',
        categoryId: 'c1',
        typeId: 't1',
        name: 'GAN 12 UI',
        brand: 'GAN',
        model: '12 UI FreePlay',
        finish: 'Stickerless',
        serial: 'SN-123',
        palette: ['#111', '#222', '#333'],
        acquiredAt: '2026-01-15',
        price: { amount: 64.95, currency: 'EUR' },
        notes: 'MagLev, tensioned 3.5',
        links: [{ label: 'Shop', url: 'https://example.com/gan12' }],
        photos: [{ id: 'p1', width: 1280, height: 1280, addedAt: 42 }],
        tags: ['ballcore', 'maglev'],
        status: 'wishlist',
        primary: true,
        favorite: true,
        rating: 4.5,
        quantity: 2,
        condition: 'mint',
        createdAt: 111,
      });
    } finally {
      db.close();
    }
  });

  it('omits optional fields that were never set instead of inventing defaults', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertItem(item('i1', 'c1'));

      const [loaded] = (await repo.loadAll()).items;
      expect(loaded).not.toHaveProperty('brand');
      expect(loaded).not.toHaveProperty('price');
      expect(loaded).not.toHaveProperty('condition');
      expect(loaded).not.toHaveProperty('rating');
      expect(loaded?.typeId).toBeNull();
      expect(loaded?.quantity).toBe(1);
    } finally {
      db.close();
    }
  });

  it('updates in place on a second upsert (no duplicate row)', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertItem(item('i1', 'c1', { name: 'First' }));
      await repo.upsertItem(item('i1', 'c1', { name: 'Renamed', updatedAt: 2000 }));

      const { items } = await repo.loadAll();
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Renamed');
    } finally {
      db.close();
    }
  });

  it('deleting a category takes its types and its items (mirrors removeCategory)', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertCategory(category('c2'));
      await repo.upsertType(type('t1', 'c1'));
      await repo.upsertType(type('t2', 'c2'));
      await repo.upsertItem(item('i1', 'c1', { typeId: 't1' }));
      await repo.upsertItem(item('i2', 'c2', { typeId: 't2' }));

      await repo.deleteCategory('c1');

      const snapshot = await repo.loadAll();
      expect(snapshot.categories.map((c) => c.id)).toEqual(['c2']);
      expect(snapshot.types.map((t) => t.id)).toEqual(['t2']);
      expect(snapshot.items.map((i) => i.id)).toEqual(['i2']);
    } finally {
      db.close();
    }
  });

  it('deleting a type re-homes its items in the category (mirrors removeType)', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertType(type('t1', 'c1'));
      await repo.upsertItem(item('i1', 'c1', { typeId: 't1' }));
      await repo.upsertItem(item('i2', 'c1', { typeId: 't1' }));

      await repo.deleteType('t1');

      const { items, types } = await repo.loadAll();
      expect(types).toHaveLength(0);
      expect(items.map((i) => i.typeId)).toEqual([null, null]);
      expect(items.every((i) => i.categoryId === 'c1')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('replaceAll rewrites the collection whole (import / reset)', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('old'));
      await repo.upsertItem(item('stale', 'old'));

      await repo.replaceAll({
        categories: [category('c1'), category('c2', { kind: 'gear' })],
        types: [type('t1', 'c1', { puzzleCategory: '3x3' })],
        items: [item('i1', 'c1', { typeId: 't1' })],
      });

      const snapshot = await repo.loadAll();
      expect(snapshot.categories.map((c) => c.id)).toEqual(['c1', 'c2']);
      expect(snapshot.types.map((t) => t.id)).toEqual(['t1']);
      expect(snapshot.items.map((i) => i.id)).toEqual(['i1']);
      expect(await repo.count()).toEqual({ categories: 2, types: 1, items: 1 });
    } finally {
      db.close();
    }
  });

  it('takes a strictly newer stamp on local edits and keeps foreign stamps as-is', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertItem(item('i1', 'c1', { updatedAt: 5000 }), { local: true });

      const first = (await repo.loadAll()).items[0]!;
      expect(first.updatedAt).toBeGreaterThan(5000);

      // A second local edit must move the stamp forward even though the model
      // object still carries the old one (the push cursor is `> watermark`).
      await repo.upsertItem({ ...first, name: 'Edited again' }, { local: true });
      const second = (await repo.loadAll()).items[0]!;
      expect(second.updatedAt).toBeGreaterThan(first.updatedAt);

      // Pull paths pass the cloud timestamp through untouched.
      await repo.upsertItem({ ...second, name: 'From the cloud' }, { local: false });
      expect((await repo.loadAll()).items[0]?.updatedAt).toBe(second.updatedAt);
    } finally {
      db.close();
    }
  });

  it('survives a corrupted JSON column instead of taking the Locker down', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.upsertCategory(category('c1'));
      await repo.upsertItem(item('i1', 'c1', { tags: ['ok'] }));
      // A half-written value, as a killed worker could leave behind.
      db.exec("UPDATE gear_items SET tags = '{\"broken\"', palette = 'nope', photos = '[1,2]'");

      const [loaded] = (await repo.loadAll()).items;
      expect(loaded?.tags).toEqual([]);
      expect(loaded?.palette).toEqual([]);
      // Non-conforming photo entries are dropped, not surfaced as broken refs.
      expect(loaded?.photos).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('clear empties the three tables (reset)', async () => {
    const db = openDb();
    try {
      const repo = repoFor(db);
      await repo.replaceAll({
        categories: [category('c1')],
        types: [type('t1', 'c1')],
        items: [item('i1', 'c1', { typeId: 't1' })],
      });
      await repo.clear();
      expect(await repo.count()).toEqual({ categories: 0, types: 0, items: 0 });
    } finally {
      db.close();
    }
  });

  describe('smart cube identity (smart_id)', () => {
    it('separates the radio address from the printed serial number', async () => {
      const db = openDb();
      try {
        const repo = repoFor(db);
        await repo.upsertCategory(category('c1'));
        // Two DIFFERENT facts on the same item: the serial is typed by a person,
        // the address is what a connection matches against.
        await repo.upsertItem(
          item('i1', 'c1', { serial: 'SN-123', smartId: 'AABBCCDDEEFF' }),
        );

        const [loaded] = (await repo.loadAll()).items;
        expect(loaded?.serial).toBe('SN-123');
        expect(loaded?.smartId).toBe('AABBCCDDEEFF');

        // Writing one must not disturb the other.
        await repo.upsertItem(item('i1', 'c1', { serial: 'SN-999', smartId: 'AABBCCDDEEFF' }));
        const [afterSerial] = (await repo.loadAll()).items;
        expect(afterSerial?.serial).toBe('SN-999');
        expect(afterSerial?.smartId).toBe('AABBCCDDEEFF');

        await repo.upsertItem(item('i1', 'c1', { serial: 'SN-999', smartId: '112233445566' }));
        const [afterSmart] = (await repo.loadAll()).items;
        expect(afterSmart?.serial).toBe('SN-999');
        expect(afterSmart?.smartId).toBe('112233445566');
      } finally {
        db.close();
      }
    });

    it('stores the canonical form whatever spelling the writer used', async () => {
      const db = openDb();
      try {
        const repo = repoFor(db);
        await repo.upsertCategory(category('c1'));
        await repo.upsertItem(item('i1', 'c1', { smartId: 'aa:bb:cc:dd:ee:ff' }));
        await repo.upsertItem(item('i2', 'c1', { smartId: 'AA-BB-CC-DD-EE-FF' }));

        const rows = db.exec({
          sql: 'SELECT smart_id FROM gear_items ORDER BY id',
          rowMode: 'object',
        });
        expect(rows.map((row: { smart_id: string }) => row.smart_id)).toEqual([
          'AABBCCDDEEFF',
          'AABBCCDDEEFF',
        ]);
      } finally {
        db.close();
      }
    });

    it('stores NULL instead of a value that is not an address', async () => {
      const db = openDb();
      try {
        const repo = repoFor(db);
        await repo.upsertCategory(category('c1'));
        // A printed serial typed into the wrong field must never become an
        // identity the link could match against.
        await repo.upsertItem(item('i1', 'c1', { smartId: 'SN-12345678' }));
        await repo.upsertItem(item('i2', 'c1', { smartId: 'AABBCCDDEEF' }));

        const rows = db.exec({
          sql: 'SELECT smart_id FROM gear_items ORDER BY id',
          rowMode: 'object',
        });
        expect(rows.map((row: { smart_id: string | null }) => row.smart_id)).toEqual([null, null]);
      } finally {
        db.close();
      }
    });

    it('clears the identity when an item stops claiming a cube', async () => {
      const db = openDb();
      try {
        const repo = repoFor(db);
        await repo.upsertCategory(category('c1'));
        await repo.upsertItem(item('i1', 'c1', { smartId: 'AABBCCDDEEFF' }));
        await repo.upsertItem(item('i1', 'c1'));

        const rows = db.exec({
          sql: 'SELECT smart_id FROM gear_items WHERE id = ?',
          bind: ['i1'],
          rowMode: 'object',
        });
        expect(rows[0]?.smart_id).toBeNull();
      } finally {
        db.close();
      }
    });

    it('indexes the address, because every connection looks an item up by it', async () => {
      const db = openDb();
      try {
        const rows = db.exec({
          sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_gear_items_smart'",
          rowMode: 'object',
        });
        expect(rows).toHaveLength(1);
      } finally {
        db.close();
      }
    });

    it('keeps an item without an identity intact across a reload', async () => {
      const db = openDb();
      try {
        const repo = repoFor(db);
        await repo.upsertCategory(category('c1'));
        await repo.upsertItem(item('i1', 'c1', { serial: 'SN-1' }));

        const [loaded] = (await repo.loadAll()).items;
        expect(loaded?.smartId).toBeUndefined();
        expect(loaded?.serial).toBe('SN-1');
      } finally {
        db.close();
      }
    });
  });
});
