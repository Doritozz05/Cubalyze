"use client";

/**
 * collectionStore.ts — the Locker's state and its journey to the database.
 *
 * The collection is held as ONE in-memory object (`CollectionState`, the pure
 * model) and every edit produces a new one. The store's job is to keep that
 * object, and to make sure what it holds is what the database holds:
 *
 *   • `hydrate()` reads the rows once from SQLite (via `GearRepository`) and, on
 *     the very first run, performs the one-shot import of the old localStorage
 *     blob — photos included, converted into IndexedDB blobs.
 *   • Every action goes through `mutate`, which swaps in the new state and then
 *     persists only the DIFF against what the DB is known to hold. Untouched
 *     rows are never rewritten: a rewrite would bump every `updated_at` and, once
 *     the Locker syncs, would push the whole collection on every keystroke.
 *   • `dataRevision` (a local write, a sync pull, or another tab) triggers a
 *     re-read, which is how two tabs of the Locker stay in step. Reads always
 *     wait for the in-flight write chain, so a slow write can never be clobbered
 *     by a refresh that raced it.
 *
 * Photo BYTES never pass through here: they are blobs in IndexedDB
 * (`collectionPhotos.ts`) and the item rows keep references. When an item or a
 * category goes away, its photos are deleted with it, and the photo store's
 * orphan sweep covers the ones an abandoned editor left behind.
 *
 * `createCollectionStore` takes its connection as a parameter so the whole
 * orchestration is testable without a Worker/OPFS; the app uses the default
 * `useCollectionStore`, wired to `initDB`.
 */

import { create } from "zustand";
import {
  AppMetaRepository,
  GearRepository,
  initDB,
  type GearCategory,
  type GearCollectionSnapshot,
  type GearItem,
  type GearType,
} from "@cubeforge/database";
import { syncStore } from "@cubeforge/state";
import { requestSync } from "@/services/sync";
import { PUZZLE_SELECTOR, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import type { PuzzleCategory } from "@/types";
import {
  COLLECTION_VERSION,
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
  type GlobalCategoryOption,
  type ItemInput,
  type TypeInput,
} from "./collectionModel";
import { deleteItemPhotos, photoKey, pruneOrphanPhotos } from "./collectionPhotos";
import {
  deletionPlan,
  diffCollection,
  isDiffEmpty,
  sameStringArray,
  type CollectionDiff,
} from "./collectionPersistence";
import { readLockerFile } from "./collectionTransfer";

/** localStorage key of the PRE-database Locker (read once, then left alone). */
export const COLLECTION_STORAGE_KEY = "cubeforge-locker";

/** `app_meta` keys: the Locker's own device-level bookkeeping. */
const INITIALIZED_KEY = "locker_initialized";
const EXCLUDED_KEY = "locker_excluded_categories";

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

// ─── Connection (injectable) ───────────────────────────────────────────────

/**
 * The slice of `GearRepository` the store uses. Structural, so the real
 * repository satisfies it and a test double can too.
 */
export interface LockerRepository {
  loadAll(): Promise<GearCollectionSnapshot>;
  count(): Promise<{ categories: number; types: number; items: number }>;
  upsertCategory(category: GearCategory, opts?: { local?: boolean }): Promise<void>;
  upsertType(type: GearType, opts?: { local?: boolean }): Promise<void>;
  upsertItem(item: GearItem, opts?: { local?: boolean }): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  deleteType(id: string): Promise<void>;
  deleteItem(id: string): Promise<void>;
  replaceAll(snapshot: GearCollectionSnapshot, opts?: { local?: boolean }): Promise<void>;
}

export interface LockerMeta {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface LockerConnection {
  repo: LockerRepository;
  meta: LockerMeta;
}

export type LockerConnector = () => Promise<LockerConnection>;

/** Production connector: the shared SQLite worker. */
export const connectLockerDatabase: LockerConnector = async () => {
  const dbClient = await initDB();
  const executor = async (sql: string, bind?: unknown[]) => await dbClient.execute(sql, bind);
  return { repo: new GearRepository(executor), meta: new AppMetaRepository(executor) };
};

// ─── Row ↔ state ───────────────────────────────────────────────────────────

function toPuzzleCategory(value: string | null): PuzzleCategory | null {
  if (!value) return null;
  return GLOBAL_CATEGORY_OPTIONS.some((option) => option.category === value)
    ? (value as PuzzleCategory)
    : null;
}

function toState(snapshot: GearCollectionSnapshot, excluded: readonly PuzzleCategory[]): CollectionState {
  return {
    version: COLLECTION_VERSION,
    categories: snapshot.categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind === "cube" ? "cube" : "gear",
      icon: category.icon,
      ...(category.accent ? { accent: category.accent } : {}),
      createdAt: category.createdAt,
    })),
    types: snapshot.types.map((type) => ({
      id: type.id,
      categoryId: type.categoryId,
      name: type.name,
      puzzleCategory: toPuzzleCategory(type.puzzleCategory),
      createdAt: type.createdAt,
    })),
    items: snapshot.items.map((item) => ({ ...item })),
    excludedCategories: [...excluded],
  };
}

