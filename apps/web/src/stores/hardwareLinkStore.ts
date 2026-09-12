"use client";

/**
 * hardwareLinkStore.ts — what the CONNECTED cube is, in Locker terms.
 *
 * This is the UI-facing mirror of one question: "the cube in your hand — which
 * of your Locker items is it?". It is deliberately NOT persisted and holds no
 * source of truth of its own: the source is the adapter's `identity$`, the
 * Locker, and `activeCubeStore`. Wiping this store loses nothing but the
 * current frame of that conversation.
 *
 * Two halves, kept apart on purpose:
 *
 *   • the **mark…** methods are how the headless service (`services/cubeIdentity`)
 *     reports what it resolved. They only describe; they never write to the
 *     Locker. That keeps the resolution a pure function of (identity, collection)
 *     and makes the automatic behaviour a consequence of it, not a side effect
 *     hidden inside a store setter.
 *   • the **actions** (`linkTo`, `createFromHardware`, `unlink`, `undoAutoCreate`)
 *     are the deliberate, user-initiated writes. They go through the collection
 *     store (so the diff engine, the retry and the sync request all still
 *     apply) and nothing else.
 *
 * `createHardwareLinkStore` takes its collaborators as a parameter, so every
 * action above is testable without a Worker, a Locker or a real cube.
 */

import { create } from "zustand";
import { toast } from "sonner";
import { normalizeSmartId, smartIdsMatch } from "@cubeforge/database";
import type { CubeIdentity } from "@cubeforge/hardware-hal";
import i18n from "@/i18n";
import { provisioningTarget } from "@/views/Collection/activeCube";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";
import type { CollectionState, GearItem, ItemInput } from "@/views/Collection/collectionModel";
import type { DescribedCubeModel } from "@/views/Collection/cubeModelCatalog";

/** The tag an app-created item carries, so it is recognisable and editable. */
export const SMART_ITEM_TAG = "Smart";

/**
 * Where the link stands, as one of a small closed set. Every value is a real
 * situation with its own sentence in the UI — which is why there is no
 * catch-all "error": a state nobody can name is a state nobody can explain.
 */
export type HardwareLinkStatus =
  /** Nothing connected, or the adapter has no identity to offer. */
  | "idle"
  /** Connected, but there is no usable address to key the link on. */
  | "no-identity"
  /** Resolved to a Locker item. `suppressed` says whether it may be attributed. */
  | "linked"
  /** The address is real but no item carries it: offer to link or create. */
  | "unlinked"
  /** More than one item carries the address — must be fixed by hand. */
  | "conflict"
  /** The item is sold, lent, or cannot belong to an event: cannot be attributed. */
  | "unavailable";

/** Why a linked item may not receive solves. */
export type UnavailableReason = "not-owned" | "no-event";

/** Why a link action was refused (never silent — the UI shows the reason). */
export type LinkRefusal =
  | "no-identity"
  | "missing-item"
  /** Another item already owns this address; it must be reassigned explicitly. */
  | "taken"
  /** No cube category / no type of the smart cube's event to file it under. */
  | "no-target";

/** Notices the service raises so the UI can toast them, with their undo. */
export type HardwareLinkNotice =
  | { kind: "auto-created"; itemId: string; itemName: string }
  | { kind: "auto-linked"; itemId: string; itemName: string }
  | {
      kind: "auto-selected";
      event: string;
      itemId: string;
      itemName: string;
      /** What was chosen before, so undo can restore it (null = nothing). */
      previousItemId: string | null;
    };

export interface HardwareLinkDeps {
  getCollection: () => CollectionState;
  isHydrated: () => boolean;
  addItem: (input: ItemInput & { id?: string }) => string;
  patchItem: (id: string, patch: Partial<GearItem>) => void;
  removeItem: (id: string) => void;
  getActiveCube: (event: string) => string | undefined;
  setActiveCube: (event: string, itemId: string | null) => void;
}

export interface HardwareLinkStore {
  status: HardwareLinkStatus;
  /** The parent hardware report, kept for the info section (firmware, date…). */
  identity: CubeIdentity | null;
  /** Catalogue description of `identity.model` (label, generation, gyro). */
  model: DescribedCubeModel | null;
  /** Canonical address of the connected cube, when we have one. */
  mac: string | null;
  /** The resolved Locker item, when there is one. */
  itemId: string | null;
  /** The event that item belongs to (`333`, `222`…). */
  event: string | null;
  /** Why an `unavailable` item cannot be attributed, when that is the state. */
  unavailableReason: UnavailableReason | null;
  /** Items that plausibly are this cube but are not linked yet. */
  candidateIds: string[];
  /** True when the resolved item may receive solves (no explicit "no cube"). */
  suppressed: boolean;
  /** Where a newly created item would go, or null when it cannot be filed. */
  canCreate: boolean;
  /**
   * The address whose offer the user dismissed — an ADDRESS, not a flag.
   *
   * Per-cube on purpose: saying "don't offer" about one cube (or unlinking it)
   * must not silence the offer for the next cube you connect. Compared against
   * the current `mac`; use `isOfferDismissed()` rather than reading it directly.
   */
  dismissedMac: string | null;
  /** The item the app created for this cube, while its undo is still valid. */
  autoCreated: GearItem | null;

