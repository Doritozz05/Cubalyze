"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrainingSessionEngine } from "@cubeforge/training";
import type { TrainingSessionState, ExercisePreset, AttemptVerdict, PlayMode, MetricKind } from "@cubeforge/training";
import { useDrillTimer } from "./useDrillTimer";
import { useTrainingProgress } from "./useTrainingProgress";
import { useTrainingSession } from "./useTrainingSession";

/* ──────────────────────────────────────────────────────────────────────────
   useTrainingEngine

   Composes the pure `TrainingSessionEngine` state machine with the shared
   drill timer, DB persistence and the persisted session lifecycle, so a
   Training view stays thin:

     timer (useDrillTimer)   →  drive the machine (ARM/START_SOLVING/STOP)
     engine (TrainingSessionEngine) → session attempt accumulator (phase/attempts)
     useTrainingProgress     →  recordAttempt/getSubsetProgress
     useTrainingSession      →  persisted logical session grouping

   The 45+ state-machine tests in packages/training guarantee the reducer
   transitions; this hook only wires the UI-facing events into it.
   ──────────────────────────────────────────────────────────────────────── */

export interface UseTrainingEngineOptions {
  preset: ExercisePreset;
  smartCubeUsed?: boolean;
}

export interface SubmitVerdictParams {
  verdict: AttemptVerdict;
  playMode?: PlayMode;
  caseId: string;
  scramble: string;
  timeMs: number;
  expectedMoves?: string[];
  metricKind?: MetricKind;
  advanceSRS?: boolean;
  /** Persisted with the attempt when provided (session grouping). */
  sessionId?: string;
}

export function useTrainingEngine({
  preset,
  smartCubeUsed = false,
}: UseTrainingEngineOptions) {
  // ── Engine (stable instance) ─────────────────────────────────────────
  const engineRef = useRef<TrainingSessionEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TrainingSessionEngine();
  const engine = engineRef.current;

  const [sessionState, setSessionState] = useState<TrainingSessionState>(engine.getState());

  useEffect(() => engine.subscribe(setSessionState), [engine]);

  // ── Shared subsystems ────────────────────────────────────────────────
  const drill = useDrillTimer();
  const progress = useTrainingProgress();
  const session = useTrainingSession({
    exerciseId: preset.exerciseId,
    methodId: preset.methodId,
    phaseId: preset.phaseId,
    subsetId: preset.subsetId,
    smartCubeUsed,
  });

  // Auto-start a session once the DB is ready (and the machine is idle).
  const presetKey = useMemo(
    () => `${preset.exerciseId}|${preset.methodId}|${preset.phaseId ?? ""}|${preset.subsetId ?? ""}`,
    [preset.exerciseId, preset.methodId, preset.phaseId, preset.subsetId],
  );
  const startedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!progress.ready) return;
    if (startedKeyRef.current === presetKey) return;
    startedKeyRef.current = presetKey;
    engine.dispatch({
      type: "START_SESSION",
      config: { preset, smartCubeMode: smartCubeUsed ? "on" : "auto" },
    });
  }, [progress.ready, presetKey, smartCubeUsed, engine]);

  // ── Bridge: timer events → machine events ───────────────────────────
  // Defensive: invalid transitions are no-ops inside the reducer, so this
  // can only ever move the machine forward when the phases line up.
  useEffect(() => {
    const ph = sessionState.phase;
    const timerPhase = drill.phase;
    if (timerPhase === "running" && ph === "armed") {
      engine.dispatch({ type: "START_SOLVING" });
    } else if (timerPhase === "stopped" && ph === "solving" && drill.stoppedTime > 0) {
      engine.dispatch({ type: "STOP", timeMs: drill.stoppedTime });
    }
  }, [drill.phase, drill.stoppedTime, sessionState.phase, engine]);

  // ── Register the scramble for the current attempt (setup phase) ─────
  const beginAttempt = useCallback(
    (scramble: string, caseId: string) => {
      if (engine.getState().phase === "setup") {
        engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble, caseId });
      }
    },
    [engine],
  );

  // ── Submit a verdict: drive the machine through the cycle, persist ──
  const submitVerdict = useCallback(
    async (params: SubmitVerdictParams) => {
      const { verdict, playMode = "manual", caseId, scramble, timeMs, expectedMoves, metricKind, advanceSRS } = params;
      const ph = engine.getState().phase;

      // Move the machine to the verdict state if it isn't there yet
      // (untimed quizzes jump straight from setup; a double-click is ignored).
      if (ph === "setup") {
        engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble, caseId });
        engine.dispatch({ type: "ARM" });
        engine.dispatch({ type: "START_SOLVING" });
        engine.dispatch({ type: "STOP", timeMs });
      } else if (ph === "armed") {
        engine.dispatch({ type: "START_SOLVING" });
        engine.dispatch({ type: "STOP", timeMs });
      } else if (ph === "solving") {
        engine.dispatch({ type: "STOP", timeMs });
      }

      if (engine.getState().phase !== "verdict") return; // guard: already judged

      engine.dispatch({ type: "VERDICT", verdict, playMode, expectedMoves });
      await progress.recordAttempt({
        exerciseId: preset.exerciseId,
        methodId: preset.methodId,
        phaseId: preset.phaseId,
        caseId,
        sessionId: params.sessionId,
        timeMs,
        verdict,
        playMode,
        scramble,
        metricKind,
        advanceSRS,
      });
      engine.dispatch({ type: "NEXT_ATTEMPT" });
    },
    [engine, progress.recordAttempt, preset.exerciseId, preset.methodId, preset.phaseId],
  );

  // ── Skip: advance the machine WITHOUT recording an attempt (matches the
  //    historical Drill behaviour — skips never counted in session stats nor
  //    persisted to the DB). Only valid once a verdict is pending.
  const skip = useCallback(() => {
    const ph = engine.getState().phase;
    if (ph === "solving") {
      engine.dispatch({ type: "STOP", timeMs: engine.getState().currentTimeMs });
    }
    if (engine.getState().phase === "verdict") {
      engine.dispatch({ type: "NEXT_ATTEMPT" });
    }
  }, [engine]);

  const endSession = useCallback(() => {
    engine.dispatch({ type: "END_SESSION" });
  }, [engine]);

  return {
    // Machine state (phase, attempts, attemptIndex, stoppedTimeMs)
    sessionState,
    // Timer API (manual drill timer + exposed TimerEngine for smart cube)
    phase: drill.phase,
    time: drill.time,
    stoppedTime: drill.stoppedTime,
    press: drill.press,
    release: drill.release,
    reset: drill.reset,
    timerEngine: drill.engine,
    // Persistence / progress
    ready: progress.ready,
    recordAttempt: progress.recordAttempt,
    getSubsetProgress: progress.getSubsetProgress,
    getAttemptsByExercise: progress.getAttemptsByExercise,
    // Session grouping
    sessionId: session.sessionId,
    session: session.session,
    completeSession: session.completeSession,
    // Machine actions
    engine,
    dispatch: engine.dispatch.bind(engine),
    beginAttempt,
    submitVerdict,
    skip,
    endSession,
  };
}
