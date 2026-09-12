"use client";

/**
 * collectionPhotoSync.ts — the photo channel of the Locker's cloud sync.
 *
 * The row-sync moves `gear_items.photos`, which is a list of REFERENCES
 * (`{id,width,height,addedAt}`). The BYTES never travel in a row: a blob in a
 * synced column would be re-uploaded on every unrelated edit and would fight
 * the row's LWW. So there is a second channel, and this is it:
 *
 *   • upload  — a referenced photo whose bytes are here but not in Storage;
 *   • download — a referenced photo whose bytes are NOT here (a fresh device
 *     that just pulled the reference);
 *   • reconcile — a ledger entry whose photo no longer appears in any item
 *     (a delete): remove its objects and forget it.
 *
 * Everything it needs from the outside is injected (`PhotoStoragePort`,
 * `PhotoBlobStore`, repository), so the orchestration is tested against fakes
 * with no IndexedDB, no network and no Supabase.
 *
 * Quota discipline (the reason this is not a loop over every photo):
 *   • a per-run budget caps objects touched (`MAX_OBJECTS_PER_CYCLE`);
 *   • a synced photo is never re-uploaded unless its fingerprint changed;
 *   • a failure in EITHER direction (a 404 download, a rejected upload) is
 *     remembered with exponential backoff instead of being retried every
 *     cycle;
 *   • the whole thing is skipped outside a signed-in row cycle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GearRepository,
  initDB,
  type GearPhotoRef,
  type GearPhotoSyncState,
} from "@cubeforge/database";
import {
  deletePhoto,
  importPhotoRecord,
  photoKey,
  readPhoto,
  storedPhotoKeys,
} from "./collectionPhotos";

/** The private bucket created by migration 20260912000013. */
const BUCKET = "locker-photos";
/** Objects touched per run (a photo = 2 objects: full + thumb). */
export const MAX_OBJECTS_PER_CYCLE = 20;
/** Consecutive-failure backoff before retrying a missing object. */
export const RETRY_BACKOFF_MS = [30_000, 120_000, 600_000] as const;

export type PhotoRendition = "full" | "thumb";

/** `{user}/{item}/{photo}/{full|thumb}.jpg` — first folder == the RLS partition. */
export function photoObjectPath(
  userId: string,
  itemId: string,
  photoId: string,
  rendition: PhotoRendition,
): string {
  return `${userId}/${itemId}/${photoId}/${rendition}.jpg`;
}

/**
 * Cheap content fingerprint of a reference. `addedAt` changes when a photo is
 * replaced under the same id (the import path does that), which is enough to
 * decide "the bytes may differ, re-upload" without reading the blob.
 */
export function photoFingerprint(photo: GearPhotoRef): string {
  return `${photo.width}x${photo.height}@${photo.addedAt}`;
}

// ─── Ports ─────────────────────────────────────────────────────────────────

export interface PhotoStoragePort {
  upload(path: string, blob: Blob, contentType: string): Promise<void>;
  /** `null` when the object does not exist (404) — not an error. */
  download(path: string): Promise<Blob | null>;
  remove(paths: string[]): Promise<void>;
}

export interface PhotoBlobStore {
  /** Keys (`<itemId>:<photoId>`) whose bytes are present locally. */
  keys(): Promise<Set<string>>;
  read(itemId: string, photoId: string): Promise<{ full: Blob; thumb: Blob } | null>;
  import(record: {
    itemId: string;
    photoId: string;
    full: Blob;
    thumb: Blob;
    width: number;
    height: number;
    addedAt: number;
  }): Promise<void>;
  remove(itemId: string, photoId: string): Promise<void>;
}

// ─── Plan (pure) ───────────────────────────────────────────────────────────

export interface PhotoSyncPlanEntry {
  key: string;
  itemId: string;
  photoId: string;
  photo: GearPhotoRef;
}

export interface PhotoSyncPlan {
  toUpload: PhotoSyncPlanEntry[];
  toDownload: PhotoSyncPlanEntry[];
  /** Ledger keys whose photo is no longer referenced anywhere. */
  toDeleteRemote: string[];
}

/** True when a previous failure is past its backoff window. */
export function shouldRetry(state: GearPhotoSyncState | undefined, now: number): boolean {
  if (!state) return true;
  if (state.status === "synced") return true; // heal: bytes may have vanished
  if (state.attempts <= 0) return true;
  const index = Math.min(state.attempts - 1, RETRY_BACKOFF_MS.length - 1);
  return now - state.lastAttemptAt >= RETRY_BACKOFF_MS[index]!;
}

/**
 * Decide what this run should touch. Pure — the whole retry/reconcile policy is
 * testable without any I/O.
 */
