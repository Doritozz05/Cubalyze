"use client";

/**
 * collectionPhotos.ts — where the Locker's photo bytes actually live.
 *
 * IndexedDB, one record per photo, holding BOTH renditions (thumb + full). The
 * gear row in SQLite only keeps a reference (id + natural size), which is the
 * same split the app already uses for background media and the opposite of what
 * this collection used to do (base64 inside a localStorage JSON, capped at
 * roughly 5 MB for the whole origin — a handful of photos).
 *
 * Keys are `<itemId>:<photoId>` with an index on `itemId`, so an item's photos
 * are found and deleted as a group, and a store-wide sweep can tell which
 * groups belong to an item that no longer exists.
 *
 * Object URLs are cached with reference counting: a grid of cards promotes the
 * same thumbnail many times, and every URL is revoked exactly when the last
 * consumer releases it (or when the photo is deleted).
 */

import type { GearPhotoRef } from "@cubeforge/database";
import { processPhotoFile, type ProcessedPhoto } from "./imageUtils";

const DB_NAME = "cubeforge-collection";
const DB_VERSION = 1;
const STORE = "photos";
const INDEX_ITEM = "by_item";

/**
 * How long an unsaved group of photos is spared by the orphan sweep. The editor
 * stores a new item's photos BEFORE the item row exists, so a sweep running
 * while someone is filling the form must not eat them.
 */
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

export interface StoredPhoto {
  /** `${itemId}:${photoId}` — the primary key. */
  key: string;
  itemId: string;
  photoId: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  addedAt: number;
}

/**
 * Storage key of one photo (`<itemId>:<photoId>`). Exported because the backup
 * file keys its side-car the same way: one convention, one function.
 */
export function photoKey(itemId: string, photoId: string): string {
  return `${itemId}:${photoId}`;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openPhotosDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex(INDEX_ITEM, "itemId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the photo store"));
  });
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * A photo id that has never been used. Used by the editor for a brand-new item,
 * where the item id is already decided: the photos are stored (and previewed)
 * before the row exists.
 */
export function newPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Store an already-processed pair of renditions and return its reference. */
export async function saveProcessedPhoto(
  itemId: string,
  processed: ProcessedPhoto,
  /** Injectable for tests; defaults to now. */
  addedAt: number = Date.now(),
): Promise<GearPhotoRef> {
  const photoId = newPhotoId();
  const record: StoredPhoto = {
    key: photoKey(itemId, photoId),
    itemId,
    photoId,
    full: processed.full,
    thumb: processed.thumb,
    width: processed.width,
    height: processed.height,
    addedAt,
  };
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await request(tx.objectStore(STORE).put(record));
    return { id: photoId, width: processed.width, height: processed.height, addedAt };
  } finally {
    db.close();
  }
}

/**
 * Store a photo under an EXPLICIT id — the import path.
 *
 * A backup carries the original ids, so re-importing must rebuild the very same
 * keys: the item rows still reference `<itemId>` + `<photoId>`, and storing
 * under a fresh id would leave every card pointing at a blob that is not there.
 * The bytes are written as they came out of the file (no re-encode), and any
 * cached object URL for that key is dropped so the next read sees the new bytes.
 */
export async function importPhotoRecord(record: {
  itemId: string;
  photoId: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  addedAt: number;
}): Promise<void> {
  const stored: StoredPhoto = {
    key: photoKey(record.itemId, record.photoId),
    itemId: record.itemId,
    photoId: record.photoId,
    full: record.full,
    thumb: record.thumb,
    width: record.width,
    height: record.height,
    addedAt: record.addedAt,
  };
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await request(tx.objectStore(STORE).put(stored));
  } finally {
    db.close();
    releaseUrl(record.itemId, record.photoId);
  }
}

/** Process a picked file and store it — the path the editor uses. */
export async function addPhotoFromFile(itemId: string, file: File): Promise<GearPhotoRef> {
  return saveProcessedPhoto(itemId, await processPhotoFile(file));
}

export async function deletePhoto(itemId: string, photoId: string): Promise<void> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await request(tx.objectStore(STORE).delete(photoKey(itemId, photoId)));
  } finally {
    db.close();
    releaseUrl(itemId, photoId);
  }
}

/**
 * Empty the store and drop every cached object URL.
 *
 * Used by the account wipe, which has to leave the device in a pristine
 * first-launch state — a deleted account's photos surviving it would be exactly
 * the kind of leftover the wipe exists to prevent.
 */
export async function clearAllPhotos(): Promise<void> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await request(tx.objectStore(STORE).clear());
  } finally {
    db.close();
  }
  for (const entry of urlCache.values()) {
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
  urlCache.clear();
}

/** Delete every rendition of an item (called when the item row goes away). */
export async function deleteItemPhotos(itemId: string): Promise<number> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const keys = await request(store.index(INDEX_ITEM).getAllKeys(IDBKeyRange.only(itemId)));
    for (const key of keys) {
      store.delete(key);
    }
    for (const key of keys) {
      const [owner, photoId] = String(key).split(":");
      if (owner && photoId) releaseUrl(owner, photoId);
    }
    return keys.length;
  } finally {
    db.close();
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function readPhoto(itemId: string, photoId: string): Promise<StoredPhoto | null> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readonly");
    const record = await request<StoredPhoto | undefined>(
      tx.objectStore(STORE).get(photoKey(itemId, photoId)),
    );
    return record ?? null;
  } finally {
    db.close();
  }
}

