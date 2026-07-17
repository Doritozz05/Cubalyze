"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "zustand";
import type { TimerState, Penalty } from "@/types";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { globalAudioSystem } from "@/utils/audioSystem";
import { preferencesStore } from "@cubeforge/state";
import {
  useScrambleValidator,
  type ScrambleValidationResult,
} from "@/hooks/useScrambleValidator";
import { shouldAutoArm } from "@/hooks/shouldAutoArm";

const SOLVED_FACELETS = /^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/;

export interface UseSolveSessionOptions {
  onSolve?: (time: number, penalty: Penalty) => void;
}

export interface UseSolveSessionResult {
  phase: TimerState;
  time: number;
  lastTime: number | null;
  press: () => void;
  release: () => void;
  reset: () => void;
  cancel: () => void;
  validation: ScrambleValidationResult;
  smartCubeConnected: boolean;
  inspection: boolean;
  scrambleVerification: boolean;
}

const mapEngineStateToUIState = (engineState: EngineState): TimerState => {
  switch (engineState) {
    case EngineState.IDLE:
      return "idle";
    case EngineState.INSPECTION:
      return "inspection";
    case EngineState.READY_FOR_MOVE:
      return "ready_for_move";
    case EngineState.TOUCHING:
      return "holding";
    case EngineState.READY:
      return "ready";
    case EngineState.RUNNING:
      return "running";
    case EngineState.COOLDOWN:
    case EngineState.STOPPED:
      return "stopped";
    default:
      return "idle";
  }
};

/**
 * The single source of truth for the solve start-of-flow orchestration.
 *
 * Combination matrix supported (Scramble Verification × Inspection):
 *
 *   M1  ON + ON    ─ Space → INSPECTION → cube move → RUNNING
 *   M2  ON + OFF   ─ scramble completes → READY_FOR_MOVE → cube move → RUNNING
 *   M3  OFF + ON   ─ Space → INSPECTION → cube move → RUNNING
 *   M4  OFF + OFF  ─ Space → READY_FOR_MOVE → cube move → RUNNING
 *
 * The auto-arm transition is restricted to Mode 2 by `shouldAutoArm` —
 * any other combination requires an explicit user gesture. A
 * swallow-once guard prevents the scramble-completer move from also
 * being treated as the first solve-start move in the rare React-batching
 * edge case.
 */