export function planPhotoSync(input: {
  refs: readonly { itemId: string; photo: GearPhotoRef }[];
  ledger: ReadonlyMap<string, GearPhotoSyncState>;
  localKeys: ReadonlySet<string>;
  now: number;
}): PhotoSyncPlan {
  const referenced = new Set<string>();
  const toUpload: PhotoSyncPlanEntry[] = [];
  const toDownload: PhotoSyncPlanEntry[] = [];

  for (const { itemId, photo } of input.refs) {
    const key = photoKey(itemId, photo.id);
    referenced.add(key);
    const state = input.ledger.get(key);
    const fingerprint = photoFingerprint(photo);

    if (input.localKeys.has(key)) {
      // Bytes are here: upload unless Storage already has this exact version,
      // and unless the last attempt failed within its backoff window — a quota
      // error or an expired token must not be hammered on every cycle either.
      const upToDate = state?.status === "synced" && state.contentHash === fingerprint;
      if (!upToDate && shouldRetry(state, input.now)) {
        toUpload.push({ key, itemId, photoId: photo.id, photo });
      }
    } else if (shouldRetry(state, input.now)) {
      // No bytes here: they must be fetched (the other device uploaded them).
      toDownload.push({ key, itemId, photoId: photo.id, photo });
    }
  }

  const toDeleteRemote: string[] = [];
  for (const key of input.ledger.keys()) {
    if (!referenced.has(key)) toDeleteRemote.push(key);
  }

  return { toUpload, toDownload, toDeleteRemote };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export interface PhotoSyncResult {
  uploaded: number;
  downloaded: number;
  deleted: number;
  failed: number;
}

const EMPTY_RESULT: PhotoSyncResult = {
  uploaded: 0,
  downloaded: 0,
  deleted: 0,
  failed: 0,
};

export interface RunPhotoSyncOptions {
  supabase: SupabaseClient | null | undefined;
  userId: string | null | undefined;
  storage?: PhotoStoragePort;
  blobs?: PhotoBlobStore;
  repo?: GearRepository;
  /** Max objects (renditions) touched this run. Defaults to the constant. */
  budget?: number;
  now?: number;
}

/** Serialises runs inside a tab; the next cycle picks up where this one stopped. */
let inFlight: Promise<PhotoSyncResult> | null = null;
/** Last completed run, to keep the row-cycle callback from hammering Storage. */
let lastRunAt = 0;
const MIN_INTERVAL_MS = 15_000;

/**
 * One photo-sync pass. Safe to call after every row cycle: it is a no-op when
 * signed out, throttled inside a tab, and bounded per run. Never throws.
 */
export async function runPhotoSync(options: RunPhotoSyncOptions): Promise<PhotoSyncResult> {
  if (!options.supabase || !options.userId) return EMPTY_RESULT;
  if (inFlight) return inFlight;

  const now = options.now ?? Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) return EMPTY_RESULT;

  inFlight = (async () => {
    try {
      const storage = options.storage ?? supabasePhotoStorage(options.supabase!);
      const blobs = options.blobs ?? indexedDbPhotoBlobs();
      const repo = options.repo ?? (await createGearRepo());
      const budget = options.budget ?? MAX_OBJECTS_PER_CYCLE;
      return await performPhotoSync({
        userId: options.userId!,
        storage,
        blobs,
        repo,
        budget,
        now,
      });
    } catch (err) {
      console.warn("[locker-sync] photo sync failed:", err);
      return EMPTY_RESULT;
    } finally {
      lastRunAt = Date.now();
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Reset the throttle — tests and the account wipe use it. */
export function resetPhotoSyncThrottle(): void {
  lastRunAt = 0;
}

export interface PerformPhotoSyncOptions {
  userId: string;
  storage: PhotoStoragePort;
  blobs: PhotoBlobStore;
  repo: GearRepository;
  budget: number;
  now: number;
}

/** The I/O half of a run, injected end-to-end so tests drive it directly. */
export async function performPhotoSync(
  options: PerformPhotoSyncOptions,
): Promise<PhotoSyncResult> {
  const { userId, storage, blobs, repo, budget, now } = options;
  const result: PhotoSyncResult = { uploaded: 0, downloaded: 0, deleted: 0, failed: 0 };

  const snapshot = await repo.loadAll();
  const refs = snapshot.items.flatMap((item) =>
    item.photos.map((photo) => ({ itemId: item.id, photo })),
  );
  const [ledger, localKeys] = await Promise.all([
    repo.loadPhotoSyncStates(),
    blobs.keys(),
  ]);
  const plan = planPhotoSync({ refs, ledger, localKeys, now });

  let touched = 0;
  const consume = (renditions: number): boolean => {
    if (touched + renditions > budget) return false;
    touched += renditions;
    return true;
  };

  // ── Upload ────────────────────────────────────────────────────────────
  for (const entry of plan.toUpload) {
    if (!consume(2)) break;
    try {
      const record = await blobs.read(entry.itemId, entry.photoId);
      if (!record) {
        result.failed += 1;
        continue;
      }
      await storage.upload(
        photoObjectPath(userId, entry.itemId, entry.photoId, "full"),
        record.full,
        "image/jpeg",
      );
      await storage.upload(
        photoObjectPath(userId, entry.itemId, entry.photoId, "thumb"),
        record.thumb,
        "image/jpeg",
      );
      await repo.upsertPhotoSyncState({
        photoKey: entry.key,
        itemId: entry.itemId,
        photoId: entry.photoId,
        status: "synced",
        contentHash: photoFingerprint(entry.photo),
        fullBytes: record.full.size,
        thumbBytes: record.thumb.size,
        attempts: 0,
        lastAttemptAt: now,
        uploadedAt: now,
      });
      result.uploaded += 1;
    } catch (err) {
      await markFailure(repo, ledger, entry, now, err);
      result.failed += 1;
    }
  }

  // ── Download ──────────────────────────────────────────────────────────
  for (const entry of plan.toDownload) {
    if (!consume(2)) break;
    try {
      const full = await storage.download(
        photoObjectPath(userId, entry.itemId, entry.photoId, "full"),
      );
      if (!full) {
        // The other device has not uploaded yet (or deleted the object). Keep
        // the reference and retry later with backoff — never drop the ref: the
        // row is the source of truth and the bytes may still arrive.
        await markFailure(repo, ledger, entry, now, new Error("photo not in Storage yet"));
        continue;
      }
      const thumb =
        (await storage.download(
          photoObjectPath(userId, entry.itemId, entry.photoId, "thumb"),
        )) ?? full;
      await blobs.import({
        itemId: entry.itemId,
        photoId: entry.photoId,
        full,
        thumb,
        width: entry.photo.width,
        height: entry.photo.height,
        addedAt: entry.photo.addedAt,
      });
      await repo.upsertPhotoSyncState({
        photoKey: entry.key,
        itemId: entry.itemId,
        photoId: entry.photoId,
        status: "synced",
        contentHash: photoFingerprint(entry.photo),
        fullBytes: full.size,
        thumbBytes: thumb.size,
        attempts: 0,
        lastAttemptAt: now,
        uploadedAt: now,
      });
      result.downloaded += 1;
    } catch (err) {
      await markFailure(repo, ledger, entry, now, err);
      result.failed += 1;
    }
  }

  // ── Reconcile (deleted photos) ────────────────────────────────────────
  for (const key of plan.toDeleteRemote) {
    if (!consume(2)) break;
    const state = ledger.get(key);
    const { itemId, photoId } = splitPhotoKey(key, state);
    if (!itemId || !photoId) {
      await repo.deletePhotoSyncState(key);
      continue;
    }
    try {
      await storage.remove([
        photoObjectPath(userId, itemId, photoId, "full"),
        photoObjectPath(userId, itemId, photoId, "thumb"),
      ]);
      await repo.deletePhotoSyncState(key);
      result.deleted += 1;
    } catch {
      // Best effort: a failed delete is retried next run (the entry stays).
      result.failed += 1;
    }
  }

  return result;
}

function splitPhotoKey(
  key: string,
  state: GearPhotoSyncState | undefined,
): { itemId: string; photoId: string } {
  if (state) return { itemId: state.itemId, photoId: state.photoId };
  const [itemId, photoId] = key.split(":");
  return { itemId: itemId ?? "", photoId: photoId ?? "" };
}

async function markFailure(
  repo: GearRepository,
  ledger: Map<string, GearPhotoSyncState>,
  entry: PhotoSyncPlanEntry,
  now: number,
  err: unknown,
): Promise<void> {
  const previous = ledger.get(entry.key);
  const state: GearPhotoSyncState = {
    photoKey: entry.key,
    itemId: entry.itemId,
    photoId: entry.photoId,
    status: "missing",
    contentHash: photoFingerprint(entry.photo),
    fullBytes: previous?.fullBytes ?? 0,
    thumbBytes: previous?.thumbBytes ?? 0,
    attempts: (previous?.attempts ?? 0) + 1,
    lastAttemptAt: now,
    uploadedAt: previous?.uploadedAt ?? 0,
    lastError: err instanceof Error ? err.message : String(err),
  };
  await repo.upsertPhotoSyncState(state);
  ledger.set(entry.key, state);
}

// ─── Default adapters ──────────────────────────────────────────────────────

/** Supabase Storage adapter for the private `locker-photos` bucket. */
export function supabasePhotoStorage(supabase: SupabaseClient): PhotoStoragePort {
  return {
    async upload(path, blob, contentType) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType,
        upsert: true,
        // Immutable: the path contains a unique photoId, so a re-read can be
        // served from the CDN instead of Storage egress.
        cacheControl: "31536000",
      });
      if (error) throw error;
    },
    async download(path) {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
      return data;
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) throw error;
    },
  };
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: unknown; status?: unknown })?.statusCode ??
    (error as { status?: unknown })?.status;
  const message = String((error as { message?: unknown })?.message ?? "");
  return status === "404" || status === 404 || /not found/i.test(message);
}

/** IndexedDB blob store adapter (the real photo store). */
export function indexedDbPhotoBlobs(): PhotoBlobStore {
  return {
    keys: storedPhotoKeys,
    async read(itemId, photoId) {
      const record = await readPhoto(itemId, photoId);
      if (!record) return null;
      return { full: record.full, thumb: record.thumb || record.full };
    },
    import: importPhotoRecord,
    remove: deletePhoto,
  };
}

async function createGearRepo(): Promise<GearRepository> {
  const client = await initDB();
  const executor = async (sql: string, bind?: unknown[]) =>
    await client.execute(sql, bind);
  return new GearRepository(executor);
}
