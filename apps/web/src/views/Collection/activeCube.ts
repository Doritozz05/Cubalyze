"use client";

/**
 * activeCube.ts — which of YOUR cubes a solve of a given event should use.
 *
 * The Locker knows the gear; the timer knows the event. This module is the
 * bridge, and it is deliberately pure: it takes the collection state and the
 * event code and answers with an item (or nothing), so every rule below is
 * unit-testable without a database, a timer or React.
 *
 * The rules, in the order they are applied:
 *
 *   1. **Owned cubes only.** A cube marked sold or lent is not in your hand;
 *      attributing a solve to it would be a lie.
 *   2. **Cubes of the event only.** The link is the type's `puzzleCategory`
 *      (the same bridge the taxonomy sync uses), so a 2×2 solve can never be
 *      attributed to your 3×3 — and an event with no registered cubes simply has
 *      no candidate, which is the honest answer.
 *   3. **An item directly under a cube category** (no type) belongs to no event
 *      and is therefore never a candidate: we cannot know which event it is.
 *   4. Preference order: the explicitly chosen cube, then a **Main** cube for
 *      that event, then the most recently used one.
 */

import type { CubeIdentity } from "@cubalyze/hardware-hal";
import { normalizeSmartId, smartIdsMatch } from "@cubalyze/database";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import { describeCubeModel, modelItemName } from "./cubeModelCatalog";
import type { CollectionState, GearItem } from "./collectionModel";

/**
 * Stored value meaning "no cube, on purpose". It is a deliberate choice, so it
 * must be distinguishable from "never chosen" (which falls back to a Main cube).
 */
export const NO_CUBE = "none";

/** Owned cubes of the Locker that belong to one event, in Locker order. */
export function cubesForEvent(state: CollectionState, eventCode: string): GearItem[] {
  const cubeCategoryIds = new Set(
    state.categories.filter((category) => category.kind === "cube").map((category) => category.id),
  );
  if (cubeCategoryIds.size === 0) return [];

  const typesOfEvent = new Set(
    state.types
      .filter((type) => type.puzzleCategory && puzzleCategoryToType(type.puzzleCategory) === eventCode)
      .map((type) => type.id),
  );

  return state.items.filter(
    (item) =>
      cubeCategoryIds.has(item.categoryId) &&
      item.status === "owned" &&
      item.typeId !== null &&
      typesOfEvent.has(item.typeId),
  );
}

/** True when the Locker item is a linked smart cube (SmarTube/BLE address set). */
export function isLinkedSmartCube(item: GearItem): boolean {
  return normalizeSmartId(item.smartId) !== null;
}

/**
 * Owned cubes for one event, plus — only for `222` with the "3×3 as 2×2"
 * opt-in — every owned LINKED smart 3×3 (SmarTube 3×3 used as 2×2).
 *
 * Non-smart 3×3 never leaks into 2×2, and 3×3 sessions never gain 2×2 cubes.
 * Order is Locker order: native 2×2 first, then the linked 3×3 smart cubes.
 */
export function cubesForEventWithSmartFallback(
  state: CollectionState,
  eventCode: string,
  includeLinked333: boolean,
): GearItem[] {
  const base = cubesForEvent(state, eventCode);
  if (eventCode !== "222" || !includeLinked333) return base;

  const seen = new Set(base.map((item) => item.id));
  const extra = cubesForEvent(state, "333").filter(
    (item) => !seen.has(item.id) && isLinkedSmartCube(item),
  );
  return [...base, ...extra];
}

/**
 * The connected smart cube in session terms.
 *
 * `event: null` is not "no cube" — it means *connected but not something the
 * app can name*: no Locker item carries the address, the address could not be
 * read, two items claim it, or the item is sold / has no event. `connected` is
 * what separates that from "nothing plugged in", and conflating the two was a
 * real hole in the gate: an unlinked 3×3 kept driving a 2×2 session.
 */
export interface SessionHardware {
  /** True when a smart cube is connected at the adapter level. */
  connected: boolean;
  /** Event of the Locker item it resolved to, or `null` when unresolved. */
  event: string | null;
}

