"use client";

import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface ContextMenuItemBase {
  /** Unique key (also used as React key in the menu). */
  id: string;
  /** Optional icon component (lucide). */
  icon?: LucideIcon;
  /** Called when the item is clicked. */
  onClick?: () => void;
  /** Render a thin separator line before this item. */
  separatorBefore?: boolean;
  /** Grey out + disable click. */
  disabled?: boolean;
  /** Red/destructive styling for danger actions like delete. */
  destructive?: boolean;
  /**
   * Why the action is off, as a second line under the label. A context menu has
   * no hover, so this is the only place the reason can surface.
   */
  hint?: string;
}

/**
 * A label is either a `contextMenu` i18n key (resolved by the component) or the
 * caller's own already-resolved text — the escape hatch for callers whose
 * strings live in another namespace (e.g. the Insights solve actions, which the
 * detail panel and the row menu share so the same action reads the same way).
 * Exactly one of the two is required: no item can end up with both or neither.
 */
export type ContextMenuItem =
  | (ContextMenuItemBase & { /** i18n key in the `contextMenu` namespace. */ label: string; labelText?: undefined })
  | (ContextMenuItemBase & { /** Final, already-localized text. */ labelText: string; label?: undefined });

// ── Module-level state ─────────────────────────────────────────────────

let _open = false;
let _x = 0;
let _y = 0;
let _items: ContextMenuItem[] = [];
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

// ── Public API ─────────────────────────────────────────────────────────

export const contextMenuStore = {
  open(x: number, y: number, items: ContextMenuItem[]) {
    _x = x;
    _y = y;
    _items = items;
    _open = true;
    emitSnapshot();
  },

  close() {
    if (!_open) return;
    _open = false;
    _items = [];
    emitSnapshot();
  },

  get isOpen() {
    return _open;
  },
};

// ── React hooks (useSyncExternalStore) ─────────────────────────────────

let _snapshot: { open: boolean; x: number; y: number; items: ContextMenuItem[] } = {
  open: false, x: 0, y: 0, items: [] };

function getSnapshot() {
  return _snapshot;
}

function emitSnapshot() {
  _snapshot = { open: _open, x: _x, y: _y, items: _items };
  notify();
}

export function useContextMenuState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
