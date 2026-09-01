"use client";

import { useCallback, useRef } from "react";
import type { PyraminxEngine, PyraminxPick } from "@cubeforge/cube-3d-engine";
import {
  pyraminxDragToken,
  resolvePyraminxDragMove,
} from "@/utils/pyraminxDrag";

/**
 * Touch + keyboard controls for the virtual-Pyraminx view — the vertex-
 * turning counterpart of {@link useCubeTurnControls}.
 *
 * Gesture model (virtual-puzzle interaction — identical philosophy to the
 * cube): a PIECE drag does NOT track the pointer live. Once the swipe
 * passes the dead zone it resolves a definite FIXED ±120° turn (the layer
 * or tip under the finger, direction read against the piece's rotation
 * tangent) and fires it through the same `onTurn` pipeline as the keyboard,
 * so the engine plays the turn animation at the configured turn speed and
 * the layer lands at exactly ±120°, ignoring the mouse from then on.
 *
 *   • 1 finger drag ON a piece → the layer/tip under the finger turns
 *     (corners → their layer; tips → the tip; edges → the endpoint whose
 *     tangent best matches the swipe). The camera NEVER moves on a piece.
 *   • Single click / tap → ignored (moves only resolve on drag).
 *   • DRAG ON THE BACKGROUND → ONE discrete camera step per drag: yaw snaps
 *     to the 120° grid, pitch to the 30° grid (see PyraminxEngine.orbitStep)
 *     — the camera is locked on fixed angles, like the cube simulator's
 *     locked isometric view + discrete whole-cube rotation.
 *   • 2 fingers → pinch zoom.
 *   • Keyboard (csTimer layout, see pyraminxKeybinds) → animated turns via
 *     `onTurn` — the SAME pipeline as drags, so visual and logical state
 *     stay in lockstep.
 *
 * Pointer-cancel (scroll / OS gesture) before the dead zone never fires a
 * move — nothing is turned and the logical state is untouched.
 */
export interface UsePyraminxTurnControlsOptions {
  /** Ref to the live PyraminxEngine instance (from useCube3D, cast). */
  engineRef: React.RefObject<PyraminxEngine | null>;
  /** Min pointer travel (px) before a piece drag fires its move. Default 14. */
  minSwipeDistance?: number;
  /** Background-drag distance (px) that fires the single discrete camera
   *  step allowed per drag. Default 70. */
  rotateStepDistance?: number;
  /** Called once per resolved piece drag — the fixed ±120° WCA token
   *  (U, L', u, …). */
  onTurn?: (token: string) => void;
  /** Lateral drone rotation (120° steps around Y). -1 = right, 1 = left. */
  onRotateLateral?: (direction: 1 | -1) => void;
  /** Tilt rotation (109.47° around horizontal X). 1 = down, -1 = up. */
  onRotateTilt?: (direction: 1 | -1) => void;
  /** Called once per background drag — the discrete camera step (fallback). */
  onOrbitStep?: (dx: number, dy: number) => void;
}

export interface UsePyraminxTurnControlsResult {
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  };
}

type DragMode = "idle" | "turn" | "background";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  totalDist: number;
  /** Sticker picked at pointer-down (the drag's geometric origin). */
  pick: PyraminxPick | null;
  committed: boolean;
  swipeX: number;
  swipeY: number;
}

const FRESH_DRAG: DragState = {
  mode: "idle",
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  totalDist: 0,
  pick: null,
  committed: false,
  swipeX: 0,
  swipeY: 0,
};

