"use client";

import { create } from "zustand";

export type StorageType = "opfs" | "memory" | "unknown";

interface StorageStatusState {
  /** OPFS = persistent, memory = data lost on reload, unknown = not checked yet. */
  storageType: StorageType;
  setStorageType: (t: StorageType) => void;
}

/**
 * Surfaces the SQLite storage backend to the UI.
 *
 * When the DB falls back to in-memory storage (OPFS unavailable — e.g.
 * private browsing, locked by another tab), solves and progress are LOST on
 * reload. Components (App banner, Settings → Data) read this store to warn
 * the user and suggest exporting their data.
 */
export const useStorageStatusStore = create<StorageStatusState>((set) => ({
  storageType: "unknown",
  setStorageType: (storageType) => set({ storageType }),
}));
