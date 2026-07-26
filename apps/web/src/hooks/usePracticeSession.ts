"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/solver-engine";

/* ──────────────────────────────────────────────────────────────────────────
   Shared helpers
   ─────────────────────────────────────────────────────────────────────── */

export function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

let _gid = 0;
export function nextPracticeId(): string { return `pr-${++_gid}-${Date.now()}`; }

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

export function usePracticeSession({
  methodId, phaseId, exerciseId,
}: PracticeSessionParams): PracticeSessionResult {
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );

  // Timer
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer();
  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);
  const smartCube = useDrillSmartCube({ engine, setupScramble: currentScramble });
  const hasSmartCube = smartCube.smartCubeConnected;
  const { recordAttempt: dbPersistAttempt } = useTrainingProgress();

  // Verdict
  const [showVerdict, setShowVerdict] = useState(false);
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) setShowVerdict(true);
    else if (phase !== "stopped") setShowVerdict(false);
  }, [phase, stoppedTime]);

  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube, scrambleVerif: hasSmartCube, inspection: false,
    isScrambled: smartCube.validation.isScrambled,
  }), [hasSmartCube, smartCube.validation.isScrambled]);

  // Stats
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestTime = validAttempts.length > 0 ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0
    ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) { if (attempts[i].correct) s++; else break; }
    return s;
  }, [attempts]);

  // Persist
  const recordAttempt = useCallback((correct: boolean) => {
    setAttempts((prev) => [{
      id: nextPracticeId(), timeMs: stoppedTime, correct, timestamp: Date.now(),
    }, ...prev]);
    dbPersistAttempt({
      exerciseId, methodId, phaseId, timeMs: stoppedTime,
      verdict: correct ? "correct" : "incorrect",
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentScramble,
    }).catch((err) => { console.error(`[${exerciseId}] Failed to persist:`, err); });
  }, [stoppedTime, dbPersistAttempt, methodId, phaseId, exerciseId, hasSmartCube, currentScramble]);

  const regenerateScramble = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
  }, []);

  const handleCorrect = useCallback(() => { recordAttempt(true); reset(); regenerateScramble(); }, [recordAttempt, reset, regenerateScramble]);
  const handleIncorrect = useCallback(() => { recordAttempt(false); reset(); regenerateScramble(); }, [recordAttempt, reset, regenerateScramble]);
  const handleSkip = useCallback(() => { reset(); regenerateScramble(); }, [reset, regenerateScramble]);

  return {
    phase, time, stoppedTime, press, release, reset,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict,
    attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    regenerateScramble, currentScramble, setCurrentScramble,
  };
}
