import { describe, expect, it } from "vitest";
import {
  KIND_I18N_KEY,
  SAMPLE_GEAR,
  countByKind,
  formatAcquired,
  formatPrice,
  hashString,
  kindRank,
  loadCollection,
  mulberry32,
  primaryItem,
  sortGear,
  stickerStateFor,
  type GearItem,
  type GearKind,
} from "../collectionModel";

/** A minimal cube item; overrides let each test state only what it cares about. */
function cube(id: string, overrides: Partial<GearItem> = {}): GearItem {
  return {
    id,
    kind: "cube",
    name: id,
    palette: ["#FFFFFF", "#FFD500", "#00A651", "#0051BA", "#C41E3A", "#FF5800"],
    ...overrides,
  };
}

describe("collection model — ordering", () => {
  it("ranks cubes ahead of every other kind of gear", () => {
    expect(kindRank("cube")).toBeLessThan(kindRank("timer"));
    expect(kindRank("timer")).toBeLessThan(kindRank("other"));
    expect(kindRank("other")).toBeLessThan(kindRank("unknown" as unknown as GearKind));
  });

  it("sorts cubes first, then the main cube, then by name", () => {
    const items: GearItem[] = [
      { ...cube("zeta"), kind: "mat", name: "Zeta mat" },
      cube("beta"),
      cube("alpha", { primary: true }),
      { ...cube("lube"), kind: "lube", name: "A lube" },
    ];

    expect(sortGear(items).map((i) => i.id)).toEqual(["alpha", "beta", "zeta", "lube"]);
  });

  it("never mutates the array it was given", () => {
    const items = [cube("b"), cube("a")];
    const snapshot = items.map((i) => i.id);
    sortGear(items);
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it("finds the primary item and counts per kind", () => {
    const items: GearItem[] = [cube("a"), cube("b", { primary: true }), { ...cube("c"), kind: "timer" }];
    expect(primaryItem(items)?.id).toBe("b");
    expect(countByKind(items)).toEqual({ cube: 2, timer: 1, mat: 0, lube: 0, other: 0 });
  });
});

describe("collection model — deterministic cube pattern", () => {
  it("renders the same pattern for the same id, every time", () => {
    const item = cube("stable-id");
    expect(stickerStateFor(item)).toEqual(stickerStateFor(item));
  });

  it("gives different ids different patterns", () => {
    expect(stickerStateFor(cube("one"))).not.toEqual(stickerStateFor(cube("two")));
  });

  it("covers six faces of nine stickers and leaves every centre alone", () => {
    const state = stickerStateFor(cube("shape"), 6);
    expect(state).toHaveLength(6);
    for (const [faceIndex, face] of state.entries()) {
      expect(face).toHaveLength(9);
      // The centre defines the face colour, so it must never be swapped away.
      expect(face[4]).toBe(cube("shape").palette[faceIndex]);
    }
  });

  it("only paints faces with colours from the item's own palette", () => {
    const item = cube("palette", {
      palette: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
    });
    const allowed = new Set(item.palette);
    for (const face of stickerStateFor(item, 8)) {
      for (const sticker of face) expect(allowed.has(sticker)).toBe(true);
    }
  });

  it("is unaffected by how many swaps the guard loop lets through", () => {
    // Asking for more swaps than the guard allows must still terminate with a
    // legal-shaped state rather than hang.
    const state = stickerStateFor(cube("guard"), 500);
    expect(state).toHaveLength(6);
    for (const face of state) expect(face).toHaveLength(9);
  });
});

describe("collection model — primitives", () => {
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
});

describe("collection model — formatting", () => {
  it("formats dates in UTC so the timezone cannot shift the day", () => {
    expect(formatAcquired("2026-01-18", "en")).toContain("2026");
    expect(formatAcquired(undefined)).toBeNull();
    expect(formatAcquired("not-a-date")).toBeNull();
  });

  it("formats known currencies and falls back on unknown ones", () => {
    expect(formatPrice({ amount: 12.5, currency: "EUR" }, "en")).toContain("12.50");
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice({ amount: 5, currency: "NOPE" }, "en")).toBe("5 NOPE");
  });
});

describe("collection sample catalog", () => {
  it("has unique ids so React keys and the rail focus stay stable", () => {
    const ids = SAMPLE_GEAR.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every item a six-colour palette", () => {
    for (const item of SAMPLE_GEAR) expect(item.palette).toHaveLength(6);
  });

  it("has a translation key for every kind in the catalog", () => {
    for (const item of SAMPLE_GEAR) expect(KIND_I18N_KEY[item.kind]).toBeTruthy();
  });

  it("loads through the source seam", async () => {
    await expect(loadCollection()).resolves.toHaveLength(SAMPLE_GEAR.length);
  });
});
