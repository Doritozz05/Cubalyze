/**
 * Sync-trigger safety — regression tests for the SQLite rule that made an
 * UPSERT abort on its second write.
 *
 * SQLite refuses to resolve ANY constraint conflict inside a trigger fired by
 * the DO UPDATE arm of an `INSERT … ON CONFLICT`: even a sub-statement that
 * carries its own OR REPLACE / OR IGNORE is aborted, and the error surfaces on
 * the OUTER statement. The sync triggers wrote the dirty flag with
 * `INSERT OR REPLACE INTO app_meta`, so any repository that upserted through a
 * conflict clause threw
 *
 *     SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key
 *
 * on the second write to the same row — a user-facing bug (editing a calendar
 * task twice) and a hard blocker for the Locker repositories, which upsert
 * by design. The fix is the explicit `ON CONFLICT(key) DO UPDATE` spelling
 * (migrations 037/038); these tests guard both the behaviour and the spelling,
 * because the failure mode is a silent throw far from its cause.
 *
 * The second half of the file guards the flip side of the same coin:
 * `INSERT OR REPLACE` on a table whose AFTER DELETE trigger records a sync
 * tombstone turns an EDIT into a DELETION. With `PRAGMA recursive_triggers`
 * on (which REPLACE's internal delete needs), re-completing a skill or
 * re-storing a training session would mint a tombstone for a row that is very
 * much alive and get it pushed. The repositories now use explicit upserts, and
 * these tests pin that even when the pragma IS enabled.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { MIGRATIONS } from '../migrations/migrations.js';
import { CalendarRepository } from '../repositories/calendar.repository.js';
import { SkillProgressRepository } from '../repositories/skill-progress.repository.js';
import { TrainingRepository } from '../repositories/training.repository.js';
import type { TrainingSessionRecord } from '../repositories/training.repository.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 0;

/**
 * A fully migrated database. `recursiveTriggers` mirrors the worst case: the
 * worker leaves the pragma OFF, but REPLACE's internal DELETE only fires the
 * tombstone triggers when it is ON — so the tombstone tests run with it ON to
 * prove the repositories no longer depend on that accident.
 */
function openDb(opts: { recursiveTriggers?: boolean } = {}) {
  dbSeq += 1;
  const db = new sqlite3.oo1.DB(`/triggers-${dbSeq}.sqlite3`, 'c');
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY)');
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
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`PRAGMA recursive_triggers = ${opts.recursiveTriggers ? 'ON' : 'OFF'};`);
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const executorFor = (db: any) => async (sql: string, bind?: unknown[]) =>
  (db.exec({ sql, bind, rowMode: 'object' }) ?? []) as Record<string, unknown>[];

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Warm-up',
  description: '',
  startDate: '2026-09-01',
  repeat: 'none' as const,
  daysOfWeek: [] as number[],
  color: 'blue' as const,
  createdAt: new Date(1_700_000_000_000).toISOString(),
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

const trainingSession = (overrides: Partial<TrainingSessionRecord> = {}): TrainingSessionRecord => ({
  id: 'ts-1',
  exerciseId: 'ex-1',
  methodId: 'method-1',
  phaseId: undefined,
  subsetId: undefined,
  startedAt: 1_700_000_000_000,
  completedAt: undefined,
  durationMs: 0,
  smartCubeUsed: false,
  status: 'active',
  totalAttempts: 0,
  correctCount: 0,
  accuracy: 0,
  avgTimeMs: 0,
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

describe('sync triggers are UPSERT-safe', () => {
  it('migration 038 repairs every dirty trigger the old migrations wrote with OR REPLACE', () => {
    // The historical migrations keep their OR REPLACE text (a migration is a
    // record of what ran, never edited), so the guard is that the repair
    // migration names EVERY trigger that had the unsafe body — a new table
    // added with the old idiom would otherwise slip through un-repaired.
    const unsafe = new Set<string>();
    const re = /CREATE TRIGGER IF NOT EXISTS (\w+)([\s\S]*?)END;/g;
    for (const migration of MIGRATIONS) {
      let match: RegExpExecArray | null;
      while ((match = re.exec(migration.sql)) !== null) {
        if (/OR\s+REPLACE\s+INTO\s+app_meta/i.test(match[2])) unsafe.add(match[1]);
      }
    }
    expect(unsafe.size).toBeGreaterThan(0);

    const repair = MIGRATIONS.find((m) => m.id === '038_upsert_safe_dirty_triggers');
    expect(repair).toBeDefined();
    for (const name of unsafe) {
      expect(repair!.sql, `038 must repair ${name}`).toContain(name);
    }
  });

  it('every dirty trigger in the schema uses the explicit ON CONFLICT form', () => {
    // The LAST migration that defines each trigger wins; check the effective
    // definition rather than the history.
    const effective = new Map<string, string>();
    for (const migration of MIGRATIONS) {
      const re = /CREATE TRIGGER IF NOT EXISTS (\w+)([\s\S]*?)END;/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(migration.sql)) !== null) {
        effective.set(match[1], match[2]);
      }
    }
    const dirty = [...effective.entries()].filter(([name]) => name.startsWith('trg_dirty_'));
    expect(dirty.length).toBeGreaterThanOrEqual(20);
    for (const [name, body] of dirty) {
      expect(body, `${name} must use the UPSERT-safe idiom`).toContain('ON CONFLICT(key) DO UPDATE');
      expect(body, `${name} must not use OR REPLACE`).not.toContain('OR REPLACE');
    }
  });

  it('editing the same calendar task twice works and still flags the sync', async () => {
    const db = openDb();
    try {
      const repo = new CalendarRepository(executorFor(db));
      await repo.upsert(task());
      // Before the fix this threw SQLITE_CONSTRAINT_PRIMARYKEY on app_meta.key:
      // the second write takes the ON CONFLICT arm, which fires the dirty
      // trigger, whose INSERT OR REPLACE app_meta could not be resolved.
      await repo.upsert(task({ title: 'Edited' }));
      await repo.upsert(task({ title: 'Edited again' }));

      const rows = db.exec({ sql: 'SELECT title FROM training_tasks', rowMode: 'object' });
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Edited again');
      expect(
        db.exec({ sql: "SELECT value FROM app_meta WHERE key = 'sync_dirty'", rowMode: 'object' })[0]
          .value,
      ).toBe('1');
    } finally {
      db.close();
    }
  });

  it('a Locker item can be rewritten any number of times (the gear upserts)', async () => {
    const db = openDb();
    try {
      const executor = executorFor(db);
      const category = {
        id: 'c1',
        name: 'Cubes',
        kind: 'cube' as const,
        icon: 'Box',
        createdAt: 1_700_000_000_000,
      };
      const item = (name: string) => ({
        id: 'i1',
        categoryId: 'c1',
        typeId: null,
        name,
        palette: [] as string[],
        links: [],
        photos: [],
        tags: [],
        status: 'owned' as const,
        primary: false,
        favorite: false,
        quantity: 1,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });
      const { GearRepository } = await import('../repositories/gear.repository.js');
      const repo = new GearRepository(executor);
      await repo.upsertCategory(category);
      await repo.upsertCategory({ ...category, name: 'Renamed' });
      await repo.upsertItem(item('First'));
      await repo.upsertItem(item('Second'));
      await repo.upsertItem(item('Third'));

      const { items, categories } = await repo.loadAll();
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Third');
      expect(categories).toHaveLength(1);
      expect(categories[0]?.name).toBe('Renamed');
    } finally {
      db.close();
    }
  });
});

