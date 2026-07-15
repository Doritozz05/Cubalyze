"use client";

// ─────────────────────────────────────────────────────────────────────────
// useTimerUI — local-only timer state machine.
//
// State transitions:
//   idle      --(press)-->  holding
//   holding   --(hold ≥ ARM_MS)--> ready
//   holding   --(release early)--> idle
//   ready     --(release)--> running
//   running   --(press)--> stopped  (reports final time via onSolve)
//   stopped   --(auto, short)--> idle
//
// Inputs: Space key (global) + pointer down/up on the timer surface.
// This hook intentionally owns no persistence — it just produces time values.
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { TimerState } from "@/types";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { globalAudioSystem } from "@/utils/audioSystem";

const SOLVED_FACELETS = /^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/;

export interface UseTimerUIResult {
  state: TimerState;
  /** Live elapsed time in ms (0 when idle). */
  time: number;
  /** Last finalized time (persists after reset). null until first solve. */
  lastTime: number | null;
  /** Imperative press (pointer/touch). Safe to call alongside keyboard. */
  press: () => void;
  /** Imperative release (pointer/touch). */
  release: () => void;
  /** Reset to idle, keeping lastTime. */
  reset: () => void;
  /** Cancel any pending arm/hold (Esc). No-op while running. */
  cancel: () => void;
  /** Manually arm/disarm inspection (no-op stub for future WCA inspection). */
  inspectionEnabled: boolean;
  setInspectionEnabled: (v: boolean) => void;
}

const mapEngineStateToUIState = (engineState: EngineState): TimerState => {
  switch (engineState) {
    case EngineState.IDLE:
      return "idle";
    case EngineState.INSPECTION:
      return "inspection";
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

export function useTimerUI(onSolve?: (time: number, penalty: "none" | "+2" | "DNF") => void, isScrambled: boolean = false): UseTimerUIResult {
  const [inspectionEnabled, setInspectionEnabled] = useState(true);
  const engine = useMemo(() => new TimerEngine({ useInspection: inspectionEnabled }), [inspectionEnabled]);
  
  const [state, setState] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);

  const onSolveRef = useRef(onSolve);
  useEffect(() => {
    onSolveRef.current = onSolve;
  });

  useEffect(() => {
    const sub1 = engine.state$.subscribe((engineState) => {
      setState(mapEngineStateToUIState(engineState));
    });
    const sub2 = engine.tick$.subscribe((t) => {
      setTime(t);
    });
    const sub3 = engine.stop$.subscribe((ev) => {
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      if (onSolveRef.current) {
        const uiPenalty = ev.penalty === 'NONE' ? 'none' : ev.penalty as ("+2" | "DNF");
        onSolveRef.current(ev.timeMs, uiPenalty);
      }
    });

    const sub4 = engine.inspectionWarning$.subscribe((warning) => {
      if (warning === '8s') globalAudioSystem.play8s();
      if (warning === '12s') globalAudioSystem.play12s();
    });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      sub4.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  // ── Hardware: Smart Cube ────────────────────────────────────────────────
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    // Subscribe to moves for auto-start
    const moveSub = adapter.moves$.subscribe(() => {
      const current = engine.getState();

      if (current === EngineState.INSPECTION && isScrambled) {
        engine.handleSmartCubeStart();
      } else if (current === EngineState.IDLE && !(engine as any)["config"]?.useInspection && isScrambled) {
        engine.handleSmartCubeStart();
      }
    });

    // Subscribe to facelets for auto-stop (no callback-chain fragility)
    let faceletSub: import('rxjs').Subscription | undefined;
    if ('facelets$' in adapter && (adapter as any).facelets$) {
      faceletSub = (adapter as any).facelets$.subscribe((f: string) => {
        const isSolved = SOLVED_FACELETS.test(f);
        if (isSolved && engine.getState() === EngineState.RUNNING) {
          engine.handleSmartCubeStop();
        }
      });
    }

    return () => {
      moveSub.unsubscribe();
      faceletSub?.unsubscribe();
    };
  }, [engine, isScrambled]);

  // Update inspection flag dynamically
  useEffect(() => {
    // Already handled by useMemo dependency recreating TimerEngine
  }, [inspectionEnabled]);

  const handlePress = useCallback(() => {
    if ((state === "idle" || state === "stopped") && inspectionEnabled) {
      if (state === "stopped") {
        engine.reset(); // Reset first to clear previous solve data
      }
      engine.startInspection();
    } else {
      engine.handleDown();
    }
  }, [engine, state, inspectionEnabled]);

  const handleRelease = useCallback(() => {
    engine.handleUp();
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
  }, [engine]);

  const cancel = useCallback(() => {
    const current = engine.getState();
    if (current === EngineState.RUNNING || current === EngineState.COOLDOWN || current === EngineState.STOPPED) {
      return;
    }
    engine.reset();
  }, [engine]);

  // ── Keyboard: Space ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // Ignore when focus is in an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      e.preventDefault();
      e.stopPropagation();

      if (!e.repeat) {
        handlePress();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      
      // Ignore when focus is in an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      e.preventDefault();
      e.stopPropagation();
      handleRelease();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [handlePress, handleRelease, engine, inspectionEnabled, state]);

  return {
    state,
    time,
    lastTime,
    press: handlePress,
    release: handleRelease,
    reset,
    cancel,
    inspectionEnabled,
    setInspectionEnabled,
  };
}
