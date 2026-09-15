"use client";

import type { CustomFontMeta } from "@cubalyze/state";

/**
 * User-uploaded fonts: blobs in IndexedDB, metadata in preferencesStore.
 *
 * Each file is registered as one @font-face (400/normal) under the family
 * `CustomFont-<id>` and resolved through the typography registry like a
 * built-in. Object URLs live for the session; they are rebuilt on every
 * boot from IndexedDB (fire-and-forget, display:swap covers the gap).
 */

const DB_NAME = "cubeforge-fonts";
const DB_VERSION = 1;
const STORE_NAME = "fonts";

interface FontBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
}

/** woff2 / woff / ttf / otf, 3 MB cap. */
const MAX_FONT_BYTES = 3 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

function openFontsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function sniffKind(file: File): "woff2" | "woff" | "ttf" | "otf" | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "woff2" || ext === "woff" || ext === "ttf" || ext === "otf") return ext;
  const type = file.type.toLowerCase();
  if (type.includes("woff2")) return "woff2";
  if (type.includes("woff")) return "woff";
  if (type.includes("ttf") || type.includes("truetype")) return "ttf";
  if (type.includes("otf") || type.includes("opentype")) return "otf";
  return null;
}

async function sniffMagic(file: File, kind: string): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (kind === "woff2") return head[0] === 0x77 && head[1] === 0x4f && head[2] === 0x46 && head[3] === 0x32;
  if (kind === "woff") return head[0] === 0x77 && head[1] === 0x4f && head[2] === 0x46 && head[3] === 0x46;
  if (kind === "ttf") return head[0] === 0x00 && head[1] === 0x01 && head[2] === 0x00 && head[3] === 0x00;
  if (kind === "otf") return head[0] === 0x4f && head[1] === 0x54 && head[2] === 0x54 && head[3] === 0x4f;
  return false;
}

export type FontValidationErrorCode = "BAD_TYPE" | "TOO_LARGE" | "BAD_MAGIC";

export class FontValidationError extends Error {
  code: FontValidationErrorCode;
  constructor(code: FontValidationErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Validate a user-picked file, returning its kind + canonical mime. */
export async function validateFontFile(file: File): Promise<{ kind: string; mimeType: string }> {
  const kind = sniffKind(file);
  if (!kind) throw new FontValidationError("BAD_TYPE");
  if (file.size <= 0 || file.size > MAX_FONT_BYTES) throw new FontValidationError("TOO_LARGE");
  if (!(await sniffMagic(file, kind))) throw new FontValidationError("BAD_MAGIC");
  return { kind, mimeType: MIME_BY_EXT[kind] };
}

/** Family name used in @font-face + stacks for a custom font id. */
export function customFontFamily(id: string): string {
  return `CustomFont-${id}`;
}

const injectedFamilies = new Set<string>();
const objectUrls = new Map<string, string>();

/** Retrieve the active in-memory object URL for a custom font. */
export function getCustomFontBlobUrl(id: string): string | undefined {
  return objectUrls.get(id);
}

function injectFace(id: string, url: string): void {
  const family = customFontFamily(id);
  if (injectedFamilies.has(family)) return;
  const face = new FontFace(family, `url(${url})`, {
    weight: "400",
    style: "normal",
    display: "swap",
  });
  // Skip the async load gate: the face applies as soon as the URL resolves.
  void face.load().catch(() => undefined);
  document.fonts.add(face);
  injectedFamilies.add(family);
}

export async function saveFontBlob(id: string, file: File, mimeType: string): Promise<string> {
  const db = await openFontsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const record: FontBlobRecord = { id, blob: file, mimeType, updatedAt: Date.now() };
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
  return activateFontBlob(id, file);
}

/** Create the object URL + @font-face for an in-memory file. */
export function activateFontBlob(id: string, blob: Blob): string {
  const prev = objectUrls.get(id);
  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  if (typeof document !== "undefined") injectFace(id, url);
  return url;
}

export async function deleteFontBlob(id: string): Promise<void> {
  try {
    const db = await openFontsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[CustomFonts] Failed to delete blob:", err);
  }
  const prev = objectUrls.get(id);
  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
  objectUrls.delete(id);
  injectedFamilies.delete(customFontFamily(id));
}

/** Rebuild every persisted custom font face (call once at boot). */
export async function loadCustomFonts(metas: CustomFontMeta[]): Promise<void> {
  if (typeof window === "undefined" || metas.length === 0) return;
  try {
    const db = await openFontsDB();
    const blobs: FontBlobRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as FontBlobRecord[]) ?? []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
    const byId = new Map(blobs.map((b) => [b.id, b.blob]));
    for (const meta of metas) {
      const blob = byId.get(meta.id);
      if (blob) activateFontBlob(meta.id, blob);
    }
  } catch (err) {
    console.warn("[CustomFonts] Failed to restore faces:", err);
  }
}
