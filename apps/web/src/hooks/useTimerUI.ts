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
    case EngineState.INSPECTION:
      return "idle";
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

export function useTimerUI(onSolve?: (time: number) => void, isScrambled: boolean = false): UseTimerUIResult {
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
        onSolveRef.current(ev.timeMs);
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
    if (!globalCubeAdapter.moves$) return;
    const sub = globalCubeAdapter.moves$.subscribe(() => {
      const current = engine.getState();
      
      // If idle and correctly scrambled, do nothing automatically. 
      // The user must trigger inspection via spacebar, OR we could auto-start inspection.
      // Standard WCA logic requires manual start of inspection.
      if (current === EngineState.INSPECTION && isScrambled) {
        // First move starts the timer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine as any).handleSmartCubeStart();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (current === EngineState.IDLE && !(engine as any)["config"].useInspection && isScrambled) {
        // If inspection is off, we can start immediately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine as any).handleSmartCubeStart();
      }
    });
    
    const subFacelets = globalCubeAdapter.onFacelets;
    globalCubeAdapter.onFacelets = (f) => {
      if (subFacelets) subFacelets(f);
      // Check if solved. A fully solved cube usually has 54 characters of same facelets in 9-blocks.
      // 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
      const isSolved = f.match(/^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/);
      if (isSolved && engine.getState() === EngineState.RUNNING) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine as any).handleSmartCubeStop();
      }
    };

    return () => {
      sub.unsubscribe();
    };
  }, [engine, isScrambled]);

  // Update inspection flag dynamically
  useEffect(() => {
    // Already handled by useMemo dependency recreating TimerEngine
  }, [inspectionEnabled]);

  const handlePress = useCallback(() => {
    engine.handleDown();
  }, [engine]);

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
        if (state === "idle" && inspectionEnabled) {
          engine.startInspection();
        } else {
          handlePress();
        }
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
