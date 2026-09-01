"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { PyraminxScrambleTracker } from "@/hooks/pyraminxSessionCore";
import type { CubeMoveEvent } from "@cubeforge/types";
import type { Penalty, TimerState } from "@/types";
import { mapTimerState } from "@/utils/timerState";
import { hapticStart, hapticStop } from "@/utils/haptics";

/** The pyraminx equivalent of the cube virtual solve's onSolve shape. */
export type PyraminxVirtualSolveHandler = (
  time: number,
  penalty: Penalty,
  moves: CubeMoveEvent[],
) => void;

export interface UsePyraminxVirtualSessionResult {
  /** UI phase (same mapping as the real timer): idle / ready_for_move /
   *  running / stopped. */
  phase: TimerState;
  /** Live time while running; final time once stopped. */
  time: number;
  lastTime: number | null;
  /** Scramble verification (per-token progress + mistakes). */
  validation: {
    /** Whether the full scramble has been performed (timer may arm). */
    isScrambled: boolean;
    /** Too many consecutive mistakes → the user must reset. */
    needsReset: boolean;
    /** Number of scramble tokens verified so far. */
    progress: number;
    totalTokens: number;
    /** Consecutive wrong moves since the last correct one. */
    mistakes: number;
  };
  /**
   * Apply one WCA pyraminx token (U, U', l, …) — the user's move. Handles
   * scramble verification (IDLE), the first-turn timer start (armed) and
   * solve collection + solved detection (RUNNING).
   */
  performMove: (token: string) => void;
  /** Apply the scramble instantly (Scramble button): reaches the scrambled
   *  state immediately and arms the timer. */
  applyScrambleNow: () => void;
  /** Reset the timer + logical state to solved. */
  reset: () => void;
  /** Force-check or notify that the puzzle is solved. */
  notifySolved: () => void;
}

/**
 * The professional solve session for the Pyraminx virtual cube — the SAME
 * TimerEngine state machine the cube virtual uses, verified by the pure
 * {@link PyraminxScrambleTracker} (PyraminxState mirror) instead of cube
 * facelets:
 *
 *   IDLE (solved) → the user performs the WCA scramble move by move (or
 *   presses Scramble) → verified → arm (READY_FOR_MOVE) → FIRST turn starts
 *   the timer (RUNNING) → solved → stop.
 *
 * The timer can never start before the cube is scrambled, exactly like the
 * cube virtual. Solve moves are collected as the same CubeMoveEvent shape
 * the cube path persists — each event carries the WCA token verbatim in
 * `displayNotation` — so the save pipeline (useSolveCompletion) and the 3D
 * replay (PyraminxReplayEngine) work with zero changes.
 */
