/**
 * collectionModel.ts — the data model behind the Locker (gear collection).
 *
 * The Locker is organised as a **two-level taxonomy**:
 *
 *   Category (outer)          Type (inner)            Item
 *   ────────────────          ────────────            ────
 *   Cubes (kind: cube)        3×3, 2×2, Pyraminx…     GAN 12, Valk 2…
 *   Lubes (kind: gear)        (no defaults)           Weight 5…
 *   Gear  (kind: gear)        (no defaults)           Timer, mat…
 *
 * The three built-in categories keep their English names as literal data —
 * they are product nouns (the same words the rest of the app uses in every
 * locale), not UI copy, so they are deliberately not translated.
 *
 * Categories and types are both user-created and fully editable. The default
 * "Cubes" category seeds its types from the app's **global puzzle categories**
 * (`@/utils/puzzleUtils`), minus the exclusions the user keeps (OH out of the
 * box). That bridge lives in `collectionStore.ts`, never here: this module is
 * pure data + pure functions, with no React and no I/O, so it is fully
 * unit-testable.
 *
 * "Main" marks the cube a solve would default to. It is only meaningful for
 * cube-kind categories, and several items of the same type may all be main
 * (a 3×3 main for OH *and* one for two-handed is a normal setup).
 */

import type { ParseKeys } from 'i18next';
import type { PuzzleCategory } from '@/types';

// ─── Taxonomy ────────────────────────────────────────────────────────────────

/**
 * What a category holds. `cube` categories render the isometric cube glyph and
 * may carry a "main" item; `gear` categories render a flat plate glyph.
 */
export type CategoryKind = 'cube' | 'gear';

/** Category kind → translation key (explicit map keeps i18next typed). */
export const KIND_I18N_KEY: Record<CategoryKind, ParseKeys<'collection'>> = {
  cube: 'kinds.cube',
  gear: 'kinds.gear',
};

export interface CollectionCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  /** Lucide icon id (see `CATEGORY_ICONS` in the view layer). */
  icon: string;
  /** Optional accent colour for the category chip. */
  accent?: string;
  createdAt: number;
}

export interface CollectionType {
  id: string;
  categoryId: string;
  name: string;
  /**
   * The app puzzle category this type mirrors (e.g. `"3x3"`) when it came from
   * the global selector, or `null` for a free-form type. Used to keep the
   * "mirror app categories" sync idempotent.
   */
  puzzleCategory: PuzzleCategory | null;
  createdAt: number;
}

// ─── Items ───────────────────────────────────────────────────────────────────

/**
 * Sticker colours of an item, in face order. The six standard faces come first
 * (U D F B R L, math-core face order); anything beyond them are extra faces the
 * user added for machinery with more (a Pyraminx has 4, a Megaminx 12).
 */
export type GearPalette = readonly string[];

/** The six standard faces, in the order the palette stores them. */
export const PALETTE_FACES = ['U', 'D', 'F', 'B', 'R', 'L'] as const;

export type PaletteFace = (typeof PALETTE_FACES)[number];

/** How many standard faces map onto the sides of a rendered cube. */
export const CUBE_FACE_COUNT = PALETTE_FACES.length;

/** Where an item stands in its lifecycle. */
export type ItemStatus = 'owned' | 'wishlist' | 'sold' | 'lent';

export const STATUS_I18N_KEY: Record<ItemStatus, ParseKeys<'collection'>> = {
  owned: 'status.owned',
  wishlist: 'status.wishlist',
  sold: 'status.sold',
  lent: 'status.lent',
};

/** Optional physical condition. */
export type ItemCondition = 'mint' | 'good' | 'used' | 'broken';

export const CONDITION_I18N_KEY: Record<ItemCondition, ParseKeys<'collection'>> = {
  mint: 'condition.mint',
  good: 'condition.good',
  used: 'condition.used',
  broken: 'condition.broken',
};

export interface GearLink {
  label: string;
  url: string;
}

