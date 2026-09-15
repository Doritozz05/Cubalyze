/**
 * @cubalyze/database — Gear (Locker) Repository
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
 * Sync (Fase 6, migration 037) adds three things here:
 *   • the push cursor (`find*Since`) and the pull LWW checks (`findUpdatedAts`);
 *   • the versioned deletes used by remote tombstones (`delete*IfNotNewer`);
 *   • two behaviours that the naive implementation gets wrong, both because
 *     SQLite does not fire row triggers on FK cascades and an FK `SET NULL`
 *     does not touch `updated_at`:
 *       - `deleteCategory` deletes children EXPLICITLY so every row produces a
 *         tombstone (otherwise the cloud keeps them and they resurrect);
 *       - `deleteType` re-homes its items with a fresh stamp (otherwise the
 *         re-home never leaves the device).
 *
 * Photos are NOT here: `photos` holds references (id + natural size) and the
 * bytes live as blobs in IndexedDB (see the web-side photo store). What IS here
 * is `gear_photo_sync`, a DEVICE-LOCAL ledger of which blobs are already in
 * Storage — deliberately not a synced column, because writing upload state into
 * the row would bump `updated_at` and loop the sync forever.
 */

import { nextLocalStamps } from './local-clock.js';
import { withTransaction } from './transaction.js';
import { normalizeSmartId } from '../smart-cube-id.js';
import { purgeTombstoneEchoes, rowIsDoomed } from './tombstone-echo.js';

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

// ─── Domain types (camelCase, mirrored by the web model) ──────────────────

export type GearCategoryKind = 'cube' | 'gear';
export type GearItemStatus = 'owned' | 'wishlist' | 'sold' | 'lent';
export type GearItemCondition = 'mint' | 'good' | 'used' | 'broken';

/** The three synced tables — used by the sync cursors and tombstone deletes. */
export type GearTable = 'gear_categories' | 'gear_types' | 'gear_items';

