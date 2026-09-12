/**
 * collectionPhotos — where the Locker's photo bytes actually live.
 *
 * IndexedDB is faked in memory and object URLs are stubbed: what is under test is
 * the store's contract, which is where the silent bugs would be — a rendition
 * that is never written, a URL revoked while a card still points at it, an item's
 * photos left behind after the item is gone, or the orphan sweep eating photos
 * the editor has just staged for an item that does not exist yet.
 *
 * The canvas downscaling itself is NOT covered here (Node has no canvas); its
 * arithmetic is pure and tested at the bottom.
 */
import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  acquirePhotoUrl,
  clearAllPhotos,
  collectionPhotoUsage,
  deleteItemPhotos,
  deletePhoto,
  importPhotoRecord,
  photoKey,
  pruneOrphanPhotos,
  readPhoto,
  saveProcessedPhoto,
} from "../collectionPhotos";
import {
  JPEG_QUALITY_LADDER,
  MAX_PHOTO_EDGE,
  THUMB_EDGE,
  blobToDataUrl,
  dataUrlToBlob,
  fitWithin,
  fitsBudget,
  pickJpegQuality,
} from "../imageUtils";

const originalObjectUrls = {
  createObjectURL: URL.createObjectURL,
  revokeObjectURL: URL.revokeObjectURL,
};

let createdUrls: string[] = [];
let revokedUrls: string[] = [];
let urlSeq = 0;

beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: () => {
      urlSeq += 1;
      const url = `blob:test-${urlSeq}`;
      createdUrls.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
  });
});

afterAll(() => {
  Object.assign(URL, originalObjectUrls);
});

beforeEach(async () => {
  createdUrls = [];
  revokedUrls = [];
  // The fake IndexedDB is shared by every test in this file: start each one
  // from an empty store so "how many photos are left" means something.
  await clearAllPhotos();
});

let itemSeq = 0;
function freshItemId(): string {
  itemSeq += 1;
  return `item-${itemSeq}`;
}

function processed(full = "FULL-BYTES", thumb = "THUMB") {
  return {
    full: new Blob([full], { type: "image/jpeg" }),
    thumb: new Blob([thumb], { type: "image/jpeg" }),
    width: 1280,
    height: 960,
  };
}

