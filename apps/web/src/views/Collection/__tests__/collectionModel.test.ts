import { describe, expect, it } from "vitest";
import {
  COLLECTION_VERSION,
  DEFAULT_PALETTE,
  SEED_CATEGORY_IDS,
  buildCategoryTree,
  clampRating,
  countByStatus,
  countItemsInCategory,
  countItemsInType,
  formatAcquired,
  formatPrice,
  hashString,
  isCubeCategory,
  mulberry32,
  normalizeState,
  normalizeTags,
  queryItems,
  removeCategory,
  removeType,
  seedCollectionState,
  setExcludedCategories,
  sortItems,
  stickerStateFor,
  syncCubeCategory,
  tagFacets,
  toggleFavorite,
  togglePrimary,
  typeOf,
  upsertCategory,
  upsertItem,
  upsertType,
  type CollectionState,
  type GearItem,
  type GlobalCategoryOption,
} from "../collectionModel";

/** The app's puzzle selector, narrowed to the shape the seed consumes. */
const OPTIONS: GlobalCategoryOption[] = [
  { category: "2x2", name: "2×2", playable: true, planned: false },
  { category: "3x3", name: "3×3", playable: true, planned: false },
  { category: "3x3 OH", name: "3×3 OH", playable: true, planned: false },
  { category: "Pyraminx", name: "Pyraminx", playable: true, planned: false },
  { category: "FTO", name: "FTO", playable: false, planned: true },
];

/** A seeded collection with the default OH exclusion. */
function seeded(): CollectionState {
  return seedCollectionState(OPTIONS);
}

function firstType(state: CollectionState, name: string) {
  const type = state.types.find((t) => t.name === name);
  if (!type) throw new Error(`missing type ${name}`);
  return type;
}

function addCube(state: CollectionState, name: string, overrides: Partial<GearItem> = {}) {
  const next = upsertItem(state, {
    categoryId: SEED_CATEGORY_IDS.cubes,
    typeId: firstType(state, "3×3").id,
    name,
    ...overrides,
  });
  return next;
}

