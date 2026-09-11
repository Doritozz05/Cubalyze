/**
 * collectionModel.ts — the data model behind the Locker (gear collection).
 *
 * EXPERIMENTAL (branch `exp/cube-collection`).
 *
 * Design goals, in order:
 *
 *   1. **Gear, not just cubes.** The item carries a `kind`, so the same view
 *      can hold cubes, timers, mats, lube… The cube is simply the kind that
 *      gets a full 3D-colour glyph today.
 *   2. **A persistence seam that costs nothing.** `CollectionSource` is the one
 *      place the view reads items from. Today the only implementation is the
 *      read-only sample catalog below; a future SQLite-backed source (the repo
 *      already runs SQLite-WASM in a worker, with one repository per domain)
 *      implements the same interface and the view does not change. That is why
 *      nothing here touches the database: the seam is the deliverable.
 *   3. **Deterministic presentation.** A given item id always renders the same
 *      cube pattern (`stickerStateFor`), so the grid is stable across renders
 *      and reloads without storing anything.
 *
 * No React, no I/O — pure data + pure functions, so it is unit-testable.
 */

import type { ParseKeys } from 'i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

/** What the item is. Only `cube` has a 3D glyph today; the rest degrade to a
 *  neutral card so the model can grow into full gear without a migration. */
export type GearKind = 'cube' | 'timer' | 'mat' | 'lube' | 'other';

/** Sticker palette per face, in U D F B R L order (the math-core face order). */
export type GearPalette = readonly [string, string, string, string, string, string];

/** Kind → translation key. A single explicit map (rather than a template
 *  literal at each call site) so i18next keeps type-checking the keys. */
export const KIND_I18N_KEY: Record<GearKind, ParseKeys<'collection'>> = {
  cube: 'kinds.cube',
  timer: 'kinds.timer',
  mat: 'kinds.mat',
  lube: 'kinds.lube',
  other: 'kinds.other',
};

/** Face index into {@link GearPalette} — named so call sites read like the
 *  cube does instead of using bare 0–5. */
export const FACE = { U: 0, D: 1, F: 2, B: 3, R: 4, L: 5 } as const;

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
  kind: GearKind;
  name: string;
  brand?: string;
  model?: string;
  /** Puzzle size or form factor, e.g. "3×3", "2×2", "Pyraminx". */
  size?: string;
  /** Sticker colours in U D F B R L order. */
  palette: GearPalette;
  /** ISO date (YYYY-MM-DD). */
  acquiredAt?: string;
  price?: GearPrice;
  notes?: string;
  links?: readonly GearLink[];
  /** Image URLs (remote or data). Empty ⇒ the view shows the glyph instead. */
  photos?: readonly string[];
  tags?: readonly string[];
  /** The cube your solves default to. Assignment to a session is a later phase. */
  primary?: boolean;
}

/**
 * The single read seam for the collection. The view never imports the sample
 * catalog directly, so swapping in a persisted source later is a one-line
 * change at the composition root (see `loadCollection`).
 */
export interface CollectionSource {
  /** Every item the user owns. Order is not significant — the view sorts. */
  list(): Promise<readonly GearItem[]>;
}

/** Read-only source backed by the bundled sample catalog. */
export function sampleCollectionSource(items: readonly GearItem[]): CollectionSource {
  return { list: async () => items };
}

// ─── Sample catalog ──────────────────────────────────────────────────────────
//
// PLACEHOLDER CONTENT. These are illustrative entries so the view has something
// to render; they are NOT claims about the user's gear. The UI labels them as
// sample data and the source seam above is what will replace them.

