"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import {
  compactOrientationTimeline,
  expandWideMoves,
  OrientationTable,
  SOLVED_FACELETS,
  type OrientationEntry,
} from "@cubeforge/math-core";
import type {
  CubeFace,
  CubeMoveEvent,
  CubeOrientation,
  OrientationTimeline,
} from "@cubeforge/types";
import type { Penalty, TimerState } from "@/types";
import { mapTimerState } from "@/utils/timerState";
import { createVirtualCubeAdapter } from "@/utils/virtualCubeAdapter";
import {
  useScrambleValidator,
  type ScrambleValidationResult,
} from "@/hooks/useScrambleValidator";
import { hapticStart, hapticStop } from "@/utils/haptics";

export interface UseVirtualCubeSessionResult {
  /** UI phase (same mapping as the real timer): idle / ready_for_move /
   *  running / stopped. */
  phase: TimerState;
  /** Live time while running; final time once stopped. */
  time: number;
  lastTime: number | null;
  /** Scramble validation (per-token states, errors, isScrambled, needsReset). */
  validation: ScrambleValidationResult;
  /**
   * Feed a completed turn — already mirrored into the CubeState and animated
   * on the engine — so the validator consumes it and the timer gates on it
   * (the first turn after the scramble starts the clock). `displayNotation`
   * (optional) is the SOLVER-frame token (e.g. "M'" when the conjugated
   * slice is "S'" under a y grip) so the replay shows what the user did.
   */
  notifyTurn: (face: CubeFace, direction: 1 | -1, displayNotation?: string) => void;
  /**
   * Feed a completed WIDE move as a single notation token ("r", "u'", …)
   * so the validator compares one action against one scramble token.
   * `displayNotation` is the solver-frame token the user performed (e.g.
   * "r" when the cube-frame conjugate is "b" under a y grip).
   */
  notifyTurnToken: (notation: string, displayNotation?: string) => void;
  /**
   * Push an absolute facelet snapshot. The session stops the running timer
   * when the cube is solved (SOLVED_FACELETS matches any orientation, so
   * whole-cube rotations never stop it early) and the validator's facelet
   * handler resets the sticky "too many mistakes" state on a solved cube.
   */
  pushFacelets: (facelets: string) => void;
  /**
   * Re-seed the scramble validator to a FRESH state for the current scramble
   * text (no scramble-change). Used by the Scramble button, which applies
   * the scramble already on screen.
   */
  resetScramble: () => void;
  /** Reset the timer engine (the view resets the cube itself). */
  reset: () => void;
}

/** Callback fired when a virtual solve completes (timer stops). Mirrors the
 *  real timer's `onSolve` so the same completion pipeline can persist the
 *  solve — raw moves + per-move orientations + compact orientation timeline
 *  (identical shape to smart-cube solves). */
export type VirtualSolveHandler = (
  time: number,
  penalty: Penalty,
  moves: CubeMoveEvent[],
  orientations: (CubeOrientation | undefined)[],
  orientationTimeline: OrientationTimeline | undefined,
) => void;

/**
 * Expand a single wide/slice/face notation token into the elementary
 * face+slice halves the STATE pipeline consumes ("b" → B + S', "r'" → R' +
 * M, "u2" → U2 + E2). Plain faces and slices pass through unchanged. Used
 * to derive `stateTokens` for exact timeline states. Pure — unit-tested in
 * `hooks/__tests__/virtualSolveCapture.test.ts`.
 */
export function wideTokenToMoveEvents(notation: string): CubeMoveEvent[] {
  return expandWideMoves(notation).map((token) => ({
    face: token[0] as CubeFace,
    direction: token.includes("'")
      ? -1
      : token.includes("2")
        ? 2
        : 1,
    cubeTimestamp: 0,
    hostTimestamp: 0,
  }));
}

