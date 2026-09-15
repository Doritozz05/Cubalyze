"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  pyraminxDragToken,
  resolvePyraminxDragMove,
  type PyraminxEngine,
  type PyraminxPick,
} from "@cubalyze/cube-3d-engine";

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
 *     arc the swipe follows — the sticker always follows the finger). The
 *     camera NEVER moves on a piece.
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
 * A gesture that crossed the dead zone is NEVER dropped: if the engine is
 * still animating the previous turn when the swipe commits, the resolve is
 * deferred (re-tried on the next pointer move, and finally at pointer-up
 * once the engine settles) instead of silently discarding the move — a fast
 * "turn back the other way" flick must always land.
 *
 * Pointer-cancel (scroll / OS gesture) after the dead zone fires the move —
 * exactly as if it had resolved on a move event (the dead-zone crossing was
 * already a committed gesture).
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
  /** Tilt rotation (180° C2 symmetry tilt around PYRAMINX_TILT_AXIS). 1 = down, -1 = up. */
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
  /** True when the engine was ANIMATING at pointer-down: the pick may be
   *  stale (the piece was mid-pivot), so it is re-picked at resolve time. */
  pickStale: boolean;
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
  pickStale: false,
  committed: false,
  swipeX: 0,
  swipeY: 0,
};

/** Max total wait (ms) for the engine to settle before resolving a deferred
 *  pointer-up gesture (a turn animation is at most ~350 ms). */
const SETTLE_MAX_WAIT_MS = 1000;
const SETTLE_POLL_MS = 25;

/** How long a pointer entry may sit in the `pointers` map with no event
 *  before it is treated as a ghost. A live finger refreshes its own entry on
 *  every move, so a genuinely held finger is never pruned; an entry whose
 *  pointerup/pointercancel escaped the canvas (capture loss, canvas remount,
 *  context eviction, OS gesture…) ages out and the drag system self-heals.
 *  Generous on purpose: the window-level listeners in the hook clear ghosts
 *  instantly; the TTL is only the final safety net. */
const POINTER_TTL_MS = 3000;

/** How long a just-pressed pointer may sit UNMOVED before the next
 *  pointerdown may drop it as a ghost. A real second finger in a pinch
 *  produces a move within this window; a ghost entry whose up escaped the
 *  canvas (reload teardown, frozen frame…) never does — so a drag started
 *  right after such a ghost is not swallowed by the "second finger" pinch
 *  branch. Long enough that a deliberate slow two-finger landing is kept. */
const POINTER_ARM_GRACE_MS = 250;

/** One entry of the live-pointer map (see {@link pruneGhostPointers}). */
export interface PyraminxPointerEntry {
  x: number;
  y: number;
  /** Timestamp of the entry's last event (performance.now()). */
  t: number;
  /** True once the pointer produced a move event. */
  moved: boolean;
}

/**
 * Drop pointer entries whose up/cancel never reached the canvas. Without
 * this, ONE lost pointerup (e.g. the browser eats the up during a canvas
 * remount or capture loss) leaves `pointers.size` stuck at ≥ 2 and the
 * `size === 1` single-finger gate refuses to arm ANY drag from then on —
 * every piece drag and background rotation silently dies (the "ghost
 * pointer" wedge). Pure and exported so the wedge is unit-testable.
 *
 * Two rules:
 *   • TTL: an entry with no event at all for POINTER_TTL_MS is a ghost.
 *   • Arm grace: at pointer-down, an UNMOVED entry older than
 *     POINTER_ARM_GRACE_MS is dropped too — a real second finger has
 *     produced a move by then; a ghost from a missed up never does.
 * A freshly-armed pointer is never dropped: its age is ~0 at the moment of
 * its own pointerdown, so both rules leave it in place.
 */
