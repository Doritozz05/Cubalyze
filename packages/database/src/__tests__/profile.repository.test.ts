import { describe, it, expect, vi } from 'vitest';
import { AppMetaRepository, generateUuid, ONBOARDING_KEY } from '../repositories/app-meta.repository.js';
import { ProfilesRepository } from '../repositories/profiles.repository.js';
import type { Profile } from '@cubeforge/models';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * In-memory fake of the `app_meta` table so first-run semantics (generate →
 * persist → re-read) can be asserted realistically.
 */
function metaFake(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const fn = vi.fn(async (sql: string, bind?: unknown[]) => {
    const key = bind?.[0] as string | undefined;
    if (sql.includes('SELECT')) {
      const value = key !== undefined ? store.get(key) : undefined;
      return value === undefined ? [] : [{ value }];
    }
    if (sql.includes('INSERT OR IGNORE')) {
      if (key !== undefined && bind?.[1] !== undefined && !store.has(key)) {
        store.set(key, bind[1] as string);
      }
      return [];
    }
    if (sql.includes('INSERT OR REPLACE')) {
      if (key !== undefined && bind?.[1] !== undefined) {
        store.set(key, bind[1] as string);
      }
      return [];
    }
    return [];
  });
  return { fn, store };
}

/** In-memory fake of the `profiles` table. */
function profilesFake(initial: Record<string, unknown>[] = []) {
  const rows = initial.map((r) => ({ ...r }));
  const fn = vi.fn(async (sql: string, bind?: unknown[]) => {
    if (sql.includes('SELECT')) {
      const userId = bind?.[0] as string | undefined;
      const matches = userId !== undefined ? rows.filter((r) => r.user_id === userId) : rows;
      return matches.map((r) => ({ ...r }));
    }
    if (sql.includes('INSERT OR IGNORE') || sql.includes('INSERT OR REPLACE')) {
      const [userId, displayName, handle, bio, avatarKind, avatarData, mainPuzzle, declaredMethods, createdAt, updatedAt] =
        bind as unknown[];
      const row: Record<string, unknown> = {
        user_id: userId,
        display_name: displayName,
        handle,
        bio,
        avatar_kind: avatarKind,
        avatar_data: avatarData,
        main_puzzle: mainPuzzle,
        declared_methods: declaredMethods,
        created_at: createdAt,
        updated_at: updatedAt,
      };
      const idx = rows.findIndex((r) => r.user_id === userId);
      if (sql.includes('INSERT OR IGNORE') && idx >= 0) return [];
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      return [];
    }
    if (sql.includes('DELETE')) {
      const userId = bind?.[0] as string;
      const idx = rows.findIndex((r) => r.user_id === userId);
      if (idx >= 0) rows.splice(idx, 1);
      return [];
    }
    return [];
  });
  return { fn, rows };
}

const SAMPLE_PROFILE_ROW: Record<string, unknown> = {
  user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  display_name: 'Ada Cube',
  handle: 'adacube',
  bio: 'Sub-15 CFOP',
  avatar_kind: 'photo',
  avatar_data: 'data:image/png;base64,AAAA',
  main_puzzle: '3x3x3',
  declared_methods: '["CFOP","Roux"]',
  created_at: 1750000000000,
  updated_at: 1750000000001,
};