export interface GearPrice {
  amount: number;
  currency: string;
}

export interface GearItem {
  id: string;
  categoryId: string;
  /** `null` ⇒ the item sits directly under its category, outside any type. */
  typeId: string | null;
  name: string;
  brand?: string;
  model?: string;
  /** Finish / colourway, e.g. "Stickerless", "Black". */
  finish?: string;
  /** Sticker colours in U D F B R L order. */
  palette: GearPalette;
  /** ISO date (YYYY-MM-DD). */
  acquiredAt?: string;
  price?: GearPrice;
  notes?: string;
  links: readonly GearLink[];
  /** Image URLs or small data URLs (localStorage-friendly). */
  photos: readonly string[];
  tags: readonly string[];
  status: ItemStatus;
  /** Marked as "main". Only honoured for cube categories. */
  primary: boolean;
  favorite: boolean;
  /** 0–5, rounds to whole stars. */
  rating?: number;
  quantity: number;
  condition?: ItemCondition;
  serial?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Whole-state ─────────────────────────────────────────────────────────────

export interface CollectionState {
  version: number;
  categories: CollectionCategory[];
  types: CollectionType[];
  items: GearItem[];
  /** Global puzzle categories the user keeps OUT of the cube types. */
  excludedCategories: PuzzleCategory[];
}

/** Bump when the persisted shape changes; `normalizeState` migrates older data. */
export const COLLECTION_VERSION = 1;

/** Global categories left out of the cube types on first run. */
export const DEFAULT_EXCLUDED_CATEGORIES: readonly PuzzleCategory[] = ['3x3 OH'];

/**
 * First-run category names that were shipped in Spanish before the Locker
 * settled on English product nouns. Used once, on restore, and only when the
 * stored name still matches exactly.
 */
export const LEGACY_SEED_NAMES: Record<string, string> = { Cubos: 'Cubes' };

/**
 * One global puzzle category offered by the app selector, resolved by the
 * store into the shape the model needs. Mirrors `PuzzleSelectorItem`.
 */
export interface GlobalCategoryOption {
  category: PuzzleCategory;
  /** Human label (the store resolves "3x3" → "3×3"). */
  name: string;
  /** True when a real scramble provider exists (playable today). */
  playable: boolean;
  /** True when the event is planned but not yet available. */
  planned: boolean;
}

// ─── Palette constants ───────────────────────────────────────────────────────

export const DEFAULT_PALETTE: GearPalette = [
  '#f8f8f8',
  '#ffd500',
  '#00a651',
  '#0051ba',
  '#c41e3a',
  '#ff5800',
];

/** Ready-made sticker schemes so a new item looks right in two clicks. */
export const PALETTE_PRESETS: readonly {
  id: string;
  labelKey: ParseKeys<'collection'>;
  palette: GearPalette;
}[] = [
  { id: 'standard', labelKey: 'palettes.standard', palette: DEFAULT_PALETTE },
  {
    id: 'stickerless',
    labelKey: 'palettes.stickerless',
    palette: ['#f2f2f2', '#ffe14d', '#00b45a', '#1f6feb', '#e5484d', '#ff7a18'],
  },
  {
    id: 'pastel',
    labelKey: 'palettes.pastel',
    palette: ['#f5f5f5', '#ffe9a8', '#b8e6c9', '#bcd7f5', '#f5b8b8', '#ffd2a8'],
  },
  {
    id: 'carbon',
    labelKey: 'palettes.carbon',
    palette: ['#2b2f33', '#1b1f23', '#3a4046', '#262b30', '#444b52', '#1f2429'],
  },
];

// ─── Identity helpers ────────────────────────────────────────────────────────

/** Stable, collision-resistant id with a readable prefix. */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `${prefix}_${random}`;
}

