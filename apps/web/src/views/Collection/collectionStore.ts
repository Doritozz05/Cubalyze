"use client";

/**
 * collectionStore.ts — the persisted Locker store.
 *
 * The only I/O in the feature: the whole collection (categories, types, items,
 * exclusions) is a single zustand store persisted to **localStorage** under
 * `cubeforge-locker`. No database, by design — the Locker is a personal,
 * offline-first surface and it must work on a cold, offline load.
 *
 * This file is the **bridge** between the pure model and the app: it resolves
 * the global puzzle categories (`@/utils/puzzleUtils`) into the options the
 * taxonomy seeds from. The model stays pure and testable; only this module
 * knows about the app's event registry.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PUZZLE_SELECTOR, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import type { PuzzleCategory } from "@/types";
import {
  DEFAULT_EXCLUDED_CATEGORIES,
  countItemsInCategory,
  moveItems as moveItemsOp,
  newId,
  normalizeState,
  removeCategory as removeCategoryOp,
  removeItem as removeItemOp,
  removeType as removeTypeOp,
  seedCollectionState,
  setExcludedCategories,
  syncCubeCategory,
  toggleFavorite as toggleFavoriteOp,
  togglePrimary as togglePrimaryOp,
  updateItem as updateItemOp,
  upsertCategory,
  upsertItem,
  upsertType,
  type CategoryInput,
  type CollectionState,
  type GearItem,
  type GlobalCategoryOption,
  type ItemInput,
  type TypeInput,
} from "./collectionModel";

/** localStorage key (zustand persists a `{ state, version }` envelope here). */
export const COLLECTION_STORAGE_KEY = "cubeforge-locker";

/**
 * The app's global puzzle categories, resolved once for the taxonomy bridge.
 * `PUZZLE_SELECTOR` is the same list the timer's puzzle dropdown shows.
 */
export const GLOBAL_CATEGORY_OPTIONS: readonly GlobalCategoryOption[] = PUZZLE_SELECTOR.map(
  (item) => ({
    category: item.category,
    name: puzzleTypeLabel(puzzleCategoryToType(item.category)),
    playable: item.playable,
    planned: item.planned,
  }),
);

/** Fresh first-run state, seeded from the global categories. */
function createSeedState(): CollectionState {
  return seedCollectionState(GLOBAL_CATEGORY_OPTIONS, DEFAULT_EXCLUDED_CATEGORIES);
}

export interface CollectionStore {
  data: CollectionState;
  /** False until localStorage has been read (first paint shows a skeleton). */
  hydrated: boolean;

  addCategory: (input: CategoryInput) => string;
  updateCategory: (id: string, input: CategoryInput) => void;
  removeCategory: (id: string) => void;

  addType: (input: TypeInput) => string;
  updateType: (id: string, input: TypeInput) => void;
  removeType: (id: string) => void;

  addItem: (input: ItemInput) => string;
  updateItem: (id: string, input: ItemInput) => void;
  patchItem: (id: string, patch: Partial<GearItem>) => void;
  removeItem: (id: string) => void;

  togglePrimary: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveItems: (ids: readonly string[], categoryId: string, typeId: string | null) => void;

  setExcluded: (excluded: readonly PuzzleCategory[]) => void;
  syncCategory: (categoryId: string) => void;

  replaceState: (state: CollectionState) => void;
  reset: () => void;
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      data: createSeedState(),
      hydrated: false,

      addCategory: (input) => {
        const id = newId("cat");
        set({ data: upsertCategory(get().data, { ...input, id }) });
        return id;
      },

      updateCategory: (id, input) => {
        set({ data: upsertCategory(get().data, { ...input, id }) });
      },

      removeCategory: (id) => {
        set({ data: removeCategoryOp(get().data, id) });
      },

      addType: (input) => {
        const id = newId("type");
        set({ data: upsertType(get().data, { ...input, id }) });
        return id;
      },

      updateType: (id, input) => {
        set({ data: upsertType(get().data, { ...input, id }) });
      },

      removeType: (id) => {
        set({ data: removeTypeOp(get().data, id) });
      },

      addItem: (input) => {
        const id = newId("item");
        set({ data: upsertItem(get().data, { ...input, id }) });
        return id;
      },

      updateItem: (id, input) => {
        set({ data: upsertItem(get().data, { ...input, id }) });
      },

      patchItem: (id, patch) => {
        set({ data: updateItemOp(get().data, id, patch) });
      },

      removeItem: (id) => {
        set({ data: removeItemOp(get().data, id) });
      },

      togglePrimary: (id) => {
        set({ data: togglePrimaryOp(get().data, id) });
      },

      toggleFavorite: (id) => {
        set({ data: toggleFavoriteOp(get().data, id) });
      },

      moveItems: (ids, categoryId, typeId) => {
        set({ data: moveItemsOp(get().data, ids, categoryId, typeId) });
      },

      setExcluded: (excluded) => {
        set({ data: setExcludedCategories(get().data, excluded) });
      },

      syncCategory: (categoryId) => {
        const state = get().data;
        set({
          data: syncCubeCategory(
            state,
            categoryId,
            GLOBAL_CATEGORY_OPTIONS,
            state.excludedCategories,
          ),
        });
      },

      replaceState: (state) => {
        const normalized = normalizeState(state);
        if (normalized) set({ data: normalized });
      },

      reset: () => {
        set({ data: createSeedState() });
      },
    }),
    {
      name: COLLECTION_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only the data — never the functions.
      partialize: (store) => ({ data: store.data }),
      // Tolerate partial/legacy blobs: normalise on the way in, and fall back
      // to the seeded state when nothing usable was stored.
      merge: (persisted, current) => {
        const envelope = persisted as { data?: unknown } | undefined;
        const restored = normalizeState(envelope?.data);
        return { ...current, data: restored ?? current.data };
      },
      onRehydrateStorage: () => () => {
        // Flip the flag even when nothing was stored (first run), so the view
        // never waits on a rehydration that will not happen.
        //
        // Deferred by a microtask on purpose: with a synchronous storage this
        // callback fires *inside* `create(...)`, while `useCollectionStore` is
        // still in its temporal dead zone — referencing it there would throw.
        queueMicrotask(() => useCollectionStore.setState({ hydrated: true }));
      },
    },
  ),
);

/** Convenience selector: how many items a category holds. */
export function selectCategoryCount(state: CollectionState, categoryId: string): number {
  return countItemsInCategory(state, categoryId);
}