describe("collection — taxonomy", () => {
  it("takes cube types from the global categories minus the exclusions", () => {
    const state = seeded();
    const cubeTypes = state.types
      .filter((t) => t.categoryId === SEED_CATEGORY_IDS.cubes)
      .map((t) => t.name)
      .sort();
    // OH is excluded by default; FTO is not playable yet.
    expect(cubeTypes).toEqual(["2×2", "3×3", "Pyraminx"]);
  });

  it("creates the three built-in categories and starts with no items", () => {
    const state = seeded();
    expect(state.categories.map((c) => c.name)).toEqual(["Cubos", "Lubes", "Gear"]);
    expect(state.items).toHaveLength(0);
    expect(state.version).toBe(COLLECTION_VERSION);
  });

  it("keeps non-cube categories free of default types", () => {
    const state = seeded();
    expect(state.types.some((t) => t.categoryId === SEED_CATEGORY_IDS.lubes)).toBe(false);
    expect(state.types.some((t) => t.categoryId === SEED_CATEGORY_IDS.gear)).toBe(false);
  });

  it("creates and edits categories without touching the previous state", () => {
    const before = seeded();
    const after = upsertCategory(before, { name: "  Smart cubes ", kind: "cube", icon: "Zap" });
    expect(after.categories).toHaveLength(before.categories.length + 1);
    const created = after.categories.at(-1)!;
    expect(created.name).toBe("Smart cubes");
    expect(created.kind).toBe("cube");

    const renamed = upsertCategory(after, { id: created.id, name: "Smart", kind: "gear", icon: "Box" });
    expect(renamed.categories.at(-1)).toMatchObject({ name: "Smart", kind: "gear", icon: "Box" });
    expect(renamed.categories).toHaveLength(after.categories.length);
    // The original array was never mutated.
    expect(before.categories).toHaveLength(3);
  });

  it("ignores blank category/type names", () => {
    const state = seeded();
    expect(upsertCategory(state, { name: "   ", kind: "gear", icon: "Box" })).toBe(state);
    expect(upsertType(state, { categoryId: SEED_CATEGORY_IDS.lubes, name: "" })).toBe(state);
  });

  it("deleting a category cascades to its types and items", () => {
    const withItem = addCube(seeded(), "GAN 12");
    const after = removeCategory(withItem, SEED_CATEGORY_IDS.cubes);
    expect(after.categories.some((c) => c.id === SEED_CATEGORY_IDS.cubes)).toBe(false);
    expect(after.types.some((t) => t.categoryId === SEED_CATEGORY_IDS.cubes)).toBe(false);
    expect(after.items).toHaveLength(0);
  });

  it("deleting a type keeps its items and lifts them to the category", () => {
    const withItem = addCube(seeded(), "GAN 12");
    const type = firstType(withItem, "3×3");
    const after = removeType(withItem, type.id);
    expect(after.types.some((t) => t.id === type.id)).toBe(false);
    expect(after.items).toHaveLength(1);
    expect(after.items[0].typeId).toBeNull();
    expect(after.items[0].categoryId).toBe(SEED_CATEGORY_IDS.cubes);
  });

  it("mirrors app categories into a cube category and drops excluded empty types", () => {
    const state = seeded();
    const synced = syncCubeCategory(state, SEED_CATEGORY_IDS.cubes, OPTIONS, ["3x3 OH", "Pyraminx"]);
    const names = synced.types.filter((t) => t.categoryId === SEED_CATEGORY_IDS.cubes).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["2×2", "3×3"]));
    // Pyraminx was excluded and was empty → removed.
    expect(names).not.toContain("Pyraminx");
  });

  it("never deletes an excluded type that still holds items", () => {
    const base = seeded();
    const pyraminx = firstType(base, "Pyraminx");
    const withItem = upsertItem(base, {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: pyraminx.id,
      name: "QiYi Pyraminx",
    });
    const synced = syncCubeCategory(withItem, SEED_CATEGORY_IDS.cubes, OPTIONS, [
      "3x3 OH",
      "Pyraminx",
    ]);
    expect(synced.types.some((t) => t.id === pyraminx.id)).toBe(true);
    expect(synced.items).toHaveLength(1);
  });

  it("deduplicates the exclusion list", () => {
    const state = setExcludedCategories(seeded(), ["3x3 OH", "3x3 OH", "Pyraminx"]);
    expect(state.excludedCategories).toEqual(["3x3 OH", "Pyraminx"]);
  });

  it("knows which categories are cubes", () => {
    const state = seeded();
    expect(isCubeCategory(state, SEED_CATEGORY_IDS.cubes)).toBe(true);
    expect(isCubeCategory(state, SEED_CATEGORY_IDS.lubes)).toBe(false);
    expect(isCubeCategory(state, "missing")).toBe(false);
  });
});