/**
 * True when the connected smart cube must be IGNORED in the current session.
 *
 * The rule is deliberately one-sided: **in a 2×2 session, any connected smart
 * cube that is not KNOWN to be this event's hardware is foreign** — unless the
 * user opted into "3×3 as 2×2". That covers the three ways the connected cube
 * can be wrong for the session, not just the tidy one:
 *
 *   • it resolved to 333 (a 3×3 — the only supported smart cube);
 *   • it resolved to some OTHER event (a 3×3 filed under 3×3 OH, a custom
 *     type): the physical cube is still a 3×3, so it is still foreign;
 *   • it did not resolve at all (`event === null`). Every smart cube this app
 *     knows is a 3×3, so "connected but unknown" is treated as foreign rather
 *     than allowed to silently drive the 2×2 timer.
 *
 * A cube the Locker KNOWS is 222 (`event === "222"`) is never ignored, with the
 * opt-in on or off, and nothing connected never gates — so a real 2×2 smart
 * cube is untouched either way.
 *
 * Trade-off, stated plainly: a real 2×2 smart cube that is connected but not
 * filed in the Locker is also foreign until it is linked (one tap in the
 * Locker) or the opt-in is turned on. When a non-3×3 smart cube becomes
 * supported, its catalog entry is where this rule learns to stop assuming 3×3.
 */
export function shouldIgnoreSmartCubeForSession(
  sessionEvent: string,
  hardware: SessionHardware,
  use3x3As2x2: boolean,
): boolean {
  if (sessionEvent !== "222") return false;
  if (!hardware.connected) return false;
  // Known to be this session's hardware: never gate it.
  if (hardware.event === "222") return false;
  return !use3x3As2x2;
}

/**
 * The cube a solve of `eventCode` should be attributed to.
 *
 * `chosenId` is what the user picked on this device; `recentId` is the cube of
 * the most recent solve of that event (a fallback, not a preference);
 * `preferredId` is the cube the CONNECTED hardware IS (`hardwareLinkStore`),
 * which outranks both Locker fallbacks — the cube in your hand is a better
 * answer than "the Main one" or "the last one used". It never outranks an
 * explicit choice, and it only applies when it is a candidate for THIS event:
 * that is what keeps a linked 3×3 from being preferred for a 2×2 session while
 * the "3×3 as 2×2" opt-in is off (the widened candidate list already excludes
 * it). Anything that is not a candidate is ignored rather than trusted — that
 * is what keeps a sold cube, or a cube swiped from another event, from silently
 * mislabeling solves.
 */
export function resolveActiveCube(
  state: CollectionState,
  eventCode: string,
  chosenId?: string | null,
  recentId?: string | null,
  candidatesOverride?: GearItem[],
  preferredId?: string | null,
): GearItem | null {
  if (chosenId === NO_CUBE) return null;

  const candidates = candidatesOverride ?? cubesForEvent(state, eventCode);
  if (candidates.length === 0) return null;

  const byId = new Map(candidates.map((item) => [item.id, item]));
  const chosen = chosenId ? byId.get(chosenId) : undefined;
  if (chosen) return chosen;

  // Hardware first, then the Locker fallbacks. Gated hardware never reaches
  // here: the candidate list for a 2×2 with the opt-in off does not contain it.
  const preferred = preferredId ? byId.get(preferredId) : undefined;
  if (preferred) return preferred;

  const main = candidates.find((item) => item.primary);
  if (main) return main;

  const recent = recentId ? byId.get(recentId) : undefined;
  return recent ?? null;
}

/** The cube of the most recent solve that carries one, for a given event. */
export function latestCubeIdForEvent(
  solves: readonly { cubeId?: string; puzzleType?: string }[],
  eventCode: string,
): string | null {
  for (const solve of solves) {
    if (solve.cubeId && solve.puzzleType === eventCode) return solve.cubeId;
  }
  return null;
}

/** Short label for a cube chip / dock piece. */
export function cubeShortLabel(item: GearItem): string {
  const name = item.name.trim();
  return name.length > 0 ? name : (item.brand?.trim() || "Cube");
}

/**
 * What a solve should store about its cube. Empty when there is none — the
 * spread keeps the call sites honest (no `cubeId: undefined` noise) and the row
 * nullable, which is the truth for a virtual solve or an event without a
 * registered cube.
 */
export function cubeAttribution(cube: GearItem | null): { cubeId?: string; cubeLabel?: string } {
  return cube ? { cubeId: cube.id, cubeLabel: cubeShortLabel(cube) } : {};
}

