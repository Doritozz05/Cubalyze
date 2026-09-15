"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubalyze/state";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import type { useDrillTimer } from "@/hooks/useDrillTimer";
import { useOrientation } from "@/hooks/useOrientation";
import { useTrainingEngine } from "@/hooks/useTrainingEngine";
import { RandomStateGenerator } from "@cubalyze/solver-engine";
import { getMin2PhaseSolver } from "@/utils/puzzleUtils";
import type { MetricKind } from "@cubalyze/training";

/* ──────────────────────────────────────────────────────────────────────────
   Shared helpers
   ─────────────────────────────────────────────────────────────────────── */

export function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

export interface PracticeAttempt {
  id: string;
  timeMs: number;
  correct: boolean;
  timestamp: number;
}

export interface PracticeSessionParams {
  methodId: string;
  phaseId: string;
  exerciseId: string;
  /** Optional per-phase efficiency metadata (move count vs optimal) so
      phase-target trainings (Cross/EO/LSE) feed real phase stats. */
  metricKind?: MetricKind;
  moveCount?: number | null;
  optimalMoves?: number | null;
  tps?: number | null;
  rotationCount?: number | null;
}

export interface PracticeSessionResult {
  // Timer
  phase: ReturnType<typeof useDrillTimer>["phase"];
  time: ReturnType<typeof useDrillTimer>["time"];
  stoppedTime: ReturnType<typeof useDrillTimer>["stoppedTime"];
  press: ReturnType<typeof useDrillTimer>["press"];
  release: ReturnType<typeof useDrillTimer>["release"];
  reset: () => void;
  // Smart Cube
  displayScramble: string;
  hasSmartCube: boolean;
  smartCube: ReturnType<typeof useDrillSmartCube>;
  hintCtx: HintContext;
  // Verdict
  showVerdict: boolean;
  // Stats
  attempts: PracticeAttempt[];
  bestTime: number;
  avgTime: number;
  streak: number;
  // Actions
  handleCorrect: () => void;
  handleIncorrect: () => void;
  handleSkip: () => void;
  regenerateScramble: () => void;
  currentScramble: string;
  setCurrentScramble: (s: string) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   Hook
   ─────────────────────────────────────────────────────────────────────── */

/**
 * Thin practice-mode orchestrator. Delegates the session state machine, the
 * drill timer, DB persistence and the logical session to `useTrainingEngine`
 * (the SAME engine Drill/Recognize use), so every training view shares one
 * machine with its 45+ reducer tests behind it.
 *
 * Behaviour preserved from the legacy hook:
 *  - skips ARE persisted to the DB (verdict 'skipped', timeMs 0) so
 *    fail/skip rates are real, but they are NOT counted in the local
 *    session stats (attempts/best/avg/streak);
 *  - scrambles are generated locally with RandomStateGenerator.
 */
export function usePracticeSession({
  methodId, phaseId, exerciseId,
  metricKind, moveCount, optimalMoves, tps, rotationCount,
}: PracticeSessionParams): PracticeSessionResult {
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(getMin2PhaseSolver()),
  );

  // Smart cube connection, tracked before the engine so the persisted session
  // records smartCubeUsed=true once a cube is linked (same pattern as Drill).
  const [smartCubeConnected, setSmartCubeConnected] = useState(false);

  // Training engine: session machine + drill timer + persistence + session.
  const {
    phase, time, stoppedTime, press, release, reset,
    timerEngine, sessionState, sessionId,
    submitVerdict,
  } = useTrainingEngine({
    preset: { exerciseId, methodId, phaseId },
    smartCubeUsed: smartCubeConnected,
  });

  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);
  const smartCube = useDrillSmartCube({ engine: timerEngine, setupScramble: currentScramble });
  const hasSmartCube = smartCube.smartCubeConnected;

  useEffect(() => {
    if (hasSmartCube !== smartCubeConnected) {
      setSmartCubeConnected(hasSmartCube);
    }
  }, [hasSmartCube, smartCubeConnected]);

  // Verdict
  const showVerdict = phase === "stopped" && stoppedTime > 0;

  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const scrambleVerificationRaw = useStore(preferencesStore, (s) => s.scrambleVerification);
  const scrambleVerification = scrambleDisplay && scrambleVerificationRaw;

  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube, scrambleVerif: hasSmartCube && scrambleVerification, inspection: false,
    isScrambled: smartCube.validation.isScrambled,
  }), [hasSmartCube, scrambleVerification, smartCube.validation.isScrambled]);

  // Stats derive from the session machine. Skips are excluded so they match
  // the historical behaviour (skips never counted in local stats).
  const attempts: PracticeAttempt[] = useMemo(
    () => sessionState.attempts
      .filter((a) => a.verdict !== "skipped")
      .map((a) => ({
        id: a.id,
        timeMs: a.timeMs,
        correct: a.verdict === "correct",
        timestamp: a.timestamp,
      })),
    [sessionState.attempts],
  );
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestTime = validAttempts.length > 0 ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0
    ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) { if (attempts[i].correct) s++; else break; }
    return s;
  }, [attempts]);

  const regenerateScramble = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(getMin2PhaseSolver()));
  }, []);

  const persist = useCallback((verdict: "correct" | "incorrect" | "skipped", time: number) => {
    void submitVerdict({
      verdict,
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentScramble,
      timeMs: time,
      metricKind,
      sessionId: sessionId ?? undefined,
      moveCount: moveCount ?? undefined,
      optimalMoves: optimalMoves ?? undefined,
      tps: tps ?? undefined,
      rotationCount: rotationCount ?? undefined,
    }).catch((err) => {
      console.error(`[${exerciseId}] Failed to persist:`, err);
    });
  }, [submitVerdict, hasSmartCube, currentScramble, metricKind, sessionId,
    moveCount, optimalMoves, tps, rotationCount, exerciseId]);

  const handleCorrect = useCallback(() => {
    persist("correct", stoppedTime);
    reset();
    regenerateScramble();
  }, [persist, stoppedTime, reset, regenerateScramble]);

  const handleIncorrect = useCallback(() => {
    persist("incorrect", stoppedTime);
    reset();
    regenerateScramble();
  }, [persist, stoppedTime, reset, regenerateScramble]);

  const handleSkip = useCallback(() => {
    // Skips are persisted (verdict 'skipped', timeMs 0) so fail/skip rates are
    // real — but excluded from the local stats above (historical behaviour).
    persist("skipped", 0);
    reset();
    regenerateScramble();
  }, [persist, reset, regenerateScramble]);

  return {
    phase, time, stoppedTime, press, release, reset,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict,
    attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    regenerateScramble, currentScramble, setCurrentScramble,
  };
}
