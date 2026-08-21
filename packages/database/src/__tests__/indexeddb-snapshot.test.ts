import { describe, it, expect, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────
// Minimal in-memory IndexedDB fake.
//
// The real indexedDB is not available in Node's worker-less environment, so
// we install a tiny object-store shim that emulates the exact surface our
// helper uses (open → onupgradeneeded/onsuccess, transaction().objectStore(),
// store.get/put). This proves the byte round-trip without a browser.
// ─────────────────────────────────────────────────────────────────────────

type FakeStore = Map<string, Uint8Array>;
let storeData: FakeStore;

function installFakeIndexedDB() {
  storeData = new Map<string, Uint8Array>();

  const objectStore = {
    get(key: string) {
      const req = makeRequest(storeData.get(key));
      return req;
    },
    put(value: Uint8Array, key: string) {
      storeData.set(key, new Uint8Array(value));
      return makeRequest(key);
    },
    delete(key: string) {
      storeData.delete(key);
      return makeRequest(undefined);
    },
  };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    transaction(_name: string) {
      return { objectStore: (_store: string) => objectStore };
    },
    close() {},
  };
  const makeRequest = (result: unknown) => {
    const req = {
      result,
      error: null as DOMException | null,
      onupgradeneeded: null as ((ev: Event) => void) | null,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
    };
    queueMicrotask(() => {
      req.onsuccess?.({ target: req } as unknown as Event);
    });
    return req;
  };

  globalThis.indexedDB = {
    open(_name: string, _version?: number) {
      const req = makeRequest(fakeDb);
      req.onupgradeneeded = () => {
        // The Map-backed store needs no schema upgrade.
      };
      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return storeData;
}

afterEach(() => {
  // Remove the fake so other test files never see it.
  // @ts-expect-error deleting is intentional here
  delete globalThis.indexedDB;
});

describe('indexeddb-snapshot', () => {
  it('round-trips a full-database byte snapshot through a fake IndexedDB', async () => {
    const data = installFakeIndexedDB();
    const { loadSnapshot, saveSnapshot } = await import('../indexeddb-snapshot.js');

    // Nothing stored yet.
    expect(await loadSnapshot()).toBeNull();

    const bytes = new Uint8Array([1, 2, 3, 4, 5, 0, 255]);
    await saveSnapshot(bytes);
    expect(data.get('main')).toEqual(bytes);

    const restored = await loadSnapshot();
    expect(restored).not.toBeNull();
    expect(Array.from(restored!)).toEqual(Array.from(bytes));
    // Same object store instance keeps working after multiple opens.
    data.set('main', new Uint8Array([42]));
    expect(Array.from((await loadSnapshot())!)).toEqual([42]);
  });

  it('returns null (not throw) when IndexedDB is unavailable', async () => {
    const { loadSnapshot, saveSnapshot } = await import('../indexeddb-snapshot.js');
    expect(await loadSnapshot()).toBeNull();
    // saveSnapshot is best-effort and must not throw.
    await expect(saveSnapshot(new Uint8Array([9]))).resolves.toBeUndefined();
  });

  it('clearSnapshot removes the stored snapshot', async () => {
    const data = installFakeIndexedDB();
    const { saveSnapshot, loadSnapshot, clearSnapshot } = await import('../indexeddb-snapshot.js');
    await saveSnapshot(new Uint8Array([7, 7, 7]));
    expect(data.has('main')).toBe(true);
    await clearSnapshot();
    expect(data.has('main')).toBe(false);
    expect(await loadSnapshot()).toBeNull();
  });
});