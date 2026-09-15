/**
 * collectionStore — the Locker's orchestration: hydrate, first-run seed, the
 * one-shot import of the pre-database blob, and the diff persistence.
 *
 * The store takes its connection as a parameter, so these tests drive it with an
 * in-memory repository that mimics the SQL semantics that matter (upsert by id,
 * cascade on category delete, re-home on type delete) and RECORDS every write.
 * That recording is the point: the guarantee under test is not "the data ends up
 * there" but "untouched rows are never rewritten" — a wholesale save would bump
 * every `updated_at` and, once the Locker syncs, push the whole collection on
 * every keystroke.
 *
 * Photos are real (fake IndexedDB): the store has to delete the blobs of the
 * items it drops, and that is invisible in the row data.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GearCategory,
  GearCollectionSnapshot,
  GearItem,
  GearType,
} from "@cubalyze/database";
import {
  COLLECTION_STORAGE_KEY,
  createCollectionStore,
  type LockerConnection,
  type LockerRepository,
} from "../collectionStore";
import { importPhotoRecord, readPhoto } from "../collectionPhotos";
import { blobToDataUrl } from "../imageUtils";
import { DEFAULT_PALETTE, type GearPhotoRef } from "../collectionModel";

vi.mock("@/services/sync", () => ({ requestSync: vi.fn(async () => undefined) }));

// ─── In-memory database stand-in ───────────────────────────────────────────

class MemoryRepo implements LockerRepository {
  categories: GearCategory[] = [];
  types: GearType[] = [];
  items: GearItem[] = [];
  /** Every id written, in order — the "was this row rewritten?" ledger. */
  written: string[] = [];
  replaced = 0;

  async loadAll(): Promise<GearCollectionSnapshot> {
    return {
      categories: this.categories.map((row) => ({ ...row })),
      types: this.types.map((row) => ({ ...row })),
      items: this.items.map((row) => ({ ...row })),
    };
  }

  async count() {
    return {
      categories: this.categories.length,
      types: this.types.length,
      items: this.items.length,
    };
  }

  async upsertCategory(category: GearCategory): Promise<void> {
    this.written.push(category.id);
    this.categories = [...this.categories.filter((row) => row.id !== category.id), { ...category }];
  }

  async upsertType(type: GearType): Promise<void> {
    this.written.push(type.id);
    this.types = [...this.types.filter((row) => row.id !== type.id), { ...type }];
  }

  async upsertItem(item: GearItem): Promise<void> {
    this.written.push(item.id);
    this.items = [...this.items.filter((row) => row.id !== item.id), { ...item }];
  }

  async deleteCategory(id: string): Promise<void> {
    const typeIds = this.types.filter((row) => row.categoryId === id).map((row) => row.id);
    this.types = this.types.filter((row) => row.categoryId !== id);
    this.items = this.items.filter((row) => row.categoryId !== id);
    this.categories = this.categories.filter((row) => row.id !== id);
    this.written.push(`del-cat:${id}`, ...typeIds.map((typeId) => `del-type:${typeId}`));
  }

  async deleteType(id: string): Promise<void> {
    this.types = this.types.filter((row) => row.id !== id);
    this.items = this.items.map((row) => (row.typeId === id ? { ...row, typeId: null } : row));
    this.written.push(`del-type:${id}`);
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((row) => row.id !== id);
    this.written.push(`del-item:${id}`);
  }

  async replaceAll(snapshot: GearCollectionSnapshot): Promise<void> {
    this.replaced += 1;
    this.categories = snapshot.categories.map((row) => ({ ...row }));
    this.types = snapshot.types.map((row) => ({ ...row }));
    this.items = snapshot.items.map((row) => ({ ...row }));
    this.written.push("replaceAll");
  }
}

/**
 * A repository whose next write throws once — the transient local-storage
 * failure (a locked pool) the store has to survive.
 */
class FlakyRepo extends MemoryRepo {
  failNext = false;
  attempts = 0;