describe('an edit is never mistaken for a delete', () => {
  it('re-completing a skill mints no tombstone, even with recursive triggers on', async () => {
    const db = openDb({ recursiveTriggers: true });
    try {
      const repo = new SkillProgressRepository(executorFor(db));
      await repo.setCompletedAt('skill-1', 1_700_000_000_000);
      await repo.setCompletedAt('skill-1', 1_700_000_000_000);
      await repo.setCompletedAt('skill-1', 1_700_000_000_001);

      const tombstones = db.exec({ sql: 'SELECT * FROM sync_tombstones', rowMode: 'object' });
      expect(tombstones).toHaveLength(0);
      const rows = db.exec({ sql: 'SELECT * FROM skill_progress', rowMode: 'object' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].completed_at)).toBe(1_700_000_000_001);
    } finally {
      db.close();
    }
  });

  it('re-storing a pulled training session mints no tombstone', async () => {
    const db = openDb({ recursiveTriggers: true });
    try {
      const repo = new TrainingRepository(executorFor(db));
      await repo.upsertTrainingSession(trainingSession());
      await repo.upsertTrainingSession(trainingSession({ status: 'completed', completedAt: 1_700_000_001_000 }));

      expect(db.exec({ sql: 'SELECT * FROM sync_tombstones', rowMode: 'object' })).toHaveLength(0);
      const rows = db.exec({ sql: 'SELECT * FROM training_sessions', rowMode: 'object' });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('completed');
    } finally {
      db.close();
    }
  });

  it('un-completing a skill still DOES mint a tombstone (the delete channel is intact)', async () => {
    const db = openDb();
    try {
      const repo = new SkillProgressRepository(executorFor(db));
      await repo.setCompletedAt('skill-1', 1_700_000_000_000);
      await repo.setIncomplete('skill-1');
      const tombstones = db.exec({ sql: 'SELECT * FROM sync_tombstones', rowMode: 'object' });
      expect(tombstones).toHaveLength(1);
      expect(tombstones[0].entity).toBe('skill_progress');
      expect(Number(tombstones[0].deleted_at)).toBeGreaterThan(1_700_000_000_000);
    } finally {
      db.close();
    }
  });

  it('replaceAll keeps tombstones only for the skills that are really gone', async () => {
    const db = openDb();
    try {
      const repo = new SkillProgressRepository(executorFor(db));
      await repo.setCompletedAt('kept', 1_700_000_000_000);
      await repo.setCompletedAt('dropped', 1_700_000_000_000);

      // Mock-data reset: the kept skill is rewritten, the other is removed.
      await repo.replaceAll(['kept']);

      const tombstones = db.exec({ sql: 'SELECT entity_id FROM sync_tombstones', rowMode: 'object' });
      expect(tombstones.map((t: { entity_id: string }) => t.entity_id)).toEqual(['dropped']);
      expect(await repo.findAll()).toEqual(['kept']);
    } finally {
      db.close();
    }
  });
});