export function usePyraminxVirtualSession(
  scramble: string,
  onSolve?: PyraminxVirtualSolveHandler,
): UsePyraminxVirtualSessionResult {
  const engine = useMemo(() => new TimerEngine({ useInspection: false }), []);
  const trackerRef = useRef<PyraminxScrambleTracker | null>(null);
  if (trackerRef.current === null) {
    trackerRef.current = new PyraminxScrambleTracker(scramble);
  }
  const tracker = trackerRef.current;

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [validation, setValidation] = useState(() => ({
    isScrambled: false,
    needsReset: false,
    progress: 0,
    totalTokens: tracker.totalTokens,
    mistakes: 0,
  }));

  const collectedMovesRef = useRef<CubeMoveEvent[]>([]);
  const onSolveRef = useRef(onSolve);
  useEffect(() => {
    onSolveRef.current = onSolve;
  });

  // Re-seed the tracker when the scramble text changes (regenerate).
  useEffect(() => {
    trackerRef.current = new PyraminxScrambleTracker(scramble);
    engine.reset();
    setTime(0);
    setLastTime(null);
    setValidation({
      isScrambled: false,
      needsReset: false,
      progress: 0,
      totalTokens: trackerRef.current.totalTokens,
      mistakes: 0,
    });
  }, [scramble, engine]);

  /** Fresh solve: the collection buffer resets when the engine returns IDLE. */
  useEffect(() => {
    const s1 = engine.state$.subscribe((st) => {
      if (st === EngineState.IDLE) {
        collectedMovesRef.current = [];
      }
      if (st === EngineState.RUNNING) hapticStart();
      setPhase(mapTimerState(st));
    });
    const s2 = engine.tick$.subscribe(setTime);
    const s3 = engine.stop$.subscribe((ev) => {
      hapticStop();
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      onSolveRef.current?.(
        ev.timeMs,
        ev.penalty === "NONE" ? "none" : (ev.penalty as Penalty),
        [...collectedMovesRef.current],
      );
    });
    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
      s3.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  const syncValidation = useCallback(() => {
    setValidation({
      isScrambled: trackerRef.current!.isScrambled,
      needsReset: trackerRef.current!.needsResetState,
      progress: trackerRef.current!.progressCount,
      totalTokens: trackerRef.current!.totalTokens,
      mistakes: trackerRef.current!.mistakeCount,
    });
  }, []);

  // ── Auto-arm: the moment the scramble is verified, the NEXT turn starts
  //    the timer (mirrors useVirtualCubeSession incl. the COOLDOWN defer).
  //    `scrambleResetEpoch` is STATE (not a ref): the Scramble button sets
  //    the scrambled flag true → true in ONE render and React bails out on
  //    an unchanged effect dep — bumping the epoch forces the effect to
  //    re-run.
  const [scrambleResetEpoch, setScrambleResetEpoch] = useState(0);
  const wasScrambledRef = useRef(false);
  useEffect(() => {
    // `validation.isScrambled` is a DEP (not just trackerRef) so the effect
    // re-runs the moment a hand-performed scramble completes — tracker-only
    // deps never changed during per-move progress, so the timer never armed.
    const justScrambled = validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;
    if (!justScrambled) return;

    if (engine.getState() === EngineState.COOLDOWN) {
      const sub = engine.state$.subscribe((st) => {
        if (st !== EngineState.STOPPED) return;
        sub.unsubscribe();
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
  }, [validation.isScrambled, scrambleResetEpoch, engine]);

  /** One user move. The engine state decides what it means. */
  const performMove = useCallback(
    (token: string) => {
      const tracker = trackerRef.current!;
      const result = tracker.applyMove(token);
      const st = engine.getState();
      const running = st === EngineState.RUNNING;

      // Scramble phase: verification handled by the tracker.
      if (result.kind.startsWith("scramble-")) {
        syncValidation();
        return;
      }

      // Armed: the first turn starts the clock, then counts as a solve move.
      if (st === EngineState.READY_FOR_MOVE) {
        engine.handleSmartCubeStart();
      }

      // Solve phase: collect + detect solved.
      if (running || engine.getState() === EngineState.RUNNING) {
        collectedMovesRef.current.push({
          face: "U", // inert carrier — the pyraminx token travels in displayNotation
          direction: 1,
          displayNotation: token,
          cubeTimestamp: collectedMovesRef.current.length * 550,
          hostTimestamp: performance.now(),
        });
        if (result.kind === "solve-complete") {
          engine.handleSmartCubeStop();
        }
      }
      syncValidation();
    },
    [engine, syncValidation],
  );

  const applyScrambleNow = useCallback(() => {
    trackerRef.current!.applyScrambleNow();
    // Re-arm the edge detector for THIS press: a second press keeps
    // isScrambled true → true (React bails out), so the epoch bump re-runs
    // the effect — it must see a fresh false→true edge.
    wasScrambledRef.current = false;
    setScrambleResetEpoch((n) => n + 1);
    syncValidation();
  }, [syncValidation]);

  const reset = useCallback(() => {
    engine.reset();
    trackerRef.current!.reset();
    setTime(0);
    setLastTime(null);
    syncValidation();
  }, [engine, syncValidation]);

  const notifySolved = useCallback(() => {
    if (engine.getState() === EngineState.RUNNING) {
      engine.handleSmartCubeStop();
    }
  }, [engine]);

  return {
    phase,
    time,
    lastTime,
    validation,
    performMove,
    applyScrambleNow,
    reset,
    notifySolved,
  };
}
