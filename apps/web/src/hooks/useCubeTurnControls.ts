"use client";

import { useCallback, useRef } from "react";
import {
  resolveDragTurn,
  type Cube3DEngine,
  type CubeLayerPick,
} from "@cubeforge/cube-3d-engine";
import type { CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";

/**
 * Touch + keyboard controls for the virtual-cube view.
 *
 * Gesture model (the virtual-cube.net interaction — "drag the mouse on a
 * cube layer ACROSS A SOLID BLACK LINE to rotate it"):
 *
 *   • DRAG ON A STICKER — the move is derived from the GEOMETRY of the
 *     sticker you pressed and the sticker currently under the pointer, never
 *     from the sticker's face alone. Same cubie, crossed over its own edge →
 *     a whole-face turn; same face, same row/column → the slice through that
 *     row/column; diagonal crossings → the slice at the shared coordinate
 *     (see `resolveDragTurn` in the engine package). Every boundary crossing
 *     fires the move immediately (animated at the current turn speed) and
 *     re-baselines, so one continuous drag can chain several turns.
 *   • TAP on a cube face → deterministic CLOCKWISE turn of that face.
 *   • DRAG ON THE BACKGROUND → the CUBE rotates in discrete 90° steps (y for
 *     left/right swipes, x for up/down swipes) exactly like the x/y keys —
 *     the camera stays locked on the isometric view.
 *   • 2 fingers → pinch zoom
 *   • Keyboard (csTimer layout) → animated face turns via `performAction`
 *
 * Pointer-cancel (scroll / OS gesture) never commits — nothing is turned and
 * the logical state is untouched.
 */
export interface UseCubeTurnControlsOptions {
  /** Ref to the live Cube3DEngine instance (from useCube3D). */
  engineRef: React.RefObject<Cube3DEngine | null>;
  /** Min pointer travel (px) before a drag starts turning. Default 6. */
  minSwipeDistance?: number;
  /**
   * Background-drag distance (px) per 90° cube rotation step. Default 70 —
   * mirroring virtual-cube's discrete swipe rotation.
   */
  rotateStepDistance?: number;
  /**
   * Called for every resolved action (drag turns, taps, background rotations,
   * keyboard). The view animates the move on the engine AND mirrors it into
   * the logical state.
   */
  onAction?: (action: CubeKeyAction) => void;
}

export interface UseCubeTurnControlsResult {
  /** Apply a keymap action (keyboard path — animated by the view). */
  performAction: (action: CubeKeyAction) => void;
  /** Pointer handlers to attach to the <canvas>. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  };
}

type DragMode = "idle" | "sticker" | "background";

export function useCubeTurnControls({
  engineRef,
  minSwipeDistance = 6,
  rotateStepDistance = 70,
  onAction,
}: UseCubeTurnControlsOptions): UseCubeTurnControlsResult {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    /** Cumulative pointer travel (px) since the drag started. */
    totalDist: number;
    /** Sticker pressed at pointer-down (the drag's geometric origin). */
    startPick: CubeLayerPick | null;
    /** True once a move has fired — later crossings don't need the dead zone. */
    firedOnce: boolean;
    /** Accumulated background swipe (px) since the last 90° step. */
    swipeX: number;
    swipeY: number;
  }>({
    mode: "idle",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    totalDist: 0,
    startPick: null,
    firedOnce: false,
    swipeX: 0,
    swipeY: 0,
  });

  /** Execute a keymap action through the view's single move pipeline. */
  const performAction = useCallback((action: CubeKeyAction) => {
    onActionRef.current?.(action);
  }, []);

  const currentPinchDistance = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const ndcFromPointer = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const canvas = e.target as HTMLCanvasElement;
      canvas.setPointerCapture(e.pointerId);
      const engine = engineRef.current;

      if (pointers.current.size === 1) {
        const ndc = ndcFromPointer(canvas, e.clientX, e.clientY);
        const pick: CubeLayerPick | null = ndc && engine ? engine.pickLayer(ndc.x, ndc.y) : null;

        dragRef.current = {
          mode: pick ? "sticker" : "background",
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          totalDist: 0,
          startPick: pick,
          firedOnce: false,
          swipeX: 0,
          swipeY: 0,
        };
      } else if (pointers.current.size === 2) {
        // A second finger lands: switch the gesture to pinch zoom.
        dragRef.current = {
          mode: "idle",
          startX: 0,
          startY: 0,
          lastX: 0,
          lastY: 0,
          totalDist: 0,
          startPick: null,
          firedOnce: false,
          swipeX: 0,
          swipeY: 0,
        };
        pinchDistRef.current = currentPinchDistance();
      }
    },
    [engineRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const engine = engineRef.current;
      if (!engine) return;

      // Two fingers → pinch zoom (spread = zoom in, pinch = zoom out).
      if (pointers.current.size >= 2) {
        const dist = currentPinchDistance();
        if (pinchDistRef.current > 0 && dist > 0) {
          const ratio = dist / pinchDistRef.current;
          engine.zoomCamera((1 - ratio) * 600);
          pinchDistRef.current = dist;
        }
        return;
      }

      const drag = dragRef.current;
      if (drag.mode === "idle") return;

      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      if (drag.mode === "sticker") {
        drag.totalDist += Math.hypot(dx, dy);
        if (!drag.startPick) return;

        // Sticker geometry: resolve the move from START sticker → CURRENT
        // sticker. Fires on every boundary crossing; re-baselines so one
        // drag can chain several turns.
        if (drag.firedOnce || drag.totalDist >= minSwipeDistance) {
          const ndc = ndcFromPointer(e.target as HTMLCanvasElement, e.clientX, e.clientY);
          const cur: CubeLayerPick | null = ndc ? engine.pickLayer(ndc.x, ndc.y) : null;
          if (cur && cur.cubiePosition && drag.startPick.cubiePosition) {
            const move = resolveDragTurn(
              {
                position: drag.startPick.cubiePosition,
                face: drag.startPick.face,
              },
              {
                position: cur.cubiePosition,
                face: cur.face,
              },
            );
            if (move) {
              onActionRef.current?.({ kind: "turn", face: move.face, direction: move.direction });
              drag.startPick = cur;
              drag.firedOnce = true;
            }
          }
        }
        return;
      }

      // Background: rotate the CUBE in discrete 90° steps (camera locked on
      // the isometric view) — the same x/y rotations as the arrow keys.
      drag.swipeX += dx;
      drag.swipeY += dy;
      if (Math.abs(drag.swipeX) >= rotateStepDistance || Math.abs(drag.swipeY) >= rotateStepDistance) {
        if (Math.abs(drag.swipeX) >= Math.abs(drag.swipeY)) {
          // Swipe right = y' (front face turns right), swipe left = y.
          const direction = drag.swipeX > 0 ? -1 : 1;
          onActionRef.current?.({ kind: "rotate", axis: "y", direction });
        } else {
          // Swipe down = x' (top face tips forward), swipe up = x.
          const direction = drag.swipeY > 0 ? -1 : 1;
          onActionRef.current?.({ kind: "rotate", axis: "x", direction });
        }
        drag.swipeX = 0;
        drag.swipeY = 0;
      }
    },
    [engineRef, minSwipeDistance, rotateStepDistance],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, allowCommit = true) => {
      const canvas = e.target as HTMLCanvasElement;
      const drag = dragRef.current;
      const wasSticker = drag.mode === "sticker" && !!drag.startPick;

      pointers.current.delete(e.pointerId);

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be lost
      }

      // Tap on a sticker (no real drag, no move fired) → deterministic
      // clockwise turn of the tapped face. Pointer-cancel never commits.
      if (wasSticker && allowCommit && !drag.firedOnce && drag.totalDist < minSwipeDistance) {
        const face = drag.startPick!.face;
        onActionRef.current?.({ kind: "turn", face, direction: 1 });
      }

      // Only finalize the gesture state if it is STILL the active one — a new
      // pointerdown during an animation replaces dragRef.current, and we must
      // never clobber the fresh gesture.
      const isCurrent = dragRef.current === drag;
      const fresh = {
        mode: "idle" as DragMode,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        totalDist: 0,
        startPick: null,
        firedOnce: false,
        swipeX: 0,
        swipeY: 0,
      };
      if (pointers.current.size === 0) {
        if (isCurrent) dragRef.current = fresh;
      } else if (pointers.current.size === 1 && isCurrent) {
        // 2 → 1 fingers: the remaining finger starts a FRESH gesture.
        dragRef.current = fresh;
        const remaining = [...pointers.current.values()][0];
        dragRef.current.lastX = remaining.x;
        dragRef.current.lastY = remaining.y;
      }
    },
    [minSwipeDistance],
  );

  return {
    performAction,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointer,
      // A cancelled pointer (scroll / OS gesture) must never commit.
      onPointerCancel: (e) => finishPointer(e, false),
    },
  };
}
