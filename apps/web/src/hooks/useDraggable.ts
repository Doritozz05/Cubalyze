"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

/** A rectangle target for snapping (e.g., another widget's bounds). */
export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseDraggableOptions {
  /** Minimum pointer movement (px) before drag engages. Below this it's a click. */
  clickThreshold?: number;
  /**
   * If set, position is persisted to localStorage under this key.
   * @deprecated New widgets should use `onPositionChange` + widgetStore instead.
   */
  storageKey?: string;
  /**
   * Called whenever the position is persisted (at the end of a successful drag).
   * Use this to sync position to a store instead of localStorage.
   */
  onPositionChange?: (pos: Position) => void;
  /**
   * Called continuously during a drag with the current position.
   * Useful for real-time feedback (e.g., dock zone detection).
   */
  onDrag?: (pos: Position) => void;
  /**
   * Snap threshold in pixels. If edges are within this distance,
   * the position is gently nudged to align. 0 = disabled.
   * Default 8.
   */
  snapThreshold?: number;
  /**
   * Other rectangles to snap to (e.g., other floating widgets' bounds).
   * Viewport edges are always included automatically.
   */
  snapTargets?: SnapRect[];
}

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  pointerId: number;
}

/** Softly snap a position to viewport edges and target rectangles. */
function applySnap(
  pos: Position,
  elW: number,
  elH: number,
  threshold: number,
  targets: SnapRect[],
): Position {
  if (threshold <= 0) return pos;
  let { x, y } = pos;
  const right = x + elW;
  const bottom = y + elH;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Viewport edges ────────────────────────────────────────────────
  if (Math.abs(x) < threshold) x = 0;
  if (Math.abs(y) < threshold) y = 0;
  if (Math.abs(right - vw) < threshold) x = vw - elW;
  if (Math.abs(bottom - vh) < threshold) y = vh - elH;

  // ── Widget-to-widget (left and top edges only — avoids false
  //     snaps from mismatched widget widths/heights) ──────────────
  for (const t of targets) {
    // Left edge → left edge
    if (Math.abs(x - t.x) < threshold) x = t.x;
    // Top edge → top edge
    if (Math.abs(y - t.y) < threshold) y = t.y;
  }

  return { x, y };
}

/**
 * Dependency-free draggable hook using pointer events.
 *
 * - Viewport-clamped: the element can't be dragged off-screen.
 * - Click-vs-drag: `wasDrag()` returns true if the last interaction moved
 *   beyond `clickThreshold`, letting callers suppress click after a drag.
 * - Optional persistence: pass `storageKey` or `onPositionChange`.
 * - Soft snap: pass `snapThreshold` and `snapTargets` to gently align
 *   edges to viewport borders or other widget rectangles.
 *
 * Attach `onPointerDown/Move/Up` to the drag handle and spread `elementRef`
 * onto the element whose size should be used for clamping.
 */
export function useDraggable<T extends HTMLElement = HTMLElement>(
  initial: Position,
  options: UseDraggableOptions = {},
) {
  const {
    clickThreshold = 4,
    storageKey,
    onPositionChange,
    onDrag,
    snapThreshold = 8,
    snapTargets,
  } = options;

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

  // Sync external position changes (e.g. layout organizer) into local state,
  // but only when the user is NOT actively dragging the element.
  useEffect(() => {
    if (!dragState.current) {
      setPosition(clampToViewport(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.x, initial.y]);

  /** Tracks whether the *current* interaction exceeded the click threshold. */
  const movedRef = useRef(false);
  const elementRef = useRef<T | null>(null);

  const persist = useCallback(
    (pos: Position) => {
      if (onPositionChange) {
        onPositionChange(pos);
      }
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(pos));
        } catch {
          /* storage full / disabled — ignore */
        }
      }
    },
    [storageKey, onPositionChange],
  );

  // Keep snap targets in a ref so onPointerMove doesn't need them in deps
  const snapTargetsRef = useRef(snapTargets);
  snapTargetsRef.current = snapTargets;
  const snapThresholdRef = useRef(snapThreshold);
  snapThresholdRef.current = snapThreshold;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
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
      const rawPos = {
        x: Math.max(0, Math.min(maxX, state.origX + dx)),
        y: Math.max(0, Math.min(maxY, state.origY + dy)),
      };
      // Apply soft snap
      const snapped = applySnap(
        rawPos,
        w,
        h,
        snapThresholdRef.current,
        snapTargetsRef.current ?? [],
      );
      // Re-clamp after snap (snapping might push slightly out of bounds)
      const finalPos = {
        x: Math.max(0, Math.min(maxX, snapped.x)),
        y: Math.max(0, Math.min(maxY, snapped.y)),
      };
      setPosition(finalPos);
      onDrag?.(finalPos);
    },
    [clickThreshold, onDrag],
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