describe("photo store", () => {
  it("stores both renditions and returns a reference with the natural size", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed(), 1234);

    expect(ref.width).toBe(1280);
    expect(ref.height).toBe(960);
    expect(ref.addedAt).toBe(1234);

    const stored = await readPhoto(itemId, ref.id);
    expect(await stored?.full.text()).toBe("FULL-BYTES");
    expect(await stored?.thumb.text()).toBe("THUMB");
    expect(stored?.itemId).toBe(itemId);
  });

  it("returns null for a photo that is not there", async () => {
    expect(await readPhoto("nobody", "nothing")).toBeNull();
  });

  it("resolves an object URL once and revokes it when the last user lets go", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed());

    const first = await acquirePhotoUrl(itemId, ref.id, "thumb");
    const second = await acquirePhotoUrl(itemId, ref.id, "thumb");
    expect(first.url).toBeTruthy();
    expect(second.url).toBe(first.url);
    // One blob read, two consumers.
    expect(createdUrls).toHaveLength(1);

    first.release();
    expect(revokedUrls).toEqual([]);

    second.release();
    expect(revokedUrls).toEqual([first.url]);
  });

  it("imports a photo under an explicit id and forgets its cached URL", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed("OLD"));
    await acquirePhotoUrl(itemId, ref.id, "thumb");
    expect(createdUrls).toHaveLength(1);

    await importPhotoRecord({
      itemId,
      photoId: ref.id,
      full: new Blob(["NEW"], { type: "image/jpeg" }),
      thumb: new Blob(["NEW-THUMB"], { type: "image/jpeg" }),
      width: 100,
      height: 80,
      addedAt: 7,
    });

    // The overwrite must invalidate the URL that pointed at the old bytes.
    expect(revokedUrls).toEqual([createdUrls[0]]);
    const stored = await readPhoto(itemId, ref.id);
    expect(await stored?.full.text()).toBe("NEW");
    expect(stored?.width).toBe(100);
  });

  it("deletes every rendition of one item and leaves the others alone", async () => {
    const keep = freshItemId();
    const drop = freshItemId();
    const keptRef = await saveProcessedPhoto(keep, processed());
    const first = await saveProcessedPhoto(drop, processed());
    await saveProcessedPhoto(drop, processed());

    const removed = await deleteItemPhotos(drop);
    expect(removed).toBe(2);

    const usage = await collectionPhotoUsage();
    expect(usage.photos).toBe(1);
    expect(await readPhoto(drop, first.id)).toBeNull();
    expect(await readPhoto(keep, keptRef.id)).not.toBeNull();
  });

  it("releases the cached URL when a photo is deleted", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed());
    await acquirePhotoUrl(itemId, ref.id, "thumb");

    await deletePhoto(itemId, ref.id);
    expect(revokedUrls).toEqual([createdUrls[0]]);
    expect(await readPhoto(itemId, ref.id)).toBeNull();
  });

  it("spares a photo staged moments ago and sweeps an abandoned one", async () => {
    const itemId = freshItemId();
    const now = 11 * 60 * 1000;
    // One photo is seconds old (an editor is still open), the other predates
    // the grace window by minutes.
    const staged = await saveProcessedPhoto(itemId, processed(), now - 10_000);
    const abandoned = await saveProcessedPhoto(itemId, processed(), 0);

    const removed = await pruneOrphanPhotos([], { now });
    expect(removed).toBe(1);
    expect(await readPhoto(itemId, staged.id)).not.toBeNull();
    expect(await readPhoto(itemId, abandoned.id)).toBeNull();
  });

  it("never sweeps a referenced photo, however old", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed(), 0);
    expect(await pruneOrphanPhotos([photoKey(itemId, ref.id)], { now: 10 * 60 * 1000 })).toBe(0);
    expect(await readPhoto(itemId, ref.id)).not.toBeNull();
  });

  it("sweeps an unreferenced photo of an item that still exists", async () => {
    // The abandoned-edit case: the item is alive, but this photo is no longer
    // part of it, so an item-level sweep would never have reclaimed it.
    const itemId = freshItemId();
    const referenced = await saveProcessedPhoto(itemId, processed(), 0);
    const dropped = await saveProcessedPhoto(itemId, processed(), 0);

    const removed = await pruneOrphanPhotos([photoKey(itemId, referenced.id)], {
      now: 10 * 60 * 1000,
    });
    expect(removed).toBe(1);
    expect(await readPhoto(itemId, referenced.id)).not.toBeNull();
    expect(await readPhoto(itemId, dropped.id)).toBeNull();
  });

  it("empties the store on a full wipe", async () => {
    const itemId = freshItemId();
    const ref = await saveProcessedPhoto(itemId, processed());
    await acquirePhotoUrl(itemId, ref.id, "thumb");

    await clearAllPhotos();
    expect((await collectionPhotoUsage()).photos).toBe(0);
    expect(revokedUrls).toEqual([createdUrls[0]]);
  });
});

describe("image helpers", () => {
  it("downscales to the longest edge and never upscales", () => {
    expect(fitWithin(2560, 1440, MAX_PHOTO_EDGE)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(1440, 2560, MAX_PHOTO_EDGE)).toEqual({ width: 720, height: 1280 });
    expect(fitWithin(320, 240, MAX_PHOTO_EDGE)).toEqual({ width: 320, height: 240 });
    expect(fitWithin(1000, 1000, THUMB_EDGE)).toEqual({ width: 320, height: 320 });
  });

  it("clamps the quality ladder instead of running off the end", () => {
    expect(pickJpegQuality(0)).toBe(JPEG_QUALITY_LADDER[0]);
    expect(pickJpegQuality(JPEG_QUALITY_LADDER.length - 1)).toBe(
      JPEG_QUALITY_LADDER[JPEG_QUALITY_LADDER.length - 1],
    );
    expect(pickJpegQuality(99)).toBe(JPEG_QUALITY_LADDER[JPEG_QUALITY_LADDER.length - 1]);
    expect(pickJpegQuality(-3)).toBe(JPEG_QUALITY_LADDER[0]);
  });

  it("knows the byte budget", () => {
    expect(fitsBudget(10)).toBe(true);
    expect(fitsBudget(601 * 1024)).toBe(false);
  });

  it("round-trips bytes through a data URL without re-encoding", async () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255, 0, 128]);
    const blob = new Blob([bytes], { type: "image/png" });

    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const restored = dataUrlToBlob(dataUrl);
    expect(restored).not.toBeNull();
    expect(restored?.type).toBe("image/png");
    expect(new Uint8Array(await restored!.arrayBuffer())).toEqual(bytes);
  });

  it("refuses a data URL that is not base64", () => {
    expect(dataUrlToBlob("data:image/svg+xml,<svg/>")).toBeNull();
    expect(dataUrlToBlob("nonsense")).toBeNull();
  });
});
