"use client";

import { create } from "zustand";
import { preferencesStore } from "@cubeforge/state";

export type BackgroundMediaType = "image" | "video" | "gif";

export interface StoredBackgroundMedia {
  id: string; // 'current'
  blob: Blob;
  mimeType: string;
  mediaType: BackgroundMediaType;
  name: string;
  posterDataUrl: string;
  duration?: number;
  width?: number;
  height?: number;
  updatedAt: number;
}

const DB_NAME = "cubeforge-media";
const DB_VERSION = 1;
const STORE_NAME = "background";
const RECORD_ID = "current";

function openMediaDB(): Promise<IDBDatabase> {
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

export async function saveMediaToIndexedDB(
  record: Omit<StoredBackgroundMedia, "id" | "updatedAt">,
): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const item: StoredBackgroundMedia = {
      ...record,
      id: RECORD_ID,
      updatedAt: Date.now(),
    };
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getMediaFromIndexedDB(): Promise<StoredBackgroundMedia | null> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_ID);
      req.onsuccess = () => resolve((req.result as StoredBackgroundMedia) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[BackgroundMedia] Failed to read from IndexedDB:", err);
    return null;
  }
}

export async function deleteMediaFromIndexedDB(): Promise<void> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[BackgroundMedia] Failed to delete from IndexedDB:", err);
  }
}

interface BackgroundMediaState {
  mediaUrl: string | null;
  posterUrl: string | null;
  mediaType: BackgroundMediaType | null;
  duration: number | null;
  fileName: string | null;
  isLoading: boolean;
  isAnimating: boolean;
  animationKey: number;

  setIsAnimating: (isAnimating: boolean) => void;
  loadMedia: () => Promise<void>;
  setMedia: (
    data: Omit<StoredBackgroundMedia, "id" | "updatedAt">,
  ) => Promise<void>;
  clearMedia: () => Promise<void>;
}

export const useBackgroundMediaStore = create<BackgroundMediaState>((set, get) => ({
  mediaUrl: null,
  posterUrl: null,
  mediaType: null,
  duration: null,
  fileName: null,
  isLoading: true,
  isAnimating: false,
  animationKey: 0,

  setIsAnimating: (isAnimating: boolean) => {
    const prev = get().isAnimating;
    if (prev === isAnimating) return;
    set((state) => ({
      isAnimating,
      // Whenever animation starts, increment key so GIFs and videos restart cleanly from frame 0
      animationKey: isAnimating ? state.animationKey + 1 : state.animationKey,
    }));
  },

  loadMedia: async () => {
    set({ isLoading: true });
    try {
      const prefValue = preferencesStore.getState().timerBackgroundImage;
      if (!prefValue) {
        const oldUrl = get().mediaUrl;
        if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
        set({
          mediaUrl: null,
          posterUrl: null,
          mediaType: null,
          duration: null,
          fileName: null,
          isLoading: false,
          isAnimating: false,
        });
        return;
      }

      // If stored as legacy data URL or direct link
      if (prefValue.startsWith("data:") || prefValue.startsWith("http")) {
        set({
          mediaUrl: prefValue,
          posterUrl: prefValue,
          mediaType: "image",
          duration: null,
          fileName: "legacy-image",
          isLoading: false,
        });
        return;
      }

      // If stored in IndexedDB ('indexeddb:current')
      const record = await getMediaFromIndexedDB();
      if (!record) {
        // Preference was set but no media found in IndexedDB
        set({
          mediaUrl: null,
          posterUrl: null,
          mediaType: null,
          duration: null,
          fileName: null,
          isLoading: false,
        });
        return;
      }

      const oldUrl = get().mediaUrl;
      if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);

      const objectUrl = URL.createObjectURL(record.blob);
      set({
        mediaUrl: objectUrl,
        posterUrl: record.posterDataUrl || objectUrl,
        mediaType: record.mediaType,
        duration: record.duration ?? null,
        fileName: record.name,
        isLoading: false,
      });
    } catch (err) {
      console.error("[BackgroundMedia] Error loading media:", err);
      set({ isLoading: false });
    }
  },

  setMedia: async (data) => {
    set({ isLoading: true });
    try {
      await saveMediaToIndexedDB(data);

      const oldUrl = get().mediaUrl;
      if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);

      const objectUrl = URL.createObjectURL(data.blob);

      // Update preferences store to flag that custom background is active
      preferencesStore.getState().setTimerBackgroundImage("indexeddb:current");

      set((state) => ({
        mediaUrl: objectUrl,
        posterUrl: data.posterDataUrl || objectUrl,
        mediaType: data.mediaType,
        duration: data.duration ?? null,
        fileName: data.name,
        isLoading: false,
        isAnimating: false,
        animationKey: state.animationKey + 1,
      }));
    } catch (err) {
      console.error("[BackgroundMedia] Error setting media:", err);
      set({ isLoading: false });
      throw err;
    }
  },

  clearMedia: async () => {
    try {
      const oldUrl = get().mediaUrl;
      if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);

      await deleteMediaFromIndexedDB();
      preferencesStore.getState().setTimerBackgroundImage(null);

      set({
        mediaUrl: null,
        posterUrl: null,
        mediaType: null,
        duration: null,
        fileName: null,
        isLoading: false,
        isAnimating: false,
      });
    } catch (err) {
      console.error("[BackgroundMedia] Error clearing media:", err);
      preferencesStore.getState().setTimerBackgroundImage(null);
      set({
        mediaUrl: null,
        posterUrl: null,
        mediaType: null,
        duration: null,
        fileName: null,
        isLoading: false,
        isAnimating: false,
      });
    }
  },
}));

// Load media on startup when in browser environment
if (typeof window !== "undefined") {
  void useBackgroundMediaStore.getState().loadMedia();
}
