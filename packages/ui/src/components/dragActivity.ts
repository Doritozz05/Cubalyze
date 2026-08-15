"use client"

import { useSyncExternalStore } from "react"

/**
 * Module-level "is anything being dragged?" counter shared across the app.
 *
 * Both drag systems report here: floating widgets (useDraggable's pointer
 * capture drag) and dock pill reorders (framer-motion Reorder). UI that must
 * not react to hover while the user is dragging — most importantly tooltips,
 * which would otherwise pop under the pointer as a reorder sweep crosses
 * other pills — subscribes via `useDragActivityActive()`.
 */
let _dragCount = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export const dragActivity = {
  get active() {
    return _dragCount > 0
  },
  /** Mark a drag as started (idempotent per caller — it's a counter). */
  begin() {
    _dragCount += 1
    if (_dragCount === 1) notify()
  },
  /** Mark a drag as ended (safe to call even if begin never fired). */
  end() {
    if (_dragCount === 0) return
    _dragCount -= 1
    if (_dragCount === 0) notify()
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  getSnapshot() {
    return _dragCount > 0
  },
}

/** True while any drag (floating widget or dock pill) is in progress. */
export function useDragActivityActive(): boolean {
  return useSyncExternalStore(
    dragActivity.subscribe,
    dragActivity.getSnapshot,
  )
}
