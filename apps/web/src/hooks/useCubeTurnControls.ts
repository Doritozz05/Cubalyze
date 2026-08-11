"use client";

import { useCallback, useRef } from "react";
import {
  FACE_ROTATION_MAP,
  layerTwistAngleDelta,
  type Cube3DEngine,
  type CubeLayerPick,
} from "@cubeforge/cube-3d-engine";
import type { CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";

/**
 * Touch + keyboard controls for the virtual-cube view.
 *
 * Gesture model (the csTimer virtual-cube interaction):
 *   • 1 finger drag ON a cube face  → the layer LIVE-TWISTS following the
 *     finger (arc-length tracking). On release it SNAPS 90° (animated) when
 *     the twist is at least `commitThresholdDeg`, otherwise it springs back.
 *   • 1 finger drag on the background → orbit the camera (inertia included)
 *   • 2 fingers                      → pinch zoom
 *   • Keyboard (csTimer layout)      → animated face turns via `performAction`
 *
 * The layer under the finger is resolved once on pointer-down (raycast →
 * `pickLayer`), then the engine's live-twist API drives its angle frame by
 * frame. The move is committed through `onAction` ONLY after the snap
 * animation completes, so the logical state (CubeState) always lands exactly
 * on the finished visual — no desync, deterministic by construction.
 *
 * The drag math (`pickLayer` + `layerTwistAngleDelta`) lives in the engine
 * package and is fully unit-tested there.
 */
export interface UseCubeTurnControlsOptions {
  /** Ref to the live Cube3DEngine instance (from useCube3D). */
  engineRef: React.RefObject<Cube3DEngine | null>;
  /** Min pointer travel (px) before a face drag starts live-twisting. Default 6. */
  minSwipeDistance?: number;
  /**
   * Twist angle (degrees) at which a released drag COMMITS a 90° turn
   * instead of springing back. Default 40.
   */
  commitThresholdDeg?: number;
  /**
   * Called by `performAction` (keyboard path). The view animates the move on
   * the engine AND mirrors it into the logical state.
   */
  onAction?: (action: CubeKeyAction) => void;
  /**
   * Called when a DRAG commits a turn, after the engine's snap animation has
   * already finished — the view only mirrors the move into the logical state
   * (never re-animates).
   */
  onTurnCommitted?: (action: CubeKeyAction) => void;
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

type DragMode = "idle" | "turn" | "orbit";

/** World-units-per-pixel at the cube's depth (camera orbits the origin). */
function worldPerPixelAtCube(canvas: HTMLCanvasElement, engine: Cube3DEngine): number {
  const cam = engine.sceneManager.camera;
  const rect = canvas.getBoundingClientRect();
  if (rect.height <= 0) return 0.01;
  const verticalHalfFovTan = Math.tan((cam.fov * Math.PI) / 360);
  return (2 * verticalHalfFovTan * cam.position.length()) / rect.height;
}

export function useCubeTurnControls({
  engineRef,
  minSwipeDistance = 6,
  commitThresholdDeg = 40,
  onAction,
  onTurnCommitted,
}: UseCubeTurnControlsOptions): UseCubeTurnControlsResult {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const onTurnCommittedRef = useRef(onTurnCommitted);
  onTurnCommittedRef.current = onTurnCommitted;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    /** Cumulative pointer travel (px) — dead zone before live-twisting. */
    totalDist: number;
    pick: CubeLayerPick | null;
    /** Live twist angle in engine degrees, clamped to ±90. */
    angleDeg: number;
    /** True while the commit/spring-back animation is running. */
    snapping: boolean;
  }>({
    mode: "idle",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    totalDist: 0,
    pick: null,
    angleDeg: 0,
    snapping: false,
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

        // Center grabs sit ON the rotation axis (tangent ≈ 0 → dead zone).
        // Give the drag a stable virtual grab point at the face edge by
        // projecting the camera-right direction onto the face plane, so the
        // layer still follows the finger wherever the user touches.
        if (pick && engine) {
          const a = pick.axisVector;
          const t = {
            x: a.y * pick.worldPoint.z - a.z * pick.worldPoint.y,
            y: a.z * pick.worldPoint.x - a.x * pick.worldPoint.z,
            z: a.x * pick.worldPoint.y - a.y * pick.worldPoint.x,
          };
          if (Math.hypot(t.x, t.y, t.z) < 0.25) {
            const cam = engine.sceneManager.camera;
            cam.updateMatrixWorld(true);
            const m = cam.matrixWorld.elements;
            const camRight = { x: m[0], y: m[1], z: m[2] };
            const along = camRight.x * a.x + camRight.y * a.y + camRight.z * a.z;
            const proj = { x: camRight.x - along * a.x, y: camRight.y - along * a.y, z: camRight.z - along * a.z };
            const len = Math.hypot(proj.x, proj.y, proj.z);
            if (len > 1e-4) {
              pick.worldPoint = {
                x: a.x + proj.x / len,
                y: a.y + proj.y / len,
                z: a.z + proj.z / len,
              };
            }
          }
        }

        // A twist only starts if the engine grants a free pivot; otherwise the
        // gesture degrades to orbit instead of fighting over the cubies.
        const twisting = pick && engine ? engine.beginLayerTwist(pick.axis, [pick.layerValue]) : false;

        dragRef.current = {
          mode: twisting ? "turn" : "orbit",
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          totalDist: 0,
          pick: twisting ? pick : null,
          angleDeg: 0,
          snapping: false,
        };
        // Arm the camera inertia (no-op for turn mode; kills stale glides).
        engine?.setCameraDragActive(true);
      } else if (pointers.current.size === 2) {
        // A second finger lands: abort any in-flight twist (spring back) and
        // switch the gesture to pinch zoom.
        if (dragRef.current.mode === "turn" && !dragRef.current.snapping) {
          void engine?.cancelLayerTwist(60);
        }
        dragRef.current.mode = "idle";
        dragRef.current.pick = null;
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

      // ── Turn mode: the layer follows the finger, live ────────────────
      if (drag.snapping || !drag.pick) return;
      drag.totalDist += Math.hypot(dx, dy);
      if (drag.totalDist < minSwipeDistance) return;

      // Screen drag → world units at the cube's depth (camera basis).
      const cam = engine.sceneManager.camera;
      const m = cam.matrixWorld.elements;
      const worldPerPx = worldPerPixelAtCube(e.target as HTMLCanvasElement, engine);
      const worldDrag = {
        x: (dx * m[0] + dy * m[4]) * worldPerPx,
        y: (dx * m[1] + dy * m[5]) * worldPerPx,
        z: (dx * m[2] + dy * m[6]) * worldPerPx,
      };

      const delta = layerTwistAngleDelta({
        axisVector: drag.pick.axisVector,
        worldPoint: drag.pick.worldPoint,
        worldDrag,
      });
      const next = Math.max(-90, Math.min(90, drag.angleDeg + delta));
      drag.angleDeg = next;
      engine.setLayerTwistAngle(next);
    },
    [engineRef, minSwipeDistance],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = e.target as HTMLCanvasElement;
      const engine = engineRef.current;
      const drag = dragRef.current;
      const wasTurn = drag.mode === "turn" && !!drag.pick;

      pointers.current.delete(e.pointerId);

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be lost
      }

      if (wasTurn && engine) {
        if (pointers.current.size === 0) {
          // Release with a twist: commit past the threshold, else spring back.
          drag.snapping = true;
          const abs = Math.abs(drag.angleDeg);
          if (abs >= commitThresholdDeg) {
            const target = Math.sign(drag.angleDeg) * 90;
            const face = drag.pick!.face;
            const angleSign = FACE_ROTATION_MAP[face].angleSign;
            const direction = Math.round(target / (90 * angleSign)) as 1 | -1;
            // Commit the logical move NOW (release time) and let the snap
            // animation play out in the background. This keeps the state order
            // identical to the visual order even when a keyboard move lands
            // during the snap, and the timer starts immediately.
            //
            // Only commit when the live twist is still active: a keyboard move
            // that collided with the drag already snapped the twist away (its
            // own turn is what the visuals show) — committing would record a
            // phantom move.
            if (engine.isLayerTwistActive()) {
              onTurnCommittedRef.current?.({ kind: "turn", face, direction });
            }
            void engine.finishLayerTwist(target, 90);
          } else {
            void engine.cancelLayerTwist(90);
          }
        } else {
          // 2 → 1 fingers mid-turn: abort the twist; the remaining finger
          // starts a fresh gesture (handled below).
          void engine.cancelLayerTwist(60);
        }
      }

      // Only finalize the gesture state if it is STILL the active one — a new
      // pointerdown during the snap animation replaces dragRef.current, and we
      // must never clobber the fresh gesture.
      const isCurrent = dragRef.current === drag;
      if (pointers.current.size === 0) {
        if (isCurrent) {
          dragRef.current = {
            mode: "idle",
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            totalDist: 0,
            pick: null,
            angleDeg: 0,
            snapping: false,
          };
          // Release: let the engine glide the camera with inertia (orbit mode).
          engine?.setCameraDragActive(false);
        }
      } else if (pointers.current.size === 1) {
        // 2 → 1 fingers: the remaining finger starts a FRESH gesture.
        if (isCurrent) {
          dragRef.current = {
            mode: "idle",
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            totalDist: 0,
            pick: null,
            angleDeg: 0,
            snapping: false,
          };
          const remaining = [...pointers.current.values()][0];
          dragRef.current.lastX = remaining.x;
          dragRef.current.lastY = remaining.y;
        }
      }
    },
    [commitThresholdDeg, engineRef],
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
