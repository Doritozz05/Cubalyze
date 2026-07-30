"use client";

import { useSyncExternalStore } from "react";

// ── Module-level dock zone state ───────────────────────────────────────

/**
 * Lightweight shared state for dock zone hover detection.
 * Uses a Set of widget IDs so multiple FloatingWidgetWrappers can
 * report "near dock" independently. Unmount or leave cleans up
 * only that widget's entry — no race condition.
 */
let _nearIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const dockZoneState = {
  get active() {
    return _nearIds.size > 0;
  },
  /** A widget entered the dock zone (idempotent per widget id). */
  enter(id: string) {
    const wasEmpty = _nearIds.size === 0;
    _nearIds.add(id);
    if (wasEmpty) notify();
  },
  /** A widget left the dock zone (idempotent per widget id). */
  leave(id: string) {
    const hadItems = _nearIds.size > 0;
    _nearIds.delete(id);
    if (hadItems && _nearIds.size === 0) notify();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot() {
    return _nearIds.size > 0;
  },
};

/** React hook: returns true when any widget is being dragged near the dock zone. */
export function useDockZoneActive(): boolean {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    dockZoneState.getSnapshot,
  );
}
