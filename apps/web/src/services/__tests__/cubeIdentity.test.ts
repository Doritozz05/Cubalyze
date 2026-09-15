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
import { createHardwareLinkStore } from "@/stores/hardwareLinkStore";
import type { HardwareLinkNotice } from "@/stores/hardwareLinkStore";
import { createCubeIdentityService } from "@/services/cubeIdentity";
import { NO_CUBE } from "@/views/Collection/activeCube";
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

function addCube(
  state: CollectionState,
  name: string,
  extra: Partial<{ smartId: string; model: string; status: "owned" | "sold"; event: "3x3" | "2x2" }> = {},
): CollectionState {
  return upsertItem(state, {
    categoryId: SEED_CATEGORY_IDS.cubes,
    typeId: typeIdFor(state, extra.event ?? "3x3"),
    name,
    brand: "GAN",
    status: extra.status,
    smartId: extra.smartId,
    model: extra.model,
  });
}

/**
 * The world the service lives in: a Locker that notifies subscribers on write
 * (like the real store does), an active-cube choice per event, and the notices
 * it raised. Writes go through the same pure model the app uses.
 */
function harness(initial?: CollectionState, options: { hydrated?: boolean } = {}) {
  let state = initial ?? seedCollectionState(OPTIONS, []);
  let hydrated = options.hydrated ?? true;
  let seq = 0;
  const listeners = new Set<() => void>();
  const notices: HardwareLinkNotice[] = [];
  const active = new Map<string, string>();

  const publish = () => {
    for (const listener of listeners) listener();
  };

  const store = createHardwareLinkStore({
    getCollection: () => state,
    isHydrated: () => hydrated,
    addItem: (input) => {
      const id = input.id ?? `item_new_${++seq}`;
      state = upsertItem(state, { ...input, id });
      publish();
      return id;
    },
    patchItem: (id, patch) => {
      state = updateItem(state, id, patch);
      publish();
    },
    removeItem: (id) => {
      state = removeItem(state, id);
      publish();
    },
    getActiveCube: (event) => active.get(event),
    setActiveCube: (event, itemId) => {
      if (itemId) active.set(event, itemId);
      else active.delete(event);
    },
  });

  const service = createCubeIdentityService({
    store,
    getCollection: () => state,
    isHydrated: () => hydrated,
    getActiveCube: (event) => active.get(event),
    setActiveCube: (event, itemId) => {
      if (itemId) active.set(event, itemId);
      else active.delete(event);
    },
    notify: (notice) => notices.push(notice),
    subscribeCollection: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return {
    store,
    service,
    notices,
    active,
    getState: () => state,
    setState: (next: CollectionState) => {
      state = next;
      publish();
    },
    setHydrated: (value: boolean) => {
      hydrated = value;
      publish();
    },
    items: () => state.items,
  };
}

describe("cubeIdentity — resolution and auto-selection", () => {
  it("resolves nothing while there is no cube", () => {
    const h = harness();
    h.service.handleIdentity(null);
    expect(h.store.getState().status).toBe("idle");
  });

  it("reports no-identity when the address could not be read", () => {
    const h = harness();
    h.service.handleIdentity(identity(null));
    const state = h.store.getState();
    expect(state.status).toBe("no-identity");
    expect(state.mac).toBeNull();
    // The model is still shown, which is all we honestly know.
    expect(state.model?.label).toBe("GAN 12 ui Maglev");
  });

  it("selects the linked cube for its event", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    const item = state.items[0]!;
    const h = harness(state);

    h.service.handleIdentity(identity());

    expect(h.store.getState().status).toBe("linked");
    expect(h.store.getState().itemId).toBe(item.id);
    expect(h.store.getState().event).toBe("333");
    expect(h.active.get("333")).toBe(item.id);
    expect(h.notices).toEqual([
      {
        kind: "auto-selected",
        event: "333",
        itemId: item.id,
        itemName: "GAN 12 ui",
        previousItemId: null,
      },
    ]);
  });

  it("replaces a different choice, and the notice carries the one to restore", () => {
    let state = addCube(seedCollectionState(OPTIONS, []), "Valk 3");
    state = addCube(state, "GAN 12 ui", { smartId: GAN_MAC });
    const valk = state.items.find((item) => item.name === "Valk 3")!;
    const gan = state.items.find((item) => item.name === "GAN 12 ui")!;
    const h = harness(state);
    h.active.set("333", valk.id);

    h.service.handleIdentity(identity());

    expect(h.active.get("333")).toBe(gan.id);
    expect(h.notices).toEqual([
      expect.objectContaining({ kind: "auto-selected", previousItemId: valk.id }),
    ]);
  });

  it("announces nothing when the cube is already the chosen one", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    const item = state.items[0]!;
    const h = harness(state);
    h.active.set("333", item.id);

    h.service.handleIdentity(identity());

    expect(h.store.getState().status).toBe("linked");
    expect(h.notices).toEqual([]);
  });

  it("never overrides an explicit 'no cube' choice", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    const h = harness(state);
    h.active.set("333", NO_CUBE);

    h.service.handleIdentity(identity());

    const link = h.store.getState();
    expect(link.status).toBe("linked");
    expect(link.suppressed).toBe(true);
    expect(h.active.get("333")).toBe(NO_CUBE);
    expect(h.notices).toEqual([]);
  });

  it("refuses an item that is sold, naming it", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "Sold cube", {
      smartId: GAN_MAC,
      status: "sold",
    });
    const h = harness(state);

    h.service.handleIdentity(identity());

    const link = h.store.getState();
    expect(link.status).toBe("unavailable");
    expect(link.unavailableReason).toBe("not-owned");
    expect(link.itemId).toBe(state.items[0]!.id);
    expect(h.active.size).toBe(0);
  });

  it("reports a clash instead of guessing which of two identical cubes it is", () => {
    let state = addCube(seedCollectionState(OPTIONS, []), "First", { smartId: GAN_MAC });
    state = addCube(state, "Second", { smartId: GAN_MAC });
    const h = harness(state);

    h.service.handleIdentity(identity());

    expect(h.store.getState().status).toBe("conflict");
    expect(h.store.getState().candidateIds).toEqual(state.items.map((item) => item.id));
    expect(h.active.size).toBe(0);
  });
});