  override async upsertCategory(category: GearCategory): Promise<void> {
    this.attempts += 1;
    if (this.failNext) {
      this.failNext = false;
      throw new Error("storage pool locked");
    }
    await super.upsertCategory(category);
  }
}

class MemoryMeta {
  values = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

let repo: MemoryRepo;
let meta: MemoryMeta;

function connector(): () => Promise<LockerConnection> {
  return async () => ({ repo, meta });
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

async function settle(): Promise<void> {
  // Writes are fire-and-forget by design (the model stays synchronous), and a
  // wholesale reset queues a lot of them, so drain real macrotasks rather than
  // counting microtask turns.
  for (let turn = 0; turn < 3; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  repo = new MemoryRepo();
  meta = new MemoryMeta();
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collection store", () => {
  it("seeds the taxonomy into the database on a cold start", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    const state = store.getState();
    expect(state.hydrated).toBe(true);
    expect(state.data.categories.map((category) => category.name)).toEqual([
      "Cubes",
      "Lubes",
      "Gear",
    ]);

    // Seeded means really written: the next device/refresh reads rows, not a
    // hardcoded default.
    expect(repo.categories).toHaveLength(3);
    expect(repo.types.length).toBeGreaterThan(0);
    expect(repo.replaced).toBe(1);
    expect(meta.values.get("locker_initialized")).toBe("1");
  });

  it("never re-seeds a locker the user emptied", async () => {
    meta.values.set("locker_initialized", "1");
    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    expect(store.getState().data.categories).toEqual([]);
    expect(repo.replaced).toBe(0);
  });

  it("imports the pre-database blob once, converting its photos", async () => {
    const dataUrl = await blobToDataUrl(new Blob(["LEGACY"], { type: "image/png" }));
    localStorage.setItem(
      COLLECTION_STORAGE_KEY,
      JSON.stringify({
        state: {
          data: {
            version: 1,
            categories: [{ id: "cat-legacy", name: "Cubes", kind: "cube", icon: "Box", createdAt: 1 }],
            types: [],
            excludedCategories: ["2x2"],
            items: [
              {
                id: "item-legacy",
                categoryId: "cat-legacy",
                typeId: null,
                name: "Valk 3",
                palette: [...DEFAULT_PALETTE],
                links: [],
                photos: [dataUrl],
                tags: [],
                status: "owned",
                primary: true,
                favorite: false,
                quantity: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        },
        version: 1,
      }),
    );

    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    const state = store.getState().data;
    expect(state.categories.map((category) => category.id)).toEqual(["cat-legacy"]);
    expect(state.excludedCategories).toEqual(["2x2"]);
    expect(state.items[0]!.name).toBe("Valk 3");
    expect(state.items[0]!.photos).toHaveLength(1);

    const ref = state.items[0]!.photos[0]!;
    const stored = await readPhoto("item-legacy", ref.id);
    expect(await stored?.full.text()).toBe("LEGACY");
  });

  it("leaves an existing database alone even if the blob is still there", async () => {
    repo.categories = [{ id: "cat-db", name: "Cubes", kind: "cube", icon: "Box", createdAt: 1 }];
    meta.values.set("locker_initialized", "1");
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({ data: { categories: [], types: [], items: [] } }));

    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    expect(store.getState().data.categories.map((category) => category.id)).toEqual(["cat-db"]);
    expect(repo.replaced).toBe(0);
  });

  it("writes only what changed", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();
    repo.written = [];

    const categoryId = store.getState().addCategory({ name: "Mats", kind: "gear", icon: "Layers" });
    await settle();
    expect(repo.written).toEqual([categoryId]);

    repo.written = [];
    const typeId = store.getState().addType({ categoryId, name: "Big mats", puzzleCategory: null });
    store.getState().addItem({ categoryId, typeId, name: "Rubik's mat" });
    await settle();
    expect(repo.written.filter((id) => id === categoryId)).toEqual([]);
    expect(repo.written).toContain(typeId);
  });

  it("deletes an item's row and its photos", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();
    const categoryId = store.getState().data.categories[0]!.id;
    const itemId = store.getState().addItem({ categoryId, name: "GAN 12" });
    await settle();

    const ref: GearPhotoRef = { id: "p1", width: 10, height: 10, addedAt: 1 };
    await importPhotoRecord({
      itemId,
      photoId: ref.id,
      full: new Blob(["BYTES"], { type: "image/jpeg" }),
      thumb: new Blob(["THUMB"], { type: "image/jpeg" }),
      width: 10,
      height: 10,
      addedAt: 1,
    });

    store.getState().removeItem(itemId);
    await settle();

    expect(repo.items.find((row) => row.id === itemId)).toBeUndefined();
    expect(await readPhoto(itemId, ref.id)).toBeNull();
  });

  it("persists the exclusion list in app_meta, not as rows", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    store.getState().setExcluded(["3x3 OH", "2x2"]);
    await settle();

    expect(JSON.parse(meta.values.get("locker_excluded_categories")!)).toEqual(["3x3 OH", "2x2"]);
    expect(repo.written).not.toContain("locker_excluded_categories");
  });

  it("ignores exclusions that are not app categories", async () => {
    meta.values.set("locker_excluded_categories", JSON.stringify(["3x3 OH", "not-a-puzzle"]));
    const store = createCollectionStore(connector());
    await store.getState().hydrate();

    expect(store.getState().data.excludedCategories).toEqual(["3x3 OH"]);
  });

  it("honours an id handed in by the editor", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();
    const categoryId = store.getState().data.categories[0]!.id;

    const returned = store.getState().addItem({ id: "item-from-editor", categoryId, name: "Weilong" });
    expect(returned).toBe("item-from-editor");
    await settle();
    expect(repo.items.map((row) => row.id)).toContain("item-from-editor");
  });

