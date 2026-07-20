"use client";

import { useCallback, useRef, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  /** Minimum pointer movement (px) before drag engages. Below this it's a click. */
  clickThreshold?: number;
  /** If set, position is persisted to localStorage under this key. */
  storageKey?: string;
}

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  pointerId: number;
}

/**
 * Dependency-free draggable hook using pointer events.
 *
 * - Viewport-clamped: the element can't be dragged off-screen.
 * - Click-vs-drag: `wasDrag()` returns true if the last interaction moved
 *   beyond `clickThreshold`, letting callers suppress click after a drag.
 * - Optional persistence: pass `storageKey` to remember position across
 *   sessions.
 *
 * Attach `onPointerDown/Move/Up` to the drag handle and spread `elementRef`
 * onto the element whose size should be used for clamping.
 */
export function useDraggable<T extends HTMLElement = HTMLElement>(
  initial: Position,
  options: UseDraggableOptions = {},
) {
  const { clickThreshold = 4, storageKey } = options;

  /** Clamp to viewport minus a safety margin so the element is never
   *  positioned off-screen after a viewport resize or resolution change.
   *  Without the element ref we use 48px as the smallest draggable size. */
  function clampToViewport(pos: Position, margin = 48): Position {
    if (typeof window === "undefined") return pos;
    const maxX = Math.max(0, window.innerWidth - margin);
    const maxY = Math.max(0, window.innerHeight - margin);
    return {
      x: Math.max(0, Math.min(maxX, pos.x)),
      y: Math.max(0, Math.min(maxY, pos.y)),
    };
  }

  const [position, setPosition] = useState<Position>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Position;
          if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
            return clampToViewport(parsed);
          }
        }
      } catch {
        /* corrupt entry — fall through to default */
      }
    }
    return clampToViewport(initial);
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<DragState | null>(null);
  /** Tracks whether the *current* interaction exceeded the click threshold.
   *  Reset on pointer-down, set on pointer-move. Read via `wasDrag()`. */
  const movedRef = useRef(false);
  const elementRef = useRef<T | null>(null);

  const persist = useCallback(
    (pos: Position) => {
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(pos));
        } catch {
          /* storage full / disabled — ignore */
        }
      }
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // left button only
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
        pointerId: e.pointerId,
      };
      movedRef.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position.x, position.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (
        !movedRef.current &&
        (Math.abs(dx) > clickThreshold || Math.abs(dy) > clickThreshold)
      ) {
        movedRef.current = true;
        setIsDragging(true);
      }
      if (!movedRef.current) return;

      const el = elementRef.current;
      const w = el?.offsetWidth ?? 0;
      const h = el?.offsetHeight ?? 0;
      const maxX = Math.max(0, window.innerWidth - w);
      const maxY = Math.max(0, window.innerHeight - h);
      setPosition({
        x: Math.max(0, Math.min(maxX, state.origX + dx)),
        y: Math.max(0, Math.min(maxY, state.origY + dy)),
      });
    },
    [clickThreshold],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (state) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(
            state.pointerId,
          );
        } catch {
          /* pointer already released — ignore */
        }
        if (movedRef.current) persist(position);
      }
      dragState.current = null;
      movedRef.current = false;
      setIsDragging(false);
    },
    [persist, position],
  );

  /** True if the last pointer interaction moved beyond the click threshold. */
  const wasDrag = () => movedRef.current;

  return {
    position,
    isDragging,
    elementRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    wasDrag,
  };
}