  /** @internal the service's report — never called by components. */
  markIdle: () => void;
  /** @internal */
  markNoIdentity: (input: { identity: CubeIdentity; model: DescribedCubeModel; mac: string | null }) => void;
  /** @internal */
  markLinked: (input: {
    identity: CubeIdentity;
    model: DescribedCubeModel;
    mac: string | null;
    itemId: string;
    event: string;
    suppressed: boolean;
  }) => void;
  /** @internal */
  markUnlinked: (input: {
    identity: CubeIdentity;
    model: DescribedCubeModel;
    mac: string;
    candidateIds: string[];
    canCreate: boolean;
  }) => void;
  /** @internal */
  markConflict: (input: {
    identity: CubeIdentity;
    model: DescribedCubeModel;
    mac: string;
    itemIds: string[];
  }) => void;
  /** @internal */
  markUnavailable: (input: {
    identity: CubeIdentity;
    model: DescribedCubeModel;
    mac: string;
    itemId: string | null;
    reason: UnavailableReason;
  }) => void;

  /** Bind this item to the connected cube's address. */
  linkTo: (itemId: string) => { ok: true } | { ok: false; reason: LinkRefusal; holderId?: string };
  /** Create a Locker item for the connected cube, pre-filled from the hardware. */
  createFromHardware: () => { ok: true; itemId: string } | { ok: false; reason: LinkRefusal };
  /** Drop the address from the currently linked item (keeps the item itself). */
  unlink: () => { ok: boolean };
  /** Remove the item this connection created, while it is still untouched. */
  undoAutoCreate: () => boolean;
  /** Stop offering for this address until the user asks again. */
  dismissOffer: () => void;
  /** Undo `dismissOffer` (the UI's "vincular" button when dismissed). */
  resumeOffer: () => void;
}

/** True when the offer for the CURRENT cube has been dismissed by the user. */
export function isOfferDismissed(state: HardwareLinkStore): boolean {
  return state.mac !== null && state.dismissedMac === state.mac;
}

function idle(): Pick<
  HardwareLinkStore,
  | "status"
  | "identity"
  | "model"
  | "mac"
  | "itemId"
  | "event"
  | "unavailableReason"
  | "candidateIds"
  | "suppressed"
  | "canCreate"
> {
  return {
    status: "idle",
    identity: null,
    model: null,
    mac: null,
    itemId: null,
    event: null,
    unavailableReason: null,
    candidateIds: [],
    suppressed: false,
    canCreate: false,
  };
}

/**
 * Has the item the app created been touched since?
 *
 * Undo may only delete what the app made. If the user renamed it, added a photo
 * or wrote a note, deleting would destroy their work — so the offer to undo
 * quietly expires instead. Comparing field by field (rather than `updatedAt`)
 * is what makes "added a photo" and "toggled favourite" differ in outcome,
 * which is what the user would expect.
 */
function isUntouched(created: GearItem, current: GearItem): boolean {
  return (
    current.name === created.name &&
    current.brand === created.brand &&
    current.model === created.model &&
    current.smartId === created.smartId &&
    current.notes === created.notes &&
    current.price === undefined &&
    current.photos.length === created.photos.length &&
    current.links.length === created.links.length &&
    current.tags.length === created.tags.length
  );
}