  it("stays usable (and silent) when the database cannot be reached", async () => {
    const failing = createCollectionStore(async () => {
      throw new Error("no OPFS here");
    });
    await failing.getState().hydrate();

    expect(failing.getState().hydrated).toBe(true);
    expect(failing.getState().data.categories.map((category) => category.name)).toEqual([
      "Cubes",
      "Lubes",
      "Gear",
    ]);
    // Nothing reached a row: the store never pretended it could save.
    expect(repo.written).toEqual([]);
  });

  it("retries a transient write failure instead of dropping the edit", async () => {
    const flaky = new FlakyRepo();
    const store = createCollectionStore(async () => ({ repo: flaky, meta }));
    await store.getState().hydrate();
    flaky.failNext = true;

    const categoryId = store.getState().addCategory({ name: "Mats", kind: "gear", icon: "Layers" });
    // The retry waits a quarter of a second before its second attempt.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();

    expect(flaky.attempts).toBe(2);
    expect(flaky.categories.some((row) => row.id === categoryId)).toBe(true);
  });

  it("loads twice without a second import or seed", async () => {
    const first = createCollectionStore(connector());
    await first.getState().hydrate();
    const replacedAfterFirst = repo.replaced;

    const second = createCollectionStore(connector());
    await second.getState().hydrate();

    expect(repo.replaced).toBe(replacedAfterFirst);
    expect(second.getState().data.categories).toHaveLength(3);
  });

  it("reset() rebuilds the seed and takes the old photos with it", async () => {
    const store = createCollectionStore(connector());
    await store.getState().hydrate();
    const categoryId = store.getState().data.categories[0]!.id;
    const itemId = store.getState().addItem({ categoryId, name: "GAN 12" });
    await settle();
    await importPhotoRecord({
      itemId,
      photoId: "p9",
      full: new Blob(["BYTES"], { type: "image/jpeg" }),
      thumb: new Blob(["THUMB"], { type: "image/jpeg" }),
      width: 1,
      height: 1,
      addedAt: 1,
    });

    store.getState().reset();
    await settle();

    expect(store.getState().data.items).toEqual([]);
    expect(repo.items).toEqual([]);
    expect(await readPhoto(itemId, "p9")).toBeNull();
  });
});