/** Trim, drop empties and de-duplicate case-insensitively, keeping first case. */
export function normalizeTags(tags: readonly string[]): string[] {  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

/**
 * Normalise a palette: always at least the six standard faces, every entry a
 * non-empty colour, extras kept in order.
 */
export function normalizePalette(palette: readonly string[] | undefined): string[] {
  const source =
    Array.isArray(palette) && palette.length >= CUBE_FACE_COUNT ? palette : DEFAULT_PALETTE;
  return source.map((colour, index) => colour || DEFAULT_PALETTE[index % CUBE_FACE_COUNT]);
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

/** Ids of the three built-in categories, so the UI can single out "Cubos". */
export const SEED_CATEGORY_IDS = {
  cubes: 'cat_cubes',
  lubes: 'cat_lubes',
  gear: 'cat_gear',
} as const;

/**
 * Build the first-run collection: three categories, and the cube types taken
 * from the app's global puzzle categories minus the exclusions. No items —
 * the Locker starts honestly empty and the user adds what they own.
 */
export function seedCollectionState(
  globalOptions: readonly GlobalCategoryOption[],
  excluded: readonly PuzzleCategory[] = DEFAULT_EXCLUDED_CATEGORIES,
  now = Date.now(),
): CollectionState {
  const excludedSet = new Set(excluded);
  const cubeTypes: CollectionType[] = globalOptions
    .filter((option) => option.playable && !excludedSet.has(option.category))
    .map((option) => ({
      id: newId('type'),
      categoryId: SEED_CATEGORY_IDS.cubes,
      name: option.name,
      puzzleCategory: option.category,
      createdAt: now,
    }));

  const categories: CollectionCategory[] = [
    { id: SEED_CATEGORY_IDS.cubes, name: 'Cubes', kind: 'cube', icon: 'Box', createdAt: now },
    { id: SEED_CATEGORY_IDS.lubes, name: 'Lubes', kind: 'gear', icon: 'Droplets', createdAt: now },
    { id: SEED_CATEGORY_IDS.gear, name: 'Gear', kind: 'gear', icon: 'Package', createdAt: now },
  ];

  return {
    version: COLLECTION_VERSION,
    categories,
    types: cubeTypes,
    items: [],
    excludedCategories: [...excluded],
  };
}

// ─── State helpers ───────────────────────────────────────────────────────────

export function categoryOf(
  state: CollectionState,
  categoryId: string | null | undefined,
): CollectionCategory | undefined {
  if (!categoryId) return undefined;
  return state.categories.find((category) => category.id === categoryId);
}

export function typeOf(
  state: CollectionState,
  typeId: string | null | undefined,
): CollectionType | undefined {
  if (!typeId) return undefined;
  return state.types.find((type) => type.id === typeId);
}

export function isCubeCategory(state: CollectionState, categoryId: string | null): boolean {
  return categoryOf(state, categoryId)?.kind === 'cube';
}

/** Types of a category, in creation order. */
export function typesOfCategory(state: CollectionState, categoryId: string): CollectionType[] {
  return state.types.filter((type) => type.categoryId === categoryId);
}

// ─── Category operations ─────────────────────────────────────────────────────

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string;
  accent?: string;
}

/** Create or update a category (an `id` in the input selects update mode). */
export function upsertCategory(
  state: CollectionState,
  input: CategoryInput & { id?: string; now?: number },
): CollectionState {
  const name = input.name.trim();
  if (!name) return state;
  const now = input.now ?? Date.now();
  const id = input.id ?? newId('cat');

  const existing = state.categories.find((c) => c.id === id);
  if (existing) {
    return {
      ...state,
      categories: state.categories.map((category) =>
        category.id === existing.id
          ? {
              ...category,
              name,
              kind: input.kind,
              icon: input.icon,
              accent: input.accent,
            }
          : category,
      ),
    };
  }

  const category: CollectionCategory = {
    id,
    name,
    kind: input.kind,
    icon: input.icon,
    accent: input.accent,
    createdAt: now,
  };
  return { ...state, categories: [...state.categories, category] };
}

/** Delete a category along with its types and its items. */
export function removeCategory(state: CollectionState, categoryId: string): CollectionState {
  return {
    ...state,
    categories: state.categories.filter((category) => category.id !== categoryId),
    types: state.types.filter((type) => type.categoryId !== categoryId),
    items: state.items.filter((item) => item.categoryId !== categoryId),
  };
}

// ─── Type operations ─────────────────────────────────────────────────────────

export interface TypeInput {
  categoryId: string;
  name: string;
  puzzleCategory?: PuzzleCategory | null;
}

/** Create or update a type (an `id` in the input selects update mode). */
export function upsertType(
  state: CollectionState,
  input: TypeInput & { id?: string; now?: number },
): CollectionState {
  const name = input.name.trim();
  if (!name) return state;
  const now = input.now ?? Date.now();
  const id = input.id ?? newId('type');

  const existing = state.types.find((t) => t.id === id);
  if (existing) {
    return {
      ...state,
      types: state.types.map((type) =>
        type.id === existing.id
          ? {
              ...type,
              name,
              categoryId: input.categoryId,
              puzzleCategory: input.puzzleCategory ?? null,
            }
          : type,
      ),
    };
  }

  const type: CollectionType = {
    id,
    categoryId: input.categoryId,
    name,
    puzzleCategory: input.puzzleCategory ?? null,
    createdAt: now,
  };
  return { ...state, types: [...state.types, type] };
}

/** Delete a type; its items move up to the category (typeId ⇒ null). */
export function removeType(state: CollectionState, typeId: string): CollectionState {
  return {
    ...state,
    types: state.types.filter((type) => type.id !== typeId),
    items: state.items.map((item) => (item.typeId === typeId ? { ...item, typeId: null } : item)),
  };
}

/** How many items live under a type (or directly under a category). */
export function countItemsInType(state: CollectionState, typeId: string): number {
  return state.items.filter((item) => item.typeId === typeId).length;
}

export function countItemsInCategory(state: CollectionState, categoryId: string): number {
  return state.items.filter((item) => item.categoryId === categoryId).length;
}

// ─── Item operations ─────────────────────────────────────────────────────────

export interface ItemInput {
  categoryId: string;
  typeId?: string | null;
  name: string;
  brand?: string;
  model?: string;
  finish?: string;
  palette?: GearPalette;
  acquiredAt?: string;
  price?: GearPrice;
  notes?: string;
  links?: readonly GearLink[];
  photos?: readonly string[];
  tags?: readonly string[];
  status?: ItemStatus;
  favorite?: boolean;
  /** "Main" flag. Silently dropped for non-cube categories. */
  primary?: boolean;
  rating?: number;
  quantity?: number;
  condition?: ItemCondition;
  serial?: string;
}

/** Create or update an item (an `id` in the input selects update mode). */
export function upsertItem(
  state: CollectionState,
  input: ItemInput & { id?: string; now?: number },
): CollectionState {
  const name = input.name.trim();
  if (!name) return state;
  const now = input.now ?? Date.now();
  const id = input.id ?? newId('item');

  const existing = state.items.find((i) => i.id === id);
  if (existing) {
    const updated: GearItem = {
      ...existing,
      categoryId: input.categoryId,
      typeId: input.typeId ?? null,
      name,
      brand: input.brand?.trim() || undefined,
      model: input.model?.trim() || undefined,
      finish: input.finish?.trim() || undefined,
      palette: normalizePalette(input.palette ?? existing.palette),
      acquiredAt: input.acquiredAt || undefined,
      price: input.price,
      notes: input.notes?.trim() || undefined,
      links: input.links ?? existing.links,
      photos: input.photos ?? existing.photos,
      tags: normalizeTags(input.tags ?? existing.tags),
      status: input.status ?? existing.status,
      favorite: input.favorite ?? existing.favorite,
      primary: isCubeCategory(state, input.categoryId)
        ? (input.primary ?? existing.primary)
        : false,
      rating: clampRating(input.rating ?? existing.rating),
      quantity: Math.max(1, Math.round(input.quantity ?? existing.quantity)),
      condition: input.condition,
      serial: input.serial?.trim() || undefined,
      updatedAt: now,
    };
    return { ...state, items: state.items.map((item) => (item.id === existing.id ? updated : item)) };
  }

  const item: GearItem = {
    id,
    categoryId: input.categoryId,
    typeId: input.typeId ?? null,
    name,
    brand: input.brand?.trim() || undefined,
    model: input.model?.trim() || undefined,
    finish: input.finish?.trim() || undefined,
    palette: normalizePalette(input.palette),
    acquiredAt: input.acquiredAt || undefined,
    price: input.price,
    notes: input.notes?.trim() || undefined,
    links: input.links ?? [],
    photos: input.photos ?? [],
    tags: normalizeTags(input.tags ?? []),
    status: input.status ?? 'owned',
    primary: isCubeCategory(state, input.categoryId) ? (input.primary ?? false) : false,
    favorite: input.favorite ?? false,
    rating: clampRating(input.rating),
    quantity: Math.max(1, Math.round(input.quantity ?? 1)),
    condition: input.condition,
    serial: input.serial?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, items: [...state.items, item] };
}

export function removeItem(state: CollectionState, itemId: string): CollectionState {
  return { ...state, items: state.items.filter((item) => item.id !== itemId) };
}

export function updateItem(
  state: CollectionState,
  itemId: string,
  patch: Partial<GearItem>,
): CollectionState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, ...patch, updatedAt: patch.updatedAt ?? Date.now() } : item,
    ),
  };
}

