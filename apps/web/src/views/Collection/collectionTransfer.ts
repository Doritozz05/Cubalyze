"use client";

/**
 * collectionTransfer.ts — the Locker's backup file.
 *
 * The live collection is split across two stores (rows in SQLite, photo bytes in
 * IndexedDB), so a single JSON file has to carry both. This module is the only
 * place that knows that format, in both directions:
 *
 *   export → `{ format, version, exportedAt, data, photos }`
 *            `data` is the collection exactly as the model holds it (photo
 *            entries are references), and `photos` maps
 *            `"<itemId>:<photoId>"` → `{ full, thumb, width, height, addedAt }`
 *            as base64 data URLs. Base64 is fine HERE — it is a file the user
 *            downloads, not a row, not localStorage.
 *
 *   import → accepts the format above AND every shape the Locker ever produced:
 *            a bare `CollectionState`, the old `{ data }` partialize envelope,
 *            the old zustand `{ state: { data } }` envelope, and photos as
 *            base64 **strings** on each item. Legacy photos are converted into
 *            real blobs, never dropped.
 *
 * Both directions are lossless for well-formed input: exports read the stored
 * blobs byte-for-byte and imports write them back under their original ids, so
 * a round trip never re-compresses a photo and never leaves a card pointing at
 * a blob that does not exist.
 */

import type { GearPhotoRef } from "@cubalyze/database";
import {
  legacyPhotoStrings,
  normalizeState,
  type CollectionState,
  type GearItem,
} from "./collectionModel";
import { importPhotoRecord, newPhotoId, photoKey, readPhoto } from "./collectionPhotos";
import { blobToDataUrl, dataUrlToBlob, processPhotoDataUrl } from "./imageUtils";
import { isKnownExportTag, type ExportTagContract } from "@/lib/exportTag";

/** Marker so a file can be recognised as ours (and versioned) later. */
export const LOCKER_FILE_FORMAT = "cubalyze-locker";

/**
 * Markers the reader accepts: the one written today plus the one earlier
 * releases wrote, so a backup saved before the rename still restores. Note this
 * is NOT the `localStorage` key of the same name in `collectionStore.ts` — that
 * one is frozen for life (see `@/lib/exportTag`).
 */
export const LOCKER_FILE_TAGS: ExportTagContract = {
  current: LOCKER_FILE_FORMAT,
  legacy: ["cubeforge-locker"],
};
export const LOCKER_FILE_VERSION = 1;

export interface LockerPhotoRecord {
  /** Base64 data URL of the stored full rendition. */
  full: string;
  /** Base64 data URL of the grid thumbnail (falls back to `full`). */
  thumb: string;
  width: number;
  height: number;
  addedAt: number;
}

export interface LockerFile {
  format: string;
  version: number;
  exportedAt: string;
  data: CollectionState;
  /** Keyed `"<itemId>:<photoId>"`. */
  photos: Record<string, LockerPhotoRecord>;
}

export interface LockerExportResult {
  file: LockerFile;
  /** Photos whose bytes were found and bundled. */
  photoCount: number;
  /** References whose bytes were already gone (never exported as a dead link). */
  missingPhotos: number;
}

/**
 * Build the backup payload. Anything whose bytes cannot be found is dropped from
 * the exported item too: shipping a reference without its photo would produce a
 * backup that restores into a locker full of broken images.
 */
export async function buildLockerFile(state: CollectionState): Promise<LockerExportResult> {
  const photos: Record<string, LockerPhotoRecord> = {};
  let photoCount = 0;
  let missingPhotos = 0;

  const items: GearItem[] = [];
  for (const item of state.items) {
    const kept: GearPhotoRef[] = [];
    for (const ref of item.photos) {
      const stored = await readPhoto(item.id, ref.id);
      if (!stored) {
        missingPhotos += 1;
        continue;
      }
      const thumbBlob = stored.thumb && stored.thumb.size > 0 ? stored.thumb : stored.full;
      photos[photoKey(item.id, ref.id)] = {
        full: await blobToDataUrl(stored.full),
        thumb: thumbBlob === stored.full ? "" : await blobToDataUrl(thumbBlob),
        width: stored.width,
        height: stored.height,
        addedAt: stored.addedAt,
      };
      kept.push({ ...ref, width: stored.width, height: stored.height });
      photoCount += 1;
    }
    items.push(kept.length === item.photos.length ? item : { ...item, photos: kept });
  }

  return {
    file: {
      format: LOCKER_FILE_FORMAT,
      version: LOCKER_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      data: { ...state, items },
      photos,
    },
    photoCount,
    missingPhotos,
  };
}

export interface LockerImportResult {
  /** The collection to adopt (already carrying only usable photo references). */
  state: CollectionState;
  /** Photos written back into IndexedDB. */
  importedPhotos: number;
  /** Photos converted from the pre-IndexedDB base64 format. */
  legacyPhotos: number;
  /** Entries that could not be restored (corrupt or unreadable). */
  skippedPhotos: number;
}

/** True when the payload looks like one of our backup files. */
export function isLockerFile(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as { format?: unknown; data?: unknown };
  return isKnownExportTag(candidate.format, LOCKER_FILE_TAGS) && typeof candidate.data === "object";
}