describe("cubeIdentity — automatic provisioning", () => {
  it("creates the item on first contact and then attributes to it", () => {
    const h = harness();
    h.service.handleIdentity(identity());

    const created = h.items()[0]!;
    expect(created.name).toBe("GAN 12 ui Maglev");
    expect(created.smartId).toBe(GAN_MAC);
    expect(created.tags).toEqual(["Smart"]);

    // The create itself re-resolved the link: the cube is now attributed.
    expect(h.store.getState().status).toBe("linked");
    expect(h.active.get("333")).toBe(created.id);
    // The "added" notice is raised BEFORE the "selected" one, which is the
    // order a person reads them in.
    expect(h.notices.map((notice) => notice.kind)).toEqual(["auto-created", "auto-selected"]);
  });

  it("links an existing unlinked item that is the same cube, instead of duplicating", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { model: "GAN12uiM" });
    const item = state.items[0]!;
    const h = harness(state);

    h.service.handleIdentity(identity());

    expect(h.items()).toHaveLength(1);
    expect(h.items()[0]!.smartId).toBe(GAN_MAC);
    expect(h.store.getState().itemId).toBe(item.id);
    expect(h.notices.map((notice) => notice.kind)).toEqual(["auto-linked", "auto-selected"]);
  });

  it("offers a choice when several items could be the cube — it does not guess", () => {
    let state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui A", { model: "GAN12uiM" });
    state = addCube(state, "GAN 12 ui B", { model: "GAN12uiM" });
    const h = harness(state);

    h.service.handleIdentity(identity());

    const link = h.store.getState();
    expect(link.status).toBe("unlinked");
    expect(link.candidateIds).toEqual(state.items.map((item) => item.id));
    expect(h.items()).toHaveLength(2);
    expect(h.items().every((item) => item.smartId === undefined)).toBe(true);
    expect(h.notices).toEqual([]);
  });

  it("waits for the Locker to hydrate before creating anything", () => {
    const h = harness(undefined, { hydrated: false });
    h.service.handleIdentity(identity());

    expect(h.items()).toEqual([]);
    expect(h.store.getState().status).toBe("unlinked");
    expect(h.store.getState().canCreate).toBe(true);

    // Hydration completes: the pending link is resolved without another connect.
    h.setHydrated(true);
    expect(h.items()).toHaveLength(1);
    expect(h.store.getState().status).toBe("linked");
  });

  it("respects a dismissed offer until the user asks again", () => {
    const h = harness();
    h.store.getState().markUnlinked({
      identity: identity(),
      model: { known: true, label: "GAN 12 ui Maglev", rawName: "GAN12uiM", generation: "gen4", gyro: true },
      mac: GAN_MAC,
      candidateIds: [],
      canCreate: true,
    });
    h.store.getState().dismissOffer();

    h.service.handleIdentity(identity());
    expect(h.items()).toEqual([]);
    expect(h.store.getState().status).toBe("unlinked");
    expect(h.store.getState().dismissedMac).toBe(GAN_MAC);

    // "Vincular" on the dismissed card: offer is live again.
    h.store.getState().resumeOffer();
    h.service.handleIdentity(identity());
    expect(h.items()).toHaveLength(1);
  });

  it("does not create when the event has been excluded from the Locker", () => {
    const state: CollectionState = { ...seedCollectionState(OPTIONS, []), types: [] };
    const h = harness(state);

    h.service.handleIdentity(identity());

    expect(h.items()).toEqual([]);
    expect(h.store.getState().status).toBe("unlinked");
    expect(h.store.getState().canCreate).toBe(false);
  });

  it("does not create a second item when the same cube connects again", () => {
    const h = harness();
    h.service.handleIdentity(identity());
    h.service.handleIdentity(identity());
    h.service.handleIdentity(identity());

    expect(h.items()).toHaveLength(1);
    expect(h.notices.map((notice) => notice.kind)).toEqual(["auto-created", "auto-selected"]);
  });

  it("does not link an item straight back after the user unlinks it", () => {
    const state = addCube(seedCollectionState(OPTIONS, []), "GAN 12 ui", { smartId: GAN_MAC });
    const h = harness(state);
    h.service.handleIdentity(identity());
    expect(h.store.getState().status).toBe("linked");

    h.store.getState().unlink();

    // The write re-resolved the link; without the dismissal it would have found
    // "an unlinked item that is this cube" and linked it again on the spot.
    expect(h.items()[0]!.smartId).toBeUndefined();
    expect(h.store.getState().status).toBe("unlinked");
    expect(h.store.getState().dismissedMac).toBe(GAN_MAC);
    expect(h.store.getState().itemId).toBeNull();
  });

  it("does not recreate the item after the user undoes its creation", () => {
    const h = harness();
    h.service.handleIdentity(identity());
    expect(h.items()).toHaveLength(1);

    expect(h.store.getState().undoAutoCreate()).toBe(true);

    expect(h.items()).toEqual([]);
    expect(h.store.getState().status).toBe("unlinked");
    expect(h.store.getState().dismissedMac).toBe(GAN_MAC);
  });

  it("keeps a manual choice in the dock — only connecting re-asserts the cube", () => {
    let state = addCube(seedCollectionState(OPTIONS, []), "Valk 3");
    state = addCube(state, "GAN 12 ui", { smartId: GAN_MAC });
    const valk = state.items.find((item) => item.name === "Valk 3")!;
    const gan = state.items.find((item) => item.name === "GAN 12 ui")!;
    const h = harness(state);

    h.service.handleIdentity(identity());
    expect(h.active.get("333")).toBe(gan.id);

    // The user picks the Valk in the dock, then edits anything in the Locker.
    h.active.set("333", valk.id);
    h.setState(updateItem(h.getState(), valk.id, { notes: "bought used" }));

    expect(h.active.get("333")).toBe(valk.id);
    expect(h.notices.filter((notice) => notice.kind === "auto-selected")).toHaveLength(1);
  });

  it("never files a 2×2 solve under a 3×3 cube", () => {
    // The linked item is a 2×2, so the hardware selects it for 222 only.
    const state = addCube(seedCollectionState(OPTIONS, []), "Valk 2", {
      smartId: GAN_MAC,
      event: "2x2",
    });
    const item = state.items[0]!;
    const h = harness(state);

    h.service.handleIdentity(identity());

    expect(h.store.getState().event).toBe("222");
    expect(h.active.get("222")).toBe(item.id);
    expect(h.active.has("333")).toBe(false);
  });
});
