"use client";

import { useCallback, useRef } from "react";
import {
  FACE_ROTATION_MAP,
  layerTwistAngleDelta,
  type Cube3DEngine,
  type CubeLayerPick,
} from "@cubeforge/cube-3d-engine";
import type { CubeFace } from "@cubeforge/types";
import type { CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";
import { resolveDragLayer } from "@/utils/cubeDragLayer";

/**
 * Touch + keyboard controls for the virtual-cube view.
 *
 * Gesture model (the csTimer / virtual-cube interaction — "grab the layer
 * you want to turn and move it"):
 *
 *   • 1 finger drag ON a cube face → the LAYER under the finger follows it
 *     LIVE (arc-length tracking), and on release it SNAPS 90° (animated)
 *     when the twist is at least `commitThresholdDeg`, otherwise it springs
 *     back. The layer is resolved in PURE SCREEN SPACE (camera-independent,
 *     csTimer-style): the drag direction picks the axis, the grabbed cubie's
 *     grid position picks the layer:
 *       - |dy| > |dx| (vertical drag) → the COLUMN layer at the sticker
 *         (x-axis → R/M/L by the sticker's x position)
 *       - |dx| > |dy| (horizontal drag) → the ROW layer at the sticker
 *         (y-axis → U/E/D by the sticker's y position)
 *     So dragging the right column up turns R, the middle column turns M,
 *     the bottom row right turns D, a right-swipe on the U face turns U,
 *     and a right-swipe on D turns D — always the layer you grabbed.
 *   • TAP on a cube face → deterministic CLOCKWISE turn of that face.
 *   • DRAG ON THE BACKGROUND → the CUBE rotates in discrete 90° steps (y for
 *     left/right swipes, x for up/down swipes) exactly like the x/y keys —
 *     the camera stays locked on the isometric view.
 *   • 2 fingers → pinch zoom (lifting one finger re-arms the remaining one
 *     as a normal drag).
 *   • Keyboard (csTimer layout) → animated face turns via `performAction`
 *
 * The drag math (`pickLayer` + `layerTwistAngleDelta`) lives in the engine
 * package and is fully unit-tested there. The move is committed through
 * `onTurnCommitted` ONLY after the snap animation completes, so the logical
 * state (CubeState) always lands exactly on the finished visual — no desync,
 * deterministic by construction.
 *
 * Pointer-cancel (scroll / OS gesture) never commits — nothing is turned and
 * the logical state is untouched.
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
   * Background-drag distance (px) per 90° cube rotation step. Default 70 —
   * mirroring virtual-cube's discrete swipe rotation.
   */
  rotateStepDistance?: number;
  /**
   * Duration (ms) of the snap animation when a drag COMMITS a 90° turn.
   * Default 90. The view can wire this to its turn-speed preference so the
   * snap matches the keyboard animation speed.
   */
  snapDurationMs?: number;
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

type DragMode = "idle" | "turn" | "background";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The live-twist layer resolved once a drag is underway. */
interface ResolvedTwist {
  /** Engine turn axis ('x' → R/M/L columns, 'y' → U/E/D rows). */
  axis: "x" | "y";
  /** Layer value along the axis (−1 | 0 | 1) — from the grabbed cubie. */
  layerValue: number;
  /** WCA label of the layer being turned. */
  face: CubeFace;
  /** Grab point (possibly nudged off the axis) for the arc-length tracking. */
  worldPoint: Vec3;
  axisVector: Vec3;
}

/** Mutable state of the single active pointer gesture. */
interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** Cumulative pointer travel (px) since the drag started. */
  totalDist: number;
  /** Sticker pressed at pointer-down (the drag's geometric origin). */
  startPick: CubeLayerPick | null;
  /** Resolved live-twist layer (set once the drag passes the dead zone). */
  twist: ResolvedTwist | null;
  /** Live twist angle in engine degrees, clamped to ±90. */
  angleDeg: number;
  /** True while the commit/spring-back animation is running. */
  snapping: boolean;
  /**
   * True when this gesture was RE-ARMED from a pinch's remaining finger
   * (see finishPointer). Re-armed gestures are drag-only: lifting without
   * moving must NOT fire a tap-turn.
   */
  rearmed: boolean;
  /** Accumulated background swipe (px) since the last 90° step. */
  swipeX: number;
  swipeY: number;
}

/** World-units-per-pixel at the cube's depth (camera orbits the origin). */
function worldPerPixelAtCube(canvas: HTMLCanvasElement, engine: Cube3DEngine): number {
  const cam = engine.sceneManager.camera;
  const rect = canvas.getBoundingClientRect();
  if (rect.height <= 0) return 0.01;
  const verticalHalfFovTan = Math.tan((cam.fov * Math.PI) / 360);
  return (2 * verticalHalfFovTan * cam.position.length()) / rect.height;
}

const X_AXIS: Vec3 = { x: 1, y: 0, z: 0 };
const Y_AXIS: Vec3 = { x: 0, y: 1, z: 0 };

