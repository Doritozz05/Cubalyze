import { describe, expect, it } from "vitest";
import type { CubeIdentity } from "@cubeforge/hardware-hal";
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
  cubesForEventWithSmartFallback,
  eventForItem,
  latestCubeIdForEvent,
  resolveActiveCube,
  resolveHardwareLink,
  shouldIgnoreSmartCubeForSession,
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
  extra: {
    primary?: boolean;
    status?: "owned" | "sold" | "lent" | "wishlist";
    brand?: string;
    model?: string;
    smartId?: string;
  } = {},
): CollectionState {
  return upsertItem(state, {
    categoryId: SEED_CATEGORY_IDS.cubes,
    typeId: typeIdFor(state, event),
    name,
    brand: extra.brand,
    model: extra.model,
    smartId: extra.smartId,
    status: extra.status,
    primary: extra.primary,
  });
}

/** The canonical address used across the hardware-link tests. */
const GAN_MAC = "AABBCCDDEEFF";

/** Build a hardware identity, defaulting to a GAN 12 ui that answered fully. */
function identity(mac: string | null, model: string | null = "GAN12uiM"): CubeIdentity {
  return {
    vendor: "GAN",
    model,
    mac,
    hardwareVersion: "1.2",
    softwareVersion: "1.0",
    productDate: null,
    gyroSupported: true,
  };
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

describe("eventForItem", () => {
  it("maps a typed cube to its event, and refuses anything without one", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12");
    state = addCube(state, "3x3 OH", "HuanLong");
    state = upsertItem(state, {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: null,
      name: "No type",
    });

    const byName = (name: string) => state.items.find((item) => item.name === name)!;
    expect(eventForItem(state, byName("GAN 12"))).toBe("333");
    expect(eventForItem(state, byName("HuanLong"))).toBe("333oh");
    expect(eventForItem(state, byName("No type"))).toBeNull();
    expect(
      eventForItem(state, { ...byName("GAN 12"), categoryId: SEED_CATEGORY_IDS.lubes }),
    ).toBeNull();
  });
});

describe("resolveHardwareLink", () => {
  it("returns `disconnected` with no identity at all", () => {
    expect(resolveHardwareLink(seeded(), null)).toEqual({
      item: null,
      event: null,
      reason: "disconnected",
      matches: [],
    });
  });

  it("returns `no-identity` when there is no usable address", () => {
    // A cube that connected but whose address we could not read (no System ID,
    // and the user did not type it): without a key we must not guess.
    expect(resolveHardwareLink(seeded(), identity(null)).reason).toBe("no-identity");
    expect(resolveHardwareLink(seeded(), identity("not-a-mac")).reason).toBe("no-identity");
  });

  it("returns `unlinked` when no Locker item carries that address", () => {
    const state = addCube(seeded(), "3x3", "GAN 12", { smartId: GAN_MAC });
    expect(resolveHardwareLink(state, identity("001122334455")).reason).toBe("unlinked");
  });

  it("resolves the item and the event its type belongs to", () => {
    const state = addCube(seeded(), "2x2", "Valk 2", { smartId: GAN_MAC });
    const result = resolveHardwareLink(state, identity(GAN_MAC));

    expect(result.reason).toBeNull();
    expect(result.item?.name).toBe("Valk 2");
    // A 2×2 must never come back as a 3×3 event.
    expect(result.event).toBe("222");
  });

  it("matches the address in either byte order (the protocol reads it backwards)", () => {
    const stored = addCube(seeded(), "3x3", "GAN 12", { smartId: "AABBCCDDEEFF" });
    const reversed = addCube(seeded(), "3x3", "GAN 12", { smartId: "FFEEDDCCBBAA" });

    expect(resolveHardwareLink(stored, identity("FFEEDDCCBBAA"))?.item?.name).toBe("GAN 12");
    expect(resolveHardwareLink(reversed, identity("AABBCCDDEEFF"))?.item?.name).toBe("GAN 12");
  });

  it("tolerates separators and lower case in the reported address", () => {
    const state = addCube(seeded(), "3x3", "GAN 12", { smartId: "aabbccddeeff" });
    expect(resolveHardwareLink(state, identity("AA:BB:CC:DD:EE:FF"))?.item?.name).toBe("GAN 12");
  });

  it("refuses a cube that is sold or lent", () => {
    const sold = addCube(seeded(), "3x3", "Sold", { status: "sold", smartId: GAN_MAC });
    const lent = addCube(seeded(), "3x3", "Lent", { status: "lent", smartId: GAN_MAC });

    expect(resolveHardwareLink(sold, identity(GAN_MAC)).reason).toBe("not-owned");
    expect(resolveHardwareLink(lent, identity(GAN_MAC)).reason).toBe("not-owned");
  });

  it("refuses an item that cannot belong to any event", () => {
    const state = upsertItem(seeded(), {
      categoryId: SEED_CATEGORY_IDS.cubes,
      typeId: null,
      name: "No type",
      smartId: GAN_MAC,
    });
    // It exists and is owned, but a cube with no type has no event to attribute.
    expect(resolveHardwareLink(state, identity(GAN_MAC)).reason).toBe("no-event");
  });

  it("resolves to nothing when two items share the address, instead of guessing", () => {
    let state = addCube(seeded(), "3x3", "First", { smartId: GAN_MAC });
    state = addCube(state, "3x3", "Second", { smartId: GAN_MAC });

    const result = resolveHardwareLink(state, identity(GAN_MAC));
    expect(result.item).toBeNull();
    expect(result.reason).toBe("ambiguous");
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

describe("cubesForEventWithSmartFallback", () => {
  it("returns only the event's own cubes when the opt-in is off", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "GAN 12", { smartId: GAN_MAC });

    expect(
      cubesForEventWithSmartFallback(state, "222", false).map((i) => i.name),
    ).toEqual(["Valk 2"]);
  });

  it("never widens a 3×3 session, even with the opt-in on", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2", { smartId: "112233445566" });
    state = addCube(state, "3x3", "GAN 12");

    expect(
      cubesForEventWithSmartFallback(state, "333", true).map((i) => i.name),
    ).toEqual(["GAN 12"]);
  });

  it("joins owned LINKED smart 3×3 cubes to a 2×2 when the opt-in is on", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "GAN 12", { smartId: GAN_MAC });

    expect(
      cubesForEventWithSmartFallback(state, "222", true).map((i) => i.name),
    ).toEqual(["Valk 2", "GAN 12"]);
  });

  it("never leaks a NON-smart 3×3 into 2×2", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12");

    expect(cubesForEventWithSmartFallback(state, "222", true)).toEqual([]);
  });

  it("never leaks a sold or lent smart 3×3 into 2×2", () => {
    let state = seeded();
    state = addCube(state, "3x3", "Sold", { status: "sold", smartId: GAN_MAC });
    state = addCube(state, "3x3", "Lent", { status: "lent", smartId: GAN_MAC });

    expect(cubesForEventWithSmartFallback(state, "222", true)).toEqual([]);
  });

  it("keeps Locker order (native 2×2 first) and never duplicates", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "GAN 12", { smartId: GAN_MAC });
    state = addCube(state, "3x3", "Second smart");
    // A 2×2 that also carries a smart address stays a native candidate.
    state = addCube(state, "2x2", "Smart 2x2", { smartId: "112233445566" });

    expect(
      cubesForEventWithSmartFallback(state, "222", true).map((i) => i.name),
    ).toEqual(["Valk 2", "Smart 2x2", "GAN 12"]);
  });
});

