"use client";

import { useSyncExternalStore } from "react";

// ── Module-level state ─────────────────────────────────────────────────

let _isEditing = false;
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

export const dockEditStore = {
  startEditing() {
    if (_isEditing) return;
    _isEditing = true;
    notify();
  },
  stopEditing() {
    if (!_isEditing) return;
    _isEditing = false;
    notify();
  },
  toggle() {
    _isEditing = !_isEditing;
    notify();
  },
  get isEditing() {
    return _isEditing;
  },
};

export function useIsDockEditing(): boolean {
  return useSyncExternalStore(subscribe, () => _isEditing, () => false);
}
