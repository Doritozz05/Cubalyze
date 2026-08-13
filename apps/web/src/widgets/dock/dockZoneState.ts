"use client";

import { useSyncExternalStore } from "react";

// ── Module-level dock zone state ───────────────────────────────────────

/** A rectangle in viewport coordinates (from getBoundingClientRect). */
export interface DockRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lightweight shared state for dock zone hover detection and drop positioning.
 * Uses a Set of widget IDs so multiple FloatingWidgetWrappers can
 * report "near dock" independently. Unmount or leave cleans up
 * only that widget's entry — no race condition.
 */
const _nearIds = new Set<string>();
let _dropX = 0;
let _dropIndex = -1; // calculated insertion index (-1 = end)
const listeners = new Set<() => void>();

/**
 * The dock bar's CURRENT on-screen rectangle (viewport coords), kept fresh
 * by WidgetDock via a ResizeObserver. The floating widgets read it
 * imperatively from their drag loop, so the dock zone follows the real
 * bar wherever it sits — shrinking only when the pointer is actually over
 * the dock, never over dead header space. null = no dock rendered.
 */
let _dockRect: DockRect | null = null;

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
  /** The dock bar's current on-screen rectangle, or null when no dock. */
  get dockRect(): DockRect | null {
    return _dockRect;
  },
  /** WidgetDock registers its live bounding rect here (updated on resize). */
  setDockRect(rect: DockRect | null) {
    _dockRect = rect;
  },
  /**
   * A widget entered the dock zone (idempotent per widget id).
   *
   * PERFORMANCE: this is called once per animation frame while a widget
   * drags over the dock, so it must NOT notify on every x change — that
   * would re-render the whole WidgetDock at 60fps. The drop X is stored
   * silently; WidgetDock polls it in its own RAF loop and only re-renders
   * when the computed insertion index actually changes. React subscribers
   * are notified only on the empty → non-empty transition.
   */
  enter(id: string, x?: number) {
    const wasEmpty = _nearIds.size === 0;
    _nearIds.add(id);
    if (x !== undefined) _dropX = x;
    if (wasEmpty) notify();
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
 * React hook: returns the ID of the widget currently being dragged over
 * the dock zone, or null if none.
 */
export function useDraggingWidgetId(): string | null {
  return useSyncExternalStore(
    dockZoneState.subscribe,
    () => (_nearIds.size > 0 ? [..._nearIds][0] : null),
  );
}
