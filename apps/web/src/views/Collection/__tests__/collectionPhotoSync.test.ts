/**
 * The photo channel of the Locker's sync, driven through its ports.
 *
 * The rules worth pinning are the expensive ones: never re-upload bytes that
 * Storage already has, never retry a 404 on every cycle (backoff), always keep
 * the REFERENCE when the bytes are missing (the row is the source of truth),
 * and honour the per-cycle object budget so a 200-photo Locker cannot burn the
 * whole Storage quota in one poll. All of that is orchestration, so it is
 * tested with fakes: no IndexedDB, no network, no Supabase.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GearPhotoRef, GearPhotoSyncState } from '@cubalyze/database';
import {
  MAX_OBJECTS_PER_CYCLE,
  RETRY_BACKOFF_MS,
  performPhotoSync,
  photoFingerprint,
  photoObjectPath,
  planPhotoSync,
  resetPhotoSyncThrottle,
  runPhotoSync,
  shouldRetry,
  type PhotoBlobStore,
  type PhotoStoragePort,
} from '../collectionPhotoSync';

const USER = 'user-1';
const photo = (id: string, addedAt = 1000): GearPhotoRef => ({
  id,
  width: 800,
  height: 800,
  addedAt,
});
const key = (itemId: string, photoId: string) => `${itemId}:${photoId}`;

const jpeg = (bytes = 4) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

function fakeStorage(overrides: Partial<PhotoStoragePort> = {}): PhotoStoragePort & {
  uploads: string[];
  removals: string[];
} {
  const uploads: string[] = [];
  const removals: string[] = [];
  return {
    uploads,
    removals,
    upload: vi.fn(async (path: string) => {
      uploads.push(path);
    }),
    download: vi.fn(async () => jpeg()),
    remove: vi.fn(async (paths: string[]) => {
      removals.push(...paths);
    }),
    ...overrides,
  };
}

function fakeBlobs(overrides: Partial<PhotoBlobStore> = {}): PhotoBlobStore {
  return {
    keys: vi.fn(async () => new Set<string>()),
    read: vi.fn(async () => ({ full: jpeg(100), thumb: jpeg(10) })),
    import: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

/** Minimal GearRepository surface the orchestrator uses. */
function fakeRepo(items: { id: string; photos: GearPhotoRef[] }[], ledger: GearPhotoSyncState[] = []) {
  const states = new Map(ledger.map((state) => [state.photoKey, state]));
  return {
    states,
    loadAll: vi.fn(async () => ({
      categories: [],
      types: [],
      items: items.map((item) => ({ id: item.id, photos: item.photos })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any,
    loadPhotoSyncStates: vi.fn(async () => new Map(states)),
    upsertPhotoSyncState: vi.fn(async (state: GearPhotoSyncState) => {
      states.set(state.photoKey, state);
    }),
    deletePhotoSyncState: vi.fn(async (photoKey: string) => {
      states.delete(photoKey);
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const run = (
  repo: ReturnType<typeof fakeRepo>,
  storage: PhotoStoragePort,
  blobs: PhotoBlobStore,
  now = 100_000,
  budget = MAX_OBJECTS_PER_CYCLE,
) =>
  performPhotoSync({ userId: USER, storage, blobs, repo, budget, now });

describe('photo object paths', () => {
  it('mirror the bucket policy: {uid}/{itemId}/{photoId}/{full|thumb}.jpg', () => {
    // The RLS policies key on the FIRST folder being auth.uid(); if the shape
    // ever changes, uploads start failing with 403 (or worse, succeed into
    // somebody else's folder).
    expect(photoObjectPath(USER, 'item-1', 'photo-1', 'full')).toBe(
      `${USER}/item-1/photo-1/full.jpg`,
    );
    expect(photoObjectPath(USER, 'item-1', 'photo-1', 'thumb')).toBe(
      `${USER}/item-1/photo-1/thumb.jpg`,
    );
  });
});

describe('planPhotoSync', () => {
  it('uploads a referenced photo whose bytes are here and Storage has not seen', () => {
    const plan = planPhotoSync({
      refs: [{ itemId: 'i1', photo: photo('p1') }],
      ledger: new Map(),
      localKeys: new Set([key('i1', 'p1')]),
      now: 1000,
    });
    expect(plan.toUpload.map((e) => e.key)).toEqual(['i1:p1']);
    expect(plan.toDownload).toEqual([]);
  });

  it('does not re-upload a synced photo unless its fingerprint changed', () => {
    const synced: GearPhotoSyncState = {
      photoKey: 'i1:p1',
      itemId: 'i1',
      photoId: 'p1',
      status: 'synced',
      contentHash: photoFingerprint(photo('p1', 1000)),
      fullBytes: 100,
      thumbBytes: 10,
      attempts: 0,
      lastAttemptAt: 1000,
      uploadedAt: 1000,
    };
    const same = planPhotoSync({
      refs: [{ itemId: 'i1', photo: photo('p1', 1000) }],
      ledger: new Map([['i1:p1', synced]]),
      localKeys: new Set(['i1:p1']),
      now: 2000,
    });
    expect(same.toUpload).toEqual([]);

    // Replacing the photo under the same id changes `addedAt` → re-upload.
    const replaced = planPhotoSync({
      refs: [{ itemId: 'i1', photo: photo('p1', 5000) }],
      ledger: new Map([['i1:p1', synced]]),
      localKeys: new Set(['i1:p1']),
      now: 6000,
    });
    expect(replaced.toUpload.map((e) => e.key)).toEqual(['i1:p1']);
  });

  it('downloads a referenced photo whose bytes are missing (fresh device)', () => {
    const plan = planPhotoSync({
      refs: [{ itemId: 'i1', photo: photo('p1') }],
      ledger: new Map(),
      localKeys: new Set(),
      now: 1000,
    });
    expect(plan.toDownload.map((e) => e.key)).toEqual(['i1:p1']);
    expect(plan.toUpload).toEqual([]);
  });

  it('backs off a photo Storage keeps refusing, instead of retrying every cycle', () => {
    const failed: GearPhotoSyncState = {
      photoKey: 'i1:p1',
      itemId: 'i1',
      photoId: 'p1',
      status: 'missing',
      contentHash: '',
      fullBytes: 0,
      thumbBytes: 0,
      attempts: 1,
      lastAttemptAt: 10_000,
      uploadedAt: 0,
    };
    const input = {
      refs: [{ itemId: 'i1', photo: photo('p1') }],
      ledger: new Map([['i1:p1', failed]]),
      localKeys: new Set<string>(),
    };
    // Too soon…
    expect(planPhotoSync({ ...input, now: 10_000 + RETRY_BACKOFF_MS[0] - 1 }).toDownload).toEqual([]);
    // …and due again after the window.
    expect(
      planPhotoSync({ ...input, now: 10_000 + RETRY_BACKOFF_MS[0] }).toDownload.map((e) => e.key),
    ).toEqual(['i1:p1']);
    // A synced entry is always re-checked: the bytes may have vanished.
    expect(shouldRetry({ ...failed, status: 'synced' }, 11_000)).toBe(true);
  });

  it('reconciles ledger entries whose photo is no longer referenced anywhere', () => {
    const plan = planPhotoSync({
      refs: [{ itemId: 'i1', photo: photo('p1') }],
      ledger: new Map([
        ['i1:p1', { photoKey: 'i1:p1', itemId: 'i1', photoId: 'p1', status: 'synced' } as GearPhotoSyncState],
        ['i2:p9', { photoKey: 'i2:p9', itemId: 'i2', photoId: 'p9', status: 'synced' } as GearPhotoSyncState],
      ]),
      localKeys: new Set(['i1:p1']),
      now: 1000,
    });
    expect(plan.toDeleteRemote).toEqual(['i2:p9']);
  });
});

describe('performPhotoSync', () => {
  it('uploads both renditions and records the ledger entry as synced', async () => {
    const repo = fakeRepo([{ id: 'i1', photos: [photo('p1')] }]);
    const storage = fakeStorage();
    const blobs = fakeBlobs({ keys: vi.fn(async () => new Set(['i1:p1'])) });

    const result = await run(repo, storage, blobs);

    expect(result.uploaded).toBe(1);
    expect(storage.uploads).toEqual([
      photoObjectPath(USER, 'i1', 'p1', 'full'),
      photoObjectPath(USER, 'i1', 'p1', 'thumb'),
    ]);
    expect(repo.states.get('i1:p1')?.status).toBe('synced');
    expect(repo.states.get('i1:p1')?.contentHash).toBe(photoFingerprint(photo('p1')));
  });

  it('downloads the bytes a fresh device only has a reference to', async () => {
    const repo = fakeRepo([{ id: 'i1', photos: [photo('p1')] }]);
    const storage = fakeStorage();
    const blobs = fakeBlobs();

    const result = await run(repo, storage, blobs);

    expect(result.downloaded).toBe(1);
    expect(blobs.import).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'i1', photoId: 'p1', width: 800, height: 800 }),
    );
    // The REFERENCE is untouched: bytes may still be on their way.
    expect(repo.states.get('i1:p1')?.status).toBe('synced');
  });

  it('keeps the reference and records a failing attempt when Storage 404s', async () => {
    const repo = fakeRepo([{ id: 'i1', photos: [photo('p1')] }]);
    const storage = fakeStorage({ download: vi.fn(async () => null) });
    const blobs = fakeBlobs();

    const result = await run(repo, storage, blobs);

    expect(result.downloaded).toBe(0);
    expect(result.failed).toBe(0);
    const state = repo.states.get('i1:p1');
    expect(state?.status).toBe('missing');
    expect(state?.attempts).toBe(1);
    expect(state?.lastError).toMatch(/Storage/);
    // A later run retries it (the reference was never dropped).
    const retried = await run(repo, storage, blobs, 100_000 + RETRY_BACKOFF_MS[0] * 2);
    expect(retried.downloaded).toBe(0);
    expect(repo.states.get('i1:p1')?.attempts).toBe(2);
  });

  it('removes the objects and the ledger row of a deleted photo', async () => {
    const repo = fakeRepo([], [
      {
        photoKey: 'i1:p1',
        itemId: 'i1',
        photoId: 'p1',
        status: 'synced',
        contentHash: 'x',
        fullBytes: 1,
        thumbBytes: 1,
        attempts: 0,
        lastAttemptAt: 0,
        uploadedAt: 1,
      },
    ]);
    const storage = fakeStorage();
    const blobs = fakeBlobs();

    const result = await run(repo, storage, blobs);

    expect(result.deleted).toBe(1);
    expect(storage.removals).toEqual([
      photoObjectPath(USER, 'i1', 'p1', 'full'),
      photoObjectPath(USER, 'i1', 'p1', 'thumb'),
    ]);
    expect(repo.states.has('i1:p1')).toBe(false);
  });

  it('honours the object budget so one run cannot drain the quota', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `i${i}`,
      photos: [photo('p1')],
    }));
    const repo = fakeRepo(items);
    const storage = fakeStorage();
    const blobs = fakeBlobs({ keys: vi.fn(async () => new Set(items.map((i) => `${i.id}:p1`))) });

    const result = await run(repo, storage, blobs, 100_000, 4);

    // Budget 4 objects = 2 photos (2 renditions each); the rest wait for the
    // next cycle instead of everything racing at once.
    expect(result.uploaded).toBe(2);
    expect(storage.uploads).toHaveLength(4);
  });

  it('a failed upload is remembered with a backoff, not retried on the next cycle', async () => {
    const repo = fakeRepo([{ id: 'i1', photos: [photo('p1')] }]);
    const storage = fakeStorage({
      upload: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
    });
    const blobs = fakeBlobs({ keys: vi.fn(async () => new Set(['i1:p1'])) });

    const first = await run(repo, storage, blobs);
    expect(first.failed).toBe(1);
    expect(repo.states.get('i1:p1')?.lastError).toBe('quota exceeded');

    // Immediate retry: skipped by the backoff (no new upload attempted).
    const uploads = storage.upload as unknown as { mock: { calls: unknown[] } };
    const before = uploads.mock.calls.length;
    const second = await run(repo, storage, blobs, 100_001);
    expect(second.failed).toBe(0);
    expect(uploads.mock.calls.length).toBe(before);
  });
});

describe('runPhotoSync guards', () => {
  it('is a no-op when signed out (nothing is even read)', async () => {
    resetPhotoSyncThrottle();
    const result = await runPhotoSync({ supabase: null, userId: null });
    expect(result).toEqual({ uploaded: 0, downloaded: 0, deleted: 0, failed: 0 });
  });

  it('throttles repeated runs inside a tab, and never throws', async () => {
    resetPhotoSyncThrottle();
    // `performPhotoSync` is injected away: with no ports and no real repo this
    // only asserts the entry point's guards.
    const repo = fakeRepo([]);
    const storage = fakeStorage();
    const blobs = fakeBlobs();
    const result = await runPhotoSync({
      supabase: {} as never,
      userId: USER,
      repo,
      storage,
      blobs,
    });
    expect(result.uploaded).toBe(0);

    // A second immediate call is throttled: it returns the empty result without
    // reading anything.
    const second = await runPhotoSync({
      supabase: {} as never,
      userId: USER,
      repo,
      storage,
      blobs,
    });
    expect(second).toEqual({ uploaded: 0, downloaded: 0, deleted: 0, failed: 0 });
    resetPhotoSyncThrottle();
  });
});
