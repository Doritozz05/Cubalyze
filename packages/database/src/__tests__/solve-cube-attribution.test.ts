/**
 * `solves.cube_id` / `solves.cube_label` — execution tests against real
 * sqlite-wasm.
 *
 * Phase 3 attributes every solve to the Locker item it was done with. Two
 * properties matter and both are easy to get wrong in a way no type can catch:
 *
 *   1. The columns are NULLABLE and survive a full round-trip. A 2×2 solve, a
 *      virtual solve and any row written before this field existed must all
 *      read back with NO cube — never an empty string, never a stale value.
 *   2. There is deliberately NO foreign key to `gear_items`. Selling or
 *      deleting a cube must never rewrite solve history: the id stays, the
 *      frozen `cube_label` keeps the history readable, and the row is not
 *      touched (which is why this is asserted rather than assumed — a FK would
 *      silently cascade or block, and `PRAGMA foreign_keys` is ON here, exactly
 *      as the worker leaves it).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import { SolvesRepository } from '../repositories/solves.repository.js';
import type { Solve } from '@cubeforge/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  const db = new sqlite3.oo1.DB(`/solve-cube-${dbSeq}.sqlite3`, 'c');
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
  // The worker leaves foreign keys ON after migrations; the cascades and the
  // deliberate LACK of a solve→gear FK are only meaningful in that state.
  db.exec('PRAGMA foreign_keys = ON;');
  // solves.session_id IS a real FK (ON DELETE CASCADE), so a session must exist.
  db.exec(
    "INSERT INTO sessions (id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'Main')",
  );
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repoFor(db: any): SolvesRepository {
  return new SolvesRepository(async (sql, bind) => {
    const rows = db.exec({ sql, bind, rowMode: 'object' });
    return (rows ?? []) as Record<string, unknown>[];
  });
}

function solve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: 'aaaaaaaa-1111-4111-8111-111111111111',
    sessionId: '11111111-1111-4111-8111-111111111111',
    timeMs: 12345,
    timestamp: 1767225600000,
    scramble: "R U R'",
    penalty: 'none',
    source: 'smart',
    moves: [],
    puzzleType: '333',
    ...overrides,
  } as Solve;
}

describe('solves.cube_id / cube_label — schema', () => {
  it('adds both columns as nullable TEXT', () => {
    const db = openDb();
    const columns = db.exec({
      sql: 'SELECT name, type, "notnull" FROM pragma_table_info(?)',
      bind: ['solves'],
      rowMode: 'object',
    }) as { name: string; type: string; notnull: number }[];

    for (const name of ['cube_id', 'cube_label']) {
      const column = columns.find((c) => c.name === name);
      expect(column, `${name} missing`).toBeDefined();
      expect(column!.type).toBe('TEXT');
      expect(column!.notnull).toBe(0);
    }
  });

  it('indexes cube_id for the per-cube queries of the stats phase', () => {
    const db = openDb();
    const indexes = db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'solves'",
      rowMode: 'object',
    }) as { name: string }[];
    expect(indexes.map((i) => i.name)).toContain('idx_solves_cube');
  });
});

describe('solves.cube_id / cube_label — round-trip', () => {
  it('stores and reads back the attribution', async () => {
    const repo = repoFor(openDb());
    await repo.insert(
      solve({ cubeId: 'item_gan12', cubeLabel: 'GAN 12' }),
    );

    const stored = await repo.findById('aaaaaaaa-1111-4111-8111-111111111111');
    expect(stored?.cubeId).toBe('item_gan12');
    expect(stored?.cubeLabel).toBe('GAN 12');
  });

  it('leaves a solve with no cube NULL — not an empty string', async () => {
    const db = openDb();
    const repo = repoFor(db);
    await repo.insert(solve({ cubeId: undefined, cubeLabel: undefined }));

    const stored = await repo.findById('aaaaaaaa-1111-4111-8111-111111111111');
    expect(stored?.cubeId).toBeUndefined();
    expect(stored?.cubeLabel).toBeUndefined();

    const raw = db.exec({
      sql: 'SELECT cube_id, cube_label FROM solves',
      rowMode: 'object',
    }) as { cube_id: unknown; cube_label: unknown }[];
    expect(raw[0].cube_id).toBeNull();
    expect(raw[0].cube_label).toBeNull();
  });

  it('carries the attribution through insertMany (bulk import)', async () => {
    const repo = repoFor(openDb());
    await repo.insertMany([
      solve({ id: 'bbbbbbbb-1111-4111-8111-111111111111', cubeId: 'a', cubeLabel: 'One' }),
      solve({ id: 'cccccccc-1111-4111-8111-111111111111' }),
      solve({ id: 'dddddddd-1111-4111-8111-111111111111', cubeId: 'b', cubeLabel: 'Two' }),
    ]);

    const all = await repo.findAll();
    const byId = new Map(all.map((s) => [s.id, s]));
    expect(byId.get('bbbbbbbb-1111-4111-8111-111111111111')?.cubeLabel).toBe('One');
    expect(byId.get('cccccccc-1111-4111-8111-111111111111')?.cubeId).toBeUndefined();
    expect(byId.get('dddddddd-1111-4111-8111-111111111111')?.cubeLabel).toBe('Two');
  });

  it('updates the attribution (and can clear it) through update', async () => {
    const repo = repoFor(openDb());
    const original = solve({ cubeId: 'old', cubeLabel: 'Old' });
    await repo.insert(original);

    await repo.update({ ...original, cubeId: 'new', cubeLabel: 'New' });
    expect((await repo.findById(original.id))?.cubeLabel).toBe('New');

    // `undefined` deliberately reads back as "no cube", so a solve can be
    // detached from an item without inventing a placeholder.
    await repo.update({ ...original, cubeId: undefined, cubeLabel: undefined });
    const cleared = await repo.findById(original.id);
    expect(cleared?.cubeId).toBeUndefined();
    expect(cleared?.cubeLabel).toBeUndefined();
  });
});

describe('per-cube queries (the stats are a filter, never a stored count)', () => {
  it("findByCube returns only that cube's solves, oldest first", async () => {
    const repo = repoFor(openDb());
    await repo.insertMany([
      solve({ id: 'g1', cubeId: 'gan', cubeLabel: 'GAN 12', timestamp: 3000, timeMs: 10_000 }),
      solve({ id: 'g2', cubeId: 'gan', cubeLabel: 'GAN 12', timestamp: 1000, timeMs: 12_000 }),
      solve({ id: 'v1', cubeId: 'valk', cubeLabel: 'Valk', timestamp: 2000, timeMs: 11_000 }),
      solve({ id: 'n1', timestamp: 4000, timeMs: 9000 }),
    ]);

    const gan = await repo.findByCube('gan');
    expect(gan.map((s) => s.id)).toEqual(['g2', 'g1']); // chronological
    expect(gan.map((s) => s.timeMs)).toEqual([12_000, 10_000]);

    expect((await repo.findByCube('valk')).map((s) => s.id)).toEqual(['v1']);
    // A cube nobody used, and an id that was never a Locker item at all.
    expect(await repo.findByCube('nobody')).toEqual([]);
    expect(await repo.findByCube('deleted-item')).toEqual([]);
  });

  it('findByCube excludes demo solves', async () => {
    const repo = repoFor(openDb());
    await repo.insert(solve({ id: 'real', cubeId: 'gan' }));
    await repo.insert(solve({ id: 'demo', cubeId: 'gan', timestamp: 5_000_000 }), {
      isDemo: true,
    });
    expect((await repo.findByCube('gan')).map((s) => s.id)).toEqual(['real']);
  });

  it('summarizeCubes counts and dates every attributed cube in one pass', async () => {
    const repo = repoFor(openDb());
    await repo.insertMany([
      solve({ id: 'a1', cubeId: 'gan', timestamp: 1000 }),
      solve({ id: 'a2', cubeId: 'gan', timestamp: 5000 }),
      solve({ id: 'a3', cubeId: 'gan', timestamp: 3000 }),
      solve({ id: 'b1', cubeId: 'valk', timestamp: 2000 }),
      // Unattributed solves belong to no cube and must not be counted anywhere.
      solve({ id: 'c1', timestamp: 9000 }),
    ]);
    await repo.insert(solve({ id: 'd1', cubeId: 'gan', timestamp: 9_999_999 }), {
      isDemo: true,
    });

    const summary = await repo.summarizeCubes();
    expect(summary.get('gan')).toEqual({ count: 3, lastUsedAt: 5000 });
    expect(summary.get('valk')).toEqual({ count: 1, lastUsedAt: 2000 });
    expect(summary.size).toBe(2);
  });

  it('summarizeCubes is empty when nothing has been attributed', async () => {
    const repo = repoFor(openDb());
    await repo.insert(solve({ id: 'n1' }));
    expect((await repo.summarizeCubes()).size).toBe(0);
  });

  it('keeps answering for a cube that no longer exists in the Locker', async () => {
    // Sold, deleted, gone from the grid — but the solves happened. This is the
    // whole reason per-cube stats are a filter and there is no FK.
    const repo = repoFor(openDb());
    await repo.insert(solve({ id: 'gone-1', cubeId: 'sold-cube', cubeLabel: 'Sold cube' }));
    expect((await repo.findByCube('sold-cube')).length).toBe(1);
    expect((await repo.summarizeCubes()).get('sold-cube')?.count).toBe(1);
  });
});

describe('solves.cube_id — no foreign key to gear_items', () => {
  it('keeps the solve untouched when the Locker item is deleted', async () => {
    const db = openDb();
    const repo = repoFor(db);
    const row = solve({ cubeId: 'item_gan12', cubeLabel: 'GAN 12' });
    await repo.insert(row);

    // The Locker deletes the item (cascades remove its types/items rows too).
    db.exec({
      sql: 'INSERT INTO gear_categories (id, name, kind) VALUES (?, ?, ?)',
      bind: ['cat_cubes', 'Cubes', 'cube'],
    });
    db.exec({
      sql: 'INSERT INTO gear_items (id, category_id, name, palette, links, photos, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      bind: ['item_gan12', 'cat_cubes', 'GAN 12', '[]', '[]', '[]', '[]', 'owned'],
    });
    db.exec({ sql: 'DELETE FROM gear_items WHERE id = ?', bind: ['item_gan12'] });

    // The solve is history, not a join: the id and the frozen label survive.
    const stored = await repo.findById(row.id);
    expect(stored?.cubeId).toBe('item_gan12');
    expect(stored?.cubeLabel).toBe('GAN 12');
  });

  it('does not block writing a solve for an item that does not exist locally', async () => {
    const repo = repoFor(openDb());
    // Pulled from the cloud for a device that never registered that cube (or
    // whose Locker was wiped): the row must still land.
    await expect(
      repo.insert(solve({ cubeId: 'item_from_another_device', cubeLabel: 'Travel cube' })),
    ).resolves.toBeUndefined();
    expect((await repo.findById('aaaaaaaa-1111-4111-8111-111111111111'))?.cubeLabel).toBe(
      'Travel cube',
    );
  });
});