describe("shouldIgnoreSmartCubeForSession", () => {
  it("ignores a linked 3×3 in a 2×2 session with the opt-in off", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: "333" }, false),
    ).toBe(true);
  });

  it("ignores a connected cube resolved to ANOTHER event (a 3×3 filed as 3×3 OH)", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: "333oh" }, false),
    ).toBe(true);
  });

  it("ignores connected hardware the Locker could not resolve (unlinked / no identity)", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: null }, false),
    ).toBe(true);
  });

  it("allows a linked 3×3 in a 2×2 session with the opt-in on", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: "333" }, true),
    ).toBe(false);
  });

  it("never ignores a cube the Locker knows is a 2×2, whatever the opt-in", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: "222" }, false),
    ).toBe(false);
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: true, event: "222" }, true),
    ).toBe(false);
  });

  it("never ignores when nothing is connected", () => {
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: false, event: null }, false),
    ).toBe(false);
    expect(
      shouldIgnoreSmartCubeForSession("222", { connected: false, event: "333" }, false),
    ).toBe(false);
  });

  it("never ignores for another event's session, whatever the hardware", () => {
    expect(
      shouldIgnoreSmartCubeForSession("333", { connected: true, event: "333" }, false),
    ).toBe(false);
    expect(
      shouldIgnoreSmartCubeForSession("333", { connected: true, event: "222" }, false),
    ).toBe(false);
    // Pyraminx / 3×3 OH keep their legacy behavior untouched.
    expect(
      shouldIgnoreSmartCubeForSession("pyram", { connected: true, event: "333" }, false),
    ).toBe(false);
    expect(
      shouldIgnoreSmartCubeForSession("333oh", { connected: true, event: "333" }, false),
    ).toBe(false);
  });
});

