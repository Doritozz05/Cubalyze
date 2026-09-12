/**
 * @cubeforge/database — Gear (Locker) Repository
 *
 * Persists the Locker collection to SQLite: `gear_categories` → `gear_types` →
 * `gear_items` (migration 034). This replaces the legacy single localStorage
 * JSON blob (`cubeforge-locker`), whose ~5 MB origin quota capped the whole
 * collection at a handful of photos and could not be queried, backed up or
 * synced.
 *
 * ONE repository for the three tables because they are one aggregate: a type
 * only exists inside a category, an item lives in a category (optionally in one
 * of its types), and the UI never touches one without the others. The domain
 * shapes below are structurally identical to the model in
 * `apps/web/src/views/Collection/collectionModel.ts`, so the web layer passes
 * its objects straight through — no mapping layer to drift.
 *
 * Follows the same pattern as CalendarRepository / SolvesRepository:
 * `{ local: true }` on local edit paths takes a monotonic stamp from the shared
 * write clock (local-clock.ts), so an edit that keeps a row's old `updated_at`
 * cannot be skipped by the sync push cursor.
 *
 * Photos are NOT here: `photos` holds references (id + natural size) and the
 * bytes live as blobs in IndexedDB (see the web-side photo store). Base64 in a
 * row costs ~2× and would travel to the cloud.
 */

import { nextLocalStamps } from './local-clock.js';
import { withTransaction } from './transaction.js';

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

// ─── Domain types (camelCase, mirrored by the web model) ──────────────────

export type GearCategoryKind = 'cube' | 'gear';
export type GearItemStatus = 'owned' | 'wishlist' | 'sold' | 'lent';
export type GearItemCondition = 'mint' | 'good' | 'used' | 'broken';

export interface GearCategory {
  id: string;
  name: string;
  kind: GearCategoryKind;
  /** Lucide icon id (resolved by the view layer). */
  icon: string;
  /** Optional accent colour for the category chip. */
  accent?: string;
  createdAt: number;
}

export interface GearType {
  id: string;
  categoryId: string;
  name: string;
  /**
   * The app puzzle category this type mirrors (e.g. `"3x3"`, `"3x3 OH"`) when
   * it came from the global selector, or `null` for a free-form type.
   */
  puzzleCategory: string | null;
  createdAt: number;
}

export interface GearPrice {
  amount: number;
  currency: string;
}

export interface GearLink {
  label: string;
  url: string;
}

/**
 * A reference to a photo whose bytes live in IndexedDB. The row only needs the
 * identity, the natural size (to reserve layout space before the blob loads)
 * and when it was added.
 */
export interface GearPhotoRef {
  id: string;
  width: number;
  height: number;
  addedAt: number;
}

export interface GearItem {
  id: string;
  categoryId: string;
  /** `null` ⇒ the item sits directly under its category, outside any type. */
  typeId: string | null;
  name: string;
  brand?: string;
  model?: string;
  finish?: string;
  /** Sticker colours in U D F B R L order (extra faces append after). */
  palette: readonly string[];
  /** ISO date (YYYY-MM-DD). */
  acquiredAt?: string;
  price?: GearPrice;
  notes?: string;
  links: readonly GearLink[];
  photos: readonly GearPhotoRef[];
  tags: readonly string[];
  status: GearItemStatus;
  /** Marked as "main". Only honoured for cube categories. */
  primary: boolean;
  favorite: boolean;
  /** 0–5, rounds to whole stars. */
  rating?: number;
  quantity: number;
  condition?: GearItemCondition;
  serial?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GearCollectionSnapshot {
  categories: GearCategory[];
  types: GearType[];
  items: GearItem[];
}

// ─── Row types (snake_case, matching SQL) ─────────────────────────────────

interface GearCategoryRow {
  id: string;
  name: string;
  kind: string;
  icon: string;
  accent: string | null;
  created_at: number;
}

interface GearTypeRow {
  id: string;
  category_id: string;
  name: string;
  puzzle_category: string | null;
  created_at: number;
}

interface GearItemRow {
  id: string;
  category_id: string;
  type_id: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  finish: string | null;
  serial: string | null;
  palette: string;
  acquired_at: string | null;
  price_amount: number | null;
  price_currency: string | null;
  notes: string | null;
  links: string;
  photos: string;
  tags: string;
  status: string;
  condition: string | null;
  is_primary: number;
  is_favorite: number;
  rating: number | null;
  quantity: number;
  created_at: number;
  updated_at: number;
}

// ─── Row ↔ domain converters ──────────────────────────────────────────────

/**
 * Parse a JSON column defensively. A hand-edited or half-written value must
 * degrade to the fallback instead of throwing and taking the whole Locker down
 * with it.
 */
function parseJsonArray<T>(raw: unknown, guard: (value: unknown) => value is T): T[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isPhotoRef = (value: unknown): value is GearPhotoRef => {
  if (typeof value !== 'object' || value === null) return false;
  const ref = value as Record<string, unknown>;
  return (
    typeof ref.id === 'string' &&
    typeof ref.width === 'number' &&
    typeof ref.height === 'number' &&
    typeof ref.addedAt === 'number'
  );
};

const isLink = (value: unknown): value is GearLink => {
  if (typeof value !== 'object' || value === null) return false;
  const link = value as Record<string, unknown>;
  return typeof link.label === 'string' && typeof link.url === 'string';
};

function rowToCategory(row: GearCategoryRow): GearCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === 'cube' ? 'cube' : 'gear',
    icon: row.icon,
    ...(row.accent ? { accent: row.accent } : {}),
    createdAt: row.created_at,
  };
}