describe("collection — items", () => {
  it("creates an item with sane defaults", () => {
    const state = addCube(seeded(), "GAN 12");
    const item = state.items[0];
    expect(item.name).toBe("GAN 12");
    expect(item.status).toBe("owned");
    expect(item.palette).toEqual(DEFAULT_PALETTE);
    expect(item.quantity).toBe(1);
    expect(item.links).toEqual([]);
    expect(item.photos).toEqual([]);
    expect(item.primary).toBe(false);
  });

  it("trims text fields and normalises tags on create and update", () => {
    const created = upsertItem(seeded(), {
      categoryId: SEED_CATEGORY_IDS.gear,
      name: "  Weight 5  ",
      brand: "  Lubicle ",
      tags: ["ballcore", "Ballcore ", " setup"],
    });
    const item = created.items[0];
    expect(item.name).toBe("Weight 5");
    expect(item.brand).toBe("Lubicle");
    expect(item.tags).toEqual(["ballcore", "setup"]);

    const updated = upsertItem(created, {
      id: item.id,
      categoryId: SEED_CATEGORY_IDS.gear,
      name: "Weight 5",
      tags: ["daily"],
    });
    expect(updated.items[0].tags).toEqual(["daily"]);
  });

  it("rounds and clamps ratings to 0–5", () => {
    expect(clampRating(3.6)).toBe(4);
    expect(clampRating(-2)).toBe(0);
    expect(clampRating(9)).toBe(5);
    expect(clampRating(undefined)).toBeUndefined();
    expect(clampRating(Number.NaN)).toBeUndefined();
  });

  it("normalises tag casing without losing the first spelling", () => {
    expect(normalizeTags([" Ballcore ", "BALLCORE", "", "setup"])).toEqual(["Ballcore", "setup"]);
  });

  it("counts items per type and per category", () => {
    let state = seeded();
    const type = firstType(state, "3×3");
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.cubes, typeId: type.id, name: "A" });
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.cubes, typeId: type.id, name: "B" });
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.gear, name: "Timer" });
    expect(countItemsInType(state, type.id)).toBe(2);
    expect(countItemsInCategory(state, SEED_CATEGORY_IDS.cubes)).toBe(2);
    expect(countItemsInCategory(state, SEED_CATEGORY_IDS.gear)).toBe(1);
  });

  it("toggles favourite off a torn copy", () => {
    const state = addCube(seeded(), "GAN 12");
    const id = state.items[0].id;
    expect(toggleFavorite(state, id).items[0].favorite).toBe(true);
    expect(state.items[0].favorite).toBe(false);
  });

  it("counts items by status", () => {
    let state = seeded();
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.gear, name: "Owner" });
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.gear, name: "Wish", status: "wishlist" });
    expect(countByStatus(state)).toMatchObject({ owned: 1, wishlist: 1, sold: 0, lent: 0 });
  });
});

describe("collection — main selection", () => {
  it("only lets cube categories carry a main item", () => {
    const state = upsertItem(seeded(), { categoryId: SEED_CATEGORY_IDS.gear, name: "Timer" });
    const toggled = togglePrimary(state, state.items[0].id);
    expect(toggled.items[0].primary).toBe(false);
  });

  it("keeps exactly one main per cube category", () => {
    let state = seeded();
    const type = firstType(state, "3×3");
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.cubes, typeId: type.id, name: "A" });
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.cubes, typeId: type.id, name: "B" });

    state = togglePrimary(state, state.items[0].id);
    expect(state.items[0].primary).toBe(true);
    expect(state.items[1].primary).toBe(false);

    state = togglePrimary(state, state.items[1].id);
    expect(state.items[0].primary).toBe(false);
    expect(state.items[1].primary).toBe(true);
  });
});

