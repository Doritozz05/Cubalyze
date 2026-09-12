"use client";

/**
 * imageUtils.ts — turn a user photo into the two renditions the Locker stores.
 *
 * The Locker keeps photo BYTES as blobs in IndexedDB (never as base64 in a row,
 * never in localStorage): a full rendition for the detail panel and a thumb for
 * the grid, so a wall of cards never decodes a 1280 px JPEG on a phone.
 *
 * Both renditions are produced here, and the full one is walked down a quality
 * ladder until it fits the byte budget. All the arithmetic lives in small pure
 * helpers (`fitWithin`, `pickJpegQuality`) so it can be tested without a canvas,
 * which Node does not have.
 */

/** Longest edge of the stored full rendition. */
export const MAX_PHOTO_EDGE = 1280;
/** Byte budget for the full rendition (a phone photo is 3–5 MB before this). */
export const MAX_PHOTO_BYTES = 600 * 1024;
/** Longest edge of the grid thumbnail. */
export const THUMB_EDGE = 320;

/**
 * JPEG quality ladder for the full rendition. The first step under the budget
 * wins; a photo that still overshoots at the last step is stored anyway (the
 * alternative — dropping the user's photo — is worse than a big file).
 */
export const JPEG_QUALITY_LADDER = [0.82, 0.7, 0.55, 0.45] as const;

/** Thumbnails are always small on screen, so quality never has to be traded. */
export const THUMB_QUALITY = 0.7;

export interface ProcessedPhoto {
  full: Blob;
  thumb: Blob;
  /** Natural size of the STORED full rendition (after downscaling). */
  width: number;
  height: number;
}

export class PhotoError extends Error {
  readonly code: "NOT_AN_IMAGE" | "TOO_LARGE" | "UNREADABLE";

  constructor(code: PhotoError["code"], message: string) {
    super(message);
    this.name = "PhotoError";
    this.code = code;
  }
}

/** Never upscale: a small photo keeps its size, only big ones come down. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0 || maxEdge <= 0 || longest <= maxEdge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The quality to try at `attempt` (0-based). Past the end of the ladder the
 * last step repeats, so callers can loop without special-casing.
 */
export function pickJpegQuality(attempt: number): number {
  const index = Math.min(Math.max(0, Math.trunc(attempt)), JPEG_QUALITY_LADDER.length - 1);
  return JPEG_QUALITY_LADDER[index]!;
}

/** True when the encoded blob fits the full-rendition budget. */
export function fitsBudget(bytes: number): boolean {
  return bytes <= MAX_PHOTO_BYTES;
}

/** Decode a file into something drawable (bitmap when available, `<img>` otherwise). */
async function loadBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source);
    } catch {
      // Fall through to the <img> path (older browsers / exotic formats).
    }
  }
  const url = URL.createObjectURL(source);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new PhotoError("UNREADABLE", "Could not decode image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(
  bitmap: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("UNREADABLE", "Canvas 2D context unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("UNREADABLE", "Encoding failed"))),
      "image/jpeg",
      quality,
    );
  });
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
}

/**
 * Downscale + encode both renditions. Rejects with a `PhotoError` on anything
 * that is not a decodable image, so the caller can show one honest message.
 */
async function processPhotoBlob(source: Blob): Promise<ProcessedPhoto> {
  if (!source.type.startsWith("image/")) {
    throw new PhotoError("NOT_AN_IMAGE", `Not an image file (${source.type || "unknown"})`);
  }
  const bitmap = await loadBitmap(source);
  try {
    const naturalWidth = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
    const naturalHeight = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
    const full = fitWithin(naturalWidth, naturalHeight, MAX_PHOTO_EDGE);

    const fullCanvas = drawToCanvas(bitmap, full.width, full.height);
    let encoded = await canvasToBlob(fullCanvas, pickJpegQuality(0));
    for (let attempt = 1; !fitsBudget(encoded.size); attempt += 1) {
      if (attempt >= JPEG_QUALITY_LADDER.length) break;
      encoded = await canvasToBlob(fullCanvas, pickJpegQuality(attempt));
    }

    const thumb = fitWithin(full.width, full.height, THUMB_EDGE);
    const thumbBlob = await canvasToBlob(drawToCanvas(bitmap, thumb.width, thumb.height), THUMB_QUALITY);

    return { full: encoded, thumb: thumbBlob, width: full.width, height: full.height };
  } finally {
    closeBitmap(bitmap);
  }
}

/** Same pipeline, starting from a `File` picked by the user. */
export function processPhotoFile(file: File): Promise<ProcessedPhoto> {
  return processPhotoBlob(file);
}

/**
 * Same pipeline, starting from a data URL — the shape photos had before they
 * moved to IndexedDB, so legacy localStorage data and old JSON exports can be
 * converted losslessly instead of being dropped.
 */
export async function processPhotoDataUrl(dataUrl: string): Promise<ProcessedPhoto> {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  if (!match) throw new PhotoError("NOT_AN_IMAGE", "Not a data URL");
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return processPhotoBlob(blob.slice(0, blob.size, match[1] ?? blob.type));
}

/**
 * Data URL for the EXPORT paths only: a portable JSON file has to carry the
 * bytes inline. Storage never uses this — that is the whole point of the store.
 *
 * Reads the blob's bytes directly (no `FileReader`) so the whole backup path is
 * exercisable without a DOM, and converts them to base64 in chunks: a btoa call
 * with one argument per byte would blow the stack on a 600 KB photo.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

/**
 * Decode a base64 data URL back into the exact bytes it was written from.
 *
 * This is the import counterpart of `blobToDataUrl` and it deliberately does
 * NOT re-encode: a photo that goes out in a backup must come back identical
 * (re-encoding would re-compress it and lose a little quality every round trip).
 * Returns `null` for anything that is not base64 (the caller then falls back to
 * the canvas pipeline), so legacy non-base64 data URLs still import.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]*);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  try {
    const binary = atob(match[2] ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}