export const SAMPLE_GEAR: readonly GearItem[] = [
  {
    id: 'gan-12-ui-freeplay',
    kind: 'cube',
    name: 'GAN 12 UI FreePlay',
    brand: 'GAN',
    model: '12 UI FreePlay',
    size: '3×3',
    palette: ['#F8F8F8', '#FFD500', '#00A651', '#0051BA', '#C41E3A', '#FF5800'],
    acquiredAt: '2026-01-18',
    price: { amount: 89.9, currency: 'EUR' },
    primary: true,
    tags: ['smart', 'flagship'],
    notes: 'The cube every solve is timed with. Magnets on the strongest '
      + 'setting; tensioned slightly loose for M-slice work.',
    links: [{ label: 'Manual', url: 'https://gancube.com' }],
  },
  {
    id: 'gan-356-m-pro',
    kind: 'cube',
    name: 'GAN 356 M Pro',
    brand: 'GAN',
    model: '356 M Pro',
    size: '3×3',
    palette: ['#FFFFFF', '#FFD500', '#009B48', '#0045AD', '#B90000', '#FF5900'],
    acquiredAt: '2025-08-02',
    price: { amount: 42, currency: 'EUR' },
    tags: ['magnetic', 'daily'],
    notes: 'Backup main. Stickerless, light magnets.',
  },
  {
    id: 'rs3m-2020',
    kind: 'cube',
    name: 'MoYu RS3 M 2020',
    brand: 'MoYu',
    model: 'RS3 M 2020',
    size: '3×3',
    palette: ['#FAFAFA', '#FFD500', '#00A651', '#0051BA', '#C41E3A', '#FF5800'],
    acquiredAt: '2025-03-11',
    price: { amount: 12.5, currency: 'EUR' },
    tags: ['budget', 'beater'],
    notes: 'The one that lives in the bag.',
  },
  {
    id: 'valk-2-m',
    kind: 'cube',
    name: 'Valk 2 M',
    brand: 'QiYi',
    model: 'Valk 2 M',
    size: '2×2',
    palette: ['#F5F5F5', '#FFD500', '#00A651', '#0051BA', '#C41E3A', '#FF5800'],
    acquiredAt: '2025-05-20',
    price: { amount: 18, currency: 'EUR' },
    tags: ['2x2', 'magnetic'],
    notes: 'Used for the 2×2 sessions and Ortega drills.',
  },
  {
    id: 'mgc-4',
    kind: 'cube',
    name: 'MGC 4×4',
    brand: 'YJ',
    model: 'MGC 4',
    size: '4×4',
    palette: ['#FFFFFF', '#FFE14D', '#00A651', '#0B5FBF', '#D62828', '#F77F00'],
    acquiredAt: '2025-11-07',
    tags: ['big cube'],
  },
  {
    id: 'mgc-5',
    kind: 'cube',
    name: 'MGC 5×5',
    brand: 'YJ',
    model: 'MGC 5',
    size: '5×5',
    palette: ['#FFFFFF', '#FFE14D', '#009B48', '#0051BA', '#B90000', '#FF5900'],
    acquiredAt: '2025-12-24',
    tags: ['big cube'],
  },
  {
    id: 'qiyi-pyraminx',
    kind: 'cube',
    name: 'QiYi Pyraminx',
    brand: 'QiYi',
    model: 'QY Pyraminx',
    size: 'Pyraminx',
    palette: ['#FFD500', '#FFFFFF', '#00A651', '#0051BA', '#C41E3A', '#FF5800'],
    acquiredAt: '2025-06-15',
    tags: ['non-cube'],
  },
  {
    id: 'gan-smart-timer',
    kind: 'timer',
    name: 'GAN Smart Timer',
    brand: 'GAN',
    model: 'Bluetooth Timer',
    palette: ['#2B2F33', '#1B1F23', '#3A4046', '#262B30', '#444B52', '#1F2429'],
    acquiredAt: '2025-09-30',
    price: { amount: 39, currency: 'EUR' },
    notes: 'Pairs with the app over Bluetooth for stackmat-style starts.',
  },
  {
    id: 'thecube-mat',
    kind: 'mat',
    name: 'TheCubicle Competition Mat',
    brand: 'TheCubicle',
    palette: ['#1F2937', '#111827', '#374151', '#0F172A', '#4B5563', '#1E293B'],
    acquiredAt: '2025-04-09',
    tags: ['setup'],
  },
  {
    id: 'lube-maruloxo',
    kind: 'lube',
    name: 'Weight 5 Lube',
    brand: 'Lubicle',
    model: 'Weight 5',
    palette: ['#F1F5F9', '#CBD5E1', '#94A3B8', '#E2E8F0', '#64748B', '#CBD5E1'],
    acquiredAt: '2025-10-12',
    notes: 'Used sparingly on the core.',
  },
  {
    id: 'toolkit-screwdriver',
    kind: 'other',
    name: 'Precision Screwdriver Set',
    brand: 'Generic',
    palette: ['#D1D5DB', '#9CA3AF', '#6B7280', '#E5E7EB', '#4B5563', '#9CA3AF'],
    acquiredAt: '2025-02-01',
    tags: ['tools'],
  },
];

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Display order for kinds — cubes first (they are the point), then the rest. */
const KIND_ORDER: readonly GearKind[] = ['cube', 'timer', 'mat', 'lube', 'other'];

