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

import { puzzleCategoryToType } from "@/utils/puzzleUtils";
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

/**
 * The cube a solve of `eventCode` should be attributed to.
 *
 * `chosenId` is what the user picked on this device; `recentId` is the cube of
 * the most recent solve of that event (a fallback, not a preference). Anything
 * that is not a candidate is ignored rather than trusted — that is what keeps a
 * sold cube, or a cube swiped from another event, from silently mislabeling
 * solves.
 */
export function resolveActiveCube(
  state: CollectionState,
  eventCode: string,
  chosenId?: string | null,
  recentId?: string | null,
): GearItem | null {
  if (chosenId === NO_CUBE) return null;

  const candidates = cubesForEvent(state, eventCode);
  if (candidates.length === 0) return null;

  const byId = new Map(candidates.map((item) => [item.id, item]));
  const chosen = chosenId ? byId.get(chosenId) : undefined;
  if (chosen) return chosen;

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
