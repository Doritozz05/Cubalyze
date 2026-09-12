/**
 * collectionTransfer — the Locker's backup file, in both directions.
 *
 * This is the one place that has to stay lossless: a backup that loses a photo,
 * or restores references to bytes that were never written, is worse than no
 * backup at all. The test therefore round-trips real blobs through a real file
 * payload (with IndexedDB faked in memory) and also feeds it the two OLDER
 * shapes — a plain exported state and a state whose photos are still base64
 * strings — because those are the files users actually have on disk.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildLockerFile, isLockerFile, readLockerFile } from "../collectionTransfer";
import {
  clearAllPhotos,
  deleteItemPhotos,
  importPhotoRecord,
  photoKey,
  readPhoto,
} from "../collectionPhotos";
import { blobToDataUrl } from "../imageUtils";
import {
  DEFAULT_PALETTE,
  seedCollectionState,
  type CollectionState,
  type GearItem,
  type GearPhotoRef,
  type GlobalCategoryOption,
} from "../collectionModel";

const OPTIONS: readonly GlobalCategoryOption[] = [
  { category: "3x3", name: "3×3", playable: true, planned: false },
];

const ITEM_ID = "item-1";
const PHOTO_ID = "photo-1";

function itemWith(photos: readonly GearPhotoRef[], categoryId: string): GearItem {
  return {
    id: ITEM_ID,
    categoryId,
    typeId: null,
    name: "GAN 12",
    palette: [...DEFAULT_PALETTE],
    links: [],
    photos,
    tags: ["ballcore"],
    status: "owned",
    primary: true,
    favorite: false,
    quantity: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

function stateWith(photos: readonly GearPhotoRef[]): CollectionState {
  const base = seedCollectionState(OPTIONS, []);
  return { ...base, items: [itemWith(photos, base.categories[0]!.id)] };
}

const PHOTO_REF: GearPhotoRef = { id: PHOTO_ID, width: 640, height: 480, addedAt: 99 };

async function storePhoto(fullBytes = "FULL", thumbBytes = "THUMB"): Promise<void> {
  await importPhotoRecord({
    itemId: ITEM_ID,
    photoId: PHOTO_ID,
    full: new Blob([fullBytes], { type: "image/jpeg" }),
    thumb: new Blob([thumbBytes], { type: "image/jpeg" }),
    width: 640,
    height: 480,
    addedAt: 99,
  });
}

beforeEach(async () => {
  // The fake IndexedDB is shared by all tests in this file.
  await clearAllPhotos();
});

describe("locker backup file", () => {
  it("bundles the stored bytes and the natural size", async () => {
    await storePhoto();
    const { file, photoCount, missingPhotos } = await buildLockerFile(stateWith([PHOTO_REF]));

    expect(photoCount).toBe(1);
    expect(missingPhotos).toBe(0);
    expect(file.format).toBe("cubeforge-locker");
    expect(isLockerFile(file)).toBe(true);

    const record = file.photos[photoKey(ITEM_ID, PHOTO_ID)]!;
    expect(record.width).toBe(640);
    expect(record.addedAt).toBe(99);
    expect(record.full.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(file.data.items[0]!.photos).toEqual([PHOTO_REF]);
  });

  it("survives a full round trip without re-encoding a byte", async () => {
    await storePhoto("EXACT-FULL-BYTES", "EXACT-THUMB");
    const { file } = await buildLockerFile(stateWith([PHOTO_REF]));
    const text = JSON.stringify(file);

    // A restore into a device where the photo store is empty (or a new one).
    await deleteItemPhotos(ITEM_ID);
    expect(await readPhoto(ITEM_ID, PHOTO_ID)).toBeNull();

    const restored = await readLockerFile(text);
    expect(restored.importedPhotos).toBe(1);
    expect(restored.skippedPhotos).toBe(0);
    expect(restored.state.items[0]!.photos).toEqual([PHOTO_REF]);

    const stored = await readPhoto(ITEM_ID, PHOTO_ID);
    expect(await stored?.full.text()).toBe("EXACT-FULL-BYTES");
    expect(await stored?.thumb.text()).toBe("EXACT-THUMB");
  });

  it("leaves out a reference whose bytes are already gone", async () => {
    // Nothing stored: the photo does not exist anywhere.
    const { file, photoCount, missingPhotos } = await buildLockerFile(stateWith([PHOTO_REF]));
    expect(photoCount).toBe(0);
    expect(missingPhotos).toBe(1);
    expect(file.data.items[0]!.photos).toEqual([]);
  });

  it("drops references the file cannot restore", async () => {
    const file = {
      format: "cubeforge-locker",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: stateWith([PHOTO_REF]),
      photos: {},
    };
    const restored = await readLockerFile(JSON.stringify(file));
    expect(restored.importedPhotos).toBe(0);
    expect(restored.state.items[0]!.photos).toEqual([]);
  });

  it("converts a pre-database export (photos as base64 strings)", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const dataUrl = await blobToDataUrl(new Blob([bytes], { type: "image/png" }));
    const legacy = {
      // The old zustand envelope, exactly as it sat in localStorage.
      state: {
        data: {
          version: 1,
          categories: stateWith([]).categories,
          types: stateWith([]).types,
          excludedCategories: ["3x3 OH"],
          items: [{ ...stateWith([]).items[0]!, photos: [dataUrl, dataUrl] }],
        },
      },
      version: 1,
    };

    const restored = await readLockerFile(JSON.stringify(legacy));
    expect(restored.legacyPhotos).toBe(2);
    expect(restored.importedPhotos).toBe(0);
    expect(restored.state.excludedCategories).toEqual(["3x3 OH"]);
    expect(restored.state.items[0]!.photos).toHaveLength(2);

    const ref = restored.state.items[0]!.photos[0]!;
    const stored = await readPhoto(ITEM_ID, ref.id);
    expect(stored).not.toBeNull();
    expect(new Uint8Array(await stored!.full.arrayBuffer())).toEqual(bytes);
    // No thumbnail existed in the old format: the full rendition stands in.
    expect(await stored!.thumb.text()).toBe(await stored!.full.text());
  });

  it("rejects a file that holds no collection at all", async () => {
    await expect(readLockerFile('{"hello":"world"}')).rejects.toThrow();
    await expect(readLockerFile("not json")).rejects.toThrow();
  });
});
