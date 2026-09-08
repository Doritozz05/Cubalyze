"use client";

import { useSyncExternalStore } from "react";
import { normalizeHex } from "./colorUtils";

const STORAGE_KEY = "cubeforge:favorite-colors";
export const MAX_FAVORITE_COLORS = 16;

let cache: string[] | null = null;
const listeners = new Set<() => void>();
let storageHooked = false;

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const hex = normalizeHex(item);
      if (hex && !clean.includes(hex)) clean.push(hex);
      if (clean.length >= MAX_FAVORITE_COLORS) break;
    }
    return clean;
  } catch {
    return [];
  }
}

function emit() {
  for (const fn of listeners) fn();
}

function onStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    cache = readStored();
    emit();
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (!storageHooked && typeof window !== "undefined") {
    storageHooked = true;
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): string[] {
  if (cache === null) cache = readStored();
  return cache;
}

function getServerSnapshot(): string[] {
  return [];
}

/**
 * Shared global palette (stickers + themes) persisted in localStorage.
 * Single module-level store: one storage listener and one parse no matter
 * how many pickers are mounted.
 */
export function useFavoriteColors(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveFavoriteColor(color: string): boolean {
  const hex = normalizeHex(color);
  if (!hex) return false;
  const current = getSnapshot();
  if (current.includes(hex)) return true;
  const next = [...current, hex].slice(-MAX_FAVORITE_COLORS);
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode: keep in-memory state only.
  }
  emit();
  return true;
}

export function removeFavoriteColor(color: string): void {
  const hex = normalizeHex(color);
  if (!hex) return;
  const next = getSnapshot().filter((c) => c !== hex);
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode: keep in-memory state only.
  }
  emit();
}

export function isFavoriteColor(color: string): boolean {
  const hex = normalizeHex(color);
  return hex ? getSnapshot().includes(hex) : false;
}