/**
 * Keys (`<itemId>:<photoId>`) whose bytes are present locally.
 *
 * ONE read for the whole store: the photo sync needs to know, for every
 * referenced photo, whether the bytes are here — asking `readPhoto` per photo
 * would be an IndexedDB round-trip per card.
 */
export async function storedPhotoKeys(): Promise<Set<string>> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readonly");
    const keys = await request<IDBValidKey[]>(tx.objectStore(STORE).getAllKeys());
    return new Set(keys.map((key) => String(key)));
  } finally {
    db.close();
  }
}

export interface PhotoStoreUsage {
  photos: number;
  bytes: number;
}

/** Rows and bytes held by the store (the storage read-out in the Locker). */
export async function collectionPhotoUsage(): Promise<PhotoStoreUsage> {
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readonly");
    const records = await request<StoredPhoto[]>(tx.objectStore(STORE).getAll());
    return {
      photos: records.length,
      bytes: records.reduce((total, record) => total + record.full.size + record.thumb.size, 0),
    };
  } finally {
    db.close();
  }
}

/**
 * Delete every stored photo that nothing references any more.
 *
 * "Referenced" is the exact set of `<itemId>:<photoId>` keys the collection
 * points at — not the item ids. That distinction is the whole point: a photo
 * added while editing an EXISTING item and then abandoned (the dialog was
 * cancelled, or the edit was dropped without saving) belongs to an item that
 * still exists, so an item-level sweep would never touch it.
 *
 * Photos younger than `graceMs` are spared whatever the reason: the editor
 * stores a new item's photos BEFORE its row exists, and a sweep must never eat
 * a photo the user is still looking at. Returns how many photos were removed.
 */
export async function pruneOrphanPhotos(
  referenced: Iterable<string>,
  opts?: { graceMs?: number; now?: number },
): Promise<number> {
  const keep = new Set(referenced);
  const graceMs = opts?.graceMs ?? ORPHAN_GRACE_MS;
  const now = opts?.now ?? Date.now();

  let removed = 0;
  const db = await openPhotosDB();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const records = await request<StoredPhoto[]>(store.getAll());
    for (const record of records) {
      if (keep.has(record.key)) continue;
      if (now - record.addedAt < graceMs) continue;
      store.delete(record.key);
      releaseUrl(record.itemId, record.photoId);
      removed += 1;
    }
  } finally {
    db.close();
  }
  return removed;
}

// ─── Object URLs (ref-counted) ────────────────────────────────────────────

type PhotoSize = "thumb" | "full";

interface UrlEntry {
  url: string | null;
  refs: number;
  pending: Promise<string | null> | null;
}

const urlCache = new Map<string, UrlEntry>();

function cacheKey(itemId: string, photoId: string, size: PhotoSize): string {
  return `${itemId}:${photoId}:${size}`;
}

/**
 * Take a reference to a photo's object URL. The caller MUST call `release()`
 * (the `usePhotoUrl` hook does it on unmount).
 */
export async function acquirePhotoUrl(
  itemId: string,
  photoId: string,
  size: PhotoSize = "thumb",
): Promise<{ url: string | null; release: () => void }> {
  const key = cacheKey(itemId, photoId, size);
  const entry = urlCache.get(key) ?? { url: null, refs: 0, pending: null };
  urlCache.set(key, entry);
  entry.refs += 1;

  const release = () => {
    entry.refs -= 1;
    if (entry.refs <= 0) {
      if (entry.url) URL.revokeObjectURL(entry.url);
      urlCache.delete(key);
    }
  };

  if (entry.url) return { url: entry.url, release };

  try {
    if (!entry.pending) {
      entry.pending = (async () => {
        const record = await readPhoto(itemId, photoId);
        if (!record) return null;
        const blob = size === "full" ? record.full : record.thumb || record.full;
        return URL.createObjectURL(blob);
      })().catch(() => null);
    }
    const url = await entry.pending;
    entry.pending = null;
    // Nobody wants it any more (unmounted while the blob was being read).
    if (entry.refs <= 0) {
      if (url) URL.revokeObjectURL(url);
      urlCache.delete(key);
      return { url: null, release };
    }
    entry.url = url;
    return { url, release };
  } catch {
    release();
    return { url: null, release: () => undefined };
  }
}

/** Drop cached URLs for a photo (deletion paths). */
export function releaseUrl(itemId: string, photoId: string): void {
  for (const size of ["thumb", "full"] as const) {
    const key = cacheKey(itemId, photoId, size);
    const entry = urlCache.get(key);
    if (!entry) continue;
    if (entry.url) URL.revokeObjectURL(entry.url);
    urlCache.delete(key);
  }
}

// ─── Storage read-out ─────────────────────────────────────────────────────

export interface CollectionStorageEstimate {
  /** Bytes used by this origin (all stores, not just photos). */
  usage: number;
  quota: number;
  photos: PhotoStoreUsage;
}

/**
 * What the browser reports for this origin, plus what the photo store holds.
 * `null` when the API is unavailable — the meter then simply does not render.
 */
export async function estimateCollectionStorage(): Promise<CollectionStorageEstimate | null> {
  const photos = await collectionPhotoUsage();
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await storage.estimate();
    return { usage, quota, photos };
  } catch {
    return null;
  }
}
