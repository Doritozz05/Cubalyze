"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { HelpCircle, RotateCcw, Shuffle } from "lucide-react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { useCube3D } from "@/hooks/useCube3D";
import { useCubeTurnControls } from "@/hooks/useCubeTurnControls";
import {
  CUBE_KEYMAP,
  actionToMoves,
  actionToNotation,
  actionToValidatorEvents,
  isActionAllowedForOrder,
  type CubeKeyAction,
} from "@/lib/keybinds/cubeKeybinds";
import type {
  CubeFace,
  CubeMoveEvent,
  CubeOrientation,
  OrientationTimeline,
} from "@cubeforge/types";
import type { Penalty, PuzzleCategory } from "@/types";
import { scrambleMoveDurationMs } from "@cubeforge/cube-3d-engine";
import { generateScrambleFor, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { formatTime } from "@/utils/formatTime";
import {
  useVirtualCubeSession,
  type VirtualSolveHandler,
} from "@/hooks/useVirtualCubeSession";
import type { SolveCompletionOverrides } from "@/hooks/useSolveCompletion";
import {
  Cube2x2FaceletConverter,
  Cube2x2State,
  CubeState,
  FaceletStringConverter,
  MoveTransformer,
  OrientationTable,
  SOLVED_FACELETS_2X2,
  type OrientationEntry,
} from "@cubeforge/math-core";
import { preferencesStore } from "@cubeforge/state";
import { useVirtualScrambleStore } from "@/stores/virtualScrambleStore";
import { cubeTurnSounds } from "@/utils/cubeTurnSounds";
import { CubeHelpOverlay, type CubeTurnSpeed } from "./CubeHelpOverlay";

/** The logical state of the active simulator cube (3×3 or 2×2). */
type SimulatorState = CubeState | Cube2x2State;

/**
 * Canonical solved facelet strings — the ONLY facelet state the virtual cube
 * ever pushes to the session. Math-core keeps the centers FIXED (they never
 * permute), so a solved-but-rotated mirror serializes to faces with a
 * mismatched center sticker (e.g. "BBBBRBBBB") that FAILS the SOLVED_FACELETS
 * regex — the timer would never stop and the validator would never reset
 * after a rotated solve/undo. The canonical string matches the solved regex
 * and tells both consumers "cube back at the solved start" regardless of
 * frame. 2×2 uses the 24-char form (SOLVED_FACELETS_2X2).
 */
const SOLVED_CANONICAL_3X3 = FaceletStringConverter.toFaceletString(new CubeState());
const SOLVED_CANONICAL_2X2 = Cube2x2FaceletConverter.toFaceletString(new Cube2x2State());

/**
 * End-of-solve pipeline prop (wired by App via the same useSolveCompletion
 * the real timer uses — with `source: "virtual"` overrides). Solves are
 * saved with full moves + orientation timeline so the deep analysis
 * pipeline and replay work identically to smart-cube solves.
 */
export interface CubeSimulatorViewProps {
  puzzle: PuzzleCategory;
  onVirtualSolveComplete?: (
    time: number,
    penalty: Penalty,
    moves: CubeMoveEvent[],
    orientations: (CubeOrientation | undefined)[],
    orientationTimeline: OrientationTimeline | undefined,
    overrides?: SolveCompletionOverrides,
  ) => void;
}

/** Base animation duration (ms) per turn speed. `instant` disables animation. */
const TURN_SPEED_BASE_MS: Record<CubeTurnSpeed, number> = {
  slow: 260,
  normal: 140,
  fast: 70,
  instant: 0,
};

/**
 * Virtual cube simulator — a csTimer-style keyboard/touch cube.
 *
 * Architecture (single source of truth, but the RENDERER is the visual state):
 *
 *   • The 3D engine (CubeModel + RotationEngine) is the VISUAL layer: every
 *     move — face, slice, wide or whole-cube rotation — plays as an animated
 *     layer rotation, exactly like csTimer's virtual cube. Whole-cube
 *     rotations (x/y/z) rotate ALL three layers of an axis at once, so the
 *     centers turn with the cube (a physical rotation moves every sticker).
 *   • A math-core {@link CubeState} mirrors every move for LOGIC (solved
 *     detection, timer). It is never serialized to facelets in the hot path,
 *     so rotated frames never desync the centers.
 *   • Drag (virtual-cube model — NO live mouse tracking): a face swipe
 *     resolves the layer at the sticker and fires the move through the SAME
 *     pipeline as the keyboard, so the engine animates it at the configured
 *     turn speed and the layer lands at exactly ±90° ignoring the mouse.
 *     The gesture is read in the GRABBED FACE's own orientation: on the
 *     front face vertical drags turn columns R/M/L and horizontal drags rows
 *     U/E/D; on the top face horizontal drags turn F/S/B by the sticker's
 *     front-back row; on the side faces vertical drags turn F/S/B by the
 *     sticker's front-back column (right column up on the front face → R,
 *     right-swipe on the top face front row → F, down on the right face
 *     front column → F). Dragging the background rotates the whole cube in
 *     discrete 90° steps while the camera stays locked on the isometric
 *     view.
 *   • The scramble starts SOLVED and is PERFORMED by the user (or applied
 *     instantly with the Scramble button) — exactly like the real timer with
 *     a smart cube: the per-move scramble validator shows progress, errors
 *     and the "too many mistakes" reset; the per-move turn speed is
 *     user-configurable, and 'instant' disables move animations too.
 *
 * Timer (professional system — the SAME TimerEngine state machine as the
 * real timer, driven by the virtual cube instead of BLE): the timer CANNOT
 * start before the cube is scrambled. The validator auto-arms the moment the
 * scramble is completed or applied; the FIRST turn then starts the clock,
 * and it stops when the cube is solved up to a whole-cube rotation.
 * Whole-cube rotations never start/stop it, and reset/regenerate return to
 * IDLE without starting anything (inspection is the next step).
 */
interface CubeSimulatorCoreProps {
  puzzle: PuzzleCategory;
  onVirtualSolveComplete?: CubeSimulatorViewProps["onVirtualSolveComplete"];
}

/**
 * The Cube tab supports 2×2 and 3×3. The puzzle comes from the global dock
 * selector (single source of truth, already selectable in the header); the
 * core remounts on change (`key={puzzle}`) so each order gets a clean engine
 * + logical state + scramble lifecycle — no shared-state races between the
 * two mirrors.
 */
export const CubeSimulatorView = memo(function CubeSimulatorView({
  puzzle,
  onVirtualSolveComplete,
}: CubeSimulatorViewProps) {
  return (
    <CubeSimulatorCore
      key={puzzle}
      puzzle={puzzle}
      onVirtualSolveComplete={onVirtualSolveComplete}
    />
  );
});

const CubeSimulatorCore = memo(function CubeSimulatorCore({
  puzzle,
  onVirtualSolveComplete,
}: CubeSimulatorCoreProps) {
  const order = puzzle === "2x2" ? 2 : 3;
  const puzzleType = puzzleCategoryToType(puzzle);
  const solvedCanonical =
    order === 2 ? SOLVED_CANONICAL_2X2 : SOLVED_CANONICAL_3X3;
  const { t } = useTranslation("cube");

  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    zoomCamera,
    engineRef,
  } = useCube3D({ order, connectSmartCube: false });

  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const cubeTurnSpeed = useStore(preferencesStore, (s) => s.cubeTurnSpeed);
  // "Rotate scramble with cube" (Settings → Scramble): remap the scramble
  // notation to the virtual cube's current orientation, like the real timer
  // does with the physical cube's gyroscope.
  const scrambleFollowsCube = useStore(preferencesStore, (s) => s.scrambleFollowsCube);

  const [scramble, setScramble] = useState(() => generateScrambleFor(puzzle));
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  // Wheel zoom must attach natively with { passive: false }: React registers
  // onWheel as a passive root listener, so preventDefault() is ignored and the
  // page scrolls while the cube zooms. Touch is unaffected — the canvas keeps
  // `touch-none`, so pinch stays captured and mobile scroll outside the cube
  // keeps working.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomCamera(e.deltaY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomCamera, canvasRef]);
  // The virtual cube's accumulated whole-cube rotation (x/y/z) — the
  // equivalent of the physical cube's gyro orientation. Composed with
  // OrientationTable (the same verified math the timer's dynamic notation
  // uses) and applied via MoveTransformer.remapScrambleString.
  const [grip, setGrip] = useState<OrientationEntry>(OrientationTable.IDENTITY);
  // Latest grip readable synchronously by applyAction — a drag can commit
  // through onActionRef between an engine rotation and the React re-render
  // flushing the new state, so the ref guarantees the conjugation always
  // uses the grip that matches the engine's current visual orientation.
  const gripRef = useRef(grip);
  gripRef.current = grip;

  const stateRef = useRef<SimulatorState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = order === 2 ? new Cube2x2State() : new CubeState();
  }
  // One-time init once the engine is ready (initial solved facelets + camera).
  const didInitRef = useRef(false);

  // The session's onSolve reads through this ref (set by an effect below,
  // after handleRegenerate exists) so the completion pipeline — which needs
  // this view's scramble + next-scramble lifecycle — is never in a temporal
  // dead zone, and the session hook itself stays stable.
  const virtualSolveRef = useRef<VirtualSolveHandler>(() => {});

  const {
    phase,
    time,
    lastTime,
    validation,
    notifyTurn,
    notifyTurnToken,
    pushFacelets,
    resetScramble,
    reset: resetSession,
  } = useVirtualCubeSession(scramble, {
    // The virtual cube's whole-cube rotations ARE the orientation source:
    // reading the view's grip at each move gives exact per-move
    // orientations — the equivalent of a smart cube's gyroscope.
    gripRef,
    order,
    onSolve: (time, penalty, moves, orientations, orientationTimeline) =>
      virtualSolveRef.current(time, penalty, moves, orientations, orientationTimeline),
  });

  /** Push the logical state to the 3D engine (instant facelet sync — used for
   *  scramble apply and reset, whose frames are always canonical). */
  const syncState = useCallback(() => {
    const engine = engineRef.current;
    const state = stateRef.current;
    if (!engine || !state) return;
    engine.syncFacelets(
      order === 2
        ? Cube2x2FaceletConverter.toFaceletString(state as Cube2x2State)
        : FaceletStringConverter.toFaceletString(state as CubeState),
    );
  }, [engineRef, order]);

  /** Return the camera to the locked isometric view (same as the algorithms
   *  3D: theta/phi = 30°, tilted right for the best perspective). */
  const resetCamera = useCallback(() => {
    engineRef.current?.setIsometricView();
  }, [engineRef]);

  // Warm the turn-sound sample pool as soon as the view mounts — BEFORE the
  // 3D engine is ready — so the first move's click is already decoded and
  // never lags (see cubeTurnSounds.preload's muted decode-warm).
  useEffect(() => {
    cubeTurnSounds.preload();
  }, []);

  // Share the current scramble with the floating widgets while the Cube view
  // is active — each view owns an independent scramble lifecycle, so the
  // host reads THIS value (not the real timer's) on the Cube tab. Layout
  // effect (not render, not passive): the scramble-2d widget must never
  // flash a solved cube on first visit, and the old store write inside the
  // useState initializer triggered React's "Cannot update a component
  // (StageOverlays) while rendering a different component
  // (CubeSimulatorCore)" warning — updating another component during render
  // is forbidden. A layout effect publishes before the first paint with no
  // warning.
  useLayoutEffect(() => {
    useVirtualScrambleStore.getState().setScramble(scramble);
  }, [scramble]);

  // The one-time gesture hint disappears by itself a few seconds after the
  // cube is ready (and immediately on the first drag).
  useEffect(() => {
    if (!isReady || !hintVisible) return;
    const timer = setTimeout(() => setHintVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [isReady, hintVisible]);

  // Lock the initial camera to the isometric view once the engine is ready.
  useEffect(() => {
    if (!isReady) return;
    engineRef.current?.setIsometricView();
  }, [isReady, engineRef]);

  // Mount: once ready, tell the validator we start from a solved cube (its
  // facelet handler seeds startedFromSolved — same as a freshly connected
  // smart cube reporting solved facelets).
  useEffect(() => {
    if (!isReady || didInitRef.current) return;
    didInitRef.current = true;
    // The virtual cube only ever pushes CANONICAL solved facelets (see
    // solvedCanonical) — every push tells both consumers "cube at the
    // solved start" regardless of frame.
    pushFacelets(solvedCanonical);
  }, [isReady, pushFacelets, solvedCanonical]);

  /**
   * Reset the cube to SOLVED (visual + logical CubeState) and lock the
   * isometric camera. Used by regenerate/reset/scramble-now.
   */
  const resetCube = useCallback(() => {
    stateRef.current = order === 2 ? new Cube2x2State() : new CubeState();
    engineRef.current?.resetCube();
    resetCamera();
    setGrip(OrientationTable.IDENTITY);
  }, [engineRef, order, resetCamera]);

  /** True when the logical state is solved up to a whole-cube rotation.
   *  3×3 uses CubeState.isSolvedUpToRotation; 2×2 has no fixed centers, so
   *  the rotation-invariant facelet regex (SOLVED_FACELETS_2X2) is the check. */
  const isSolvedUpToRotation = useCallback(
    (state: SimulatorState): boolean => {
      if (order === 2) {
        return SOLVED_FACELETS_2X2.test(
          Cube2x2FaceletConverter.toFaceletString(state as Cube2x2State),
        );
      }
      return (state as CubeState).isSolvedUpToRotation();
    },
    [order],
  );

  /**
   * Single move pipeline (keyboard + drag): animate the move on the engine
   * at the configured turn speed (0ms = instant), mirror it into the
   * logical state, feed the validator + timer gate, and push a solved facelet
   * the moment the cube is solved (the session stops the running clock).
   */
  const applyAction = useCallback(
    (action: CubeKeyAction) => {
      const engine = engineRef.current;
      const state = stateRef.current;
      if (!engine || !state) return;

      // 2×2 has no middle layer: slice moves (M/E/S) and wide moves are
      // meaningless, so they are ignored (drags cannot emit them on 2×2 —
      // there is no middle cubie to grab — this guards the keyboard).
      if (!isActionAllowedForOrder(action, order)) return;

      const baseMs = TURN_SPEED_BASE_MS[cubeTurnSpeed];
      const moves = actionToMoves(action, order);
      for (const mv of moves) {
        // Fire-and-forget: the RotationEngine serializes overlapping layers
        // via its collision detector, so rapid input stays consistent.
        void engine.rotateLayers(
          mv.axis,
          mv.layerValues,
          mv.angle,
          scrambleMoveDurationMs(mv.angle, baseMs),
          undefined,
          "smooth",
        );
      }

      const notation = actionToNotation(action);
      try {
        state.applySequence(notation);
      } catch {
        return; // unknown token — ignore
      }

      // Whole-cube rotations are viewing aids (x/y/z): they rotate every
      // layer so the centers turn with the cube, but they are NOT moves —
      // they never touch the validator or the timer. They DO advance the
      // display grip so the "rotate scramble with cube" setting follows.
      if (action.kind === "rotate") {
        const rotation = OrientationTable.rotationEntryFor(notation);
        if (rotation) {
          setGrip((prev) => OrientationTable.compose(rotation, prev));
        }
        return;
      }

      // Randomized turn click for every layer turn (keyboard + drag).
      // Whole-cube x/y/z rotations are viewing aids, not moves — they stay
      // silent, matching the replay engine's onMove semantics.
      cubeTurnSounds.play();

      // Feed the SAME scramble validator the real timer uses. The virtual
      // cube resolves moves in the CURRENT (possibly rotated) view frame —
      // "the layer the user sees" — but the validator compares against the
      // scramble in the CUBE-fixed frame, exactly like the physical timer
      // (the smart cube reports raw moves in its own frame; the gyro only
      // remaps the display). Each position-frame move is conjugated through
      // the grip back to the cube frame, so after a y rotation dragging the
      // front face validates as the original R move. Wide moves stay ONE
      // token ("r" → conjugated "b") so the validator counts a single
      // deviation instead of a phantom error for the slice half.
      //
      // Wides and slices also carry `displayNotation` — the SOLVER-frame
      // token the user performed ("r", "M'"), which can differ from the
      // cube-frame conjugate ("b", "S'") under a rotated grip. The replay
      // shows that label verbatim and animates a wide's layers together.
      const displayNotation =
        action.kind === "wide" ||
        (action.kind === "turn" &&
          (action.face === "M" || action.face === "E" || action.face === "S"))
          ? actionToNotation(action)
          : undefined;
      for (const ev of actionToValidatorEvents(action, gripRef.current)) {
        if (ev.kind === "face") notifyTurn(ev.face, ev.direction, displayNotation);
        else notifyTurnToken(ev.notation, displayNotation);
      }

      // Solved up to rotation → the session stops the running timer (and the
      // validator resets its sticky error state on a solved cube). The pushed
      // facelets are the CANONICAL solved string, not the rotated mirror's
      // (see solvedCanonical above) — otherwise a rotated solve/undo would
      // serialize to a facelet string that fails the solved regex.
      if (isSolvedUpToRotation(state)) {
        pushFacelets(solvedCanonical);
      }
    },
    // grip is intentionally NOT a dependency: applyAction reads gripRef,
    // which is always the latest rotation (a drag can commit between an
    // engine rotation and the React re-render flushing the new grip state).
    [
      cubeTurnSpeed,
      engineRef,
      isSolvedUpToRotation,
      notifyTurn,
      notifyTurnToken,
      order,
      pushFacelets,
      solvedCanonical,
    ],
  );

  // Orientation-adapted scramble (Settings → Scramble → "Rotate scramble
  // with cube"): each token is remapped to the face currently at that
  // position, exactly like the real timer's displayScramble.
  const displayScramble = useMemo(
    () =>
      scrambleFollowsCube
        ? MoveTransformer.remapScrambleString(scramble, grip)
        : scramble,
    [scramble, grip, scrambleFollowsCube],
  );
  // Error moves are stored in the CUBE-fixed frame (that's what the validator
  // consumed); remap them to the current view frame for display, mirroring
  // the displayScramble remap above.
  const displayErrorMoves = useMemo(
    () =>
      scrambleFollowsCube
        ? validation.errorMoves.map((m) => MoveTransformer.remapScrambleString(m, grip))
        : validation.errorMoves,
    [validation.errorMoves, grip, scrambleFollowsCube],
  );

  const { performAction, pointerHandlers } = useCubeTurnControls({
    engineRef,
    // Face drags fire through the SAME pipeline as the keyboard: the engine
    // animates the turn at the configured speed (0 = instant) and then the
    // CubeState is mirrored — there is no live mouse tracking.
    onAction: applyAction,
  });

  // ── csTimer-layout keyboard binding (only while this view is mounted) ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept when an input/editable owns the keyboard, or when a
      // modifier is held (csTimer reserves Alt/Ctrl for global shortcuts).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.code === "Escape") {
        setShowHelp(false);
        return;
      }

      const action: CubeKeyAction | undefined = CUBE_KEYMAP[e.code];
      if (!action) return;
      // 2×2: ignore slice/wide keys (no middle layer).
      if (!isActionAllowedForOrder(action, order)) return;
      e.preventDefault();
      performAction(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [order, performAction]);

  /**
   * New scramble: fresh sequence + cube back to SOLVED (the user performs
   * the new scramble themselves, like the real timer). The session resets
   * the clock when the scramble text changes.
   */
  const handleRegenerate = useCallback(() => {
    setScramble(generateScrambleFor(puzzle));
    resetCube();
  }, [puzzle, resetCube]);

  /**
   * Scramble NOW (the 3D widget's scramble button, moved into this view):
   * apply the CURRENT scramble INSTANTLY from the solved position — no new
   * scramble is generated, the text on screen is the one to solve. The cube
   * is reset to solved first (from a scrambled position the move feed could
   * not be verified), the validator is re-seeded for the SAME text via the
   * adapter's reset signal (the scramble-change re-seed would never fire
   * since the text did not change), and every scramble move is fed in — so
   * the cube is immediately verified → armed → the first turn starts the
   * timer.
   */
  const handleScrambleNow = useCallback(() => {
    // 1) Solved position + identity grip (the scramble lives in the
    //    CUBE-fixed frame) + timer back to idle.
    resetCube();
    resetSession();
    // 2) Re-seed the validator for the current scramble text (fresh state,
    //    no scramble-change → the text stays identical on screen).
    resetScramble();
    // 3) Apply the scramble instantly to the logical state + engine.
    const state: SimulatorState =
      order === 2 ? new Cube2x2State() : new CubeState();
    try {
      state.applySequence(scramble);
    } catch {
      // Unsupported token — leave the cube solved rather than crash.
    }
    stateRef.current = state;
    syncState();
    // 4) Feed every scramble move to the validator (R2 = two quarter turns)
    //    so it verifies the scramble exactly as if the user had performed
    //    it. Tokens are cube-fixed (grip is identity), so the raw faces are
    //    exactly what the validator expects.
    for (const token of scramble.trim().split(/\s+/)) {
      if (!token) continue;
      const face = token[0] as CubeFace;
      const direction: 1 | -1 = token.includes("'") ? -1 : 1;
      notifyTurn(face, direction);
      if (token.includes("2")) notifyTurn(face, direction);
    }
  }, [resetCube, resetSession, resetScramble, scramble, syncState, notifyTurn, order]);

  // ── Solve complete → save (pipeline) → next scramble ─────────────────────
  // Parity with the real timer: every solve is persisted with source
  // "virtual", full moves + orientation timeline, then the SAME deep
  // analysis pipeline patches it (phases, TPS, rotations, …). The next
  // scramble fires AFTER the save resolves (delayed 1200ms so the final
  // time stays visible). Fallback: when no pipeline is wired (e.g. a test
  // harness), regenerate on a timer as before.
  const lastTimeRef = useRef<number | null>(null);
  useEffect(() => {
    virtualSolveRef.current = (
      time,
      penalty,
      moves,
      orientations,
      orientationTimeline,
    ) => {
      // Full move + orientation data is saved for BOTH orders (2×2 and 3×3)
      // so the replay works identically for each: the 3D engine renders the
      // cube by puzzleType (order 2 in ReplaySection) and the grip timeline
      // animates whole-cube rotations like the smart cube's gyroscope. Deep
      // phase analysis (runAnalysis) is 3×3-only — useSolveCompletion skips
      // it for puzzleType "222", so 2×2 solves get the replay but no phase
      // metrics. The DB already accepts puzzleType "222" (ADR-002).
      onVirtualSolveComplete?.(
        time,
        penalty,
        moves,
        orientations,
        orientationTimeline,
        {
          // Tag the solve so stats can filter it: manual / smart / virtual.
          source: "virtual",
          // The virtual cube owns its scramble.
          scramble,
          puzzleType,
          onNextScramble: () => setTimeout(handleRegenerate, 1200),
        },
      );
    };
  });
  useEffect(() => {
    if (onVirtualSolveComplete) return; // the pipeline drives regeneration
    const prev = lastTimeRef.current;
    lastTimeRef.current = lastTime;
    if (lastTime !== null && prev === null) {
      const t = setTimeout(handleRegenerate, 1200);
      return () => clearTimeout(t);
    }
  }, [lastTime, handleRegenerate, onVirtualSolveComplete]);

  /**
   * Reset: cube back to SOLVED (undoes every move including whole-cube
   * rotations x/y/z) + camera back to isometric + timer back to idle. The
   * scramble stays on screen so the user can redo it.
   *
   * The validator is re-seeded for the SAME scramble text (reset$ signal):
   * its "post-scramble" lock (`scrambleCompleted`) must NOT survive a
   * manual reset, or every subsequent move would be silently ignored (the
   * timer would never re-verify the scramble). The solved facelet then
   * confirms the validator starts from a solved cube.
   */
  const handleReset = useCallback(() => {
    resetCube();
    resetSession();
    resetScramble();
    // Canonical solved facelets (see solvedCanonical) — the cube is solved
    // after resetCube, in the cube-fixed frame by definition.
    pushFacelets(solvedCanonical);
  }, [pushFacelets, resetCube, resetSession, resetScramble, solvedCanonical]);

  // ── Timer display (session-driven: 0 while idle, live while running,
  //    frozen at the final time once stopped). ─────────────────────────────
  const formattedTime = useMemo(
    () => formatTime(time, timePrecision),
    [time, timePrecision],
  );

  const unavailable = initFailed || contextEvicted;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col">
      {/* Top bar: scramble display with per-move validation (same component
          as the real timer — the widget-style scramble text).

          FIXED HEIGHT — the canvas below is flex-1, so any change in the
          scramble's wrapped row count (different scramble lengths, error
          moves, "too many mistakes") used to resize the canvas, and the 3D
          engine's FOV-fit then rescales the cube — the whole panel jumped.
          Reserving 3 rows on touch / 2 on desktop keeps the canvas (and the
          cube) pixel-stable; the content is top-aligned, so short scrambles
          leave clean space below. */}
      <div className="flex h-32 shrink-0 items-start overflow-hidden px-4 pt-3 sm:px-6 lg:h-24">
        <div className="min-w-0 flex-1">
          <ScrambleDisplay
            scramble={scramble}
            displayScramble={displayScramble}
            verificationActive
            states={validation.states}
            currentIndex={validation.currentIndex}
            errorMoves={displayErrorMoves}
            pendingHalfDouble={validation.pendingHalfDouble}
            isScrambled={validation.isScrambled}
            needsReset={validation.needsReset}
            awaitingSolve={validation.awaitingSolve}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={cn(
            "absolute inset-0 h-full w-full touch-none outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={(e) => {
            setIsDragging(true);
            if (hintVisible) setHintVisible(false);
            pointerHandlers.onPointerDown(e);
          }}
          onPointerMove={pointerHandlers.onPointerMove}
          onPointerUp={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerCancel(e);
          }}
        />

        {/* Timer overlay — right-center of the canvas (csTimer-style
            position). Clean: just the time, no status captions. */}
        <div className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-5">
          <div className="flex flex-col items-end rounded-xl border border-line/60 bg-background/70 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
            <span
              role="timer"
              aria-label={t("timerAria")}
              className={cn(
                "nums font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums transition-colors sm:text-3xl",
                phase === "running" || phase === "stopped"
                  ? "text-ink"
                  : phase === "ready_for_move"
                    ? "text-ready"
                    : "text-ink-3",
              )}
            >
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Controls — bottom-right floating cluster: Scramble (the 3D
            widget's scramble button), Reset, Help */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 sm:bottom-5 sm:right-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleScrambleNow}
                disabled={!isReady}
                className="h-8 gap-1 px-2 text-ink-3 hover:text-ink"
                aria-label={t("scramble")}
              >
                <Shuffle className="size-4" />
                <span className="hidden text-xs sm:inline">{t("scramble")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("scrambleTooltip")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={!isReady}
                className="h-8 px-2 text-ink-3 hover:text-ink"
                aria-label={t("reset")}
              >
                <RotateCcw className="size-4" />
                <span className="hidden text-xs sm:inline">{t("reset")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("reset")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp(true)}
                disabled={!isReady}
                className="h-8 px-2 text-ink-3 hover:text-ink"
                aria-label={t("help")}
                aria-haspopup="dialog"
                aria-expanded={showHelp}
              >
                <HelpCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("helpShort")}</TooltipContent>
          </Tooltip>
        </div>

        {/* One-time gesture hint */}
        {hintVisible && isReady && !unavailable ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="select-none rounded-full border border-line/60 bg-background/70 px-3.5 py-1.5 text-center text-[0.65rem] text-ink-3 shadow-md backdrop-blur-md"
            >
              {t("gestureHint")}
            </motion.p>
          </div>
        ) : null}

        {/* Loading / fallback states */}
        {unavailable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 px-4">
            <p className="select-none text-center text-xs text-ink-3/70">{t("unavailable")}</p>
          </div>
        ) : !isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
            <p className="animate-pulse select-none text-xs text-ink-3/50">{t("initializing")}</p>
          </div>
        ) : null}
      </div>

      {/* Controls overlay (help) — on-screen keyboard map, like virtual-cube.net */}
      <CubeHelpOverlay
        showHelp={showHelp}
        order={order}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
});