export interface UseVirtualCubeSessionOptions {
  /** Called when a solve completes — same contract as useSolveSession.onSolve. */
  onSolve?: VirtualSolveHandler;
  /**
   * Ref holding the virtual cube's CURRENT grip (accumulated whole-cube
   * x/y/z rotations). Read per-move at collection time so every recorded
   * move gets the orientation the solver actually held — the virtual
   * equivalent of the smart cube's gyroscope.
   */
  gripRef?: React.MutableRefObject<OrientationEntry>;
}

/**
 * The professional solve session for the Cube tab — the SAME TimerEngine
 * state machine and SAME scramble validator the real timer uses, but fed by
 * the virtual cube instead of a BLE Smart Cube.
 *
 * Since 3.0 it ALSO records the solve: every move (face turns + expanded
 * wide/slice halves) is captured as a {@link CubeMoveEvent} with the grip
 * orientation at that moment — exactly the data shape a smart cube produces
 * — so virtual solves run the same deep analysis pipeline, save with
 * `source: "virtual"`, and replay identically.
 *
 * Flow (inspection is the next step — deliberately disabled):
 *   IDLE (cube solved, scramble shown) → user performs the scramble (or
 *   presses the scramble button) → validator confirms isScrambled → auto-arm
 *   (READY_FOR_MOVE) → FIRST turn starts the timer (RUNNING) → cube solved
 *   → stop (COOLDOWN → STOPPED). The timer can never start before the cube
 *   is scrambled: moves made while IDLE are scramble moves, and a reset
 *   returns to IDLE without starting anything.
 *
 * TODO(virtual-puzzles): the simulator is 3×3-only today (the view forces
 * the puzzle selector to 3×3 and locks it). Supporting 2×2, 4×4, … means
 * threading the puzzle order through the scramble generator, the keymap and
 * this session — the architecture (adapter streams + move collection) is
 * puzzle-agnostic already.
 */
