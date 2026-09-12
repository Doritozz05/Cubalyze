import { describe, expect, it } from "vitest";
import {
  SEED_CATEGORY_IDS,
  seedCollectionState,
  type CollectionState,
  type GlobalCategoryOption,
} from "../collectionModel";
import { upsertItem } from "../collectionModel";
import {
  NO_CUBE,
  cubeAttribution,
  cubeShortLabel,
  cubesForEvent,
  latestCubeIdForEvent,
  resolveActiveCube,
} from "../activeCube";

const OPTIONS: GlobalCategoryOption[] = [
  { category: "2x2", name: "2×2", playable: true, planned: false },
  { category: "3x3", name: "3×3", playable: true, planned: false },
  { category: "3x3 OH", name: "3×3 OH", playable: true, planned: false },
  { category: "Pyraminx", name: "Pyraminx", playable: true, planned: false },
];

function seeded(): CollectionState {
  // Keep OH so the exclusion rule can be tested explicitly where it matters.
  return seedCollectionState(OPTIONS, []);
}

function typeIdFor(state: CollectionState, category: GlobalCategoryOption["category"]): string {
  const type = state.types.find((t) => t.puzzleCategory === category);
  if (!type) throw new Error(`no seeded type for ${category}`);
  return type.id;
}

/** Add a cube to the seeded collection (under the type of its event). */
function addCube(
  state: CollectionState,
  event: GlobalCategoryOption["category"],
  name: string,
  extra: { primary?: boolean; status?: "owned" | "sold" | "lent" | "wishlist"; brand?: string } = {},
): CollectionState {
  return upsertItem(state, {
    categoryId: SEED_CATEGORY_IDS.cubes,
    typeId: typeIdFor(state, event),
    name,
    brand: extra.brand,
    status: extra.status,
    primary: extra.primary,
  });
}

describe("cubesForEvent", () => {
  it("returns only owned cubes of that event", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12", { primary: true });
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "Sold 3x3", { status: "sold" });

    const threeByThree = cubesForEvent(state, "333");
    expect(threeByThree.map((item) => item.name)).toEqual(["GAN 12"]);

    const twoByTwo = cubesForEvent(state, "222");
    expect(twoByTwo.map((item) => item.name)).toEqual(["Valk 2"]);
  });

  it("keeps OH as its own event — never mixed with 333", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12");
    state = addCube(state, "3x3 OH", "HuanLong");

    expect(cubesForEvent(state, "333").map((i) => i.name)).toEqual(["GAN 12"]);
    expect(cubesForEvent(state, "333oh").map((i) => i.name)).toEqual(["HuanLong"]);
  });

  it("is empty for an event with no registered cubes", () => {
    const state = addCube(seeded(), "3x3", "GAN 12");
    expect(cubesForEvent(state, "pyram")).toEqual([]);
  });

  it("ignores a cube filed directly under the category (no type ⇒ no event)", () => {
    const state = upsertItem(seeded(), {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: null,
      name: "Mystery cube",
    });
    expect(cubesForEvent(state, "333")).toEqual([]);
  });

  it("ignores cubes in a non-cube category", () => {
    let state = seeded();
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.lubes,
      name: "Weight 5",
      // Even if a lubes item somehow carried a 3x3 type, the category kind wins.
      typeId: typeIdFor(state, "3x3"),
    });
    expect(cubesForEvent(state, "333")).toEqual([]);
  });

  it("ignores a user-created type with no puzzle category", () => {
    let state = seeded();
    state = {
      ...state,
      types: [
        ...state.types,
        {
          id: "type_custom",
          categoryId: SEED_CATEGORY_IDS.cubes,
          name: "My weird cube",
          puzzleCategory: null,
          createdAt: 0,
        },
      ],
    };
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: "type_custom",
      name: "Homebrew",
    });
    expect(cubesForEvent(state, "333")).toEqual([]);
  });
});

describe("resolveActiveCube", () => {
  it("prefers the explicitly chosen cube", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12", { primary: true });
    state = addCube(state, "3x3", "Valk 3");
    const valk = state.items.find((item) => item.name === "Valk 3")!;

    expect(resolveActiveCube(state, "333", valk.id)?.name).toBe("Valk 3");
  });

  it("falls back to a Main cube when nothing is chosen", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12", { primary: true });
    state = addCube(state, "3x3", "Valk 3");

    expect(resolveActiveCube(state, "333")?.name).toBe("GAN 12");
  });

  it("falls back to the most recent cube after the Main", () => {
    let state = seeded();
    state = addCube(state, "3x3", "Valk 3");
    const valk = state.items[0];

    expect(resolveActiveCube(state, "333", null, valk.id)?.name).toBe("Valk 3");
  });

  it("returns null for an explicit \"no cube\"", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12", { primary: true });
    expect(resolveActiveCube(state, "333", NO_CUBE)).toBeNull();
  });

  it("ignores a chosen cube that is no longer a candidate (sold)", () => {
    let state = seeded();
    state = addCube(state, "3x3", "Sold", { status: "sold", primary: true });
    const sold = state.items[0];

    // Falls through to Main… which is the sold one, so nothing is resolvable.
    expect(resolveActiveCube(state, "333", sold.id)).toBeNull();
  });

  it("ignores a chosen cube from another event and uses the Main of this one", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "GAN 12", { primary: true });
    const valk2 = state.items.find((item) => item.name === "Valk 2")!;

    expect(resolveActiveCube(state, "333", valk2.id)?.name).toBe("GAN 12");
  });
});

describe("latestCubeIdForEvent", () => {
  const solves = [
    { cubeId: "a", puzzleType: "333" },
    { cubeId: undefined, puzzleType: "333" },
    { cubeId: "b", puzzleType: "222" },
  ];

  it("returns the cube of the most recent solve of that event", () => {
    expect(latestCubeIdForEvent(solves, "333")).toBe("a");
    expect(latestCubeIdForEvent(solves, "222")).toBe("b");
  });

  it("returns null when no solve of the event carries a cube", () => {
    expect(latestCubeIdForEvent([{ cubeId: undefined, puzzleType: "333" }], "333")).toBeNull();
    expect(latestCubeIdForEvent([], "333")).toBeNull();
  });
});

describe("labels and attribution", () => {
  it("labels a cube by name, falling back to brand, then a generic word", () => {
    const base = {
      id: "x",
      categoryId: "c",
      typeId: null,
      palette: [] as readonly string[],
      links: [],
      photos: [],
      tags: [],
      status: "owned" as const,
      primary: false,
      favorite: false,
      quantity: 1,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(cubeShortLabel({ ...base, name: "GAN 12" })).toBe("GAN 12");
    expect(cubeShortLabel({ ...base, name: "  " })).toBe("Cube");
    expect(cubeShortLabel({ ...base, name: "", brand: "MoYu" })).toBe("MoYu");
  });

  it("omits the attribution entirely when there is no cube", () => {
    expect(cubeAttribution(null)).toEqual({});
  });

  it("attributes both the id and the frozen label", () => {
    const cube = {
      id: "item_1",
      categoryId: "c",
      typeId: null,
      name: "GAN 12",
      palette: [] as readonly string[],
      links: [],
      photos: [],
      tags: [],
      status: "owned" as const,
      primary: false,
      favorite: false,
      quantity: 1,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(cubeAttribution(cube)).toEqual({ cubeId: "item_1", cubeLabel: "GAN 12" });
  });
});
