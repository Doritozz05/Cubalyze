import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTION_STORAGE_KEY, type CollectionStore } from "../collectionStore";

/**
 * The store is a module singleton with a localStorage sink, and the node test
 * environment has no `localStorage`. We stub a tiny in-memory storage BEFORE the
 * dynamic import so `createJSONStorage` finds it, then reset the module between
 * tests to get a cold store each time.
 */

type StoreModule = typeof import("../collectionStore");

function memoryStorage(): { map: Map<string, string>; storage: Storage } {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
  return { map, storage };
}

let current: { map: Map<string, string>; storage: Storage };

function stubStorage(): void {
  current = memoryStorage();
  vi.stubGlobal("localStorage", current.storage);
}

async function loadStore(): Promise<StoreModule> {
  vi.resetModules();
  return import("../collectionStore");
}

/** Let the deferred hydration microtask (and persist writes) settle. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collection store", () => {
  it("seeds the locked taxonomy on a cold start and hydrates", async () => {
    const { useCollectionStore, GLOBAL_CATEGORY_OPTIONS } = await loadStore();
    await flush();

    const state = useCollectionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.data.categories.map((c) => c.name)).toEqual(["Cubos", "Lubes", "Gear"]);

    const cubeTypeNames = state.data.types.map((t) => t.name);
    const playable = GLOBAL_CATEGORY_OPTIONS.filter((o) => o.playable && o.category !== "3x3 OH").map(
      (o) => o.name,
    );
    expect(cubeTypeNames.sort()).toEqual([...playable].sort());
    expect(state.data.items).toEqual([]);
  });

  it("creates categories, types and items through the actions", async () => {
    const { useCollectionStore } = await loadStore();
    await flush();
    const store = (): CollectionStore => useCollectionStore.getState();

    const categoryId = store().addCategory({ name: "Smart cubes", kind: "cube", icon: "Zap" });
    expect(store().data.categories.some((c) => c.id === categoryId)).toBe(true);

    const typeId = store().addType({
      categoryId,
      name: "GAN",
      puzzleCategory: null,
    });
    expect(store().data.types.find((t) => t.id === typeId)?.name).toBe("GAN");

    const itemId = store().addItem({
      categoryId,
      typeId,
      name: "GAN 12",
      tags: ["ballcore"],
      status: "owned",
    });
    expect(store().data.items).toHaveLength(1);

    store().togglePrimary(itemId);
    expect(store().data.items[0].primary).toBe(true);
    store().toggleFavorite(itemId);
    expect(store().data.items[0].favorite).toBe(true);

    store().removeItem(itemId);
    expect(store().data.items).toHaveLength(0);
  });

  it("persists mutations and restores them in a fresh store", async () => {
    const first = await loadStore();
    await flush();
    first.useCollectionStore.getState().addCategory({ name: "Mats", kind: "gear", icon: "Layers" });

    const raw = current.map.get(COLLECTION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain("Mats");

    // Re-import the module against the SAME storage → the store restores.
    const second = await loadStore();
    await flush();
    expect(second.useCollectionStore.getState().data.categories.some((c) => c.name === "Mats")).toBe(
      true,
    );
  });

  it("reset() rebuilds the default collection", async () => {
    const { useCollectionStore } = await loadStore();
    await flush();
    const store = () => useCollectionStore.getState();
    store().addCategory({ name: "Temp", kind: "gear", icon: "Box" });
    store().reset();
    expect(store().data.categories.map((c) => c.name)).toEqual(["Cubos", "Lubes", "Gear"]);
  });
});
