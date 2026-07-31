"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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
   * Called continuously during a drag (RAF-batched, ~1 call per frame).
   * Use this for real-time feedback (e.g., dock zone detection).
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

  // ── Widget-to-widget (all edges, using real panelWidth sizes) ───
  for (const t of targets) {
    const tRight = t.x + t.w;
    const tBottom = t.y + t.h;

    // Left edge → left edge
    if (Math.abs(x - t.x) < threshold) x = t.x;
    // Right edge → right edge
    if (Math.abs(right - tRight) < threshold) x = tRight - elW;
    // Left edge → right edge (adjacent)
    if (Math.abs(x - tRight) < threshold) x = tRight;
    // Right edge → left edge (adjacent)
    if (Math.abs(right - t.x) < threshold) x = t.x - elW;

    // Top edge → top edge
    if (Math.abs(y - t.y) < threshold) y = t.y;
    // Bottom edge → bottom edge
    if (Math.abs(bottom - tBottom) < threshold) y = tBottom - elH;
    // Top edge → bottom edge (adjacent)
    if (Math.abs(y - tBottom) < threshold) y = tBottom;
    // Bottom edge → top edge (adjacent)
    if (Math.abs(bottom - t.y) < threshold) y = t.y - elH;
  }

  return { x, y };
}

