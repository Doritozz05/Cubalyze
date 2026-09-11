"use client";

/**
 * imageUtils.ts — turn a user photo into something localStorage can hold.
 *
 * The Locker persists to localStorage (~5 MB for the whole origin), so a raw
 * 4 MB phone photo would fill it in one shot. We downscale to a bounded square
 * and re-encode as JPEG, which keeps a readable thumbnail in ~40–120 KB.
 */

const MAX_BYTES = 512 * 1024;

/**
 * Read an image file, downscale it to at most `maxSize` on its longest edge,
 * and return a JPEG data URL. Non-image or unreadable files reject.
 */
export async function compressImageFile(
  file: File,
  maxSize = 720,
  quality = 0.72,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image file");
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  context.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  // Second pass at lower quality if the first overshoots the budget.
  if (dataUrl.length * 0.75 > MAX_BYTES) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.5);
  }
  return dataUrl;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (older browsers / exotic formats).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Rough JSON size of a value in bytes (for the storage meter). */
export function jsonSizeBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
