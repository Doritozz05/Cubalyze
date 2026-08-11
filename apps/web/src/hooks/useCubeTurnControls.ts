"use client";

import { useCallback, useRef } from "react";
import {
  swipeTurnDirection,
  type Cube3DEngine,
  type CubeLayerPick,
} from "@cubeforge/cube-3d-engine";
import { actionToMoves, actionToNotation, type CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";

/**
 * Touch + keyboard controls for the virtual-cube view.
 *
 * Gesture model (informed by csTimer's touch simulation):
 *   • 1 finger swipe ON a cube face  → turn that layer (90°, CW/CCW by drag)
 *   • 1 finger drag on the background → orbit the camera (inertia included)
 *   • 2 fingers                      → pinch zoom
 *   • Keyboard (csTimer layout)      → call {@link performAction} directly
 *
 * The "which layer" + "which direction" math lives in the engine package
 * (`pickLayer` + `swipeTurnDirection`) and is fully unit-tested there.
 */
export interface UseCubeTurnControlsOptions {
  /** Ref to the live Cube3DEngine instance (from useCube3D). */
  engineRef: React.RefObject<Cube3DEngine | null>;
  /** Cube order: 2 or 3 (used for whole-cube rotation layer expansion). */
  order?: number;
  /** Min drag distance (px) before a face swipe triggers a turn. Default 14. */
  minSwipeDistance?: number;
  /** Called after every executed move with its notation (for the moves strip). */
  onMove?: (notation: string, action: CubeKeyAction) => void;
}

export interface UseCubeTurnControlsResult {
  /** Apply a keymap action to the engine (shared by keyboard + touch). */
  performAction: (action: CubeKeyAction) => void;
  /** Pointer handlers to attach to the <canvas>. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  };
}

type DragMode = "idle" | "turn" | "orbit";

const TURN_DURATION_MS = 140;

export function useCubeTurnControls({
  engineRef,
  order = 3,
  minSwipeDistance = 14,
  onMove,
}: UseCubeTurnControlsOptions): UseCubeTurnControlsResult {
  const orderRef = useRef(order);
  orderRef.current = order;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    pick: CubeLayerPick | null;
    turned: boolean;
  }>({ mode: "idle", startX: 0, startY: 0, lastX: 0, lastY: 0, pick: null, turned: false });

  /** Execute a keymap action on the engine (face/slice/wide/rotate). */
  const performAction = useCallback(
    (action: CubeKeyAction) => {
      const engine = engineRef.current;
      if (!engine) return;
      const moves = actionToMoves(action, orderRef.current);
      for (const mv of moves) {
        // Fire-and-forget: the RotationEngine serializes overlapping layers
        // via its collision detector, so rapid input stays consistent.
        void engine.rotateLayers(mv.axis, mv.layerValues, mv.angle, TURN_DURATION_MS, undefined, "smooth");
      }
      onMoveRef.current?.(actionToNotation(action), action);
    },
    [engineRef],
  );

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
          mode: pick ? "turn" : "orbit",
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          pick,
          turned: false,
        };
        // Arm the camera inertia (no-op for turn mode; kills stale glides).
        engine?.setCameraDragActive(true);
      } else if (pointers.current.size === 2) {
        pinchDistRef.current = currentPinchDistance();
        engine?.setCameraDragActive(true);
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

      if (drag.mode === "orbit") {
        engine.rotateCamera(dx, dy);
        return;
      }

      // ── Turn mode: swipe on a face ─────────────────────────────────────
      if (drag.turned || !drag.pick) return;

      const totalDx = e.clientX - drag.startX;
      const totalDy = e.clientY - drag.startY;
      if (Math.hypot(totalDx, totalDy) < minSwipeDistance) return;

      // Map the screen drag to world space using the camera basis, then
      // sign it against the surface tangent → cube-notation direction.
      const m = engine.sceneManager.camera.matrixWorld.elements;
      const camRight = { x: m[0], y: m[1], z: m[2] };
      const camUp = { x: m[4], y: m[5], z: m[6] };
      const worldDrag = {
        x: totalDx * camRight.x + totalDy * camUp.x,
        y: totalDx * camRight.y + totalDy * camUp.y,
        z: totalDx * camRight.z + totalDy * camUp.z,
      };

      const direction = swipeTurnDirection({
        axisVector: drag.pick.axisVector,
        worldPoint: drag.pick.worldPoint,
        worldDrag,
      });

      performAction({ kind: "turn", face: drag.pick.face, direction });
      drag.turned = true;
    },
    [engineRef, minSwipeDistance, performAction],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // A face-drag that never reached the turn threshold is still motion:
      // apply it as a camera nudge on release instead of dropping it.
      const wasTurnPending =
        pointers.current.size === 1 &&
        dragRef.current.mode === "turn" &&
        !dragRef.current.turned &&
        !!dragRef.current.pick;

      pointers.current.delete(e.pointerId);
      const engine = engineRef.current;

      if (pointers.current.size === 0) {
        if (wasTurnPending && engine) {
          engine.rotateCamera(
            e.clientX - dragRef.current.startX,
            e.clientY - dragRef.current.startY,
          );
        }
        dragRef.current.mode = "idle";
        dragRef.current.pick = null;
        // Release: let the engine glide the camera with inertia (orbit mode).
        engine?.setCameraDragActive(false);
      } else if (pointers.current.size === 1) {
        // 2 → 1 fingers: the remaining finger starts a FRESH gesture — the
        // original pick (and any turn lock) no longer applies, otherwise a
        // later one-finger move could turn with a stale pick.
        dragRef.current.mode = "idle";
        dragRef.current.pick = null;
        const remaining = [...pointers.current.values()][0];
        dragRef.current.lastX = remaining.x;
        dragRef.current.lastY = remaining.y;
      }
      try {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be lost
      }
    },
    [engineRef],
  );

  return {
    performAction,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
    },
  };
}