/* -------------------------------------------------------------------------- */
/*  Hardware identity → the Locker item it IS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Why the connected hardware is NOT useful for attribution.
 *
 * `null` never appears here — a link that resolves has `reason: null` — so a
 * switch over this union is exhaustive for the failure path and the caller
 * cannot forget a case. Each value maps to one row of the rules table in
 * `Plan-Fase5-SmartCube-Locker-2026-09.md` §5.1.
 */
export type HardwareLinkReason =
  /** Nothing connected (or the adapter has no identity to offer). */
  | "disconnected"
  /** Connected, but we have no address to key the link on. */
  | "no-identity"
  /** The address is real, but no Locker item carries it yet. */
  | "unlinked"
  /** More than one item carries the same address (defensive; the link forbids it). */
  | "ambiguous"
  /** The item exists but is sold or lent — it is not in your hand. */
  | "not-owned"
  /** The item cannot belong to any event (no type, or not a cube). */
  | "no-event";

export interface HardwareLinkResult {
  item: GearItem | null;
  /** Event code (`333`, `222`, …) the item is bound to, when resolved. */
  event: string | null;
  reason: HardwareLinkReason | null;
  /**
   * Every item that carries this address: none, the one, or the clashing pair.
   * Kept alongside `reason` because the failure states are not anonymous — the
   * UI has to name the sold cube, or the two that collide, to be actionable.
   */
  matches: GearItem[];
}

/** All Locker items whose address is the connected cube's. */
export function matchingHardwareItems(state: CollectionState, identity: CubeIdentity): GearItem[] {
  return state.items.filter(
    (item) => item.smartId !== undefined && smartIdsMatch(item.smartId, identity.mac),
  );
}

/**
 * The event a Locker item belongs to, or `null` when it cannot belong to one.
 *
 * This deliberately mirrors `cubesForEvent` step for step — cube category, a
 * type, and that type's `puzzleCategory` — because the answer must agree with
 * the candidacy the rest of the app applies. An item directly under a cube
 * category has no type and therefore no event (rule 3 of this module): the app
 * cannot know which event it is, so it must never be attributed.
 */
export function eventForItem(state: CollectionState, item: GearItem): string | null {
  if (item.typeId === null) return null;
  const category = state.categories.find((candidate) => candidate.id === item.categoryId);
  if (!category || category.kind !== "cube") return null;
  const type = state.types.find((candidate) => candidate.id === item.typeId);
  if (!type || !type.puzzleCategory) return null;
  return puzzleCategoryToType(type.puzzleCategory);
}

/**
 * Turn the connected hardware into the Locker item it represents.
 *
 * This is the whole of the "hardware is just another source for attribution"
 * idea: it does not create anything, it does not write anything — it answers
 * "which of my cubes is this?" and leaves every consequence to the caller. Pure,
 * so each row of the rules table is a test.
 *
 * The address is compared through `smartIdsMatch`, not `===`, because the two
 * spellings are legitimate (`normalizeSmartId`): the protocol reads the address
 * backwards while a printed label does not. Both orders are accepted; see the
 * note on the risk in the plan (§2.2, R1).
 *
 * Ambiguity resolves to nothing on purpose. Two items sharing an address is a
 * state the link is designed to make impossible; if it ever happens (an import,
 * a hand-edited file), guessing would attribute solves to the wrong cube, and
 * the caller is expected to surface it so the user can fix it.
 */
export function resolveHardwareLink(
  state: CollectionState,
  identity: CubeIdentity | null,
): HardwareLinkResult {
  if (!identity) return { item: null, event: null, reason: "disconnected", matches: [] };
  if (!normalizeSmartId(identity.mac)) {
    return { item: null, event: null, reason: "no-identity", matches: [] };
  }

  const matches = matchingHardwareItems(state, identity);
  if (matches.length === 0) return { item: null, event: null, reason: "unlinked", matches };
  if (matches.length > 1) return { item: null, event: null, reason: "ambiguous", matches };

  const item = matches[0]!;
  if (item.status !== "owned") {
    return { item: null, event: null, reason: "not-owned", matches };
  }

  const event = eventForItem(state, item);
  if (!event) return { item: null, event: null, reason: "no-event", matches };

  return { item, event, reason: null, matches };
}

