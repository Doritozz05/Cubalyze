"use client";

import { useCallback, useRef } from "react";
import type { Cube3DEngine, CubeLayerPick } from "@cubeforge/cube-3d-engine";
import type { CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";
import { resolveDragMove } from "@/utils/cubeDragLayer";

/**
 * Touch + keyboard controls for the virtual-cube view.
 *
 * Gesture model (the virtual-cube interaction — "swipe the layer you want to
 * turn"): a face drag does NOT track the mouse/finger live. Once the swipe
 * passes the dead zone it resolves a definite move and fires it through the
 * same `onAction` pipeline as the keyboard, so the engine plays the turn
 * animation at the configured turn speed and the layer lands at exactly ±90°,
 * ignoring the mouse from then on (virtual-cube style — no 1:1 tracking).
 *
 *   • 1 finger drag ON a cube face → the LAYER under the finger turns, read
 *     in the GRABBED FACE's own orientation ("as if that face faced you" —
 *     see {@link resolveDragMove}): the drag is projected to world space and
 *     compared against the face's two in-plane axes; the dominant axis picks
 *     the drag direction and the OTHER axis is the turn axis, indexed by the
 *     sticker's row/column on it:
 *       - front face: vertical → columns R/M/L by x, horizontal → rows U/E/D
 *         by y (the interaction you liked — unchanged);
 *       - top/bottom face: horizontal → F/S/B by front-back row (front row →
 *         F, middle → S, back → B), front-back → R/M/L by column;
 *       - side faces: vertical → F/S/B by front-back column, front-back →
 *         U/E/D by row.
 *     The direction makes the stickers follow the finger (right-swipe on the
 *     top face front row → F, down on the right face front column → F (up →
 *     F'), up on the front face right column → R, ...). The move is
 *     committed the moment the drag crosses `minSwipeDistance` (14 px); any
 *     further pointer travel is ignored.
 *   • TAP on a cube face → deterministic CLOCKWISE turn of that face.
 *   • DRAG ON THE BACKGROUND → the CUBE rotates in discrete 90° steps (y for
 *     left/right swipes, x for up/down swipes) exactly like the x/y keys —
 *     the camera stays locked on the isometric view.
 *   • 2 fingers → pinch zoom (lifting one finger re-arms the remaining one
 *     as a normal drag).
 *   • Keyboard (csTimer layout) → animated face turns via `performAction`
 *
 * The layer/direction resolution lives in `resolveDragMove` (apps/web) and
 * is fully unit-tested; the animation is the SAME `applyAction` pipeline the
 * keyboard uses, so the visual and the logical CubeState stay in lockstep
 * (the view mirrors the action after firing it).
 *
 * Pointer-cancel (scroll / OS gesture) before the dead zone never fires a
 * move — nothing is turned and the logical state is untouched.
 */
export interface UseCubeTurnControlsOptions {
  /** Ref to the live Cube3DEngine instance (from useCube3D). */
  engineRef: React.RefObject<Cube3DEngine | null>;
  /** Min pointer travel (px) before a face drag fires its move. Default 14 —
   *  big enough to avoid accidental micro-drags, small enough to stay
   *  responsive. */
  minSwipeDistance?: number;
  /**
   * Background-drag distance (px) per 90° cube rotation step. Default 70 —
   * mirroring virtual-cube's discrete swipe rotation.
   */
  rotateStepDistance?: number;
  /**
   * Called by `performAction` (keyboard path) AND by every resolved face
   * drag. The view animates the move on the engine with the configured turn
   * speed and mirrors it into the logical state — one single move pipeline.
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

type DragMode = "idle" | "turn" | "background";

/** The move resolved once a face drag passes the dead zone (see resolveDragMove). */
type ResolvedMove = NonNullable<ReturnType<typeof resolveDragMove>>;

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
  /** Resolved drag move (set once the drag passes the dead zone). */
  move: ResolvedMove | null;
  /** True once the move has been fired — the gesture is consumed and any
   *  further pointer travel is ignored (no live tracking). */
  committed: boolean;
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

export function useCubeTurnControls({
  engineRef,
  minSwipeDistance = 14,
  rotateStepDistance = 70,
  onAction,
}: UseCubeTurnControlsOptions): UseCubeTurnControlsResult {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

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
    move: null,
    committed: false,
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
          move: null,
          committed: false,
          rearmed: false,
          swipeX: 0,
          swipeY: 0,
        };
        // Arm the camera inertia (no-op for turn mode; kills stale glides).
        engine?.setCameraDragActive(true);
      } else if (pointers.current.size === 2) {
        // A second finger lands: switch the gesture to pinch zoom. Any drag
        // move was already fired on dead-zone crossing — the pinch simply
        // supersedes whatever gesture state was left over.
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
          move: null,
          committed: false,
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
   * Resolve WHICH move the drag fires, once (when the pointer first travels
   * past `minSwipeDistance`). The gesture is read in the grabbed face's own
   * orientation (see {@link resolveDragMove}): the world-space drag is
   * compared against the face's two in-plane axes, the turn axis is the
   * other one, and the layer is the sticker's row/column on it. The
   * direction signs the drag against the rotation tangent so the stickers
   * follow the finger.
   */
  const resolveTurn = useCallback(
    (drag: DragState): ResolvedMove | null => {
      const engine = engineRef.current;
      const pick = drag.startPick;
      if (!engine || !pick) return null;
      const cam = engine.sceneManager.camera;
      cam.updateMatrixWorld(true);
      const m = cam.matrixWorld.elements;
      return resolveDragMove({
        dx: drag.lastX - drag.startX,
        dy: drag.lastY - drag.startY,
        face: pick.face,
        cubiePosition: pick.cubiePosition,
        worldPoint: pick.worldPoint,
        cameraRight: { x: m[0], y: m[1], z: m[2] },
        cameraUp: { x: m[4], y: m[5], z: m[6] },
      });
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

        // Resolve the move once, after the dead zone. While a previous move
        // is still animating, cubies sit on a pivot group mid-rotation —
        // pickLayer() would return corrupted state, so wait for it to settle.
        if (!drag.move) {
          if (drag.totalDist < minSwipeDistance) return;
          if (engine.isAnimating()) return;
          drag.move = resolveTurn(drag);
          if (!drag.move) return;
          drag.committed = true;
          // ── Fire the move: animated at the configured turn speed by the
          //    view (the same pipeline as the keyboard) — the layer lands at
          //    exactly ±90° and the mouse is ignored from here on. ──
          onActionRef.current?.({ kind: "turn", face: drag.move.face, direction: drag.move.direction });
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
    [engineRef, minSwipeDistance, resolveTurn, rotateStepDistance],
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

      if (wasTurn && allowCommit) {
        // A drag that already fired its move needs nothing more here. A lift
        // WITHOUT crossing the dead zone is a TAP → deterministic clockwise
        // turn of the tapped face (re-armed gestures never tap). `move` is
        // only ever set together with `committed`, so that check is enough.
        if (!drag.committed && !drag.rearmed && drag.totalDist < minSwipeDistance) {
          const face = drag.startPick!.face;
          onActionRef.current?.({ kind: "turn", face, direction: 1 });
        }
      }
      // Pointer-cancel before the dead zone: nothing was fired, nothing to undo.

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
        move: null,
        committed: false,
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
          move: null,
          committed: false,
          rearmed: true,
          swipeX: 0,
          swipeY: 0,
        };
      }
    },
    [engineRef, minSwipeDistance],
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
