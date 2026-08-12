"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { SOLVED_FACELETS } from "@cubeforge/math-core";
import type { CubeFace } from "@cubeforge/types";
import type { TimerState } from "@/types";
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
   * (the first turn after the scramble starts the clock).
   */
  notifyTurn: (face: CubeFace, direction: 1 | -1) => void;
  /**
   * Push an absolute facelet snapshot. The session stops the running timer
   * when the cube is solved (SOLVED_FACELETS matches any orientation, so
   * whole-cube rotations never stop it early) and the validator's facelet
   * handler resets the sticky "too many mistakes" state on a solved cube.
   */
  pushFacelets: (facelets: string) => void;
  /** Reset the timer engine (the view resets the cube itself). */
  reset: () => void;
}

/**
 * The professional solve session for the Cube tab — the SAME TimerEngine
 * state machine and SAME scramble validator the real timer uses, but fed by
 * the virtual cube instead of a BLE Smart Cube.
 *
 * Flow (inspection is the next step — deliberately disabled):
 *   IDLE (cube solved, scramble shown) → user performs the scramble (or
 *   presses the scramble button) → validator confirms isScrambled → auto-arm
 *   (READY_FOR_MOVE) → FIRST turn starts the timer (RUNNING) → cube solved
 *   → stop (COOLDOWN → STOPPED). The timer can never start before the cube
 *   is scrambled: moves made while IDLE are scramble moves, and a reset
 *   returns to IDLE without starting anything.
 */
export function useVirtualCubeSession(
  scramble: string,
): UseVirtualCubeSessionResult {
  const adapter = useMemo(() => createVirtualCubeAdapter(), []);
  const engine = useMemo(
    () => new TimerEngine({ useInspection: false }),
    [],
  );
  const validation = useScrambleValidator(scramble, true, adapter);

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);

  // ── Engine → UI ────────────────────────────────────────────────────────
  useEffect(() => {
    const s1 = engine.state$.subscribe((st) => {
      if (st === EngineState.RUNNING) hapticStart();
      setPhase(mapTimerState(st));
    });
    const s2 = engine.tick$.subscribe(setTime);
    const s3 = engine.stop$.subscribe((ev) => {
      hapticStop();
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
    });
    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
      s3.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  // ── Auto-arm: the moment the scramble is verified, the NEXT turn starts
  //    the timer (mirrors useSolveSession — including the STOPPED → reset
  //    step for post-solve regenerations; COOLDOWN blocks reset(), but by
  //    the time the scramble completes the 500ms cooldown has expired).
  const wasScrambledRef = useRef(false);
  useEffect(() => {
    const justScrambled = validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;
    if (!justScrambled) return;
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

  // ── Timer gating on moves ─────────────────────────────────────────────
  // IDLE turns are scramble moves (the validator consumes them). The first
  // turn while armed starts the clock. Turns while RUNNING need nothing
  // here — solve completion is detected via the facelet stream below.
  useEffect(() => {
    const sub = adapter.moves$.subscribe(() => {
      if (engine.getState() === EngineState.READY_FOR_MOVE) {
        engine.handleSmartCubeStart();
      }
    });
    return () => sub.unsubscribe();
  }, [adapter, engine]);

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
    (face: CubeFace, direction: 1 | -1) => {
      adapter.pushMove(face, direction);
    },
    [adapter],
  );

  const pushFacelets = useCallback(
    (facelets: string) => {
      adapter.pushFacelets(facelets);
    },
    [adapter],
  );

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
    setLastTime(null);
  }, [engine]);

  return { phase, time, lastTime, validation, notifyTurn, pushFacelets, reset };
}