export function kindRank(kind: GearKind): number {
  const i = KIND_ORDER.indexOf(kind);
  return i === -1 ? KIND_ORDER.length : i;
}

/**
 * Stable, human-meaningful ordering: cubes first, then the main cube, then by
 * name. Kept deterministic (never depends on insertion order) so the rail does
 * not reshuffle between renders.
 */
export function sortGear(items: readonly GearItem[]): GearItem[] {
  return [...items].sort((a, b) => {
    const byKind = kindRank(a.kind) - kindRank(b.kind);
    if (byKind !== 0) return byKind;
    if (a.kind === 'cube' && b.kind === 'cube' && a.primary !== b.primary) {
      return a.primary ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/** The item marked as primary, if any. */
export function primaryItem(items: readonly GearItem[]): GearItem | undefined {
  return items.find((i) => i.primary);
}

/** How many items of each kind — powers the small counts in the header. */
export function countByKind(items: readonly GearItem[]): Record<GearKind, number> {
  const counts: Record<GearKind, number> = { cube: 0, timer: 0, mat: 0, lube: 0, other: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

// ─── Deterministic sticker state ─────────────────────────────────────────────

/** cyrb53-style string hash → 32-bit unsigned. Fast and good enough for seeds. */
export function hashString(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) % 4294967296;
}

/** mulberry32 — tiny, deterministic PRNG. Same seed ⇒ same cube pattern. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 6 faces × 9 stickers (row-major), U D F B R L order. */
export type StickerState = readonly (readonly string[])[];

/** A sticker that never moves: the centre defines the face. */
const CENTRE = 4;

/**
 * Build the cube pattern an item renders with.
 *
 * Every face starts monochrome, then a seeded number of stickers are swapped
 * between **different** faces — leaving the six centres alone so the cube still
 * reads as "this cube, in its own colour scheme, in the middle of a solve".
 * Purely cosmetic: this is a picture, not a legal cube state.
 */
export function stickerStateFor(item: GearItem, swaps = 5): StickerState {
  const rng = mulberry32(hashString(item.id));
  const faces: string[][] = item.palette.map((colour) => new Array<string>(9).fill(colour));

  let done = 0;
  let guard = 0;
  while (done < swaps && guard < swaps * 20) {
    guard += 1;
    const fromFace = Math.floor(rng() * 6);
    const toFace = Math.floor(rng() * 6);
    const fromCell = Math.floor(rng() * 9);
    const toCell = Math.floor(rng() * 9);
    if (fromFace === toFace) continue;
    if (fromCell === CENTRE || toCell === CENTRE) continue;

    const tmp = faces[fromFace][fromCell];
    faces[fromFace][fromCell] = faces[toFace][toCell];
    faces[toFace][toCell] = tmp;
    done += 1;
  }

  return faces;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Localised-agnostic date formatting; the caller supplies the locale tag. */
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

// ─── Composition root ────────────────────────────────────────────────────────

/**
 * The only place the view obtains a source. Swapping the sample catalog for a
 * persisted collection is a change **here**, not in the UI.
 */
export function loadCollection(): Promise<readonly GearItem[]> {
  return sampleCollectionSource(SAMPLE_GEAR).list();
}
