"use client";

/**
 * cubeIdentity.ts — the headless service that turns "a cube is connected" into
 * "this item of your Locker is the one in your hand".
 *
 * Same shape as `orientationTracking.ts`: a module-level singleton started once
 * at boot, fed by the global adapter's observable streams, writing to stores —
 * no React, no canvas, nothing to mount. It subscribes to the adapter's
 * `identity$` (which the adapter re-emits as the handshake fills in, and emits
 * `null` on disconnect) and to the Locker, and on every change it recomputes
 * the link with one pure function (`resolveHardwareLink`).
 *
 * Two consequences are intentional and are the whole point of the phase:
 *
 *   • **Automatic attribution.** When the connected cube resolves to an item,
 *     the service selects it for its event on this device — unless the user
 *     explicitly chose "no cube", which is a decision and is never overridden.
 *     A different previous choice is replaced, but with a toast and an undo, so
 *     the machine never lies silently (§5.2 D2 of the plan).
 *   • **Automatic provisioning (§5.3 D5).** The first time a cube is seen, the
 *     service looks for an item that already IS that cube (same brand and model,
 *     no address) and links it instead of duplicating; only when there is
 *     nothing to link and nowhere ambiguous does it create the item, tagged
 *     `Smart`, with an undo. It never creates against a Locker that has not
 *     hydrated, and never without a firm address — the two ways an automatic
 *     write becomes a duplicate factory.
 *
 * Everything the service decides is reported to `hardwareLinkStore`, which is
 * the only thing the UI reads. The service never touches the DOM.
 */

import { normalizeSmartId } from "@cubeforge/database";
import { NO_CUBE, cubeShortLabel, planHardwareLink, resolveHardwareLink } from "@/views/Collection/activeCube";
import { describeCubeModel } from "@/views/Collection/cubeModelCatalog";
import type { CollectionState } from "@/views/Collection/collectionModel";
import type { StoreApi } from "zustand";
import type { CubeIdentity } from "@cubeforge/hardware-hal";
import type { Observable } from "rxjs";
import {
  hardwareLinkStore,
  notifyHardwareLink,
  type HardwareLinkNotice,
  type HardwareLinkStore,
} from "@/stores/hardwareLinkStore";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";

/** The adapter surface this service needs (structural — GanCubeAdapter satisfies it). */
export interface CubeIdentitySource {
  identity$?: Observable<CubeIdentity | null>;
}

export interface CubeIdentityDeps {
  store: StoreApi<HardwareLinkStore>;
  getCollection: () => CollectionState;
  /** False until the Locker has read the database; nothing is created before. */
  isHydrated: () => boolean;
  /** The cube chosen for an event on this device, or `NO_CUBE`. */
  getActiveCube: (event: string) => string | undefined;
  setActiveCube: (event: string, itemId: string | null) => void;
  notify: (notice: HardwareLinkNotice) => void;
  /** Subscribe to Locker changes; returns an unsubscribe. */
  subscribeCollection: (listener: () => void) => () => void;
}

export interface CubeIdentityService {
  /** Feed one identity sample (null = nothing connected). */
  handleIdentity: (identity: CubeIdentity | null) => void;
  dispose: () => void;
}

