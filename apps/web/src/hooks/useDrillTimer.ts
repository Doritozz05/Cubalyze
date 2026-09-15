"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TimerEngine } from "@cubalyze/timer-engine";
import { createTrainingTimer } from "@cubalyze/training";
import type { TimerState } from "@/types";
import { mapTimerState } from "@/utils/timerState";
import { useTimerKeyboard } from "@/hooks/useTimerKeyboard";

/* ── Hook ─────────────────────────────────────────────────────────────── */

export interface UseDrillTimerOptions {
  /** When false, space key handlers are unregistered (e.g. during verdict). Default true. */
  enabled?: boolean;
  /** Whether to enable WCA-style 15s inspection. Default false. */
  inspection?: boolean;
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
  /** Underlying TimerEngine — exposed for Smart Cube integration. */
  engine: TimerEngine;
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
  const { enabled = true, inspection = false } = options;
  const engine = useMemo(
    () => createTrainingTimer({ useInspection: inspection }),
    [inspection],
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
      setPhase(mapTimerState(es));
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

  /* ── Space key handling (shared hook, global, excluded from inputs) ─ */
  useTimerKeyboard({ onPress: press, onRelease: release, enabled });

  return { phase, time, stoppedTime, press, release, reset, engine };
}
