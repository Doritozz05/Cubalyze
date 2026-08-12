"use client";

import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface ContextMenuItem {
  /** Unique key (also used as React key in the menu). */
  id: string;
  /** i18n key for the label (resolved by the component using useTranslation). */
  label: string;
  /** Optional icon component (lucide). */
  icon?: LucideIcon;
  /** Called when the item is clicked. */
  onClick?: () => void;
  /** Render a thin separator line before this item. */
  separatorBefore?: boolean;
  /** Grey out + disable click. */
  disabled?: boolean;
}

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
