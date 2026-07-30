"use client";

import { useSyncExternalStore } from "react";

// ── Module-level dock zone state ───────────────────────────────────────

/**
 * Lightweight shared state for dock zone hover detection and drop positioning.
 * Uses a Set of widget IDs so multiple FloatingWidgetWrappers can
 * report "near dock" independently. Unmount or leave cleans up
 * only that widget's entry — no race condition.
 */
let _nearIds = new Set<string>();
let _dropX = 0;
let _dropIndex = -1; // calculated insertion index (-1 = end)
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const dockZoneState = {
  get active() {
    return _nearIds.size > 0;
  },
  /** The x position of the dragging widget (used to calculate insertion index). */
  get dropX() {
    return _dropX;
  },
  /** The calculated insertion index in dockOrder. -1 means append to end. */
  get dropIndex() {
    return _dropIndex;
  },
  /** A widget entered the dock zone (idempotent per widget id). */
  enter(id: string, x?: number) {
    const wasEmpty = _nearIds.size === 0;
    _nearIds.add(id);
    if (x !== undefined && x !== _dropX) {
      _dropX = x;
      notify();
    } else if (wasEmpty) {
      notify();
    }
  },
  /** Update the drop x position while dragging over the dock. */
  updateX(x: number) {
    _dropX = x;
  },
  /** WidgetDock calls this to register the computed insertion index. */
  setDropIndex(index: number) {
    if (_dropIndex !== index) {
      _dropIndex = index;
      notify();
    }
  },
  /** A widget left the dock zone (idempotent per widget id). */
  leave(id: string) {
    const hadItems = _nearIds.size > 0;
    _nearIds.delete(id);
    if (hadItems && _nearIds.size === 0) {
      _dropIndex = -1;
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

/**
 * React hook: returns the calculated insertion index for the drop.
 * WidgetDock subscribes to this to know where to show the indicator.
 */
export function useDropIndex(): number {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    () => _dropIndex,
  );
}

/**
 * React hook: returns the current drop x position of the dragging widget.
 */
export function useDropX(): number {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    () => _dropX,
  );
}

/**
 * React hook: returns the ID of the widget currently being dragged over
 * the dock zone, or null if none.
 */
export function useDraggingWidgetId(): string | null {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    () => (_nearIds.size > 0 ? [..._nearIds][0] : null),
  );
}