function photoParts(key: string): { itemId: string; photoId: string } | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;
  const itemId = key.slice(0, separator);
  const photoId = key.slice(separator + 1);
  if (!itemId || !photoId) return null;
  return { itemId, photoId };
}

/**
 * Write one data URL into the photo store.
 *
 * Base64 is decoded by hand, so the bytes that come back are the bytes that went
 * out — no re-encode, no loss, and no canvas (which also means the whole import
 * path works on a device where image decoding is unavailable). Only a data URL
 * that is not base64 falls back to the canvas pipeline. Returns false when
 * neither could read it, which is the one case the caller must report.
 */
async function storeDataUrl(
  itemId: string,
  photoId: string,
  dataUrl: string,
  meta: { width: number; height: number; addedAt: number },
  thumbDataUrl?: string,
): Promise<boolean> {
  const full = dataUrlToBlob(dataUrl);
  if (full) {
    const thumb = thumbDataUrl ? dataUrlToBlob(thumbDataUrl) : null;
    await importPhotoRecord({
      itemId,
      photoId,
      full,
      // Without a separate thumbnail (legacy photos never had one), the full
      // rendition is used for the grid too: a slightly heavier thumbnail beats
      // a missing one.
      thumb: thumb ?? full,
      width: meta.width,
      height: meta.height,
      addedAt: meta.addedAt,
    });
    return true;
  }

  try {
    const processed = await processPhotoDataUrl(dataUrl);
    await importPhotoRecord({
      itemId,
      photoId,
      full: processed.full,
      thumb: processed.thumb,
      width: processed.width,
      height: processed.height,
      addedAt: meta.addedAt,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restore the `photos` side-car: each record goes into IndexedDB under its
 * original `itemId`/`photoId`, and only the references that made it are kept on
 * the items.
 */
async function restorePhotoRecords(state: CollectionState, photos: unknown): Promise<LockerImportResult> {
  const available = new Set<string>();
  let importedPhotos = 0;
  let skippedPhotos = 0;

  const entries = photos && typeof photos === "object" ? Object.entries(photos) : [];
  for (const [key, value] of entries) {
    const parts = photoParts(key);
    const record = (value ?? {}) as Partial<LockerPhotoRecord>;
    if (!parts || typeof record.full !== "string" || record.full.length === 0) {
      skippedPhotos += 1;
      continue;
    }
    const opened = await storeDataUrl(
      parts.itemId,
      parts.photoId,
      record.full,
      {
        addedAt: typeof record.addedAt === "number" ? record.addedAt : Date.now(),
        width: typeof record.width === "number" ? record.width : 0,
        height: typeof record.height === "number" ? record.height : 0,
      },
      typeof record.thumb === "string" ? record.thumb : undefined,
    );
    if (!opened) {
      skippedPhotos += 1;
      continue;
    }
    available.add(key);
    importedPhotos += 1;
  }

  return {
    importedPhotos,
    legacyPhotos: 0,
    skippedPhotos,
    state: {
      ...state,
      items: state.items.map((item) =>
        item.photos.length === 0
          ? item
          : { ...item, photos: item.photos.filter((ref) => available.has(photoKey(item.id, ref.id))) },
      ),
    },
  };
}

/**
 * Convert the pre-IndexedDB photo strings an older export/backup carries on each
 * item into real blobs, and hand the item its references back.
 */
async function restoreLegacyPhotos(state: CollectionState, raw: unknown): Promise<LockerImportResult> {
  const legacy = legacyPhotoStrings(raw);
  let legacyPhotos = 0;
  let skippedPhotos = 0;
  if (legacy.size === 0) return { importedPhotos: 0, legacyPhotos, skippedPhotos, state };

  const items: GearItem[] = [];
  for (const item of state.items) {
    const urls = legacy.get(item.id);
    if (!urls || urls.length === 0) {
      items.push(item);
      continue;
    }
    const refs: GearPhotoRef[] = [];
    for (const url of urls) {
      const photoId = newPhotoId();
      const addedAt = Date.now();
      // The old format had no ids and no dimensions: the bytes are kept as they
      // were and the size is unknown (0), which only means the layout cannot
      // reserve the exact aspect ratio before the blob loads.
      const opened = await storeDataUrl(item.id, photoId, url, { width: 0, height: 0, addedAt });
      if (opened) {
        refs.push({ id: photoId, width: 0, height: 0, addedAt });
        legacyPhotos += 1;
      } else {
        skippedPhotos += 1;
      }
    }
    items.push({ ...item, photos: refs });
  }
  return { importedPhotos: 0, legacyPhotos, skippedPhotos, state: { ...state, items } };
}

/**
 * Read a backup file's text and materialise it: photos into IndexedDB, the
 * collection as a `CollectionState` ready for the store to adopt.
 *
 * Throws when the text is not JSON or holds no collection at all — the caller
 * turns that into one honest "import failed" message.
 */
export async function readLockerFile(text: string): Promise<LockerImportResult> {
  const raw: unknown = JSON.parse(text);
  const state = normalizeState(isLockerFile(raw) ? (raw as LockerFile).data : raw);
  if (!state) {
    throw new Error("Not a Cubalyze collection file");
  }

  if (isLockerFile(raw)) {
    return restorePhotoRecords(state, (raw as LockerFile).photos);
  }
  return restoreLegacyPhotos(state, raw);
}