export function pruneGhostPointers(
  map: Map<number, PyraminxPointerEntry>,
  now: number,
  atPointerDown = false,
): void {
  for (const [id, p] of map) {
    if (now - p.t > POINTER_TTL_MS) {
      map.delete(id);
      continue;
    }
    if (atPointerDown && !p.moved && now - p.t > POINTER_ARM_GRACE_MS) {
      map.delete(id);
    }
  }
}

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

  const pointers = useRef(new Map<number, PyraminxPointerEntry>());
  const pinchDistRef = useRef(0);
  const dragRef = useRef<DragState>({ ...FRESH_DRAG });

  const currentPinchDistance = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  // ── Ghost-pointer self-healing ────────────────────────────────────────
  // The canvas can lose a pointerup/pointercancel (capture loss, canvas
  // remount, context eviction, window blur, OS gesture, navigation teardown…).
  // Window-level listeners catch the escaped event no matter where it lands,
  // and a blur clears the map outright; the TTL prune (see
  // {@link pruneGhostPointers}) is the final safety net for anything the
  // listeners miss.
  useEffect(() => {
    const forget = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
    };
    const clearAll = () => {
      pointers.current.clear();
      dragRef.current = { ...FRESH_DRAG };
    };
    window.addEventListener("pointerup", forget);
    window.addEventListener("pointercancel", forget);
    window.addEventListener("lostpointercapture", forget);
    window.addEventListener("blur", clearAll);
    return () => {
      window.removeEventListener("pointerup", forget);
      window.removeEventListener("pointercancel", forget);
      window.removeEventListener("lostpointercapture", forget);
      window.removeEventListener("blur", clearAll);
    };
  }, []);

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
      pointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        moved: false,
      });
      pruneGhostPointers(pointers.current, performance.now(), true);
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
          // A pick taken while the previous turn is still animating is stale
          // (the piece sits mid-pivot) — re-pick when the gesture resolves.
          pickStale: pick !== null && (engine?.isAnimating() ?? false),
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
    (drag: DragState, canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null => {
      const engine = engineRef.current;
      if (!engine) return null;
      let pick = drag.pick;
      // Stale pick (pointer went down mid-animation): re-pick at the pointer's
      // CURRENT position — the engine is at rest here, so the piece under the
      // finger is exactly the one the user is dragging. Falls back to the
      // original pick if the pointer drifted off the puzzle.
      if (drag.pickStale) {
        const ndc = ndcFromPointer(canvas, clientX, clientY);
        const fresh = ndc && engine ? engine.pickSticker(ndc.x, ndc.y) : null;
        if (fresh) pick = fresh;
      }
      if (!pick) return null;
      const cam = engine.sceneManager?.camera;
      if (!cam) return null;
      cam.updateMatrixWorld(true);
      const m = cam.matrixWorld.elements;
      // Vertex WORLD positions (scaled to the puzzle) — the spatial fallback
      // of the resolver turns toward the candidate vertex a tangent-ambiguous
      // swipe heads at (diagonal drags the perspective makes unintuitive).
      const scale = engine.model?.root.scale.x ?? 1;
      const vertexWorld = (v: "U" | "L" | "R" | "B") =>
        engine.getWorldAxis(v).multiplyScalar(scale);
      const rect = canvas.getBoundingClientRect();
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
        vertices: {
          U: vertexWorld("U"),
          L: vertexWorld("L"),
          R: vertexWorld("R"),
          B: vertexWorld("B"),
        },
        camera: cam,
        viewWidth: rect.width > 0 ? rect.width : 400,
        viewHeight: rect.height > 0 ? rect.height : 400,
        cameraRight: { x: m[0], y: m[1], z: m[2] },
        cameraUp: { x: m[4], y: m[5], z: m[6] },
      });
      return move ? pyraminxDragToken(move) : null;
    },
    [engineRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        moved: true,
      });
      pruneGhostPointers(pointers.current, performance.now());
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
        // While the previous turn is still animating, pieces sit on pivot
        // groups mid-rotation — wait for the driver to settle. The gesture is
        // NOT dropped: the next move event (or pointer-up) re-resolves.
        if (engine.isAnimating()) return;
        const token = resolveTurn(drag, e.target as HTMLCanvasElement, e.clientX, e.clientY);
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

  /** Resolve a threshold-crossed gesture at pointer-up — the safety net that
   *  guarantees no committed drag is ever dropped (the move-event path may
   *  have skipped it while the engine was animating and the flick ended
   *  before the next move event). */
  const resolveAtPointerUp = useCallback(
    (drag: DragState, canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const tryResolve = () => {
        if (drag.committed) return;
        const token = resolveTurn(drag, canvas, clientX, clientY);
        if (!token) return;
        drag.committed = true;
        onTurnRef.current?.(token);
      };
      if (engine.isAnimating()) {
        // The previous turn is still landing — wait for it to settle, then
        // resolve (the driver snaps colliding moves, so firing is always safe).
        const deadline = performance.now() + SETTLE_MAX_WAIT_MS;
        const poll = () => {
          if (drag.committed) return;
          if (!engine.isAnimating() || performance.now() >= deadline) {
            tryResolve();
            return;
          }
          setTimeout(poll, SETTLE_POLL_MS);
        };
        poll();
      } else {
        tryResolve();
      }
    },
    [engineRef, resolveTurn],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = e.target as HTMLCanvasElement;
      const drag = dragRef.current;
      pointers.current.delete(e.pointerId);
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be lost */
      }
      if (pointers.current.size === 0) {
        // A turn gesture that crossed the dead zone but never fired (the
        // engine was animating when the swipe committed) resolves HERE — the
        // move is never dropped, even for a quick flick.
        if (
          drag.mode === "turn" &&
          !drag.committed &&
          drag.totalDist >= minSwipeDistance
        ) {
          resolveAtPointerUp(drag, canvas, e.clientX, e.clientY);
        }
        dragRef.current = { ...FRESH_DRAG };
      }
    },
    [minSwipeDistance, resolveAtPointerUp],
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
