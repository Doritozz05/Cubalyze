"use client";

import { useSyncExternalStore } from "react";

// ── Module-level dock zone state ───────────────────────────────────────

/**
 * Lightweight shared state for dock zone hover detection.
 * FloatingWidgetWrapper sets this during drag; Header reads it
 * to show the dock zone indicator.
 */
let isNearDock = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const dockZoneState = {
  get active() {
    return isNearDock;
  },
  set active(v: boolean) {
    if (isNearDock !== v) {
      isNearDock = v;
      notify();
    }
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot() {
    return isNearDock;
  },
};

/** React hook: returns true when a widget is being dragged near the dock zone. */
export function useDockZoneActive(): boolean {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    dockZoneState.getSnapshot,
  );
}