export function usePyraminxTurnControls({
  engineRef,
  minSwipeDistance = 14,
  rotateStepDistance = 70,
  onTurn,
  onRotateLateral,
  onRotateTilt,
  onOrbitStep,
}: UsePyraminxTurnControlsOptions): UsePyraminxTurnControlsResult {
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  const onRotateLateralRef = useRef(onRotateLateral);
  onRotateLateralRef.current = onRotateLateral;
  const onRotateTiltRef = useRef(onRotateTilt);
  onRotateTiltRef.current = onRotateTilt;
  const onOrbitStepRef = useRef(onOrbitStep);
  onOrbitStepRef.current = onOrbitStep;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<DragState>({ ...FRESH_DRAG });

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
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported */
      }
      const engine = engineRef.current;

      if (pointers.current.size === 1) {
        const ndc = ndcFromPointer(canvas, e.clientX, e.clientY);
        const pick: PyraminxPick | null =
          ndc && engine ? engine.pickSticker(ndc.x, ndc.y) : null;
        dragRef.current = {
          mode: pick ? "turn" : "background",
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          totalDist: 0,
          pick,
          committed: false,
          swipeX: 0,
          swipeY: 0,
        };
      } else if (pointers.current.size === 2) {
        // A second finger lands: switch to pinch zoom.
        dragRef.current = { ...FRESH_DRAG };
        pinchDistRef.current = currentPinchDistance();
      }
    },
    [engineRef],
  );

  const resolveTurn = useCallback(
    (drag: DragState): string | null => {
      const engine = engineRef.current;
      const pick = drag.pick;
      if (!engine || !pick) return null;
      const cam = engine.sceneManager?.camera;
      if (!cam) return null;
      cam.updateMatrixWorld(true);
      const m = cam.matrixWorld.elements;
      const move = resolvePyraminxDragMove({
        dx: drag.lastX - drag.startX,
        dy: drag.lastY - drag.startY,
        worldPoint: pick.position,
        candidates: pick.candidates,
        axes: {
          U: engine.getWorldAxis("U"),
          L: engine.getWorldAxis("L"),
          R: engine.getWorldAxis("R"),
          B: engine.getWorldAxis("B"),
        },
        cameraRight: { x: m[0], y: m[1], z: m[2] },
        cameraUp: { x: m[4], y: m[5], z: m[6] },
      });
      return move ? pyraminxDragToken(move) : null;
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

      if (drag.mode === "turn") {
        if (drag.committed) return;
        drag.totalDist += Math.hypot(dx, dy);
        if (drag.totalDist < minSwipeDistance) return;
        // While a previous turn is still animating, pieces sit on pivot
        // groups mid-rotation — wait for the driver to settle.
        if (engine.isAnimating()) return;
        const token = resolveTurn(drag);
        if (!token) return;
        drag.committed = true;
        // Fire the FIXED turn through the same pipeline as the keyboard —
        // the layer lands at exactly ±120° and the pointer is ignored from
        // here on.
        onTurnRef.current?.(token);
        return;
      }

      // Background: ONE discrete whole-puzzle step per drag (fixed angles — see
      // PyraminxEngine.rotatePuzzleY and rotatePuzzleX). Any further travel in this gesture is
      // ignored, so one drag never produces several steps.
      if (drag.committed) return;
      drag.swipeX += dx;
      drag.swipeY += dy;
      if (
        Math.abs(drag.swipeX) >= rotateStepDistance ||
        Math.abs(drag.swipeY) >= rotateStepDistance
      ) {
        drag.committed = true;
        if (Math.abs(drag.swipeX) >= Math.abs(drag.swipeY)) {
          const dir: 1 | -1 = drag.swipeX > 0 ? 1 : -1;
          if (onRotateLateralRef.current) {
            onRotateLateralRef.current(dir);
          } else {
            onOrbitStepRef.current?.(drag.swipeX, 0);
          }
        } else {
          const dir: 1 | -1 = drag.swipeY > 0 ? 1 : -1;
          if (onRotateTiltRef.current) {
            onRotateTiltRef.current(dir);
          } else {
            onOrbitStepRef.current?.(0, drag.swipeY);
          }
        }
      }
    },
    [engineRef, minSwipeDistance, resolveTurn, rotateStepDistance],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = e.target as HTMLCanvasElement;
      pointers.current.delete(e.pointerId);
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be lost */
      }
      if (pointers.current.size === 0) {
        dragRef.current = { ...FRESH_DRAG };
      }
    },
    [],
  );

  return {
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
    },
  };
}
