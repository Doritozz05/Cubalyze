import { describe, expect, it } from "vitest";
import {
  SEED_CATEGORY_IDS,
  seedCollectionState,
  removeItem,
  updateItem,
  upsertItem,
  type CollectionState,
  type GlobalCategoryOption,
} from "@/views/Collection/collectionModel";
import { createHardwareLinkStore, isOfferDismissed, SMART_ITEM_TAG } from "@/stores/hardwareLinkStore";
import type { HardwareLinkDeps } from "@/stores/hardwareLinkStore";
import type { CubeIdentity } from "@cubalyze/hardware-hal";

const OPTIONS: GlobalCategoryOption[] = [
  { category: "2x2", name: "2×2", playable: true, planned: false },
  { category: "3x3", name: "3×3", playable: true, planned: false },
];

const GAN_MAC = "AABBCCDDEEFF";

function identity(mac: string | null = GAN_MAC, model: string | null = "GAN12uiM"): CubeIdentity {
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

function typeIdFor(state: CollectionState, category: "3x3" | "2x2"): string {
  const type = state.types.find((candidate) => candidate.puzzleCategory === category);
  if (!type) throw new Error(`no seeded type for ${category}`);
  return type.id;
}

/**
 * A Locker double: the pure model behind a getter, with just enough of the
 * store's write surface for the link actions. `linkTo`/`createFromHardware`
 * are the code under test, so this only has to behave like the real thing.
 */
function harness(initial?: CollectionState) {
  let state = initial ?? seedCollectionState(OPTIONS, []);
  let seq = 0;
  const patched: { id: string; patch: Record<string, unknown> }[] = [];
  const removed: string[] = [];

  const deps: HardwareLinkDeps = {
    getCollection: () => state,
    isHydrated: () => true,
    addItem: (input) => {
      const id = input.id ?? `item_new_${++seq}`;
      state = upsertItem(state, { ...input, id });
      return id;
    },
    patchItem: (id, patch) => {
      patched.push({ id, patch: patch as Record<string, unknown> });
      state = updateItem(state, id, patch);
    },
    removeItem: (id) => {
      removed.push(id);
      state = removeItem(state, id);
    },
    getActiveCube: () => undefined,
    setActiveCube: () => {},
  };

  const store = createHardwareLinkStore(deps);
  return {
    store,
    getState: () => state,
    /** Simulate an edit made outside these actions (the user in the Locker). */
    setState: (next: CollectionState) => {
      state = next;
    },
    patched,
    removed,
  };
}

function cube(state: CollectionState, name: string, extra: Partial<{ smartId: string; model: string; status: "owned" | "sold" }> = {}) {
  return upsertItem(state, {
    categoryId: SEED_CATEGORY_IDS.cubes,
    typeId: typeIdFor(state, "3x3"),
    name,
    brand: "GAN",
    status: extra.status,
    smartId: extra.smartId,
    model: extra.model,
  });
}

describe("hardwareLinkStore.linkTo", () => {
  it("writes the canonical address onto the chosen item", () => {
    const state = cube(seedCollectionState(OPTIONS, []), "GAN 12 ui");
    const itemId = state.items[0]!.id;
    const h = harness(state);
    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });

    expect(h.store.getState().linkTo(itemId)).toEqual({ ok: true });
    expect(h.getState().items[0]!.smartId).toBe(GAN_MAC);
    expect(h.patched).toEqual([{ id: itemId, patch: { smartId: GAN_MAC } }]);
  });

  it("does nothing when the item already carries the address", () => {
    const state = cube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    const h = harness(state);
    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });

    expect(h.store.getState().linkTo(state.items[0]!.id)).toEqual({ ok: true });
    expect(h.patched).toEqual([]);
  });

  it("refuses to steal an address another item already owns", () => {
    let state = cube(seedCollectionState(OPTIONS, []), "First", { smartId: GAN_MAC });
    state = cube(state, "Second");
    const first = state.items.find((item) => item.name === "First")!;
    const second = state.items.find((item) => item.name === "Second")!;
    const h = harness(state);
    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });

    expect(h.store.getState().linkTo(second.id)).toEqual({
      ok: false,
      reason: "taken",
      holderId: first.id,
    });
    expect(h.getState().items.find((item) => item.id === second.id)!.smartId).toBeUndefined();
  });

  it("refuses without an address, or for an item that is gone", () => {
    const h = harness();
    // No markUnlinked: the store has no mac yet, which is the honest no-identity.
    expect(h.store.getState().linkTo("whatever")).toEqual({ ok: false, reason: "no-identity" });

    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });
    expect(h.store.getState().linkTo("missing")).toEqual({ ok: false, reason: "missing-item" });
  });
});