export function createHardwareLinkStore(deps: HardwareLinkDeps) {
  return create<HardwareLinkStore>()((set, get) => ({
    ...idle(),
    dismissedMac: null,
    autoCreated: null,

    markIdle: () => {
      // The dismissal is kept across disconnects on purpose: a user who said
      // "don't offer" about a cube should not be asked again every time it
      // reconnects. It is keyed by address, so a different cube is unaffected.
      set(idle());
    },

    markNoIdentity: ({ identity, model, mac }) => {
      set({ ...idle(), status: "no-identity", identity, model, mac });
    },

    markLinked: ({ identity, model, mac, itemId, event, suppressed }) => {
      set({
        ...idle(),
        status: "linked",
        identity,
        model,
        mac,
        itemId,
        event,
        suppressed,
      });
    },

    markUnlinked: ({ identity, model, mac, candidateIds, canCreate }) => {
      set({
        ...idle(),
        status: "unlinked",
        identity,
        model,
        mac,
        candidateIds,
        canCreate,
      });
    },

    markConflict: ({ identity, model, mac, itemIds }) => {
      set({
        ...idle(),
        status: "conflict",
        identity,
        model,
        mac,
        candidateIds: itemIds,
      });
    },

    markUnavailable: ({ identity, model, mac, itemId, reason }) => {
      set({
        ...idle(),
        status: "unavailable",
        identity,
        model,
        mac,
        itemId,
        unavailableReason: reason,
      });
    },

    linkTo: (itemId) => {
      const { mac } = get();
      if (!mac) return { ok: false, reason: "no-identity" };

      const state = deps.getCollection();
      const item = state.items.find((candidate) => candidate.id === itemId);
      if (!item) return { ok: false, reason: "missing-item" };

      const holder = state.items.find(
        (candidate) =>
          candidate.id !== itemId && candidate.smartId && smartIdsMatch(candidate.smartId, mac),
      );
      if (holder) return { ok: false, reason: "taken", holderId: holder.id };

      if (normalizeSmartId(item.smartId) !== mac) {
        deps.patchItem(itemId, { smartId: mac });
      }
      return { ok: true };
    },

    createFromHardware: () => {
      const { mac, identity } = get();
      if (!mac || !identity) return { ok: false, reason: "no-identity" };

      const target = provisioningTarget(deps.getCollection(), identity);
      if (!target) return { ok: false, reason: "no-target" };

      const itemId = deps.addItem({
        categoryId: target.categoryId,
        typeId: target.typeId,
        name: target.name,
        brand: identity.vendor,
        model: target.model ?? undefined,
        smartId: mac,
        status: "owned",
        tags: [SMART_ITEM_TAG],
      });

      const created = deps.getCollection().items.find((item) => item.id === itemId) ?? null;
      set({ autoCreated: created });
      return { ok: true, itemId };
    },

    unlink: () => {
      const { itemId } = get();
      if (!itemId) return { ok: false };
      // The dismissal MUST be in place before the write: the write notifies the
      // service synchronously, and without it the freshly unlinked item would
      // look like "an unlinked item that is this cube" — the service would link
      // it straight back, and the button would appear broken. "Don't link this
      // cube" is exactly what the user just said.
      set({ dismissedMac: get().mac });
      // Only the address goes: the serial, the photos and the frozen solve
      // history stay exactly where they were.
      deps.patchItem(itemId, { smartId: undefined });
      return { ok: true };
    },

    undoAutoCreate: () => {
      const { autoCreated } = get();
      if (!autoCreated) return false;
      const current = deps.getCollection().items.find((item) => item.id === autoCreated.id);
      if (!current || !isUntouched(autoCreated, current)) {
        set({ autoCreated: null });
        return false;
      }
      // Same ordering rule as `unlink`, and for the same reason: deleting the
      // item makes it "a cube we have never seen", which would be created again
      // on the spot. Undoing is a decision, so the offer is dismissed with it.
      set({ dismissedMac: get().mac });
      deps.removeItem(autoCreated.id);
      set({ autoCreated: null });
      return true;
    },

    dismissOffer: () => set({ dismissedMac: get().mac }),

    resumeOffer: () => set({ dismissedMac: null }),
  }));
}

// ─── The app-wide singleton ────────────────────────────────────────────────

/** Show a notice as a toast; the automatic ones offer their undo. */
export function notifyHardwareLink(notice: HardwareLinkNotice): void {
  if (notice.kind === "auto-selected") {
    toast.success(i18n.t("toast:cubeAutoSelected", { name: notice.itemName }), {
      action: {
        label: i18n.t("common:undo"),
        onClick: () =>
          activeCubeStore.getState().setActive(notice.event, notice.previousItemId ?? null),
      },
    });
    return;
  }

  const created = notice.kind === "auto-created";
  toast.success(
    i18n.t(created ? "toast:cubeAddedToLocker" : "toast:cubeLinkedToLocker", {
      name: notice.itemName,
    }),
    {
      action: {
        label: i18n.t("common:undo"),
        onClick: () => hardwareLinkStore.getState().undoAutoCreate(),
      },
    },
  );
}

export const hardwareLinkStore = createHardwareLinkStore({
  getCollection: () => useCollectionStore.getState().data,
  isHydrated: () => useCollectionStore.getState().hydrated,
  addItem: (input) => useCollectionStore.getState().addItem(input),
  patchItem: (id, patch) => useCollectionStore.getState().patchItem(id, patch),
  removeItem: (id) => useCollectionStore.getState().removeItem(id),
  getActiveCube: (event) => activeCubeStore.getState().byEvent[event],
  setActiveCube: (event, itemId) => activeCubeStore.getState().setActive(event, itemId),
});