export function createCubeIdentityService(deps: CubeIdentityDeps): CubeIdentityService {
  let latest: CubeIdentity | null = null;
  let unsubscribeCollection: (() => void) | null = null;
  /**
   * Re-entrancy guard. The automatic write (link/create) changes the Locker,
   * which notifies this service again *while the first pass is still running*.
   * Running the second pass inline would emit the toasts out of order (the
   * "selected" notice before the "added" one, which reads backwards), so the
   * nested call only marks the state dirty and the outer loop replays once the
   * pass has finished. One replay is enough: the second pass resolves to a
   * link, which writes nothing.
   */
  let running = false;
  let dirty = false;
  /**
   * The (address, item) pair the service has already selected. Auto-selection
   * happens ONCE per pair, not on every recompute: the Locker changes often
   * (any edit), and re-asserting the hardware's cube after each one would undo a
   * manual choice in the dock seconds after it was made. A new connection — or a
   * different resolved item — is what earns a (re)selection.
   */
  let selectedKey: string | null = null;

  function pass(): void {
    const identity = latest;
    if (!identity) {
      selectedKey = null;
      deps.store.getState().markIdle();
      return;
    }

    const state = deps.getCollection();
    const model = describeCubeModel(identity.model);
    const mac = normalizeSmartId(identity.mac);
    const resolution = resolveHardwareLink(state, identity);

    if (resolution.item && resolution.event) {
      const chosen = deps.getActiveCube(resolution.event);
      const suppressed = chosen === NO_CUBE;
      deps.store.getState().markLinked({
        identity,
        model,
        mac,
        itemId: resolution.item.id,
        event: resolution.event,
        suppressed,
      });

      // An explicit "no cube" is a decision: the hardware reports, it does not
      // overrule. Everything else follows the cube in your hand, once per
      // connection (see `selectedKey`).
      const key = `${resolution.item.id}:${mac ?? ""}`;
      if (!suppressed && selectedKey !== key) {
        selectedKey = key;
        if (chosen !== resolution.item.id) {
          const item = resolution.item;
          deps.setActiveCube(resolution.event, item.id);
          deps.notify({
            kind: "auto-selected",
            event: resolution.event,
            itemId: item.id,
            itemName: cubeShortLabel(item),
            previousItemId: chosen ?? null,
          });
        }
      }
      return;
    }

    // Every reason below is reached by matching an address, so a missing one
    // collapses back to the honest "could not read it" instead of a state that
    // claims more than we know. (A linked resolution returned above.)
    if (!mac) {
      deps.store.getState().markNoIdentity({ identity, model, mac: null });
      return;
    }

    switch (resolution.reason) {
      case "ambiguous":
        deps.store.getState().markConflict({
          identity,
          model,
          mac,
          itemIds: resolution.matches.map((item) => item.id),
        });
        return;

      case "not-owned":
      case "no-event":
        deps.store.getState().markUnavailable({
          identity,
          model,
          mac,
          itemId: resolution.matches[0]?.id ?? null,
          reason: resolution.reason,
        });
        return;

      case "unlinked": {
        const plan = planHardwareLink(state, identity);
        const candidateIds = plan.linkCandidates.map((item) => item.id);
        deps.store.getState().markUnlinked({
          identity,
          model,
          mac,
          candidateIds,
          canCreate: plan.provision !== null,
        });

        // From here on the store holds this identity, which is what `linkTo` and
        // `createFromHardware` read the address from.
        // The dismissal is per address: "not this cube" never silences the next.
        if (deps.store.getState().dismissedMac === mac) return;
        // Never write to a Locker whose rows have not loaded.
        if (!deps.isHydrated()) return;

        if (plan.linkCandidates.length === 1) {
          const target = plan.linkCandidates[0]!;
          const result = deps.store.getState().linkTo(target.id);
          if (result.ok) {
            deps.notify({ kind: "auto-linked", itemId: target.id, itemName: cubeShortLabel(target) });
          }
          return;
        }

        if (plan.linkCandidates.length === 0 && plan.provision) {
          const result = deps.store.getState().createFromHardware();
          if (result.ok) {
            const created = deps.getCollection().items.find((item) => item.id === result.itemId);
            deps.notify({
              kind: "auto-created",
              itemId: result.itemId,
              itemName: created ? cubeShortLabel(created) : plan.provision.name,
            });
          }
          return;
        }

        // Several candidates: offering a choice beats guessing. The state
        // already carries them.
        return;
      }

      default:
        deps.store.getState().markIdle();
    }
  }

  function recompute(): void {
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        pass();
      } while (dirty);
    } finally {
      running = false;
    }
  }

  return {
    handleIdentity: (identity) => {
      latest = identity;
      if (identity && !unsubscribeCollection) {
        unsubscribeCollection = deps.subscribeCollection(() => recompute());
      }
      recompute();
    },
    dispose: () => {
      unsubscribeCollection?.();
      unsubscribeCollection = null;
      latest = null;
    },
  };
}

/** Start the service against an adapter and keep it running. */
export function startCubeIdentity(
  adapter: CubeIdentitySource,
  deps: CubeIdentityDeps,
): CubeIdentityService {
  const service = createCubeIdentityService(deps);
  const subscription = adapter.identity$?.subscribe((identity) => service.handleIdentity(identity));
  return {
    handleIdentity: service.handleIdentity,
    dispose: () => {
      subscription?.unsubscribe();
      service.dispose();
    },
  };
}

/**
 * The app's wiring: the global adapter, the real stores, and toasts for the
 * automatic actions. Started once at boot (see `components/Hardware/CubeConnector`).
 *
 * It deliberately lives here and not in the store, so the store stays a plain
 * state container with injected collaborators and this is the single place that
 * knows the concrete singletons.
 */
export function startAppCubeIdentity(adapter: CubeIdentitySource): CubeIdentityService {
  return startCubeIdentity(adapter, {
    store: hardwareLinkStore,
    getCollection: () => useCollectionStore.getState().data,
    isHydrated: () => useCollectionStore.getState().hydrated,
    getActiveCube: (event) => activeCubeStore.getState().byEvent[event],
    setActiveCube: (event, itemId) => activeCubeStore.getState().setActive(event, itemId),
    notify: notifyHardwareLink,
    subscribeCollection: (listener) => useCollectionStore.subscribe(listener),
  });
}