/**
 * The event every catalogued smart cube belongs to, for PROVISIONING only.
 *
 * This is not attribution (that is `eventForItem`, decided by the bound item's
 * type): it is the guess made when the app creates a Locker item for a cube it
 * has just met, and there is no item yet to ask. Every model the catalog knows
 * is a 3×3, so that is the answer; when a non-3×3 smart cube becomes supported,
 * the catalog gains an event and this constant disappears. Kept explicit so the
 * assumption is one line to find, not a `"333"` buried in a flow.
 */
export const SMART_CUBE_PROVISIONING_EVENT = "333";

/**
 * Items that plausibly ARE the connected cube but carry no address yet.
 *
 * This is what makes the automatic link clean instead of a duplicate factory:
 * a "GAN 12 ui" the user typed by hand last week is the same physical cube, so
 * it must be linked, not doubled. Matching is deliberately conservative —
 * brand and model must both agree, the item must be owned, in a cube category
 * and under a real type — because a wrong match silently steals a cube.
 *
 * More than one match is a legitimate answer (two identical cubes); the caller
 * offers a choice rather than guessing.
 */
export function findLinkCandidates(state: CollectionState, identity: CubeIdentity): GearItem[] {
  const described = describeCubeModel(identity.model);
  const modelNames = new Set(
    [described.label, described.rawName]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase()),
  );
  if (modelNames.size === 0) return [];
  const vendor = identity.vendor.trim().toLowerCase();

  return state.items.filter((item) => {
    if (item.smartId !== undefined) return false;
    if (item.status !== "owned") return false;

    const category = state.categories.find((candidate) => candidate.id === item.categoryId);
    if (!category || category.kind !== "cube") return false;

    const type = item.typeId ? state.types.find((candidate) => candidate.id === item.typeId) : null;
    if (!type || !type.puzzleCategory) return false;

    const model = (item.model ?? "").trim().toLowerCase();
    if (!model || !modelNames.has(model)) return false;

    // A brand the user typed must agree with the hardware; a missing one is not
    // a contradiction (plenty of items are filed without a brand).
    const brand = (item.brand ?? "").trim().toLowerCase();
    return brand === "" || vendor === "" || brand === vendor;
  });
}

/**
 * Where a cube discovered by hardware would be filed, and what it would be
 * called — or `null` when it cannot be filed at all.
 *
 * `null` is the honest answer to "nowhere to put it": the user excluded the
 * event from the Locker (there is no cube type of that event), the catalog has
 * no name for the model, or the Locker has no cube category. Creating an item
 * that no event can claim would produce a cube that receives no solves, which
 * is worse than asking.
 */
export function provisioningTarget(
  state: CollectionState,
  identity: CubeIdentity,
): { categoryId: string; typeId: string; name: string; model: string | null } | null {
  const described = describeCubeModel(identity.model);
  const baseName = modelItemName(described);
  if (!baseName) return null;

  const cubeCategoryIds = new Set(
    state.categories.filter((category) => category.kind === "cube").map((category) => category.id),
  );
  if (cubeCategoryIds.size === 0) return null;

  const type = state.types.find(
    (candidate) =>
      cubeCategoryIds.has(candidate.categoryId) &&
      candidate.puzzleCategory !== null &&
      puzzleCategoryToType(candidate.puzzleCategory) === SMART_CUBE_PROVISIONING_EVENT,
  );
  if (!type) return null;

  return {
    categoryId: type.categoryId,
    typeId: type.id,
    name: uniqueItemName(state, baseName),
    model: described.rawName,
  };
}

/**
 * `base`, or `base 2`, `base 3`… when the name is taken.
 *
 * Two cubes of the same model are two legitimate items, and the dock and the
 * selector have to be able to tell them apart. The user can rename afterwards;
 * what they must never see is two identical rows.
 */
export function uniqueItemName(state: CollectionState, base: string): string {
  const taken = new Set(state.items.map((item) => item.name.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

export interface HardwareLinkCandidates {
  /** Items that ARE this cube but carry no address yet (link, don't duplicate). */
  linkCandidates: GearItem[];
  /** If ownable, where a newly created item would go. */
  provision: { categoryId: string; typeId: string; name: string; model: string | null } | null;
}

/** Both answers the automatic link needs, computed from one state snapshot. */
export function planHardwareLink(
  state: CollectionState,
  identity: CubeIdentity,
): HardwareLinkCandidates {
  return {
    linkCandidates: findLinkCandidates(state, identity),
    provision: provisioningTarget(state, identity),
  };
}