/**
 * Professional drag hook with direct DOM manipulation for zero-lag performance.
 *
 * KEY DESIGN PRINCIPLES:
 *
 * 1. **Direct DOM manipulation during drag** — instead of calling `setState()`
 *    on every pointer event (which triggers a React re-render every frame),
 *    we update `element.style.transform` directly. This is GPU-composited
 *    and avoids layout recalculations.
 *
 * 2. **RAF-batched onDrag callback** — external callbacks (e.g. dock zone
 *    detection) are called at most once per animation frame, preventing
 *    cascading state updates.
 *
 * 3. **React state only at drag end** — `position` is updated via `setPosition`
 *    only when the drag ends or when external changes occur. During drag,
 *    the position is read from a ref.
 *
 * 4. **`transform: translate3d()` positioning** — uses GPU-accelerated
 *    compositing instead of layout-triggering `left`/`top`.
 *
 * Usage:
 * ```
 * const drag = useDraggable<HTMLDivElement>({ x: 100, y: 100 });
 *
 * <div
 *   ref={drag.elementRef}
 *   style={{
 *     position: 'fixed',
 *     transform: `translate3d(${drag.position.x}px, ${drag.position.y}px, 0)`,
 *     transformOrigin: '0 0',
 *   }}
 *   onPointerDown={drag.onPointerDown}
 *   onPointerMove={drag.onPointerMove}
 *   onPointerUp={drag.onPointerUp}
 * />
 * ```
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

  /** Clamp to viewport minus element size so the element stays on-screen. */
  function clampToViewport(pos: Position, w = 48, h = 48): Position {
    if (typeof window === "undefined") return pos;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.max(0, Math.min(maxX, pos.x)),
      y: Math.max(0, Math.min(maxY, pos.y)),
    };
  }

  // ── React state (updated ONLY at drag end or on external change) ──────
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

  // ── Safeguard: after EVERY React render during drag, re-apply the ────
  //    correct transform. This handles edge cases where state changes
  //    (e.g., isNearDock toggle, focus) cause React to re-render and
  //    reset `style.transform` back to the committed position.
  //
  //    No dependency array = runs after every render. The `isDragging`
  //    guard inside ensures it's a no-op when not dragging.
  useLayoutEffect(() => {
    if (isDragging) {
      const el = elementRef.current;
      if (el) {
        const pos = currentDragPos.current;
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }
    }
  });

  // ── Refs for high-performance drag tracking (no re-renders) ───────────
  const dragState = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const elementRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep callbacks in refs so onPointerMove doesn't need them in deps
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  const snapTargetsRef = useRef(snapTargets);
  snapTargetsRef.current = snapTargets;
  const snapThresholdRef = useRef(snapThreshold);
  snapThresholdRef.current = snapThreshold;

  /** Current position during drag. Updated on every pointer move, read by RAF. */
  const currentDragPos = useRef(position);

  // Sync external position changes (e.g. layout organizer) only when NOT dragging
  useEffect(() => {
    if (!dragState.current) {
      setPosition(clampToViewport(initial));
      currentDragPos.current = initial;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.x, initial.y]);

  const persist = useCallback(
    (pos: Position) => {
      if (onPositionChange) onPositionChange(pos);
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

  // ── Pointer handlers ──────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const el = elementRef.current;
      if (!el) return;

      // Read the ACTUAL rendered position from the DOM (accounts for any
      // transform that was already applied).
      const rect = el.getBoundingClientRect();
      const actualX = Math.round(rect.left);
      const actualY = Math.round(rect.top);

      currentDragPos.current = { x: actualX, y: actualY };

      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: actualX,
        origY: actualY,
        pointerId: e.pointerId,
      };
      movedRef.current = false;

      // Capture pointer on the element that has the handlers (e.currentTarget).
      // For the expanded panel case, this is the header div; for the minimized
      // pill case it's the outer motion.div. Capturing on the handler element
      // ensures pointermove/pointerup events are delivered to the correct handlers.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      // Hint the browser to prepare for GPU compositing on the outer element
      el.style.willChange = "transform";
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state || e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      // Click threshold: only engage after enough movement
      if (
        !movedRef.current &&
        (Math.abs(dx) > clickThreshold || Math.abs(dy) > clickThreshold)
      ) {
        movedRef.current = true;
        setIsDragging(true);
      }
      if (!movedRef.current) return;

      const el = elementRef.current;
      if (!el) return;

      const elW = el.offsetWidth;
      const elH = el.offsetHeight;

      // Clamp to viewport
      const maxX = Math.max(0, window.innerWidth - elW);
      const maxY = Math.max(0, window.innerHeight - elH);
      const rawX = Math.max(0, Math.min(maxX, state.origX + dx));
      const rawY = Math.max(0, Math.min(maxY, state.origY + dy));

      // Apply soft snap
      const snapped = applySnap(
        { x: rawX, y: rawY },
        elW,
        elH,
        snapThresholdRef.current,
        snapTargetsRef.current ?? [],
      );
      const finalX = Math.max(0, Math.min(maxX, snapped.x));
      const finalY = Math.max(0, Math.min(maxY, snapped.y));

      // ── DIRECT DOM MANIPULATION — NO React state update here! ─────────
      // This is the #1 performance optimization: we set the element's
      // transform directly, bypassing React's reconciliation entirely.
      el.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;

      // Update ref so callbacks can read the current position
      currentDragPos.current = { x: finalX, y: finalY };

      // ── RAF-batched onDrag callback ──────────────────────────────────
      // Instead of calling onDrag on every pointer event (60-120 times/sec),
      // we batch it to once per animation frame.
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          onDragRef.current?.(currentDragPos.current);
        });
      }
    },
    [clickThreshold],
  );

  /** Shared cleanup between pointerup and pointercancel. */
  const endDrag = useCallback(
    (e: { currentTarget: EventTarget }) => {
      const state = dragState.current;
      if (!state) return;

      // Release pointer capture (safe even if already released)
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(state.pointerId);
      } catch {
        /* already released — ignore */
      }

      // Cancel any pending RAF callback
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clean up will-change
      const el = elementRef.current;
      if (el) {
        el.style.willChange = "";
      }

      // Fire one last onDrag BEFORE persisting, so dock zone state is
      // settled before handlePositionChange reads dropIndex.
      onDragRef.current?.(currentDragPos.current);

      if (movedRef.current) {
        // Commit the final position from our ref → React state
        const finalPos = currentDragPos.current;
        setPosition(finalPos);
        persist(finalPos);
      }

      dragState.current = null;
      movedRef.current = false;
      setIsDragging(false);
    },
    [persist],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      endDrag(e);
    },
    [endDrag],
  );

  /**
   * Handle pointer cancellation (e.g., dragging outside the browser window,
   * or multi-touch interference). Without this handler, the drag state
   * stays "stuck": `isDragging` remains true, the `useLayoutEffect`
   * safeguard keeps re-applying the stale transform, and subsequent
   * pointer downs start from a corrupted state.
   */
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      endDrag(e);
    },
    [endDrag],
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
    onPointerCancel,
    wasDrag,
    /** Read-only ref updated in real-time during drag (for callbacks). */
    currentDragPos,
  };
}