export function useVirtualCubeSession(
  scramble: string,
  options: UseVirtualCubeSessionOptions = {},
): UseVirtualCubeSessionResult {
  const adapter = useMemo(() => createVirtualCubeAdapter(), []);
  const engine = useMemo(
    () => new TimerEngine({ useInspection: false }),
    [],
  );
  const validation = useScrambleValidator(scramble, true, adapter);

  // ── Solve move collection (mirrors useSolveSession) ────────────────────
  // Face turns arrive on moves$ (already CubeMoveEvent); wide moves arrive
  // on tokens$ as a single canonical token ("b") — the SAME elementary
  // face+slice halves a per-layer smart cube would report are preserved for
  // the state via `stateTokens` (derived at analysis time from the wide
  // event), but the recorded event itself stays ONE `wide: true` event so
  // the replay animates both layers together and shows the solver's token
  // (displayNotation "r", not the conjugated "b"). Orientations are sampled
  // from the view's grip at each move — exact, like a perfect gyroscope.
  // Buffers clear when the engine returns to IDLE (new solve).
  const collectedMovesRef = useRef<CubeMoveEvent[]>([]);
  const collectedOrientationsRef = useRef<(CubeOrientation | undefined)[]>([]);
  const solveStartHostRef = useRef(0);
  const onSolveRef = useRef(options.onSolve);
  useEffect(() => {
    onSolveRef.current = options.onSolve;
  });

  /** The solver-frame token paired with the most recent tokens$ emission
   *  (the adapter emits it just before the token). Read by the collector. */
  const lastTokenDisplayRef = useRef<string | undefined>(undefined);

  /** Snapshot the grip as a CubeOrientation (structural subset of the
   *  OrientationTable entry — exact faceMap, so compactOrientationTimeline
   *  round-trips the same table index). */
  const orientationFromGrip = useCallback((): CubeOrientation | undefined => {
    const grip = options.gripRef?.current;
    if (!grip) return undefined;
    const entry = OrientationTable.ENTRIES[grip.id];
    if (!entry) return undefined;
    return {
      quaternion: {
        x: entry.quaternion.x,
        y: entry.quaternion.y,
        z: entry.quaternion.z,
        w: entry.quaternion.w,
      },
      faceMap: entry.faceMap,
      label: entry.label,
    };
  }, [options.gripRef]);

  /** Synthetic cube-clock timestamp (ms since the solve started running). */
  const syntheticCubeTimestamp = useCallback(() => {
    const start = solveStartHostRef.current || performance.now();
    solveStartHostRef.current = start;
    return Math.max(0, Math.round(performance.now() - start));
  }, []);

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);

  // ── Engine → UI ────────────────────────────────────────────────────────
  useEffect(() => {
    const s1 = engine.state$.subscribe((st) => {
      // Fresh solve starts the collection buffer fresh (same lifecycle as
      // useSolveSession's IDLE reset).
      if (st === EngineState.IDLE) {
        collectedMovesRef.current = [];
        collectedOrientationsRef.current = [];
        solveStartHostRef.current = 0;
      }
      if (st === EngineState.RUNNING) hapticStart();
      setPhase(mapTimerState(st));
    });
    const s2 = engine.tick$.subscribe(setTime);
    const s3 = engine.stop$.subscribe((ev) => {
      hapticStop();
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      // Snapshot the raw collected data and hand it to the caller so it can
      // persist the solve immediately (before the async analysis resolves).
      const moves = [...collectedMovesRef.current];
      const orientations = [...collectedOrientationsRef.current];
      const timeline = compactOrientationTimeline(orientations);
      onSolveRef.current?.(
        ev.timeMs,
        ev.penalty === "NONE" ? "none" : (ev.penalty as Penalty),
        moves,
        orientations,
        timeline,
      );
    });
    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
      s3.unsubscribe();
      engine.reset();
    };
  }, [engine, orientationFromGrip]);

  // ── Auto-arm: the moment the scramble is verified, the NEXT turn starts
  //    the timer (mirrors useSolveSession — including the STOPPED → reset
  //    step for post-solve regenerations). The virtual scramble button can
  //    verify a scramble INSTANTLY, even inside the 500ms post-solve
  //    cooldown where reset() is blocked — so COOLDOWN defers the
  //    reset+arm until the engine transitions to STOPPED.
  const wasScrambledRef = useRef(false);
  useEffect(() => {
    const justScrambled = validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;
    if (!justScrambled) return;

    if (engine.getState() === EngineState.COOLDOWN) {
      const sub = engine.state$.subscribe((st) => {
        if (st !== EngineState.STOPPED) return;
        sub.unsubscribe();
        // Guard: the scramble may have changed while we waited — only arm if
        // the current scramble is still the verified one.
        if (!wasScrambledRef.current) return;
        if (engine.getState() === EngineState.STOPPED) engine.reset();
        if (engine.getState() === EngineState.IDLE) engine.arm();
      });
      return () => sub.unsubscribe();
    }

    if (engine.getState() === EngineState.STOPPED) {
      engine.reset();
    }
    if (engine.getState() === EngineState.IDLE) {
      engine.arm();
    }
  }, [validation.isScrambled, engine]);

  // ── A fresh scramble (regenerate / scramble button) resets the timer ───
  useEffect(() => {
    engine.reset();
    setTime(0);
    setLastTime(null);
  }, [scramble, engine]);

  // ── Timer gating on moves + move collection ────────────────────────────
  // IDLE turns are scramble moves (the validator consumes them). The first
  // turn while armed starts the clock — from EITHER stream (face moves on
  // moves$, wide moves as tokens on tokens$). Turns while RUNNING are
  // collected as solve moves (gated here — scramble moves never leak into
  // the recorded solve). Solve completion is detected via the facelet
  // stream below.
  //
  // SUBSCRIPTION ORDER MATTERS: `startIfArmed` is subscribed BEFORE the
  // collectors so the first solve move transitions the engine to RUNNING
  // synchronously (handleSmartCubeStart → setState(RUNNING)) and is then
  // captured by the collector — matching useSolveSession's RFM-start branch.
  useEffect(() => {
    const startIfArmed = () => {
      if (engine.getState() === EngineState.READY_FOR_MOVE) {
        engine.handleSmartCubeStart();
      }
    };
    const collectFace = (event: CubeMoveEvent) => {
      if (engine.getState() !== EngineState.RUNNING) return;
      collectedMovesRef.current.push({
        ...event,
        // Slices (M/E/S) carry the solver-frame token via displayNotation
        // (e.g. "M'" when the conjugated slice is "S'" under a y grip) so
        // the replay shows what the user performed. Plain faces leave it
        // undefined (the replay remaps by orientation, like smart cube).
        cubeTimestamp: syntheticCubeTimestamp(),
      });
      collectedOrientationsRef.current.push(orientationFromGrip());
    };
    const collectToken = (notation: string) => {
      if (engine.getState() !== EngineState.RUNNING) return;
      // The wide stays ONE event: face = the conjugated face half, wide:
      // true, displayNotation = the solver-frame token ("r" even when the
      // cube-frame conjugate is "b" under a y grip). The analysis derives
      // the exact face+slice state tokens from this event (see runAnalysis),
      // and the replay animates BOTH layers together and labels it "r".
      const [faceHalf] = wideTokenToMoveEvents(notation);
      if (faceHalf) {
        collectedMovesRef.current.push({
          ...faceHalf,
          wide: true,
          displayNotation: lastTokenDisplayRef.current ?? notation,
          cubeTimestamp: syntheticCubeTimestamp(),
          hostTimestamp: performance.now(),
        });
        collectedOrientationsRef.current.push(orientationFromGrip());
      }
    };
    const subs = [
      adapter.moves$.subscribe(startIfArmed),
      adapter.moves$.subscribe(collectFace),
    ];
    if (adapter.tokens$) {
      subs.push(adapter.tokens$.subscribe(startIfArmed));
      subs.push(adapter.tokens$.subscribe(collectToken));
    }
    // The display stream is emitted BEFORE its token (adapter pushToken), so
    // pairing by ref keeps the two in lockstep without restructuring tokens$.
    if (adapter.tokenDisplay$) {
      subs.push(
        adapter.tokenDisplay$.subscribe((d) => {
          lastTokenDisplayRef.current = d;
        }),
      );
    }
    return () => subs.forEach((s) => s.unsubscribe());
  }, [adapter, engine, orientationFromGrip, syntheticCubeTimestamp]);

  // ── Solved detection (same mechanism as the real timer's facelets$) ───
  useEffect(() => {
    if (!adapter.facelets$) return;
    const sub = adapter.facelets$.subscribe((facelets) => {
      if (
        SOLVED_FACELETS.test(facelets) &&
        engine.getState() === EngineState.RUNNING
      ) {
        engine.handleSmartCubeStop();
      }
    });
    return () => sub.unsubscribe();
  }, [adapter, engine]);

  const notifyTurn = useCallback(
    (face: CubeFace, direction: 1 | -1, displayNotation?: string) => {
      adapter.pushMove(face, direction, displayNotation);
    },
    [adapter],
  );

  const notifyTurnToken = useCallback(
    (notation: string, displayNotation?: string) => {
      adapter.pushToken(notation, displayNotation);
    },
    [adapter],
  );

  const pushFacelets = useCallback(
    (facelets: string) => {
      adapter.pushFacelets(facelets);
    },
    [adapter],
  );

  const resetScramble = useCallback(() => {
    adapter.pushReset();
  }, [adapter]);

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
    setLastTime(null);
  }, [engine]);

  return {
    phase,
    time,
    lastTime,
    validation,
    notifyTurn,
    notifyTurnToken,
    pushFacelets,
    resetScramble,
    reset,
  };
}