function toSnapshot(state: CollectionState): GearCollectionSnapshot {
  return {
    categories: state.categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      icon: category.icon,
      ...(category.accent ? { accent: category.accent } : {}),
      createdAt: category.createdAt,
    })),
    types: state.types.map((type) => ({
      id: type.id,
      categoryId: type.categoryId,
      name: type.name,
      puzzleCategory: type.puzzleCategory,
      createdAt: type.createdAt,
    })),
    items: state.items.map((item) => ({ ...item })),
  };
}

function parseExcluded(raw: string | null): PuzzleCategory[] {
  if (!raw) return [...DEFAULT_EXCLUDED_CATEGORIES];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_EXCLUDED_CATEGORIES];
    return parsed.filter(
      (value): value is PuzzleCategory =>
        typeof value === "string" &&
        GLOBAL_CATEGORY_OPTIONS.some((option) => option.category === value),
    );
  } catch {
    return [...DEFAULT_EXCLUDED_CATEGORIES];
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────

export interface CollectionStore {
  data: CollectionState;
  /** False until the database has answered (the view shows a skeleton). */
  hydrated: boolean;
  /** Load the collection from the database. Idempotent; safe to call twice. */
  hydrate: () => Promise<void>;

  addCategory: (input: CategoryInput) => string;
  updateCategory: (id: string, input: CategoryInput) => void;
  removeCategory: (id: string) => void;

  addType: (input: TypeInput) => string;
  updateType: (id: string, input: TypeInput) => void;
  removeType: (id: string) => void;

  addItem: (input: ItemInput & { id?: string }) => string;
  updateItem: (id: string, input: ItemInput) => void;
  patchItem: (id: string, patch: Partial<GearItem>) => void;
  removeItem: (id: string) => void;

  togglePrimary: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveItems: (ids: readonly string[], categoryId: string, typeId: string | null) => void;

  setExcluded: (excluded: readonly PuzzleCategory[]) => void;
  syncCategory: (categoryId: string) => void;

  /** Adopt an imported collection (already normalised and photo-restored). */
  replaceState: (state: unknown) => void;
  reset: () => void;
}

export type CollectionStoreApi = ReturnType<typeof createCollectionStore>;

export function createCollectionStore(connect: LockerConnector) {
  let connection: LockerConnection | null = null;
  /** The state the database is known to hold — the baseline every diff uses. */
  let persisted: CollectionState | null = null;
  /** Serialises writes; reads await it so a refresh cannot race a write. */
  let writeChain: Promise<void> = Promise.resolve();
  let hydrating: Promise<void> | null = null;
  let unsubscribeRevision: (() => void) | null = null;

  function enqueue(task: () => Promise<void>): void {
    writeChain = writeChain.then(task).catch((error: unknown) => {
      console.warn("[locker] write failed", error);
    });
  }

  /** Apply a diff to the database, then tell the app something changed. */
  function persist(prev: CollectionState, next: CollectionState): void {
    const base = persisted ?? prev;
    persisted = next;

    const diff = diffCollection(base, next);
    const excludedChanged = !sameStringArray(base.excludedCategories, next.excludedCategories);
    if (isDiffEmpty(diff) && !excludedChanged) return;

    const target = connection;
    enqueue(async () => {
      if (target) {
        await flushDiffWithRetry(target.repo, diff);
        if (excludedChanged) {
          await target.meta.set(EXCLUDED_KEY, JSON.stringify(next.excludedCategories));
        }
      }
      if (!isDiffEmpty(diff)) await requestSync();
    });
  }

  /** Re-read the database (a local write, a sync pull, or another tab). */
  async function reload(): Promise<void> {
    const target = connection;
    if (!target) return;
    await writeChain;
    try {
      const snapshot = await target.repo.loadAll();
      const current = useCollectionStore.getState().data;
      const next = toState(snapshot, current.excludedCategories);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      persisted = next;
      useCollectionStore.setState({ data: next });
    } catch {
      // A failed re-read keeps the current state; the next revision retries.
    }
  }

  const useCollectionStore = create<CollectionStore>()((set, get) => {
    const mutate = (mutator: (state: CollectionState) => CollectionState): void => {
      const prev = get().data;
      const next = mutator(prev);
      if (next === prev) return;
      set({ data: next });
      persist(prev, next);
    };

    return {
      data: createSeedState(),
      hydrated: false,

      hydrate: async () => {
        if (get().hydrated) return;
        if (hydrating) return hydrating;

        hydrating = (async () => {
          try {
            const connected = await connect();
            connection = connected;

            // First run on this device: adopt the pre-database Locker (if any),
            // otherwise start from the seeded taxonomy. Flagged in `app_meta`, so
            // a later "delete everything" is never undone by a re-seed.
            const initialized = (await connected.meta.get(INITIALIZED_KEY)) === "1";
            if (!initialized) {
              const adopted = await importLegacyLocker(connected.repo);
              let excludedCategories = adopted?.excludedCategories ?? DEFAULT_EXCLUDED_CATEGORIES;
              if (!adopted) {
                const counts = await connected.repo.count();
                if (counts.categories === 0 && counts.types === 0 && counts.items === 0) {
                  const seed = createSeedState();
                  await connected.repo.replaceAll(toSnapshot(seed), { local: true });
                  excludedCategories = seed.excludedCategories;
                }
              }
              // The exclusions are not rows: they are the taxonomy bridge's own
              // setting, so the adopted collection brings its list along.
              await connected.meta.set(EXCLUDED_KEY, JSON.stringify(excludedCategories));
              await connected.meta.set(INITIALIZED_KEY, "1");
            }

            const excluded = parseExcluded(await connected.meta.get(EXCLUDED_KEY));
            const state = toState(await connected.repo.loadAll(), excluded);
            persisted = state;
            set({ data: state, hydrated: true });

            // Photos nothing references are invisible to the diff (no row ever
            // pointed at them) — the orphan sweep is what reclaims them: an
            // abandoned editor's staging, or a photo an edit dropped without
            // saving. Bare item ids would not be enough, since most of them
            // belong to items that DO still exist.
            void pruneOrphanPhotos(
              state.items.flatMap((item) => item.photos.map((photo) => photoKey(item.id, photo.id))),
            ).catch(() => undefined);

            // Live cross-tab / cross-device refresh.
            if (!unsubscribeRevision) {
              unsubscribeRevision = syncStore.subscribe(() => {
                void reload();
              });
            }
          } catch (error) {
            // Something went wrong on the way in (no OPFS, no Worker, a failed
            // first import). The Locker shows the seeded taxonomy and stops
            // pretending it can save: the connection is dropped so no write is
            // ever attempted against a baseline that does not match the rows,
            // and the old localStorage blob stays untouched for a later run.
            console.warn("[locker] local database unavailable — the Locker is read-only", error);
            connection = null;
            persisted = null;
            set({ hydrated: true });
          }
        })();

        return hydrating;
      },

      addCategory: (input) => {
        const id = newId("cat");
        mutate((state) => upsertCategory(state, { ...input, id }));
        return id;
      },

      updateCategory: (id, input) => {
        mutate((state) => upsertCategory(state, { ...input, id }));
      },

      removeCategory: (id) => {
        mutate((state) => removeCategoryOp(state, id));
      },

      addType: (input) => {
        const id = newId("type");
        mutate((state) => upsertType(state, { ...input, id }));
        return id;
      },

      updateType: (id, input) => {
        mutate((state) => upsertType(state, { ...input, id }));
      },

      removeType: (id) => {
        mutate((state) => removeTypeOp(state, id));
      },

      addItem: (input) => {
        const id = input.id ?? newId("item");
        mutate((state) => upsertItem(state, { ...input, id }));
        return id;
      },

      updateItem: (id, input) => {
        mutate((state) => upsertItem(state, { ...input, id }));
      },

      patchItem: (id, patch) => {
        mutate((state) => updateItemOp(state, id, patch));
      },

      removeItem: (id) => {
        mutate((state) => removeItemOp(state, id));
      },

      togglePrimary: (id) => {
        mutate((state) => togglePrimaryOp(state, id));
      },

      toggleFavorite: (id) => {
        mutate((state) => toggleFavoriteOp(state, id));
      },

      moveItems: (ids, categoryId, typeId) => {
        mutate((state) => moveItemsOp(state, ids, categoryId, typeId));
      },

      setExcluded: (excluded) => {
        mutate((state) => setExcludedCategories(state, excluded));
      },

      syncCategory: (categoryId) => {
        mutate((state) =>
          syncCubeCategory(state, categoryId, GLOBAL_CATEGORY_OPTIONS, state.excludedCategories),
        );
      },

      replaceState: (state) => {
        const normalized = normalizeState(state);
        if (normalized) mutate(() => normalized);
      },

      reset: () => {
        mutate(() => createSeedState());
      },
    };
  });

  return useCollectionStore;
}

// ─── Persistence helpers ───────────────────────────────────────────────────

/**
 * `flushDiff` with one retry.
 *
 * Local storage can fail transiently (the pool is momentarily locked while the
 * sync engine or another tab works). Every write here is idempotent, so a second
 * identical attempt is free — and an edit silently missing from the database is
 * not something the user can see or fix. A second failure propagates and is
 * reported.
 */
async function flushDiffWithRetry(repo: LockerRepository, diff: CollectionDiff): Promise<void> {
  try {
    await flushDiff(repo, diff);
    return;
  } catch (error) {
    console.warn("[locker] write failed, retrying once", error);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  await flushDiff(repo, diff);
}

async function flushDiff(repo: LockerRepository, diff: CollectionDiff): Promise<void> {
  for (const category of diff.categories.upsert) await repo.upsertCategory(category, { local: true });
  for (const type of diff.types.upsert) await repo.upsertType(type, { local: true });
  for (const item of diff.items.upsert) await repo.upsertItem(item, { local: true });

  // Children before parents: the schema cascades, but issuing each delete keeps
  // every statement meaningful and the photo cleanup below in sync with it.
  for (const step of deletionPlan(diff)) {
    if (step.table === "items") await repo.deleteItem(step.id);
    else if (step.table === "types") await repo.deleteType(step.id);
    else await repo.deleteCategory(step.id);
  }
  for (const id of diff.items.remove) await deleteItemPhotos(id);
}

/**
 * One-shot import of the pre-database Locker, returning the adopted collection
 * (or `null` when there was nothing to adopt).
 *
 * The localStorage key is deliberately NOT cleared: if the import half-fails the
 * data is still there, and a user who never opens the Locker again loses nothing.
 * An existing database wins — rows mean the Locker already lives in SQLite
 * (another device, or a previous run that imported fine), and a stale blob must
 * never overwrite them.
 */
async function importLegacyLocker(repo: LockerRepository): Promise<CollectionState | null> {
  let text: string | null = null;
  try {
    text = localStorage.getItem(COLLECTION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;

  const counts = await repo.count();
  if (counts.categories > 0 || counts.types > 0 || counts.items > 0) return null;

  try {
    const { state } = await readLockerFile(text);
    await repo.replaceAll(toSnapshot(state), { local: true });
    return state;
  } catch (error) {
    console.warn("[locker] could not import the pre-database collection", error);
    return null;
  }
}

/** Convenience selector: how many items a category holds. */
export function selectCategoryCount(state: CollectionState, categoryId: string): number {
  return countItemsInCategory(state, categoryId);
}

/** The app-wide singleton, wired to the shared SQLite worker. */
export const useCollectionStore = createCollectionStore(connectLockerDatabase);