export interface GearCategory {
  id: string;
  name: string;
  kind: GearCategoryKind;
  /** Lucide icon id (resolved by the view layer). */
  icon: string;
  /** Optional accent colour for the category chip. */
  accent?: string;
  createdAt: number;
  /**
   * LWW stamp. The UI does not edit it, but the sync engine needs it: a
   * category edited on one device must beat an older copy on another.
   */
  updatedAt?: number;
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
  /** LWW stamp (see GearCategory.updatedAt). */
  updatedAt?: number;
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
  /** Serial number printed by the manufacturer (a person types this). */
  serial?: string;
  /**
   * Bluetooth address of this item when it is a smart cube, in canonical form.
   * This is what a connection resolves against; a non-smart item simply has
   * none. Distinct from `serial` so an automatic link can never overwrite a
   * value somebody typed by hand.
   */
  smartId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GearCollectionSnapshot {
  categories: GearCategory[];
  types: GearType[];
  items: GearItem[];
}

// ─── Photo-upload ledger (device-local) ───────────────────────────────────

export type GearPhotoSyncStatus = 'pending' | 'synced' | 'missing';

export interface GearPhotoSyncState {
  /** `<itemId>:<photoId>` — the same key the blob store uses. */
  photoKey: string;
  itemId: string;
  photoId: string;
  status: GearPhotoSyncStatus;
  /** Content fingerprint: skips re-uploading bytes that did not change. */
  contentHash: string;
  fullBytes: number;
  thumbBytes: number;
  attempts: number;
  lastAttemptAt: number;
  uploadedAt: number;
  lastError?: string;
}

// ─── Row types (snake_case, matching SQL) ─────────────────────────────────

interface GearCategoryRow {
  id: string;
  name: string;
  kind: string;
  icon: string;
  accent: string | null;
  created_at: number;
  updated_at: number;
}

interface GearTypeRow {
  id: string;
  category_id: string;
  name: string;
  puzzle_category: string | null;
  created_at: number;
  updated_at: number;
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
  smart_id: string | null;
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

interface GearPhotoSyncRow {
  photo_key: string;
  item_id: string;
  photo_id: string;
  status: string;
  content_hash: string;
  full_bytes: number;
  thumb_bytes: number;
  attempts: number;
  last_attempt_at: number;
  uploaded_at: number;
  last_error: string | null;
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
    updatedAt: row.updated_at,
  };
}

function rowToType(row: GearTypeRow): GearType {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    puzzleCategory: row.puzzle_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    ...(row.smart_id ? { smartId: row.smart_id } : {}),
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

function rowToPhotoSyncState(row: GearPhotoSyncRow): GearPhotoSyncState {
  const status = row.status === 'synced' ? 'synced' : row.status === 'missing' ? 'missing' : 'pending';
  return {
    photoKey: row.photo_key,
    itemId: row.item_id,
    photoId: row.photo_id,
    status,
    contentHash: row.content_hash,
    fullBytes: Number(row.full_bytes) || 0,
    thumbBytes: Number(row.thumb_bytes) || 0,
    attempts: Number(row.attempts) || 0,
    lastAttemptAt: Number(row.last_attempt_at) || 0,
    uploadedAt: Number(row.uploaded_at) || 0,
    ...(row.last_error ? { lastError: row.last_error } : {}),
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
    // Canonicalised here as well as in the web model, so the column cannot hold
    // a non-canonical address no matter who writes it. Normalisation is
    // idempotent, so doing it twice can never produce a different row than the
    // one the model already has in memory (which would show up as a phantom
    // diff on the next reload).
    smart_id: normalizeSmartId(item.smartId),
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
    id, category_id, type_id, name, brand, model, finish, serial, smart_id, palette,
    acquired_at, price_amount, price_currency, notes, links, photos, tags,
    status, condition, is_primary, is_favorite, rating, quantity,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    category_id = excluded.category_id,
    type_id = excluded.type_id,
    name = excluded.name,
    brand = excluded.brand,
    model = excluded.model,
    finish = excluded.finish,
    serial = excluded.serial,
    smart_id = excluded.smart_id,
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

/** Max ids per IN () clause — far below SQLite's variable limit. */
const ID_BATCH = 400;

export class GearRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  // ── Reads ───────────────────────────────────────────────────────────────

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

  /**
   * Push cursor for one gear table: all NON-demo rows edited strictly after
   * `updatedAt`, with the same (updated_at, id) keyset pagination as solves —
   * rows sharing a timestamp are never skipped.
   */
  private async findSince<T>(
    table: GearTable,
    updatedAt: number,
    opts: { limit?: number; afterUpdatedAt?: number; afterId?: string } | undefined,
    map: (row: Record<string, unknown>) => T,
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${table} WHERE is_demo = 0`;
    const bind: unknown[] = [];
    if (opts?.afterUpdatedAt !== undefined && opts.afterId !== undefined) {
      sql += ' AND (updated_at > ? OR (updated_at = ? AND id > ?))';
      bind.push(opts.afterUpdatedAt, opts.afterUpdatedAt, opts.afterId);
    } else {
      sql += ' AND updated_at > ?';
      bind.push(updatedAt);
    }
    sql += ' ORDER BY updated_at ASC, id ASC';
    if (opts?.limit !== undefined) {
      sql += ' LIMIT ?';
      bind.push(opts.limit);
    }
    const rows = await this.db(sql, bind);
    return rows.map(map);
  }

  findCategoriesSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<GearCategory[]> {
    return this.findSince('gear_categories', updatedAt, opts, (r) =>
      rowToCategory(r as unknown as GearCategoryRow),
    );
  }

  findTypesSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<GearType[]> {
    return this.findSince('gear_types', updatedAt, opts, (r) =>
      rowToType(r as unknown as GearTypeRow),
    );
  }

  findItemsSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<GearItem[]> {
    return this.findSince('gear_items', updatedAt, opts, (r) =>
      rowToItem(r as unknown as GearItemRow),
    );
  }

  /** Existing `updated_at` values for a batch of ids (pull LWW check). */
  async findUpdatedAts(table: GearTable, ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const chunk = ids.slice(i, i + ID_BATCH);
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await this.db(
        `SELECT id, updated_at FROM ${table} WHERE id IN (${placeholders})`,
        chunk,
      );
      for (const r of rows) map.set(String(r.id), Number(r.updated_at) || 0);
    }
    return map;
  }

  /**
   * Which of the given ids exist locally. The pull uses these to keep the local
   * FK graph valid: a type whose category is missing would fail the insert and
   * block the whole pull, exactly like an orphaned solve (pull.ts).
   */
  private async findExistingIds(table: GearTable, ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const chunk = ids.slice(i, i + ID_BATCH);
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await this.db(
        `SELECT id FROM ${table} WHERE id IN (${placeholders})`,
        chunk,
      );
      for (const r of rows) found.add(String(r.id));
    }
    return found;
  }

  findExistingCategoryIds(ids: string[]): Promise<Set<string>> {
    return this.findExistingIds('gear_categories', ids);
  }

  findExistingTypeIds(ids: string[]): Promise<Set<string>> {
    return this.findExistingIds('gear_types', ids);
  }

  // ── Writes (local edits) ────────────────────────────────────────────────

  async upsertCategory(category: GearCategory, opts?: { local?: boolean }): Promise<void> {
    const updatedAt = await this.stamp(
      'gear_categories',
      category.updatedAt ?? category.createdAt,
      opts,
    );
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
    const updatedAt = await this.stamp(
      'gear_types',
      type.updatedAt ?? type.createdAt,
      opts,
    );
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
      row.smart_id,
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

  /**
   * Edit-path stamp: monotonic and strictly newer than the row's own stamp.
   * Without `{ local: true }` the caller's timestamp is written verbatim —
   * which is exactly what a pull-applied cloud row needs.
   */
  private async stamp(
    table: GearTable,
    floor: number,
    opts?: { local?: boolean },
  ): Promise<number> {
    if (!opts?.local) return floor;
    return nextLocalStamps(this.db, table, 1, { floor });
  }

  // ── Deletes ─────────────────────────────────────────────────────────────

  /**
   * Delete a category AND its children, each with its own statement.
   *
   * The schema cascades, but SQLite does NOT fire row triggers on cascaded
   * deletes (`recursive_triggers` defaults to OFF), so a bare
   * `DELETE FROM gear_categories` would leave its types and items alive in the
   * cloud — and the next pull would resurrect them on every other device.
   * Deleting children first makes every row produce its tombstone (037); it is
   * the same contract `deleteSession` already uses for solves.
   */
  async deleteCategory(id: string): Promise<void> {
    await withTransaction(this.db, async () => {
      // Items directly under the category…
      await this.db('DELETE FROM gear_items WHERE category_id = ?', [id]);
      // …and any item that reached into one of this category's types (defensive:
      // a cross-category type reference must not survive its type).
      await this.db(
        'DELETE FROM gear_items WHERE type_id IN (SELECT id FROM gear_types WHERE category_id = ?)',
        [id],
      );
      await this.db('DELETE FROM gear_types WHERE category_id = ?', [id]);
      await this.db('DELETE FROM gear_categories WHERE id = ?', [id]);
    });
  }

  /**
   * Delete a type: its items are RE-HOMED in the category (`type_id = NULL`),
   * not deleted, mirroring `removeType`.
   *
   * The re-home is an explicit UPDATE with a fresh stamp, NOT the FK's
   * `ON DELETE SET NULL`: an FK action does not touch `updated_at`, so the
   * re-homed items would keep their old stamp and the push cursor
   * (`updated_at > watermark`) would never upload them — the other device would
   * keep them pointing at a type that no longer exists anywhere.
   */
  async deleteType(id: string): Promise<void> {
    await withTransaction(this.db, async () => {
      const rows = await this.db('SELECT id FROM gear_items WHERE type_id = ?', [id]);
      const ids = rows.map((r) => String(r.id));
      if (ids.length > 0) {
        // One reserved, strictly-increasing range for the whole re-home: all
        // stamps are >= the wall clock and the local clock, and each row moves
        // past its own previous stamp.
        const base = await nextLocalStamps(this.db, 'gear_items', ids.length);
        for (let i = 0; i < ids.length; i += 1) {
          await this.db('UPDATE gear_items SET type_id = NULL, updated_at = ? WHERE id = ?', [
            base + i,
            ids[i],
          ]);
        }
      }
      await this.db('DELETE FROM gear_types WHERE id = ?', [id]);
    });
  }

  async deleteItem(id: string): Promise<void> {
    // Photos are bytes in IndexedDB with no FK to this table — the caller
    // (collectionStore) deletes their blobs and their ledger rows.
    await this.db('DELETE FROM gear_items WHERE id = ?', [id]);
  }

  /**
   * Versioned delete for a remote tombstone (LWW): removes the row only when it
   * was NOT edited after the delete. A newer local edit survives and is
   * re-pushed, resurrecting the row — deletes only win against older data.
   *
   * Each of these deletes is an ECHO of a tombstone the cloud already owns, so
   * none of them may announce itself: the trigger-written tombstone carries a
   * FRESHER deleted_at and, once pushed, would destroy a newer edit made on
   * another device in the meantime (tombstone-echo.ts has the full story).
   * Hence the "is this row really doomed?" probe before deleting: a device that
   * had already deleted the row on its own keeps its pending tombstone.
   */
  async deleteItemIfNotNewer(id: string, deletedAt: number): Promise<void> {
    if (!(await rowIsDoomed(this.db, 'gear_items', 'id', id, 'updated_at', deletedAt))) return;
    await this.db('DELETE FROM gear_items WHERE id = ? AND updated_at <= ?', [id, deletedAt]);
    await purgeTombstoneEchoes(this.db, 'gear_items', [id]);
  }

  async deleteTypeIfNotNewer(id: string, deletedAt: number): Promise<void> {
    // The items that referenced the type are re-homed by the FK (`SET NULL`),
    // an UPDATE that produces no tombstone of its own.
    if (!(await rowIsDoomed(this.db, 'gear_types', 'id', id, 'updated_at', deletedAt))) return;
    await this.db('DELETE FROM gear_types WHERE id = ? AND updated_at <= ?', [id, deletedAt]);
    await purgeTombstoneEchoes(this.db, 'gear_types', [id]);
  }

  /**
   * A remote category delete takes its contents, exactly like the local one —
   * but spelled out statement by statement (the FK's cascade fires no row
   * trigger). Every deleted row's echo is then dropped, so the children are not
   * re-announced with a fresher stamp: a child edited elsewhere after the
   * delete keeps its newer copy in the cloud instead of being destroyed by an
   * echo (see tombstone-echo.ts).
   */
  async deleteCategoryIfNotNewer(id: string, deletedAt: number): Promise<void> {
    if (!(await rowIsDoomed(this.db, 'gear_categories', 'id', id, 'updated_at', deletedAt))) {
      return;
    }
    await withTransaction(this.db, async () => {
      const itemRows = await this.db(
        `SELECT id FROM gear_items
          WHERE category_id = ?
             OR type_id IN (SELECT id FROM gear_types WHERE category_id = ?)`,
        [id, id],
      );
      const typeRows = await this.db('SELECT id FROM gear_types WHERE category_id = ?', [id]);
      await this.db('DELETE FROM gear_items WHERE category_id = ?', [id]);
      await this.db(
        'DELETE FROM gear_items WHERE type_id IN (SELECT id FROM gear_types WHERE category_id = ?)',
        [id],
      );
      await this.db('DELETE FROM gear_types WHERE category_id = ?', [id]);
      await this.db('DELETE FROM gear_categories WHERE id = ?', [id]);
      await purgeTombstoneEchoes(
        this.db,
        'gear_items',
        itemRows.map((r) => String(r.id)),
      );
      await purgeTombstoneEchoes(
        this.db,
        'gear_types',
        typeRows.map((r) => String(r.id)),
      );
      await purgeTombstoneEchoes(this.db, 'gear_categories', [id]);
    });
  }

  /** Delete every row (and the photo ledger). The caller purges tombstones. */
  async clear(): Promise<void> {
    await this.db('DELETE FROM gear_items');
    await this.db('DELETE FROM gear_types');
    await this.db('DELETE FROM gear_categories');
    await this.db('DELETE FROM gear_photo_sync');
  }

  // ── Photo-upload ledger ─────────────────────────────────────────────────

  async loadPhotoSyncStates(): Promise<Map<string, GearPhotoSyncState>> {
    const rows = await this.db('SELECT * FROM gear_photo_sync');
    const map = new Map<string, GearPhotoSyncState>();
    for (const row of rows) {
      const state = rowToPhotoSyncState(row as unknown as GearPhotoSyncRow);
      map.set(state.photoKey, state);
    }
    return map;
  }

  async getPhotoSyncState(photoKey: string): Promise<GearPhotoSyncState | null> {
    const rows = await this.db('SELECT * FROM gear_photo_sync WHERE photo_key = ?', [photoKey]);
    if (rows.length === 0) return null;
    return rowToPhotoSyncState(rows[0] as unknown as GearPhotoSyncRow);
  }

  async upsertPhotoSyncState(state: GearPhotoSyncState): Promise<void> {
    await this.db(
      `INSERT INTO gear_photo_sync (
         photo_key, item_id, photo_id, status, content_hash, full_bytes, thumb_bytes,
         attempts, last_attempt_at, uploaded_at, last_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(photo_key) DO UPDATE SET
         status = excluded.status,
         content_hash = excluded.content_hash,
         full_bytes = excluded.full_bytes,
         thumb_bytes = excluded.thumb_bytes,
         attempts = excluded.attempts,
         last_attempt_at = excluded.last_attempt_at,
         uploaded_at = excluded.uploaded_at,
         last_error = excluded.last_error`,
      [
        state.photoKey,
        state.itemId,
        state.photoId,
        state.status,
        state.contentHash,
        state.fullBytes,
        state.thumbBytes,
        state.attempts,
        state.lastAttemptAt,
        state.uploadedAt,
        state.lastError ?? null,
      ],
    );
  }

  async deletePhotoSyncState(photoKey: string): Promise<void> {
    await this.db('DELETE FROM gear_photo_sync WHERE photo_key = ?', [photoKey]);
  }

  /** Ledger rows in one state (the photo sync service drives off these). */
  async listPhotoSyncByStatus(status: GearPhotoSyncStatus): Promise<GearPhotoSyncState[]> {
    const rows = await this.db(
      'SELECT * FROM gear_photo_sync WHERE status = ? ORDER BY last_attempt_at ASC',
      [status],
    );
    return rows.map((r) => rowToPhotoSyncState(r as unknown as GearPhotoSyncRow));
  }

  // ── Bulk replace (import / reset) ───────────────────────────────────────

  /**
   * Rewrite the whole collection in one transaction. Used by the one-shot
   * legacy import (*) and by reset-to-seed, where the incoming state IS the
   * new truth — anything not listed must be gone.
   *
   * (*) The import deliberately does not go through here directly: the web hook
   *     keeps the existing rows if a later step fails.
   *
   * F5: `clear()` deletes the rows, which fires the tombstone triggers — and
   * then the snapshot re-inserts the SAME ids. Those tombstones must not
   * survive: pushed after the rows, a `deleted_at` in the same millisecond as
   * the fresh `updated_at` would make the cloud `delete ... where updated_at
   * <= deleted_at` remove the row that was just imported, and the next pull
   * would delete it locally too. Tombstones are therefore purged for exactly
   * the ids that were re-inserted; the ones for ids that are really gone stay,
   * because those are how the cloud learns about the deletion.
   */
  async replaceAll(snapshot: GearCollectionSnapshot, opts?: { local?: boolean }): Promise<void> {
    const local = opts?.local ?? true;
    await withTransaction(this.db, async () => {
      await this.db('DELETE FROM gear_items');
      await this.db('DELETE FROM gear_types');
      await this.db('DELETE FROM gear_categories');
      for (const category of snapshot.categories) {
        await this.upsertCategory(category, { local });
      }
      for (const type of snapshot.types) {
        await this.upsertType(type, { local });
      }
      for (const item of snapshot.items) {
        await this.upsertItem(item, { local });
      }
      await this.purgeTombstones('gear_categories', snapshot.categories.map((c) => c.id));
      await this.purgeTombstones('gear_types', snapshot.types.map((t) => t.id));
      await this.purgeTombstones('gear_items', snapshot.items.map((i) => i.id));
    });
  }

  /** Drop tombstones for ids that are alive again (see replaceAll). */
  private async purgeTombstones(entity: GearTable, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const chunk = ids.slice(i, i + ID_BATCH);
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => '?').join(', ');
      await this.db(
        `DELETE FROM sync_tombstones WHERE entity = ? AND entity_id IN (${placeholders})`,
        [entity, ...chunk],
      );
    }
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
