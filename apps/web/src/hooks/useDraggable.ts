"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGlobalDragCursor } from "@/hooks/useGlobalDragCursor";
import { dragActivity } from "@/components/ui/dragActivity";

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
   * `pointer` is the cursor's actual viewport position (clientX/clientY) —
   * it stays invariant under mid-drag re-anchoring, so zone tests based on
   * it never flap when the element is recentered (e.g. a panel collapsing
   * into a dock pill).
   */
  onDrag?: (pos: Position, pointer?: Position) => void;
  /**
   * Snap threshold in pixels. If edges are within this distance,
   * the position is gently nudged to align. 0 = disabled.
   * Default 8.
   */
  snapThreshold?: number;
  /**
   * Maximum pointer velocity in px/ms to engage widget-to-widget snapping.
   * Drags moving faster than this threshold bypass snapping so elements glide
   * smoothly across the screen without hitching or micro-stutters.
   * Snapping engages when moving slowly (e.g. deliberate alignment) or on drop.
   * Default 0.35 px/ms (~350 px/s).
   */
  snapMaxVelocity?: number;
  /**
   * Other rectangles to snap to (e.g., other floating widgets' bounds) or a getter
   * function evaluated once at drag start for optimal performance without re-renders.
   * Viewport edges are always included automatically.
   */
  snapTargets?: SnapRect[] | (() => SnapRect[]);
  /**
   * Re-anchor the element mid-drag. When provided and returning a point, that
   * point (relative to the element's CURRENT top-left) stays under the pointer
   * instead of the original grab offset — e.g. centering a dock pill on the
   * cursor when the dragged panel shrinks to dock size. Return null for the
   * default grab-offset behavior.
   */
  anchor?: (elW: number, elH: number) => { x: number; y: number } | null;
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
  allowTargetSnap = true,
): Position {
  if (threshold <= 0) return pos;
  const rawX = pos.x;
  const rawY = pos.y;
  const rawRight = rawX + elW;
  const rawBottom = rawY + elH;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let bestSnapX = rawX;
  let minDiffX = threshold;

  let bestSnapY = rawY;
  let minDiffY = threshold;

  const checkX = (candidateX: number) => {
    const diff = Math.abs(candidateX - rawX);
    if (diff < minDiffX) {
      minDiffX = diff;
      bestSnapX = candidateX;
    }
  };

  const checkY = (candidateY: number) => {
    const diff = Math.abs(candidateY - rawY);
    if (diff < minDiffY) {
      minDiffY = diff;
      bestSnapY = candidateY;
    }
  };

  // ── Viewport edges (always active) ────────────────────────────────
  checkX(0);
  checkX(vw - elW);
  checkY(0);
  checkY(vh - elH);

  // ── Widget-to-widget (deliberate slow movement or final drop) ──────
  if (allowTargetSnap && targets.length > 0) {
    for (const t of targets) {
      const tRight = t.x + t.w;
      const tBottom = t.y + t.h;

      // Vertical proximity check: dragged element and target overlap or are within 40px vertically
      const yNear = rawY <= tBottom + 40 && rawBottom >= t.y - 40;
      // Horizontal proximity check: dragged element and target overlap or are within 40px horizontally
      const xNear = rawX <= tRight + 40 && rawRight >= t.x - 40;

      // 1. Collinear edge alignments (aligning columns / rows)
      checkX(t.x);
      checkX(tRight - elW);
      checkY(t.y);
      checkY(tBottom - elH);

      // 2. Adjacent alignments (side-by-side or stacked)
      // Only makes sense when near in the orthogonal axis!
      if (yNear) {
        checkX(tRight);
        checkX(t.x - elW);
      }
      if (xNear) {
        checkY(tBottom);
        checkY(t.y - elH);
      }
    }
  }

  return { x: bestSnapX, y: bestSnapY };
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
    snapMaxVelocity = 0.35,
    snapTargets,
    anchor,
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

  // ── Global grabbing cursor while dragging ─────────────────────────────
  // The CSS cursor follows the element under the pointer, not the element
  // being dragged. Pin `cursor: grabbing` on <html> for the drag duration
  // so the cursor stays grabbing even when the pointer is over elements
  // with their own cursor-* classes (e.g. the timer).
  useGlobalDragCursor(isDragging);

  // ── Safeguard: after EVERY React render during drag, re-apply the ────
  //    correct transform. This handles edge cases where state changes
  //    (e.g., isNearDock toggle, focus) cause React to re-render and
  //    reset `style.transform` back to the committed position.
  //
  //    No dependency array = runs after every render. The `isDragging`
  //    guard inside ensures it's a no-op when not dragging.
  useLayoutEffect(() => {
    if (isDragging && dragState.current) {
      const el = elementRef.current;
      if (!el) return;
      const grab = anchorRef.current?.(el.offsetWidth, el.offsetHeight);
      if (grab) {
        // The element changed size mid-drag (e.g. a panel collapsing into a
        // dock pill): keep the SAME pointer under the cursor, but move the
        // element so the pointer now sits at the new anchor point (e.g. the
        // pill's center) instead of the stale grab offset — otherwise the
        // shrunk pill would appear offset from the mouse.
        const pos = currentDragPos.current;
        const maxX = Math.max(0, window.innerWidth - el.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
        const next = {
          x: Math.max(0, Math.min(maxX, pos.x + lastAnchorRef.current.x - grab.x)),
          y: Math.max(0, Math.min(maxY, pos.y + lastAnchorRef.current.y - grab.y)),
        };
        currentDragPos.current = next;
        lastAnchorRef.current = { x: grab.x, y: grab.y };
        el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      } else {
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
  const activeSnapTargetsRef = useRef<SnapRect[]>([]);
  const snapThresholdRef = useRef(snapThreshold);
  snapThresholdRef.current = snapThreshold;
  const snapMaxVelocityRef = useRef(snapMaxVelocity);
  snapMaxVelocityRef.current = snapMaxVelocity;
  // Velocity sampling: window of 24-32ms for robust physical velocity measurement
  const sampleRef = useRef({ x: 0, y: 0, time: 0 });
  const pointerVelocityRef = useRef(0);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  // Where the pointer currently sits within the element (grab offset or a
  // custom anchor) — updated on every move so the safeguard can re-anchor.
  const lastAnchorRef = useRef({ x: 0, y: 0 });
  // The pointer's real viewport position (clientX/clientY) — updated on
  // every move so the RAF-batched onDrag always sees the latest cursor.
  const currentPointerRef = useRef<Position>({ x: 0, y: 0 });

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

  // Safety net: if the component unmounts mid-drag (no pointerup/pointercancel
  // ever arrives), release the global drag-activity flag so tooltips and the
  // dock's rect loop don't stay frozen "dragging" forever.
  useEffect(() => {
    return () => {
      if (dragState.current || movedRef.current) dragActivity.end();
    };
  }, []);

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

      // Resolve snap targets once at drag start (supports dynamic getter function)
      if (typeof snapTargetsRef.current === "function") {
        activeSnapTargetsRef.current = snapTargetsRef.current();
      } else if (Array.isArray(snapTargetsRef.current)) {
        activeSnapTargetsRef.current = snapTargetsRef.current;
      } else {
        activeSnapTargetsRef.current = [];
      }

      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: actualX,
        origY: actualY,
        pointerId: e.pointerId,
      };
      movedRef.current = false;
      sampleRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
      pointerVelocityRef.current = 0;

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
        // Tell the app a drag is underway (disables tooltips, keeps the
        // dock's rect-measure RAF loop alive, etc.).
        dragActivity.begin();
      }
      if (!movedRef.current) return;

      const el = elementRef.current;
      if (!el) return;

      const elW = el.offsetWidth;
      const elH = el.offsetHeight;

      // Update pointer velocity using a sampled time window (filters out sub-ms mouse polling noise)
      const now = performance.now();
      const timeDiff = now - sampleRef.current.time;
      if (timeDiff > 120) {
        // Pointer was paused or stationary — reset velocity
        pointerVelocityRef.current = 0;
        sampleRef.current = { x: e.clientX, y: e.clientY, time: now };
      } else if (timeDiff >= 24) {
        const dist = Math.hypot(e.clientX - sampleRef.current.x, e.clientY - sampleRef.current.y);
        const instantVel = dist / timeDiff;
        pointerVelocityRef.current = pointerVelocityRef.current * 0.5 + instantVel * 0.5;
        sampleRef.current = { x: e.clientX, y: e.clientY, time: now };
      }

      // Snapping to other widgets is ONLY active when moving slowly (deliberate alignment).
      // When moving fast or medium speed (transit movement), snapping is bypassed so elements
      // glide smoothly across the screen without stuttering or stopping on intermediate widgets.
      const isMovingSlow = pointerVelocityRef.current <= snapMaxVelocityRef.current;

      // Pointer's current viewport position (fixed offset from its start).
      const pointerX = state.startX + dx;
      const pointerY = state.startY + dy;
      currentPointerRef.current = { x: pointerX, y: pointerY };

      // Where the pointer sits within the element: the original grab offset,
      // or a custom anchor (e.g. the center of a shrunk dock pill).
      const grab = anchorRef.current?.(elW, elH);
      const anchored = grab !== null && grab !== undefined;
      const anchorX = grab ? grab.x : state.startX - state.origX;
      const anchorY = grab ? grab.y : state.startY - state.origY;
      lastAnchorRef.current = { x: anchorX, y: anchorY };

      // Clamp to viewport
      const maxX = Math.max(0, window.innerWidth - elW);
      const maxY = Math.max(0, window.innerHeight - elH);
      const rawX = Math.max(0, Math.min(maxX, pointerX - anchorX));
      const rawY = Math.max(0, Math.min(maxY, pointerY - anchorY));

      // Apply soft snap — but NOT while the element is anchored (e.g. shrunk
      // into a dock pill centered on the cursor): snapping there would fight
      // the cursor centering and make the pill jump/vibrate.
      // Widget-to-widget snapping is gated by pointer velocity.
      const snapped = anchored
        ? { x: rawX, y: rawY }
        : applySnap(
            { x: rawX, y: rawY },
            elW,
            elH,
            snapThresholdRef.current,
            activeSnapTargetsRef.current,
            isMovingSlow,
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
          onDragRef.current?.(currentDragPos.current, currentPointerRef.current);
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
      onDragRef.current?.(currentDragPos.current, currentPointerRef.current);

      if (movedRef.current) {
        const currentEl = elementRef.current;
        let finalPos = currentDragPos.current;

        // On drop, if not anchored (e.g. not docking), apply a final snap
        // so releasing near an alignment target cleanly locks into place.
        if (currentEl && activeSnapTargetsRef.current.length > 0) {
          const grab = anchorRef.current?.(currentEl.offsetWidth, currentEl.offsetHeight);
          if (!grab) {
            const snapped = applySnap(
              finalPos,
              currentEl.offsetWidth,
              currentEl.offsetHeight,
              snapThresholdRef.current,
              activeSnapTargetsRef.current,
              true,
            );
            const maxX = Math.max(0, window.innerWidth - currentEl.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - currentEl.offsetHeight);
            finalPos = {
              x: Math.max(0, Math.min(maxX, snapped.x)),
              y: Math.max(0, Math.min(maxY, snapped.y)),
            };
            currentEl.style.transform = `translate3d(${finalPos.x}px, ${finalPos.y}px, 0)`;
            currentDragPos.current = finalPos;
          }
        }

        // Commit the final position from our ref → React state
        setPosition(finalPos);
        persist(finalPos);
        dragActivity.end();
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