export function clampRating(rating: number | undefined): number | undefined {
  if (rating === undefined || Number.isNaN(rating)) return undefined;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

/**
 * Toggle the "main" flag. Only cube categories can carry a main, and the flag
 * is per item — a type may legitimately hold several mains (one for OH, one for
 * two-handed), so this never clears the flag on anything else.
 */
export function togglePrimary(state: CollectionState, itemId: string): CollectionState {
  const item = state.items.find((i) => i.id === itemId);
  if (!item || !isCubeCategory(state, item.categoryId)) return state;
  return updateItem(state, itemId, { primary: !item.primary });
}

/** Every main of one type (the grid badge, the category indicator). */
export function mainsOfType(state: CollectionState, typeId: string | null): GearItem[] {
  if (!typeId) return [];
  return state.items.filter((item) => item.typeId === typeId && item.primary);
}

/** Every main inside one category, in name order. */
export function mainsOfCategory(state: CollectionState, categoryId: string): GearItem[] {
  return state.items
    .filter((item) => item.categoryId === categoryId && item.primary)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 3D cube order for a type: 2×2 renders 2×2×2, everything else 3×3×3. Types
 * without a linked app category (a hand-made "4×4", a "Megaminx") simply get
 * the standard cube render.
 */
export function cubeOrderFor(puzzleCategory: PuzzleCategory | null | undefined): 2 | 3 {
  return puzzleCategory === '2x2' ? 2 : 3;
}

/**
 * Face → colour map for the 3D renderer: the six standard faces of the palette,
 * with the default scheme filling any gaps.
 */
export function cubeFaceColors(palette: GearPalette): Record<PaletteFace, string> {
  const result = {} as Record<PaletteFace, string>;
  PALETTE_FACES.forEach((face, index) => {
    result[face] = palette[index] || DEFAULT_PALETTE[index];
  });
  return result;
}

export function toggleFavorite(state: CollectionState, itemId: string): CollectionState {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return state;
  return updateItem(state, itemId, { favorite: !item.favorite });
}

/** Bulk-move items to another category/type (used by delete/category edits). */
export function moveItems(
  state: CollectionState,
  itemIds: readonly string[],
  categoryId: string,
  typeId: string | null,
): CollectionState {
  const ids = new Set(itemIds);
  return {
    ...state,
    items: state.items.map((item) =>
      ids.has(item.id) ? { ...item, categoryId, typeId, primary: false, updatedAt: Date.now() } : item,
    ),
  };
}

// ─── Exclusions + global sync ────────────────────────────────────────────────

/**
 * Mirror the app's global puzzle categories into a cube category:
 *   • every playable, non-excluded category gets a type (missing ones added);
 *   • excluded categories lose their type **only when it holds no items**, so
 *     an exclusion can never delete a curated item.
 * Free-form types the user created are never touched.
 */
export function syncCubeCategory(
  state: CollectionState,
  categoryId: string,
  globalOptions: readonly GlobalCategoryOption[],
  excluded: readonly PuzzleCategory[],
  now = Date.now(),
): CollectionState {
  const category = categoryOf(state, categoryId);
  if (!category || category.kind !== 'cube') return state;

  const excludedSet = new Set(excluded);
  const wanted = globalOptions.filter(
    (option) => option.playable && !excludedSet.has(option.category),
  );

  let types = state.types;

  // 1. Add missing mirrored types.
  for (const option of wanted) {
    const exists = types.some(
      (type) => type.categoryId === categoryId && type.puzzleCategory === option.category,
    );
    if (!exists) {
      types = [
        ...types,
        {
          id: newId('type'),
          categoryId,
          name: option.name,
          puzzleCategory: option.category,
          createdAt: now,
        },
      ];
    }
  }

  // 2. Drop excluded mirrored types that are empty.
  const itemTypeIds = new Set(state.items.map((item) => item.typeId));
  types = types.filter((type) => {
    if (type.categoryId !== categoryId || !type.puzzleCategory) return true;
    if (!excludedSet.has(type.puzzleCategory)) return true;
    return itemTypeIds.has(type.id);
  });

  if (types === state.types) return state;
  return { ...state, types, excludedCategories: [...excluded] };
}

/** Set the global-category exclusion list (kept on the state for the UI). */
export function setExcludedCategories(
  state: CollectionState,
  excluded: readonly PuzzleCategory[],
): CollectionState {
  return { ...state, excludedCategories: [...new Set(excluded)] };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export type ItemSort = 'name' | 'recent' | 'oldest' | 'price' | 'brand' | 'rating';

/** Which taxonomy node the grid is showing: `null`/`null` means "everything". */
export interface CollectionSelection {
  categoryId: string | null;
  typeId: string | null;
}

export interface ItemFilter {
  categoryId?: string | null;
  typeId?: string | null;
  status?: ItemStatus | 'all';
  tags?: readonly string[];
  query?: string;
  favoritesOnly?: boolean;
}

function matchesQuery(item: GearItem, haystack: string): boolean {
  if (!haystack) return true;
  const terms = haystack.toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [
    item.name,
    item.brand ?? '',
    item.model ?? '',
    item.finish ?? '',
    item.notes ?? '',
    item.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return terms.every((term) => fields.includes(term));
}

/** Filter the collection for the current view selection. */
export function queryItems(state: CollectionState, filter: ItemFilter = {}): GearItem[] {
  const tagSet = new Set((filter.tags ?? []).map((tag) => tag.toLowerCase()));
  return state.items.filter((item) => {
    if (filter.categoryId && item.categoryId !== filter.categoryId) return false;
    if (filter.typeId && item.typeId !== filter.typeId) return false;
    if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
    if (filter.favoritesOnly && !item.favorite) return false;
    if (tagSet.size > 0) {
      const itemTags = item.tags.map((tag) => tag.toLowerCase());
      if (!itemTags.some((tag) => tagSet.has(tag))) return false;
    }
    if (!matchesQuery(item, filter.query ?? '')) return false;
    return true;
  });
}

/**
 * Deterministic ordering. "Wishlist" items always sink below owned gear so the
 * grid reads as what you have first.
 */
export function sortItems(items: readonly GearItem[], sort: ItemSort = 'name'): GearItem[] {
  const statusRank: Record<ItemStatus, number> = { owned: 0, lent: 1, sold: 2, wishlist: 3 };
  return [...items].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    switch (sort) {
      case 'recent':
        return b.createdAt - a.createdAt;
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'price':
        return (b.price?.amount ?? -1) - (a.price?.amount ?? -1);
      case 'rating':
        return (b.rating ?? -1) - (a.rating ?? -1);
      case 'brand':
        return (a.brand ?? '').localeCompare(b.brand ?? '') || a.name.localeCompare(b.name);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

/** Every tag in use with its item count, sorted by frequency then name. */
export function tagFacets(state: CollectionState): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const item of state.items) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface CategoryNode {
  category: CollectionCategory;
  types: CollectionType[];
  count: number;
}

/** The taxonomy, flattened: categories with their types and item counts. */
export function buildCategoryTree(state: CollectionState): CategoryNode[] {
  return state.categories.map((category) => ({
    category,
    types: typesOfCategory(state, category.id),
    count: countItemsInCategory(state, category.id),
  }));
}

/** How many items match the active status/query — the header summary line. */
export function countByStatus(state: CollectionState): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = { owned: 0, wishlist: 0, sold: 0, lent: 0 };
  for (const item of state.items) counts[item.status] += 1;
  return counts;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Locale-aware date formatting; the caller supplies the locale tag. */
export function formatAcquired(iso: string | undefined, locale = 'en'): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatPrice(price: GearPrice | undefined, locale = 'en'): string | null {
  if (!price) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: price.currency,
    }).format(price.amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

// ─── Persistence hygiene ─────────────────────────────────────────────────────

/** Read a persisted blob, rejecting anything that is not a collection. */
export function normalizeState(raw: unknown): CollectionState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<CollectionState> & { state?: unknown; data?: unknown };
  // Tolerate an outer envelope: zustand persist writes `{ state }`, the store's
  // own `partialize` writes `{ data }`, and both must round-trip.
  const data = (candidate.state ?? candidate.data ?? candidate) as Partial<CollectionState>;
  if (!Array.isArray(data.categories) || !Array.isArray(data.items) || !Array.isArray(data.types)) {
    return null;
  }
  const now = Date.now();
  return {
    version: COLLECTION_VERSION,
    categories: data.categories.map((category) => ({
      id: category.id || newId('cat'),
      // Only the untouched default names are migrated — a category the user
      // renamed stays exactly as they typed it.
      name: (LEGACY_SEED_NAMES[category.name ?? ''] ?? category.name) || 'Category',
      kind: category.kind === 'cube' ? 'cube' : 'gear',
      // `Droplet` was never a real icon id — the Lubricant default pointed at
      // a component that does not exist, so it silently fell back to Package.
      icon: category.icon === 'Droplet' ? 'Droplets' : category.icon || 'Package',
      accent: category.accent,
      createdAt: category.createdAt ?? now,
    })),
    types: data.types.map((type) => ({
      id: type.id || newId('type'),
      categoryId: type.categoryId,
      name: type.name || 'Type',
      puzzleCategory: type.puzzleCategory ?? null,
      createdAt: type.createdAt ?? now,
    })),
    items: data.items.map((item) => ({
      ...item,
      id: item.id || newId('item'),
      palette:
        Array.isArray(item.palette) && item.palette.length >= CUBE_FACE_COUNT
          ? normalizePalette(item.palette)
          : [...DEFAULT_PALETTE],
      links: Array.isArray(item.links) ? item.links : [],
      photos: Array.isArray(item.photos) ? item.photos : [],
      tags: normalizeTags(Array.isArray(item.tags) ? item.tags : []),
      status: item.status ?? 'owned',
      primary: !!item.primary,
      favorite: !!item.favorite,
      quantity: item.quantity ?? 1,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
    })),
    excludedCategories: Array.isArray(data.excludedCategories) ? data.excludedCategories : [],
  };
}