function rowToType(row: GearTypeRow): GearType {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    puzzleCategory: row.puzzle_category,
    createdAt: row.created_at,
  };
}

function rowToItem(row: GearItemRow): GearItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    typeId: row.type_id,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.model ? { model: row.model } : {}),
    ...(row.finish ? { finish: row.finish } : {}),
    ...(row.serial ? { serial: row.serial } : {}),
    palette: parseJsonArray<string>(row.palette, isString),
    ...(row.acquired_at ? { acquiredAt: row.acquired_at } : {}),
    ...(row.price_amount !== null && row.price_currency
      ? { price: { amount: row.price_amount, currency: row.price_currency } }
      : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    links: parseJsonArray<GearLink>(row.links, isLink),
    photos: parseJsonArray<GearPhotoRef>(row.photos, isPhotoRef),
    tags: parseJsonArray<string>(row.tags, isString),
    status: (row.status as GearItemStatus) ?? 'owned',
    primary: row.is_primary === 1,
    favorite: row.is_favorite === 1,
    ...(row.rating !== null ? { rating: row.rating } : {}),
    quantity: row.quantity,
    ...(row.condition ? { condition: row.condition as GearItemCondition } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function categoryToRow(category: GearCategory) {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    accent: category.accent ?? null,
    created_at: category.createdAt,
  };
}

function typeToRow(type: GearType) {
  return {
    id: type.id,
    category_id: type.categoryId,
    name: type.name,
    puzzle_category: type.puzzleCategory,
    created_at: type.createdAt,
  };
}

function itemToRow(item: GearItem) {
  return {
    id: item.id,
    category_id: item.categoryId,
    type_id: item.typeId,
    name: item.name,
    brand: item.brand ?? null,
    model: item.model ?? null,
    finish: item.finish ?? null,
    serial: item.serial ?? null,
    palette: JSON.stringify(item.palette ?? []),
    acquired_at: item.acquiredAt ?? null,
    price_amount: item.price?.amount ?? null,
    price_currency: item.price?.currency ?? null,
    notes: item.notes ?? null,
    links: JSON.stringify(item.links ?? []),
    photos: JSON.stringify(item.photos ?? []),
    tags: JSON.stringify(item.tags ?? []),
    status: item.status,
    condition: item.condition ?? null,
    is_primary: item.primary ? 1 : 0,
    is_favorite: item.favorite ? 1 : 0,
    rating: item.rating ?? null,
    quantity: item.quantity,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

// ─── SQL ──────────────────────────────────────────────────────────────────

const CATEGORY_UPSERT = `INSERT INTO gear_categories (id, name, kind, icon, accent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    kind = excluded.kind,
    icon = excluded.icon,
    accent = excluded.accent,
    updated_at = excluded.updated_at`;

const TYPE_UPSERT = `INSERT INTO gear_types (id, category_id, name, puzzle_category, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    category_id = excluded.category_id,
    name = excluded.name,
    puzzle_category = excluded.puzzle_category,
    updated_at = excluded.updated_at`;

const ITEM_UPSERT = `INSERT INTO gear_items (
    id, category_id, type_id, name, brand, model, finish, serial, palette,
    acquired_at, price_amount, price_currency, notes, links, photos, tags,
    status, condition, is_primary, is_favorite, rating, quantity,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    category_id = excluded.category_id,
    type_id = excluded.type_id,
    name = excluded.name,
    brand = excluded.brand,
    model = excluded.model,
    finish = excluded.finish,
    serial = excluded.serial,
    palette = excluded.palette,
    acquired_at = excluded.acquired_at,
    price_amount = excluded.price_amount,
    price_currency = excluded.price_currency,
    notes = excluded.notes,
    links = excluded.links,
    photos = excluded.photos,
    tags = excluded.tags,
    status = excluded.status,
    condition = excluded.condition,
    is_primary = excluded.is_primary,
    is_favorite = excluded.is_favorite,
    rating = excluded.rating,
    quantity = excluded.quantity,
    updated_at = excluded.updated_at`;

export class GearRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  /**
   * Every row, in creation order (the order the model appends in). The Locker
   * is a personal collection — tens to hundreds of rows — so one read per table
   * is cheaper and simpler than paging, and the view filters/sorts in memory
   * exactly as the pure model already does.
   */
  async loadAll(): Promise<GearCollectionSnapshot> {
    const [categoryRows, typeRows, itemRows] = await Promise.all([
      this.db('SELECT * FROM gear_categories ORDER BY created_at ASC, id ASC'),
      this.db('SELECT * FROM gear_types ORDER BY created_at ASC, id ASC'),
      this.db('SELECT * FROM gear_items ORDER BY created_at ASC, id ASC'),
    ]);
    return {
      categories: categoryRows.map((r) => rowToCategory(r as unknown as GearCategoryRow)),
      types: typeRows.map((r) => rowToType(r as unknown as GearTypeRow)),
      items: itemRows.map((r) => rowToItem(r as unknown as GearItemRow)),
    };
  }

  async upsertCategory(category: GearCategory, opts?: { local?: boolean }): Promise<void> {
    const updatedAt = await this.stamp('gear_categories', category.createdAt, opts);
    const row = categoryToRow(category);
    await this.db(CATEGORY_UPSERT, [
      row.id,
      row.name,
      row.kind,
      row.icon,
      row.accent,
      row.created_at,
      updatedAt,
    ]);
  }

  async upsertType(type: GearType, opts?: { local?: boolean }): Promise<void> {
    const updatedAt = await this.stamp('gear_types', type.createdAt, opts);
    const row = typeToRow(type);
    await this.db(TYPE_UPSERT, [
      row.id,
      row.category_id,
      row.name,
      row.puzzle_category,
      row.created_at,
      updatedAt,
    ]);
  }

  async upsertItem(item: GearItem, opts?: { local?: boolean }): Promise<void> {
    const updatedAt = await this.stamp('gear_items', item.updatedAt || item.createdAt, opts);
    const row = itemToRow({ ...item, updatedAt });
    await this.db(ITEM_UPSERT, [
      row.id,
      row.category_id,
      row.type_id,
      row.name,
      row.brand,
      row.model,
      row.finish,
      row.serial,
      row.palette,
      row.acquired_at,
      row.price_amount,
      row.price_currency,
      row.notes,
      row.links,
      row.photos,
      row.tags,
      row.status,
      row.condition,
      row.is_primary,
      row.is_favorite,
      row.rating,
      row.quantity,
      row.created_at,
      row.updated_at,
    ]);
  }

  /** Edit-path stamp: monotonic and strictly newer than the row's own stamp. */
  private async stamp(
    table: 'gear_categories' | 'gear_types' | 'gear_items',
    floor: number,
    opts?: { local?: boolean },
  ): Promise<number> {
    if (!opts?.local) return floor;
    return nextLocalStamps(this.db, table, 1, { floor });
  }

  async deleteCategory(id: string): Promise<void> {
    // The FK cascades take the types and their items (mirrors `removeCategory`).
    await this.db('DELETE FROM gear_categories WHERE id = ?', [id]);
  }

  async deleteType(id: string): Promise<void> {
    // `ON DELETE SET NULL` re-homes the items in their category (mirrors
    // `removeType`), and it happens inside the statement, so no partial state.
    await this.db('DELETE FROM gear_types WHERE id = ?', [id]);
  }

  async deleteItem(id: string): Promise<void> {
    await this.db('DELETE FROM gear_items WHERE id = ?', [id]);
  }

  async clear(): Promise<void> {
    await this.db('DELETE FROM gear_items');
    await this.db('DELETE FROM gear_types');
    await this.db('DELETE FROM gear_categories');
  }

  /**
   * Rewrite the whole collection in one transaction. Used by the one-shot
   * legacy import (*) and by reset-to-seed, where the incoming state IS the
   * new truth — anything not listed must be gone.
   *
   * (*) The import deliberately does not go through here: it must leave the
   * existing rows alone if a later step fails. See the web-side hook.
   */
  async replaceAll(snapshot: GearCollectionSnapshot, opts?: { local?: boolean }): Promise<void> {
    const local = opts?.local ?? true;
    // One transaction: a reset/import either lands whole or not at all. The
    // parent rows go first, so the children's FKs always resolve.
    await withTransaction(this.db, async () => {
      await this.clear();
      for (const category of snapshot.categories) {
        await this.upsertCategory(category, { local });
      }
      for (const type of snapshot.types) {
        await this.upsertType(type, { local });
      }
      for (const item of snapshot.items) {
        await this.upsertItem(item, { local });
      }
    });
  }

  async count(): Promise<{ categories: number; types: number; items: number }> {
    const [categories, types, items] = await Promise.all([
      this.db('SELECT COUNT(*) AS cnt FROM gear_categories'),
      this.db('SELECT COUNT(*) AS cnt FROM gear_types'),
      this.db('SELECT COUNT(*) AS cnt FROM gear_items'),
    ]);
    const value = (rows: Record<string, unknown>[]) => Number(rows[0]?.cnt ?? 0);
    return { categories: value(categories), types: value(types), items: value(items) };
  }
}