export function useSolveSession(
  scramble: string,
  options: UseSolveSessionOptions = {},
): UseSolveSessionResult {
  const inspectionPref = useStore(preferencesStore, (s) => s.inspection);
  const scrambleVerificationPref = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );

  const engine = useMemo(
    () => new TimerEngine({ useInspection: inspectionPref }),
    [inspectionPref],
  );

  // When Scramble Verification is OFF (Modes 3 & 4) the validator is
  // completely short-circuited — no moves$/facelets$ subscription, no CPU
  // work. `validation.isScrambled` stays false, which is harmless because
  // `shouldAutoArm` already requires scrambleVerif=true.
  const validation = useScrambleValidator(scramble, scrambleVerificationPref);

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [smartCubeConnected, setSmartCubeConnected] = useState(
    () => !!globalCubeAdapter.isConnected,
  );

  const onSolveRef = useRef(options.onSolve);
  useEffect(() => {
    onSolveRef.current = options.onSolve;
  });

  useEffect(() => {
    const sub1 = engine.state$.subscribe((engineState) => {
      // Reset the swallow-once guard whenever the engine returns to IDLE —
      // otherwise it could leak across solves or user-initiated manual arms.
      if (engineState === EngineState.IDLE) {
        swallowNextCubeMoveRef.current = false;
      }
      setPhase(mapEngineStateToUIState(engineState));
    });
    const sub2 = engine.tick$.subscribe((t) => setTime(t));
    const sub3 = engine.stop$.subscribe((ev) => {
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      if (onSolveRef.current) {
        const uiPenalty: Penalty =
          ev.penalty === "NONE" ? "none" : (ev.penalty as "+2" | "DNF");
        onSolveRef.current(ev.timeMs, uiPenalty);
      }
    });
    const sub4 = engine.inspectionWarning$.subscribe((warning) => {
      if (warning === "8s") globalAudioSystem.play8s();
      if (warning === "12s") globalAudioSystem.play12s();
    });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      sub4.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  // Smart Cube presence is tracked by polling because the adapter does not
  // expose a status observable. Interval is generous by design — connection
  // changes are user-initiated, not high-frequency.
  useEffect(() => {
    const update = () => setSmartCubeConnected(!!globalCubeAdapter.isConnected);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-Arming of Mode 2: scramble completes AND scrambleVerif ON AND
  // inspection OFF AND smart cube paired.
  //
  // IMPORTANT: When inspection is enabled (Mode 1) this effect does NOT
  // fire — the user must press Space explicitly to start inspection.
  // The swallowNextCubeMoveRef guard prevents the scramble-completer
  // movement from also being interpreted as the first solve-start move.
  const wasScrambledRef = useRef(false);
  const swallowNextCubeMoveRef = useRef(false);
  useEffect(() => {
    const justScrambled = validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;

    if (
      justScrambled &&
      shouldAutoArm({
        smartCube: smartCubeConnected,
        scrambleVerif: scrambleVerificationPref,
        inspection: inspectionPref,
        stateIsIdle: engine.getState() === EngineState.IDLE,
      })
    ) {
      if (engine.arm()) {
        swallowNextCubeMoveRef.current = true;
      }
    }
  }, [
    validation.isScrambled,
    smartCubeConnected,
    scrambleVerificationPref,
    inspectionPref,
    engine,
  ]);

  // Smart Cube move wiring: auto-start from INSPECTION / READY_FOR_MOVE
  // only, and auto-stop when the cube is solved while running.
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    const moveSub = adapter.moves$.subscribe(() => {
      const current = engine.getState();

      // Defense-in-depth against the scramble-completer race.
      if (
        swallowNextCubeMoveRef.current &&
        current === EngineState.READY_FOR_MOVE
      ) {
        swallowNextCubeMoveRef.current = false;
        return;
      }

      if (
        current === EngineState.INSPECTION ||
        current === EngineState.READY_FOR_MOVE
      ) {
        engine.handleSmartCubeStart();
      }
    });

    let faceletSub: import("rxjs").Subscription | undefined;
    if ("facelets$" in adapter && adapter.facelets$) {
      faceletSub = (adapter.facelets$ as import("rxjs").Observable<string>).subscribe(
        (f: string) => {
          const isSolved = SOLVED_FACELETS.test(f);
          if (isSolved && engine.getState() === EngineState.RUNNING) {
            engine.handleSmartCubeStop();
          }
        },
      );
    }

    return () => {
      moveSub.unsubscribe();
      faceletSub?.unsubscribe();
    };
  }, [engine]);

  // Centralised press routing. Every gesture ends here so we cannot leak
  // a scenario where a key/tap/click transitions the engine unexpectedly.
  const press = useCallback(() => {
    const current = engine.getState();

    if (current === EngineState.STOPPED) {
      engine.reset();
      return;
    }

    if (
      current === EngineState.RUNNING ||
      current === EngineState.COOLDOWN
    ) {
      engine.handleDown();
      return;
    }

    if (
      current === EngineState.TOUCHING ||
      current === EngineState.READY
    ) {
      return;
    }

    if (current === EngineState.INSPECTION) {
      engine.handleDown();
      return;
    }

    if (current === EngineState.READY_FOR_MOVE) {
      engine.handleDown();
      return;
    }

    // IDLE
    if (inspectionPref) {
      engine.startInspection();
    } else if (smartCubeConnected) {
      // M2: auto-arm effects already fired; explicit Space is still a
      // valid way to ARM the next solve. M4: explicit arm is REQUIRED.
      // Always clear the swallow guard here — it must not bleed across
      // modes or persist from a previous auto-arm that was never consumed.
      swallowNextCubeMoveRef.current = false;
      engine.arm();
    } else {
      // Manual M2 / M4: standard hold & release.
      engine.handleDown();
    }
  }, [engine, inspectionPref, smartCubeConnected]);

  const release = useCallback(() => {
    engine.handleUp();
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
  }, [engine]);

  const cancel = useCallback(() => {
    const current = engine.getState();
    if (
      current === EngineState.RUNNING ||
      current === EngineState.COOLDOWN ||
      current === EngineState.STOPPED
    ) {
      return;
    }
    engine.reset();
  }, [engine]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      release();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [press, release]);

  return {
    phase,
    time,
    lastTime,
    press,
    release,
    reset,
    cancel,
    validation,
    smartCubeConnected,
    inspection: inspectionPref,
    scrambleVerification: scrambleVerificationPref,
  };
}
