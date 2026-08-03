"use client";

/**
 * SRSReviewView — the daily spaced-repetition review session.
 *
 * Each queue item flows through three stages:
 *   1. Recognition flash — the case (diagram + label) is shown; the user
 *      says whether they recognized the algorithm. Records a recognition
 *      metric. Not recognizing auto-grades "again" (you couldn't recall).
 *   2. Timed execution — a targeted setup scramble is generated, the user
 *      executes the algorithm against the timer, and marks correct/incorrect.
 *      Records an execution metric (time + verdict).
 *   3. Grading — the four FSRS buttons (Again/Hard/Good/Easy) advance the
 *      FSRS state machine via ProgressTracker.recordReview.
 *
 * The stage machine is reset on every item change; the completion summary
 * renders when the whole queue is finished.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData, resolveVisualizationStyleForSubset } from "@cubeforge/algorithm-db";
import { useCaseAlgorithms } from "@/hooks/useCaseAlgorithms";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { generateRandomSetup, EXERCISE_IDS } from "@cubeforge/training";
import type { SRSGrade } from "@cubeforge/training";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  STAGES,
  isStageBefore,
  Shell,
  RecognitionStep,
  ExecutionStep,
  GradingStep,
  CompletionSummary,
  calculateTps,
} from "./components/ReviewSteps";
import type { ReviewStage } from "./components/ReviewSteps";
import {
  Flame,
  Loader2,
  TriangleAlert,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ─────────────────────────────────────────────────────────────────────── */

const REASON_LABEL: Record<string, string> = {
  overdue: "Overdue", review: "Due", weak: "Weak", new: "New",
};

const REASON_DOT: Record<string, string> = {
  overdue: "bg-caution", review: "bg-phase-blue", weak: "bg-phase-violet", new: "bg-phase-emerald",
};