describe("resolveActiveCube with candidatesOverride", () => {
  it("resolves the chosen cube from the override candidates", () => {
    let state = seeded();
    state = addCube(state, "3x3", "GAN 12", { smartId: GAN_MAC });
    const gan = state.items.find((item) => item.name === "GAN 12")!;

    // A linked smart 3×3 is not a native 222 candidate, so it only enters via
    // the override — exactly what the dock and the attribution feed it.
    expect(resolveActiveCube(state, "222", gan.id, undefined, [gan])?.id).toBe(gan.id);
    expect(resolveActiveCube(state, "222")).toBeNull();
  });

  it("still rejects a chosen cube outside the override candidates", () => {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2");
    state = addCube(state, "3x3", "GAN 12", { smartId: GAN_MAC });
    const valk = state.items.find((item) => item.name === "Valk 2")!;
    const gan = state.items.find((item) => item.name === "GAN 12")!;

    // Opt-in OFF: the 3×3 is not in the candidates, so a stale stored choice
    // of it is ignored rather than trusted — it falls through Main (none
    // marked) to the most recent native cube, never to the foreign one.
    expect(resolveActiveCube(state, "222", gan.id, valk.id, [valk])?.id).toBe(valk.id);
  });
});

describe("resolveActiveCube with preferredId (the connected cube)", () => {
  function twoCubes(): CollectionState {
    let state = seeded();
    state = addCube(state, "2x2", "Valk 2", { primary: true });
    state = addCube(state, "3x3", "GAN i3", { smartId: GAN_MAC });
    return state;
  }

  it("prefers the connected cube over both Main and the most recent one", () => {
    const state = twoCubes();
    const valk = state.items.find((item) => item.name === "Valk 2")!;
    const gan = state.items.find((item) => item.name === "GAN i3")!;
    const candidates = cubesForEventWithSmartFallback(state, "222", true);

    expect(
      resolveActiveCube(state, "222", undefined, valk.id, candidates, gan.id)?.name,
    ).toBe("GAN i3");
  });

  it("still lets an explicit choice win", () => {
    const state = twoCubes();
    const valk = state.items.find((item) => item.name === "Valk 2")!;
    const gan = state.items.find((item) => item.name === "GAN i3")!;
    const candidates = cubesForEventWithSmartFallback(state, "222", true);

    expect(
      resolveActiveCube(state, "222", valk.id, undefined, candidates, gan.id)?.name,
    ).toBe("Valk 2");
  });

  it("still lets an explicit \"no cube\" win over the hardware", () => {
    const state = twoCubes();
    const gan = state.items.find((item) => item.name === "GAN i3")!;
    const candidates = cubesForEventWithSmartFallback(state, "222", true);

    expect(resolveActiveCube(state, "222", NO_CUBE, undefined, candidates, gan.id)).toBeNull();
  });

  it("ignores hardware that is not a candidate for this event (opt-in off)", () => {
    const state = twoCubes();
    const valk = state.items.find((item) => item.name === "Valk 2")!;
    const gan = state.items.find((item) => item.name === "GAN i3")!;
    // The gate, expressed through the candidate list: with the opt-in off the
    // linked 3×3 is not a 2×2 candidate, so the preference finds nothing.
    const candidates = cubesForEventWithSmartFallback(state, "222", false);

    expect(resolveActiveCube(state, "222", undefined, valk.id, candidates, gan.id)?.name).toBe(
      "Valk 2",
    );
  });
});

describe("regression: a 2×2 solve done on a connected smart 3×3", () => {
  it("attributes the solve to the connected 3×3 with the opt-in on (used to be empty)", () => {
    // The exact report: a 2×2 session, the only Locker cube is a linked smart
    // 3×3, the opt-in is on. `activeCubeStore.byEvent["222"]` is untouched (the
    // identity service auto-selects for the item's OWN event, 333), so without
    // the hardware preference this stored no cube at all.
    let state = seeded();
    state = addCube(state, "3x3", "GAN i3", { smartId: GAN_MAC });
    const gan = state.items[0]!;
    const candidates = cubesForEventWithSmartFallback(state, "222", true);

    const attribution = cubeAttribution(
      resolveActiveCube(state, "222", undefined, undefined, candidates, gan.id),
    );
    expect(attribution).toEqual({ cubeId: gan.id, cubeLabel: "GAN i3" });
  });

  it("never attributes a 2×2 solve done on a real 2×2 smart cube to a 3×3", () => {
    let state = seeded();
    state = addCube(state, "2x2", "GAN 2x2", { smartId: GAN_MAC });
    state = addCube(state, "3x3", "GAN i3", { smartId: "112233445566" });
    const twoByTwo = state.items.find((item) => item.name === "GAN 2x2")!;
    const threeByThree = state.items.find((item) => item.name === "GAN i3")!;
    const candidates = cubesForEventWithSmartFallback(state, "222", true);

    const attribution = cubeAttribution(
      resolveActiveCube(state, "222", undefined, undefined, candidates, twoByTwo.id),
    );
    expect(attribution).toEqual({ cubeId: twoByTwo.id, cubeLabel: "GAN 2x2" });
    expect(attribution.cubeId).not.toBe(threeByThree.id);
  });
});