describe('AppMetaRepository', () => {
  it('get returns null for a missing key', async () => {
    const { fn } = metaFake();
    const repo = new AppMetaRepository(fn);
    expect(await repo.get('user_id')).toBeNull();
  });

  it('set then get round-trips a value', async () => {
    const { fn } = metaFake();
    const repo = new AppMetaRepository(fn);
    await repo.set('theme', 'dark');
    expect(await repo.get('theme')).toBe('dark');
    expect(fn.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO app_meta');
  });

  it('getOrCreateUserId generates and persists a UUID on first run, then reuses it', async () => {
    const { fn, store } = metaFake();
    const repo = new AppMetaRepository(fn);

    const first = await repo.getOrCreateUserId();
    expect(first).toMatch(UUID_V4);
    expect(store.get('user_id')).toBe(first);

    const second = await repo.getOrCreateUserId();
    expect(second).toBe(first);

    // Exactly one INSERT OR IGNORE across both calls (second call only reads).
    const inserts = fn.mock.calls.filter(([sql]) => sql.includes('INSERT OR IGNORE'));
    expect(inserts).toHaveLength(1);
  });

  it('getOrCreateUserId returns a pre-existing id without generating a new one', async () => {
    const seeded = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { fn, store } = metaFake({ user_id: seeded });
    const repo = new AppMetaRepository(fn);

    const id = await repo.getOrCreateUserId();
    expect(id).toBe(seeded);
    expect(store.size).toBe(1);
    const inserts = fn.mock.calls.filter(([sql]) => sql.includes('INSERT'));
    expect(inserts).toHaveLength(0);
  });

  it('getOnboardingCompleted is false while the onboarding flag is absent (first launch)', async () => {
    const { fn } = metaFake();
    const repo = new AppMetaRepository(fn);
    expect(await repo.getOnboardingCompleted()).toBe(false);
  });

  it('setOnboardingCompleted persists the flag with the onboarding key', async () => {
    const { fn, store } = metaFake();
    const repo = new AppMetaRepository(fn);
    await repo.setOnboardingCompleted();
    expect(store.get(ONBOARDING_KEY)).toBe('1');
    expect(fn.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO app_meta');
    expect(await repo.getOnboardingCompleted()).toBe(true);
  });

  it('setOnboardingCompleted is idempotent', async () => {
    const { fn } = metaFake({ [ONBOARDING_KEY]: '1' });
    const repo = new AppMetaRepository(fn);
    await repo.setOnboardingCompleted();
    expect(await repo.getOnboardingCompleted()).toBe(true);
    // One overwrite call, no reads triggered by the double-set.
    const writes = fn.mock.calls.filter(([sql]) => sql.includes('INSERT OR REPLACE'));
    expect(writes).toHaveLength(1);
  });

  it('getOnboardingCompleted is true once the flag is seeded', async () => {
    const { fn } = metaFake({ [ONBOARDING_KEY]: '1' });
    const repo = new AppMetaRepository(fn);
    expect(await repo.getOnboardingCompleted()).toBe(true);
  });

  it('generateUuid produces a v4-shaped UUID', () => {
    expect(generateUuid()).toMatch(UUID_V4);
  });
});

describe('ProfilesRepository', () => {
  it('findById returns null for a missing profile', async () => {
    const { fn } = profilesFake();
    const repo = new ProfilesRepository(fn);
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findById maps a row to a Profile (camelCase + JSON fields)', async () => {
    const { fn } = profilesFake([SAMPLE_PROFILE_ROW]);
    const repo = new ProfilesRepository(fn);
    const profile = await repo.findById(SAMPLE_PROFILE_ROW.user_id as string);
    expect(profile).not.toBeNull();
    expect(profile!.displayName).toBe('Ada Cube');
    expect(profile!.avatarKind).toBe('photo');
    expect(profile!.avatarData).toBe('data:image/png;base64,AAAA');
    expect(profile!.declaredMethods).toEqual(['CFOP', 'Roux']);
    expect(profile!.mainPuzzle).toBe('3x3x3');
    expect(profile!.createdAt).toBe(1750000000000);
  });

  it('findById normalizes avatarKind and tolerates corrupt declared_methods', async () => {
    const { fn } = profilesFake([
      { ...SAMPLE_PROFILE_ROW, avatar_kind: 'whatever', declared_methods: 'not-json' },
    ]);
    const repo = new ProfilesRepository(fn);
    const profile = await repo.findById(SAMPLE_PROFILE_ROW.user_id as string);
    expect(profile!.avatarKind).toBe('identicon');
    expect(profile!.declaredMethods).toEqual([]);
  });

  it('getOrCreate inserts a default profile on first access and reuses it after', async () => {
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const { fn, rows } = profilesFake();
    const repo = new ProfilesRepository(fn);

    const first = await repo.getOrCreate(userId);
    expect(first.userId).toBe(userId);
    expect(first.displayName).toBe('');
    expect(first.avatarKind).toBe('identicon');
    expect(first.mainPuzzle).toBe('3x3x3');
    expect(first.declaredMethods).toEqual([]);
    expect(first.createdAt).toBeGreaterThan(0);
    expect(rows).toHaveLength(1);

    const second = await repo.getOrCreate(userId);
    expect(second).toEqual(first);
    const inserts = fn.mock.calls.filter(([sql]) => sql.includes('INSERT'));
    expect(inserts).toHaveLength(1);
  });

  it('getOrCreate returns an existing profile without inserting', async () => {
    const { fn } = profilesFake([SAMPLE_PROFILE_ROW]);
    const repo = new ProfilesRepository(fn);
    const profile = await repo.getOrCreate(SAMPLE_PROFILE_ROW.user_id as string);
    expect(profile.displayName).toBe('Ada Cube');
    const inserts = fn.mock.calls.filter(([sql]) => sql.includes('INSERT'));
    expect(inserts).toHaveLength(0);
  });

  it('upsert replaces the identity row (edit flow)', async () => {
    const { fn, rows } = profilesFake();
    const repo = new ProfilesRepository(fn);
    const profile: Profile = {
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      displayName: 'Feliks',
      handle: 'f2l',
      bio: 'Lookahead',
      avatarKind: 'identicon',
      mainPuzzle: '2x2x2',
      declaredMethods: ['ZZ'],
      createdAt: 1750000000000,
      updatedAt: 1750000000001,
    };
    await repo.upsert(profile);
    expect(fn.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO profiles');
    expect(rows).toHaveLength(1);
    expect((rows[0] as Record<string, unknown>).declared_methods).toBe('["ZZ"]');
    expect((rows[0] as Record<string, unknown>).avatar_data).toBeNull();
  });

  it('delete removes the profile row', async () => {
    const { fn, rows } = profilesFake([SAMPLE_PROFILE_ROW]);
    const repo = new ProfilesRepository(fn);
    await repo.delete(SAMPLE_PROFILE_ROW.user_id as string);
    expect(rows).toHaveLength(0);
    expect(fn.mock.calls[0][0]).toContain('DELETE FROM profiles');
  });
});
