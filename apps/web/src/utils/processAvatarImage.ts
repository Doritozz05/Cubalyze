"use client";

/**
 * Client-side avatar image processing.
 *
 * Phones produce multi-megabyte photos that would bloat the local profile
 * row (base64 ≈ 1.33× the file size) and make every profile read heavy.
 * This downscales to a square-friendly avatar size and re-encodes to a
 * compact format (WebP → JPEG → PNG), so the stored payload stays tiny
 * regardless of the source image. If decoding/rasterizing fails (e.g. an
 * exotic format), the original data URL is kept as a fallback.
 */

/** Largest avatar edge (px) after downscale — plenty for a 112px hero. */
export const AVATAR_MAX_DIMENSION = 512;

/** Re-encode quality (0..1) for WebP/JPEG exports. */
const AVATAR_QUALITY = 0.85;

/** Raw source cap — anything above is rejected before processing. */
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * When rasterizing fails we keep the original data URL — but only if it's
 * small, so a multi-megabyte source can never bloat the stored profile row.
 * (~1.5 MB binary ≈ 2 MB of base64 chars.)
 */
const MAX_RAW_FALLBACK_CHARS = 2 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't decode the image"));
    img.src = src;
  });
}

/**
 * Downscale + re-encode an avatar image. Never throws: on any processing
 * failure the original data URL is returned unchanged.
 */
export async function processAvatarImage(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);

  try {
    const img = await loadImage(raw);
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (naturalW <= 0 || naturalH <= 0) throw new Error("Empty image");

    const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    // Flatten to white first: a JPEG fallback would otherwise turn
    // transparent pixels black (ugly corners on light surfaces).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Try the most compact encoders first (WebP keeps alpha; JPEG/Png cover
    // browsers without a WebP encoder).
    const attempts = ["image/webp", "image/jpeg", "image/png"] as const;
    for (const type of attempts) {
      try {
        const dataUrl = canvas.toDataURL(type, AVATAR_QUALITY);
        if (dataUrl && dataUrl.length > 0) return dataUrl;
      } catch {
        // Unsupported encoder — try the next format.
      }
    }
  } catch {
    // Decode/rasterize failure (SVG edge cases, corrupted file…) — fall
    // through to the size-guarded raw fallback below.
  }

  if (raw.length > MAX_RAW_FALLBACK_CHARS) {
    throw new Error("Couldn't process this image — try a JPG, PNG or WebP");
  }
  return raw;
}