describe("hardwareLinkStore.createFromHardware", () => {
  const described = {
    known: true,
    label: "GAN 12 ui Maglev",
    rawName: "GAN12uiM",
    generation: "gen4" as const,
    gyro: true,
  };

  it("files the cube in the Locker, tagged and pre-filled, and records its undo", () => {
    const h = harness();
    h.store.getState().markUnlinked({
      identity: identity(),
      model: described,
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });

    const result = h.store.getState().createFromHardware();
    expect(result.ok).toBe(true);
    const created = h.getState().items[0]!;
    expect(created.name).toBe("GAN 12 ui Maglev");
    expect(created.brand).toBe("GAN");
    expect(created.model).toBe("GAN12uiM");
    expect(created.smartId).toBe(GAN_MAC);
    expect(created.status).toBe("owned");
    expect(created.tags).toEqual([SMART_ITEM_TAG]);
    expect(created.typeId).toBe(typeIdFor(h.getState(), "3x3"));
    expect(h.store.getState().autoCreated?.id).toBe(created.id);
  });

  it("suffixes the name when one like it is already in the Locker", () => {
    let state = cube(seedCollectionState(OPTIONS, []), "GAN 12 ui Maglev");
    state = { ...state, items: state.items.map((item) => ({ ...item, model: undefined })) };
    const h = harness(state);
    h.store.getState().markUnlinked({
      identity: identity(),
      model: described,
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });

    h.store.getState().createFromHardware();
    expect(h.getState().items.map((item) => item.name)).toEqual([
      "GAN 12 ui Maglev",
      "GAN 12 ui Maglev 2",
    ]);
  });

  it("refuses when there is nowhere to file it (event excluded from the Locker)", () => {
    // No cube types at all: the user excluded every event.
    const empty: CollectionState = { ...seedCollectionState(OPTIONS, []), types: [] };
    const h = harness(empty);
    h.store.getState().markUnlinked({
      identity: identity(),
      model: described,
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: false,
    });

    expect(h.store.getState().createFromHardware()).toEqual({ ok: false, reason: "no-target" });
    expect(h.getState().items).toEqual([]);
  });

  it("refuses without an address or hardware to describe", () => {
    const h = harness();
    expect(h.store.getState().createFromHardware()).toEqual({ ok: false, reason: "no-identity" });
  });
});

describe("hardwareLinkStore.unlink", () => {
  it("drops only the address, keeping the item and its serial", () => {
    let state = cube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    state = updateItem(state, state.items[0]!.id, { serial: "SN-1" });
    const itemId = state.items[0]!.id;
    const h = harness(state);
    h.store.getState().markLinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      itemId,
      event: "333",
      suppressed: false,
    });

    expect(h.store.getState().unlink()).toEqual({ ok: true });
    expect(h.getState().items[0]!.smartId).toBeUndefined();
    expect(h.getState().items[0]!.serial).toBe("SN-1");
  });

  it("is a no-op when nothing is linked", () => {
    const h = harness();
    expect(h.store.getState().unlink()).toEqual({ ok: false });
  });
});

describe("hardwareLinkStore.undoAutoCreate", () => {
  function autoCreated() {
    const h = harness();
    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui Maglev", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });
    const result = h.store.getState().createFromHardware();
    if (!result.ok) throw new Error("expected the create to succeed");
    return { h, itemId: result.itemId };
  }

  it("removes an item the app created and nobody touched", () => {
    const { h, itemId } = autoCreated();
    expect(h.store.getState().undoAutoCreate()).toBe(true);
    expect(h.getState().items).toEqual([]);
    expect(h.removed).toEqual([itemId]);
    expect(h.store.getState().autoCreated).toBeNull();
  });

  it("expires instead of deleting an item the user has edited", () => {
    const { h, itemId } = autoCreated();
    // The user renamed it — undo must not take their work with it.
    h.setState(updateItem(h.getState(), itemId, { name: "Mi GAN de siempre" }));

    expect(h.store.getState().undoAutoCreate()).toBe(false);
    expect(h.removed).toEqual([]);
    expect(h.getState().items).toHaveLength(1);
    expect(h.store.getState().autoCreated).toBeNull();
  });

  it("still removes it after a change that is not the user's work", () => {
    const { h, itemId } = autoCreated();
    // Toggling "favourite" is not authorship: the undo stays available.
    h.setState(updateItem(h.getState(), itemId, { favorite: true }));
    expect(h.store.getState().undoAutoCreate()).toBe(true);
    expect(h.getState().items).toEqual([]);
  });
});

describe("hardwareLinkStore offers", () => {
  const described = {
    known: true,
    label: "GAN 12 ui Maglev",
    rawName: "GAN12uiM",
    generation: "gen4" as const,
    gyro: true,
  };
  const markUnlinked = (h: ReturnType<typeof harness>, mac: string) =>
    h.store.getState().markUnlinked({
      identity: identity(mac),
      model: described,
      mac,
      candidateIds: [],
      canCreate: true,
    });

  it("dismisses per address, survives a disconnect, and clears on resume", () => {
    const h = harness();
    markUnlinked(h, GAN_MAC);
    h.store.getState().dismissOffer();
    expect(isOfferDismissed(h.store.getState())).toBe(true);

    // Survives the cube going away and coming back…
    h.store.getState().markIdle();
    expect(h.store.getState().dismissedMac).toBe(GAN_MAC);
    markUnlinked(h, GAN_MAC);
    expect(isOfferDismissed(h.store.getState())).toBe(true);

    // …but a DIFFERENT cube is not silenced by it, and asking again clears it.
    markUnlinked(h, "112233445566");
    expect(isOfferDismissed(h.store.getState())).toBe(false);
    h.store.getState().resumeOffer();
    expect(h.store.getState().dismissedMac).toBeNull();
  });

  it("reports each state without inventing fields", () => {
    const h = harness();
    const described = { known: false, label: null, rawName: "GAN12uiM", generation: null, gyro: null };
    h.store.getState().markConflict({
      identity: identity(),
      model: described,
      mac: GAN_MAC,
      itemIds: ["a", "b"],
    });
    const state = h.store.getState();
    expect(state.status).toBe("conflict");
    expect(state.candidateIds).toEqual(["a", "b"]);
    expect(state.itemId).toBeNull();

    h.store.getState().markUnavailable({
      identity: identity(),
      model: described,
      mac: GAN_MAC,
      itemId: "a",
      reason: "not-owned",
    });
    expect(h.store.getState().status).toBe("unavailable");
    expect(h.store.getState().unavailableReason).toBe("not-owned");
  });
});
