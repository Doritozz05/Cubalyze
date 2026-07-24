"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TimerEngine,
  TimerState as EngineState,
} from "@cubeforge/timer-engine";
import type { TimerState } from "@/types";

/* ── Map engine state → UI state ─────────────────────────────────────── */

function mapState(es: EngineState): TimerState {
  switch (es) {
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
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

export interface UseDrillTimerOptions {
  /** When false, space key handlers are unregistered (e.g. during verdict). Default true. */
  enabled?: boolean;
}

export interface UseDrillTimerResult {
  /** Current timer phase (idle / holding / ready / running / stopped). */
  phase: TimerState;
  /** Live elapsed time in ms (0 when idle). */
  time: number;
  /** Time captured at stop (ms). 0 if no solve stopped yet. */
  stoppedTime: number;
  /** Press / hold down (space or pointer). */
  press: () => void;
  /** Release (space or pointer). */
  release: () => void;
  /** Reset timer to idle + clear stopped time. */
  reset: () => void;
}

/**
 * Lightweight drill timer hook.
 *
 * Wraps `TimerEngine` with `useInspection: false` for hold-to-arm
 * behavior (no inspection countdown). Handles space key globally
 * so the user can operate the timer from any focus state (except
 * inputs / textareas).
 *
 * Pass `{ enabled: false }` to temporarily disable space key
 * handlers (useful during verdict overlays to prevent accidental
 * reset).
 *
 * Does NOT depend on scramble validation, BLE move collection,
 * or the analysis pipeline — those are practice-mode concerns.
 */
export function useDrillTimer(options: UseDrillTimerOptions = {}): UseDrillTimerResult {
  const { enabled = true } = options;
  const engine = useMemo(
    () => new TimerEngine({ useInspection: false }),
    [],
  );

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [stoppedTime, setStoppedTime] = useState(0);

  /* ── Press / Release / Reset ─────────────────────────────────────── */
  const press = useCallback(() => engine.handleDown(), [engine]);
  const release = useCallback(() => engine.handleUp(), [engine]);
  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
    setStoppedTime(0);
  }, [engine]);

  /* ── Subscribe to engine events ──────────────────────────────────── */
  useEffect(() => {
    const sub1 = engine.state$.subscribe((es) => {
      setPhase(mapState(es));
    });
    const sub2 = engine.tick$.subscribe((t) => setTime(t));
    const sub3 = engine.stop$.subscribe((ev) => {
      setStoppedTime(ev.timeMs);
      setTime(ev.timeMs);
    });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  /* ── Space key handling (global, excluded from inputs) ──────────── */
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) press();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
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
  }, [press, release, enabled]);

  return { phase, time, stoppedTime, press, release, reset };
}