function methodName(methodId: string): string {
  return METHODS.find((m) => m.id === methodId)?.name ?? methodId;
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ─────────────────────────────────────────────────────────────────────── */

export interface SRSReviewViewProps {
  methodId?: string;
  onBack: () => void;
}

export function SRSReviewView({ methodId, onBack }: SRSReviewViewProps) {
  const { ready, loading, error, session, startSession, recordAttempt, grade, skip, updateAttemptReviewGrade } = useSRSQueue();
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [stage, setStage] = useState<ReviewStage>("recognition");
  const [currentSetup, setCurrentSetup] = useState("");
  const [showVerdict, setShowVerdict] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const current = session.current;
  const caseId = current?.algorithmId;
  const { sessionId, completeSession } = useTrainingSession({
    exerciseId: EXERCISE_IDS.srsReview(methodId),
    methodId: methodId ?? "all",
    phaseId: "srs-review",
    sessionKey,
  });

  // ── Case + algorithm data ────────────────────────────────────────────
  const { cases: allCases } = useMemo(() => getSeedData(), []);
  const currentCase = useMemo(
    () => allCases.find((c) => c.id === caseId) ?? null,
    [allCases, caseId],
  );
  const { primaryAlgorithm: defaultAlgorithm } = useCaseAlgorithms(caseId);
  const subset = useMemo(
    () => SUBSETS.find((s) => s.id === current?.subsetId) ?? null,
    [current?.subsetId],
  );
  const visualizationStyle = useMemo(
    () => resolveVisualizationStyleForSubset(subset?.name),
    [subset],
  );

  // ── Timer + smart cube (timer only armed during the execution stage) ──
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer({
    enabled: stage === "execution" && !showVerdict,
  });
  const drillSmartCube = useDrillSmartCube({ engine, setupScramble: currentSetup });
  const { remapScramble } = useOrientation();
  const displaySetup = remapScramble(currentSetup);
  const hasSmartCube = drillSmartCube.smartCubeConnected;

  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const scrambleVerificationRaw = useStore(preferencesStore, (s) => s.scrambleVerification);
  const scrambleVerification = scrambleDisplay && scrambleVerificationRaw;
  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube && scrambleVerification,
    inspection: false,
    isScrambled: drillSmartCube.validation.isScrambled,
  }), [hasSmartCube, scrambleVerification, drillSmartCube.validation.isScrambled]);

  // ── Kick off the session when the DB is ready (and for "Review again") ──
  useEffect(() => {
    if (!ready || started) return;
    setStarted(true);
    void startSession({ methodId });
  }, [ready, started, startSession, methodId]);

  // The completion summary remains mounted after the last grade. Close the
  // persisted training session now rather than waiting for navigation away.
  useEffect(() => {
    if (!started || session.total === 0 || session.active) return;
    void completeSession().catch((err) => console.error("[SRSReview] complete session:", err));
  }, [started, session.total, session.active, completeSession]);

  // ── Reset stage + timer when the item changes ────────────────────────
  useEffect(() => {
    setStage("recognition");
    setShowVerdict(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // ── Always start the timed run fresh when entering the execution stage ─
  useEffect(() => {
    if (stage === "execution") {
      reset();
      setShowVerdict(false);
    }
  }, [stage, reset]);

  // ── Generate a targeted setup scramble for the current case ──────────
  useEffect(() => {
    if (defaultAlgorithm?.moves) {
      const setup = generateRandomSetup(
        defaultAlgorithm.moves,
        "Y",
        currentCase?.puzzleType ?? "3x3x3",
        currentCase?.setupScramble,
      );
      setCurrentSetup(setup || currentCase?.setupScramble || "");
    } else {
      setCurrentSetup("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, defaultAlgorithm?.id]);

  // ── Verdict overlay when the execution timer stops ───────────────────
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) setShowVerdict(true);
    else if (phase !== "stopped") setShowVerdict(false);
  }, [phase, stoppedTime]);

  // ── Recognition handlers ─────────────────────────────────────────────
  const handleRecognized = async () => {
    if (!current) return;
    setPersistenceError(null);
    try {
      await recordAttempt({
      exerciseId: EXERCISE_IDS.srsReview(current.methodId),
      methodId: current.methodId,
      caseId: current.algorithmId,
      timeMs: 0,
      verdict: "correct",
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentSetup,
      metricKind: "recognition",
      sessionId: sessionId ?? undefined,
      });
      setStage("execution");
    } catch (err) {
      console.error("[SRSReview] recognition:", err);
      setPersistenceError("Could not save recognition result. Please try again.");
    }
  };

  const handleNotRecognized = async () => {
    if (!current) return;
    setPersistenceError(null);
    try {
      await recordAttempt({
      exerciseId: EXERCISE_IDS.srsReview(current.methodId),
      methodId: current.methodId,
      caseId: current.algorithmId,
      timeMs: 0,
      verdict: "incorrect",
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentSetup,
      metricKind: "recognition",
      sessionId: sessionId ?? undefined,
      });
      // Couldn't recall → the honest grade is "again"; advance only after the
      // recognition write has settled, avoiding a lost concurrent upsert.
      await grade("again");
      // Tag the attempt with the grade that drove the FSRS schedule. Best-effort:
      // the grade itself already saved, so a tag failure must not mislead.
      updateAttemptReviewGrade(current.algorithmId, "again").catch((err) =>
        console.error("[SRSReview] tag recognition attempt:", err),
      );
    } catch (err) {
      console.error("[SRSReview] recognition miss:", err);
      setPersistenceError("Could not save recognition result. Please try again.");
    }
  };

  // ── Execution verdict handlers ───────────────────────────────────────
  const handleExecutionVerdict = async (correct: boolean) => {
    if (!current) return;
    setPersistenceError(null);
    try {
      await recordAttempt({
      exerciseId: EXERCISE_IDS.srsReview(current.methodId),
      methodId: current.methodId,
      caseId: current.algorithmId,
      timeMs: stoppedTime,
      verdict: correct ? "correct" : "incorrect",
      playMode: hasSmartCube ? "smart-cube" : "manual",
      scramble: currentSetup,
      metricKind: "execution",
      sessionId: sessionId ?? undefined,
      });
      reset();
      setStage("grading");
    } catch (err) {
      console.error("[SRSReview] execution:", err);
      setPersistenceError("Could not save execution result. Please try again.");
    }
  };

  const handleGrade = async (nextGrade: SRSGrade) => {
    setPersistenceError(null);
    try {
      await grade(nextGrade);
      // Tag the attempt that produced this review with the FSRS grade so
      // attempt history and the SRS schedule stay linked. Best-effort: the
      // grade already saved, so a tag failure must not read as a failed grade.
      if (current) {
        updateAttemptReviewGrade(current.algorithmId, nextGrade).catch((err) =>
          console.error("[SRSReview] tag attempt:", err),
        );
      }
    } catch (err) {
      console.error("[SRSReview] grade:", err);
      setPersistenceError("Could not save the review grade. Please try again.");
    }
  };

  const handleSkipExecution = () => {
    reset();
    setStage("grading");
  };

  // ── Guard states ─────────────────────────────────────────────────────
  const sessionPending = ready && !started && !session.active;

  if (!ready || loading || sessionPending) {
    return (
      <Shell onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 text-ink-3 animate-spin" />
          <p className="text-[0.7rem] text-ink-3">Loading review queue…</p>
        </div>
      </Shell>
    );
  }

  // Only queue *load* failures are fatal. Transient persistence errors are
  // rendered inline below so the current review can be retried instead of
  // throwing away the whole session.
  if (error) {
    return (
      <Shell onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-[0.7rem] text-hold">{error}</p>
          <button onClick={onBack} className="rounded-md bg-surface-2 px-3 py-1.5 text-[0.65rem] text-ink">
            Back to training
          </button>
        </div>
      </Shell>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────
  if (!session.active || !current) {
    return (
      <CompletionSummary
        session={session}
        onBack={onBack}
        onReviewAgain={() => {
          setSessionKey((key) => key + 1);
          setStarted(false);
        }}
      />
    );
  }

  const total = session.total;
  const progress = total > 0 ? (session.index / total) * 100 : 0;

  return (
    <Shell onBack={onBack}>
      {persistenceError && (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-hold/30 bg-hold/10 px-3 py-2 text-[0.62rem] text-hold">
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{persistenceError}</span>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full rounded-full bg-ink/60"
          />
        </div>
        <span className="nums text-[0.62rem] text-ink-3 shrink-0">
          {Math.min(session.index + 1, total)} / {total}
        </span>
      </div>

      {/* Stage indicator */}
      <div className="flex gap-1 shrink-0">
        {STAGES.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-[0.6rem] text-ink-3/40">›</span>}
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[0.62rem] font-medium transition-colors",
                stage === s.id
                  ? "bg-ink text-surface"
                  : isStageBefore(s.id, stage)
                    ? "text-ink-3/40"
                    : "text-ink-3",
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <motion.div
          key={`${current.algorithmId}-${stage}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          {/* Case header */}
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2">
              <Flame className="size-4 text-ink-2" />
            </div>
            <div className="min-w-0 flex-1">
              {/* During the recognition flash the answer must stay hidden — the
                  user has to identify the case from the diagram alone. */}
              {stage !== "recognition" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="nums text-[1rem] font-semibold text-ink">{current.caseNumber}</span>
                    <span className={cn("size-2 shrink-0 rounded-full", REASON_DOT[current.reason] ?? "bg-ink-3")} />
                  </div>
                  <p className="text-[0.7rem] text-ink-2 mt-0.5">{current.name}</p>
                </>
              )}
              <p className="text-[0.6rem] text-ink-3 mt-0.5">
                {methodName(current.methodId)} ·{" "}
                <span className="capitalize">{REASON_LABEL[current.reason] ?? current.reason}</span>
                {current.overdueDays >= 1 && (
                  <span className="text-caution"> · {Math.floor(current.overdueDays)}d overdue</span>
                )}
              </p>
            </div>
          </div>

          {/* Stage content */}
          {stage === "recognition" && (
            <RecognitionStep
              caseData={currentCase}
              algorithm={defaultAlgorithm}
              style={visualizationStyle}
              onRecognized={handleRecognized}
              onNotRecognized={handleNotRecognized}
            />
          )}

          {stage === "execution" && (
            <ExecutionStep
              currentSetup={currentSetup}
              displaySetup={displaySetup}
              hasSmartCube={hasSmartCube}
              validation={drillSmartCube.validation}
              phase={phase}
              time={time}
              stoppedTime={stoppedTime}
              hintCtx={hintCtx}
              onPress={press}
              onRelease={release}
              showVerdict={showVerdict}
              tpsDisplay={calculateTps(defaultAlgorithm?.moves ?? [], stoppedTime)}
              onCorrect={() => handleExecutionVerdict(true)}
              onIncorrect={() => handleExecutionVerdict(false)}
              onSkipExecution={handleSkipExecution}
            />
          )}

          {stage === "grading" && (
            <GradingStep
              current={current}
              defaultAlgorithm={defaultAlgorithm}
              onGrade={(g) => void handleGrade(g)}
              onSkip={skip}
            />
          )}
        </motion.div>
      </div>
    </Shell>
  );
}

