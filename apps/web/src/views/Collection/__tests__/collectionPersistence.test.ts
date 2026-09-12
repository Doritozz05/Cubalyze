/**
 * collectionPersistence — the diff that decides what reaches SQLite.
 *
 * This is the part that, if it got it wrong, would silently rewrite the whole
 * collection on every keystroke (bumping every `updated_at`), or delete rows
 * nobody deleted. It is pure, so it is tested directly: identity is the row id,
 * "changed" is deep equality.
 */
import { describe, expect, it } from "vitest";
import { deletionPlan, diffCollection, isDiffEmpty, sameStringArray } from "../collectionPersistence";
import { seedCollectionState, upsertItem, type CollectionState, type GlobalCategoryOption } from "../collectionModel";

const OPTIONS: readonly GlobalCategoryOption[] = [
  { category: "3x3", name: "3×3", playable: true, planned: false },
  { category: "2x2", name: "2×2", playable: true, planned: false },
];

function seeded(): CollectionState {
  return seedCollectionState(OPTIONS, []);
}

function withItem(state: CollectionState, name = "GAN 12"): CollectionState {
  const categoryId = state.categories[0]!.id;
  return upsertItem(state, { categoryId, name, now: 1000 });
}

describe("collection diff", () => {
  it("reports nothing for an identical state", () => {
    const state = seeded();
    const diff = diffCollection(state, state);
    expect(isDiffEmpty(diff)).toBe(true);
    expect(deletionPlan(diff)).toEqual([]);
  });

  it("detects a new item without touching the rest", () => {
    const before = seeded();
    const after = withItem(before);
    const diff = diffCollection(before, after);

    expect(diff.items.upsert).toHaveLength(1);
    expect(diff.items.remove).toEqual([]);
    // The taxonomy was already there: nothing to rewrite.
    expect(diff.categories.upsert).toEqual([]);
    expect(diff.types.upsert).toEqual([]);
  });

  it("detects an edit through a changed field", () => {
    const before = withItem(seeded());
    const item = before.items[0]!;
    const after: CollectionState = {
      ...before,
      items: [{ ...item, name: "GAN 12 MagLev" }],
    };
    const diff = diffCollection(before, after);
    expect(diff.items.upsert).toHaveLength(1);
    expect(diff.items.upsert[0]!.name).toBe("GAN 12 MagLev");
  });

  it("treats a photo reference change as an edit", () => {
    const before = withItem(seeded());
    const item = before.items[0]!;
    const after: CollectionState = {
      ...before,
      items: [
        {
          ...item,
          photos: [{ id: "p1", width: 100, height: 80, addedAt: 5 }],
        },
      ],
    };
    expect(diffCollection(before, after).items.upsert).toHaveLength(1);
  });

  it("plans deletes children-first", () => {
    const before = withItem(seeded());
    const category = before.categories[0]!;
    const typeId = before.types[0]!.id;
    const after: CollectionState = {
      ...before,
      categories: before.categories.filter((entry) => entry.id !== category.id),
      types: [],
      items: [],
    };
    const diff = diffCollection(before, after);
    const plan = deletionPlan(diff);
    // Items first, then the category's types, and the category itself last —
    // the order the schema's foreign keys expect.
    expect(plan[0]!.table).toBe("items");
    expect(plan[plan.length - 1]).toEqual({ table: "categories", id: category.id });
    expect(plan.slice(1, -1).map((step) => step.table)).toEqual(["types", "types"]);
    expect(plan.slice(1, -1).map((step) => step.id)).toContain(typeId);
  });

  it("compares the exclusion list by value", () => {
    expect(sameStringArray(["3x3 OH"], ["3x3 OH"])).toBe(true);
    expect(sameStringArray(["3x3 OH"], ["Pyraminx"])).toBe(false);
    expect(sameStringArray([], [])).toBe(true);
  });
});