describe("collection — queries", () => {
  function populated(): CollectionState {
    let state = seeded();
    const three = firstType(state, "3×3");
    const two = firstType(state, "2×2");
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: three.id,
      name: "GAN 12",
      brand: "GAN",
      tags: ["ballcore", "flagship"],
    });
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: two.id,
      name: "Valk 2",
      brand: "QiYi",
      tags: ["ballcore"],
    });
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.gear,
      name: "Smart Timer",
      status: "wishlist",
    });
    return state;
  }

  it("filters by category, type, status, tag, favourites and free text", () => {
    const state = populated();
    const three = firstType(state, "3×3");

    expect(queryItems(state, { categoryId: SEED_CATEGORY_IDS.gear })).toHaveLength(1);
    expect(queryItems(state, { typeId: three.id })[0].name).toBe("GAN 12");
    expect(queryItems(state, { status: "wishlist" })[0].name).toBe("Smart Timer");
    expect(queryItems(state, { tags: ["ballcore"] })).toHaveLength(2);
    expect(queryItems(state, { query: "gan 12" })).toHaveLength(1);
    expect(queryItems(state, { query: "qiyi" })[0].name).toBe("Valk 2");
    expect(queryItems(state, { query: "nothing" })).toHaveLength(0);
  });

  it("sinks wishlist items below owned gear", () => {
    const state = populated();
    const sorted = sortItems(queryItems(state, {}));
    expect(sorted.at(-1)?.name).toBe("Smart Timer");
  });

  it("sorts by name, price, rating and recency", () => {
    let state = seeded();
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.gear, name: "Beta", price: { amount: 30, currency: "EUR" }, now: 1 });
    state = upsertItem(state, { categoryId: SEED_CATEGORY_IDS.gear, name: "Alpha", price: { amount: 10, currency: "EUR" }, now: 2 });

    expect(sortItems(state.items, "name").map((i) => i.name)).toEqual(["Alpha", "Beta"]);
    expect(sortItems(state.items, "price").map((i) => i.name)).toEqual(["Beta", "Alpha"]);
    expect(sortItems(state.items, "recent").map((i) => i.name)).toEqual(["Alpha", "Beta"]);
  });

  it("builds tag facets with counts, most used first", () => {
    const facets = tagFacets(populated());
    expect(facets[0]).toEqual({ tag: "ballcore", count: 2 });
  });

  it("builds the category tree with types and counts", () => {
    const tree = buildCategoryTree(populated());
    const cubes = tree.find((node) => node.category.id === SEED_CATEGORY_IDS.cubes)!;
    expect(cubes.count).toBe(2);
    expect(cubes.types.map((t) => t.name).sort()).toEqual(["2×2", "3×3", "Pyraminx"]);
  });
});

describe("collection — primitives", () => {
  it("hashes stably and spreads different inputs", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("mulberry32 is reproducible and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("renders a stable, palette-only sticker state that leaves centres alone", () => {
    const item = upsertItem(seeded(), { categoryId: SEED_CATEGORY_IDS.gear, name: "x" }).items[0];
    expect(stickerStateFor(item)).toEqual(stickerStateFor(item));
    const faces = stickerStateFor(item, 6);
    expect(faces).toHaveLength(6);
    for (const [faceIndex, face] of faces.entries()) {
      expect(face).toHaveLength(9);
      expect(face[4]).toBe(item.palette[faceIndex]);
    }
  });

  it("formats dates in UTC and prices with fallbacks", () => {
    expect(formatAcquired("2026-01-18", "en")).toContain("2026");
    expect(formatAcquired(undefined)).toBeNull();
    expect(formatAcquired("not-a-date")).toBeNull();
    expect(formatPrice({ amount: 12.5, currency: "EUR" }, "en")).toContain("12.50");
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice({ amount: 5, currency: "NOPE" }, "en")).toBe("5 NOPE");
  });

  it("resolves a type by id", () => {
    const state = seeded();
    const type = firstType(state, "3×3");
    expect(typeOf(state, type.id)?.name).toBe("3×3");
    expect(typeOf(state, null)).toBeUndefined();
  });
});

describe("collection — persistence hygiene", () => {
  it("rejects blobs that are not a collection", () => {
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState({ nope: true })).toBeNull();
    expect(normalizeState({ data: { categories: [], types: [], items: [] } })).not.toBeNull();
  });

  it("fills missing item arrays and flags on restore", () => {
    const restored = normalizeState({
      data: {
        categories: [{ id: "c1", name: "Cubos", kind: "cube", icon: "Box" }],
        types: [],
        items: [{ id: "i1", name: "Old cube", palette: "#fff" }],
      },
    })!;
    const item = restored.items[0];
    expect(item.links).toEqual([]);
    expect(item.photos).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.status).toBe("owned");
    expect(item.palette).toEqual(DEFAULT_PALETTE);
    expect(restored.version).toBe(COLLECTION_VERSION);
  });
});
