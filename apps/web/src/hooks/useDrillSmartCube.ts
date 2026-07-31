"use client";

import { useEffect, useRef, useState } from "react";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import {
  useScrambleValidator,
  type ScrambleValidationResult,
} from "@/hooks/useScrambleValidator";
import { SOLVED_FACELETS } from "@cubeforge/math-core";

/* ──────────────────────────────────────────────────────────────────────────
   useDrillSmartCube

   Wires the Smart Cube (BLE moves + facelets) and scramble validation
   into the drill timer's TimerEngine. Mirrors the practice-timer flow:

     1. User executes the setup scramble on the physical cube
     2. Scramble validator confirms isScrambled → auto-arm (READY_FOR_MOVE)
     3. First cube move → timer starts (RUNNING)
     4. Cube reaches solved state → timer stops

   Space key ALWAYS works alongside the smart cube (manual override),
   exactly like the practice timer.

   No inspection support — drill mode never uses inspection.
   ─────────────────────────────────────────────────────────────────────── */

export interface UseDrillSmartCubeOptions {
  /** The TimerEngine from useDrillTimer (shared instance). */
  engine: TimerEngine;
  /** The random setup scramble to validate against. */
  setupScramble: string;
}

export interface UseDrillSmartCubeResult {
  /** Scramble validation result from useScrambleValidator. */
  validation: ScrambleValidationResult;
  /** Whether a smart cube is currently connected. */
  smartCubeConnected: boolean;
}

export function useDrillSmartCube({
  engine,
  setupScramble,
}: UseDrillSmartCubeOptions): UseDrillSmartCubeResult {
  const scrambleDisplay = useStore(
    preferencesStore,
    (s) => s.scrambleDisplay,
  );
  const scrambleVerificationRaw = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const scrambleVerification = scrambleDisplay && scrambleVerificationRaw;

  // ── Scramble validation ──
  const validation = useScrambleValidator(
    setupScramble || "",
    scrambleVerification && (setupScramble ? setupScramble.length > 0 : false),
  );

  // ── Smart Cube connection state ──────────────────────────────────────
  const [smartCubeConnected, setSmartCubeConnected] = useState(
    () => !!globalCubeAdapter.isConnected,
  );

  useEffect(() => {
    const update = () =>
      setSmartCubeConnected(!!globalCubeAdapter.isConnected);
    update();
    const sub = globalCubeAdapter.connectionStatus$?.subscribe((status) => {
      setSmartCubeConnected(status === "connected");
    });
    return () => sub?.unsubscribe();
  }, []);

  // ── Ref mirror of isScrambled to avoid React state delay in the move
  //     subscriber (same pattern as useSolveSession's isScrambledRef).
  const isScrambledRef = useRef(false);
  useEffect(() => {
    isScrambledRef.current = validation.isScrambled;
  }, [validation.isScrambled]);

  // ── Auto-arm when scramble is confirmed ──────────────────────────────
  const wasScrambledRef = useRef(false);
  useEffect(() => {
    const justScrambled =
      validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;

    if (justScrambled) {
      // If engine is STOPPED (post-solve), reset to IDLE first so arm() works
      if (engine.getState() === EngineState.STOPPED) {
        engine.reset();
      }
      // Arm: IDLE → READY_FOR_MOVE (user's next move starts the timer)
      if (engine.getState() === EngineState.IDLE) {
        engine.arm();
      }
    }
  }, [validation.isScrambled, engine]);

  // ── BLE move subscriber (first move starts timer) ────────────────────
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    const sub = adapter.moves$.subscribe(() => {
      const current = engine.getState();

      // READY_FOR_MOVE: auto-armed and waiting — first move starts timer
      if (current === EngineState.READY_FOR_MOVE) {
        engine.handleSmartCubeStart();
        return;
      }

      // IDLE + already scrambled: move arrived during the race window
      // between isScrambled=true and the arm() effect. Arm + start now.
      if (current === EngineState.IDLE && isScrambledRef.current) {
        engine.arm();
        engine.handleSmartCubeStart();
        return;
      }
    });

    return () => sub.unsubscribe();
  }, [engine]);

  // ── BLE facelet subscriber (solved state stops timer) ─────────────────
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.facelets$) return;

    const sub = adapter.facelets$.subscribe((f: string) => {
      const isSolved = SOLVED_FACELETS.test(f);
      if (isSolved && engine.getState() === EngineState.RUNNING) {
        engine.handleSmartCubeStop();
      }
    });

    return () => sub.unsubscribe();
  }, [engine]);

  return { validation, smartCubeConnected };
}