/** Cross product of a rotation axis and a point → tangent direction. */
const tangent = (a: Vec3, p: Vec3): Vec3 => ({
  x: a.y * p.z - a.z * p.y,
  y: a.z * p.x - a.x * p.z,
  z: a.x * p.y - a.y * p.x,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const len = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

export function useCubeTurnControls({
  engineRef,
  minSwipeDistance = 6,
  commitThresholdDeg = 40,
  rotateStepDistance = 70,
  snapDurationMs = 90,
  onAction,
  onTurnCommitted,
}: UseCubeTurnControlsOptions): UseCubeTurnControlsResult {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const onTurnCommittedRef = useRef(onTurnCommitted);
  onTurnCommittedRef.current = onTurnCommitted;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<DragState>({
    mode: "idle",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    totalDist: 0,
    startPick: null,
    twist: null,
    angleDeg: 0,
    snapping: false,
    rearmed: false,
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
          mode: pick ? "turn" : "background",
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          totalDist: 0,
          startPick: pick,
          twist: null,
          angleDeg: 0,
          snapping: false,
          rearmed: false,
          swipeX: 0,
          swipeY: 0,
        };
        // Arm the camera inertia (no-op for turn mode; kills stale glides).
        engine?.setCameraDragActive(true);
      } else if (pointers.current.size === 2) {
        // A second finger lands: abort any in-flight twist (spring back) and
        // switch the gesture to pinch zoom.
        if (dragRef.current.mode === "turn" && dragRef.current.twist && !dragRef.current.snapping) {
          void engine?.cancelLayerTwist(60);
        }
        // Keep the camera-inertia state machine armed (same as 1-finger drags)
        // so a later 2→1 re-arm / release doesn't leave a stale glide.
        engine?.setCameraDragActive(true);
        dragRef.current = {
          mode: "idle",
          startX: 0,
          startY: 0,
          lastX: 0,
          lastY: 0,
          totalDist: 0,
          startPick: null,
          twist: null,
          angleDeg: 0,
          snapping: false,
          rearmed: false,
          swipeX: 0,
          swipeY: 0,
        };
        pinchDistRef.current = currentPinchDistance();
      }
    },
    [engineRef],
  );

  /**
   * Resolve WHICH layer the drag is turning, once (when the pointer first
   * travels past `minSwipeDistance`). Rule (csTimer-style, PURE SCREEN
   * SPACE — no camera projection, so it cannot be fooled by the view angle):
   *
   *   • |dy| > |dx| (vertical drag) → the COLUMN layer at the grabbed
   *     sticker: x-axis, R/M/L by the cubie's x grid position.
   *   • |dx| > |dy| (horizontal drag) → the ROW layer at the grabbed
   *     sticker: y-axis, U/E/D by the cubie's y grid position.
   *
   * So dragging the right column turns R, the middle column M, the bottom
   * row D, a right-swipe on U turns U — the layer you grab always turns.
   * The live-twist arc-length tracking (layerTwistAngleDelta) then makes it
   * follow the finger in the dragged direction.
   */
  const resolveTwist = useCallback(
    (drag: DragState): ResolvedTwist | null => {
      const engine = engineRef.current;
      const pick = drag.startPick;
      if (!engine || !pick) return null;

      const dx = drag.lastX - drag.startX;
      const dy = drag.lastY - drag.startY;
      const resolved = resolveDragLayer({
        dx,
        dy,
        cubieX: pick.cubiePosition.x,
        cubieY: pick.cubiePosition.y,
      });
      if (!resolved) return null;
      const { axis, layerValue, face } = resolved;

      const axisVector = axis === "x" ? X_AXIS : Y_AXIS;
      const cam = engine.sceneManager.camera;
      cam.updateMatrixWorld(true);
      const m = cam.matrixWorld.elements;
      const p = pick.worldPoint;
      let grabPoint = p;
      // Center grabs sit ON the rotation axis (tangent ≈ 0 → dead zone).
      // Give the drag a stable virtual grab point at the face edge by
      // projecting the camera-right direction onto the plane ⊥ axis, so the
      // layer still follows the finger wherever the user touches.
      if (len(tangent(axisVector, p)) < 0.25) {
        const camRight: Vec3 = { x: m[0], y: m[1], z: m[2] };
        const along = dot(camRight, axisVector);
        const proj: Vec3 = {
          x: camRight.x - along * axisVector.x,
          y: camRight.y - along * axisVector.y,
          z: camRight.z - along * axisVector.z,
        };
        const plen = len(proj);
        if (plen > 1e-4) {
          grabPoint = { x: p.x + proj.x / plen, y: p.y + proj.y / plen, z: p.z + proj.z / plen };
        }
      }

      // A twist only starts if the engine grants a free pivot; otherwise the
      // gesture stays inert (a previous move is still snapping).
      const ok = engine.beginLayerTwist(axis, [layerValue]);
      if (!ok) return null;
      return { axis, layerValue, face, worldPoint: grabPoint, axisVector };
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
        if (drag.snapping) return;
        drag.totalDist += Math.hypot(dx, dy);
        const canvas = e.target as HTMLCanvasElement;

        // Resolve the layer once, after the dead zone. While a previous move
        // is still animating, cubies sit on a pivot group mid-rotation —
        // pickLayer() would return corrupted state, so wait for it to settle.
        if (!drag.twist) {
          if (drag.totalDist < minSwipeDistance) return;
          if (engine.isAnimating()) return;
          drag.twist = resolveTwist(drag);
          if (!drag.twist) return;
          drag.angleDeg = 0;
        }

        // ── Live twist: the layer follows the finger, frame by frame ────
        const cam = engine.sceneManager.camera;
        const m = cam.matrixWorld.elements;
        const worldPerPx = worldPerPixelAtCube(canvas, engine);
        const worldDrag: Vec3 = {
          x: (dx * m[0] + dy * m[4]) * worldPerPx,
          y: (dx * m[1] + dy * m[5]) * worldPerPx,
          z: (dx * m[2] + dy * m[6]) * worldPerPx,
        };
        const delta = layerTwistAngleDelta({
          axisVector: drag.twist.axisVector,
          worldPoint: drag.twist.worldPoint,
          worldDrag,
        });
        const next = Math.max(-90, Math.min(90, drag.angleDeg + delta));
        drag.angleDeg = next;
        engine.setLayerTwistAngle(next);
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
    [engineRef, minSwipeDistance, resolveTwist, rotateStepDistance],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, allowCommit = true) => {
      const canvas = e.target as HTMLCanvasElement;
      const engine = engineRef.current;
      const drag = dragRef.current;
      const wasTurn = drag.mode === "turn" && !!drag.startPick;

      pointers.current.delete(e.pointerId);

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be lost
      }

      if (wasTurn && engine) {
        if (allowCommit) {
          if (drag.twist && engine.isLayerTwistActive()) {
            // Release with a twist: commit past the threshold, else spring back.
            drag.snapping = true;
            const abs = Math.abs(drag.angleDeg);
            if (abs >= commitThresholdDeg) {
              const target = Math.sign(drag.angleDeg) * 90;
              void engine.finishLayerTwist(target, snapDurationMs).then(() => {
                // Map the finished engine angle back to a cube-notation
                // direction (angle = direction × angleSign × 90) — same
                // convention as the smart-cube move path, so the committed
                // state is exact.
                const angleSign = FACE_ROTATION_MAP[drag.twist!.face].angleSign;
                const direction = Math.round(target / (90 * angleSign)) as 1 | -1;
                onTurnCommittedRef.current?.({ kind: "turn", face: drag.twist!.face, direction });
              });
            } else {
              void engine.cancelLayerTwist(90);
            }
          } else if (!drag.rearmed && !drag.twist) {
            // Tap (no real drag) → deterministic clockwise turn of the face.
            if (drag.totalDist < minSwipeDistance) {
              const face = drag.startPick!.face;
              onActionRef.current?.({ kind: "turn", face, direction: 1 });
            }
          }
        } else if (drag.twist && engine.isLayerTwistActive()) {
          // Pointer-cancel (scroll / OS gesture): spring back, never commit.
          void engine.cancelLayerTwist(60);
        }
      }

      // Only finalize the gesture state if it is STILL the active one — a new
      // pointerdown during an animation replaces dragRef.current, and we must
      // never clobber the fresh gesture.
      const isCurrent = dragRef.current === drag;
      const fresh: DragState = {
        mode: "idle",
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        totalDist: 0,
        startPick: null,
        twist: null,
        angleDeg: 0,
        snapping: false,
        rearmed: false,
        swipeX: 0,
        swipeY: 0,
      };
      if (pointers.current.size === 0) {
        if (isCurrent) {
          dragRef.current = fresh;
          // Release: let the engine glide the camera with inertia (background mode).
          engine?.setCameraDragActive(false);
        }
      } else if (pointers.current.size === 1 && isCurrent) {
        // 2 → 1 fingers: RE-ARM the remaining finger as a real gesture
        // (sticker or background, depending on what's under it) so a pinch
        // can continue as a drag without lifting. Its pointer-moves now
        // drive the normal gesture state machine.
        const remaining = [...pointers.current.values()][0];
        const ndc = ndcFromPointer(canvas, remaining.x, remaining.y);
        const pick: CubeLayerPick | null =
          ndc && engineRef.current ? engineRef.current.pickLayer(ndc.x, ndc.y) : null;
        dragRef.current = {
          mode: pick ? "turn" : "background",
          startX: remaining.x,
          startY: remaining.y,
          lastX: remaining.x,
          lastY: remaining.y,
          totalDist: 0,
          startPick: pick,
          twist: null,
          angleDeg: 0,
          snapping: false,
          rearmed: true,
          swipeX: 0,
          swipeY: 0,
        };
      }
    },
    [commitThresholdDeg, engineRef, minSwipeDistance, snapDurationMs],
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
