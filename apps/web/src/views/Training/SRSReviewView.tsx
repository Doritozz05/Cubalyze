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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  METHODS,
  SUBSETS,
  getSeedData,
  resolveVisualizationStyleForSubset,
  resolveAlgorithmDiagramRotation,
} from "@cubeforge/algorithm-db";
import { useCaseAlgorithms } from "@/hooks/useCaseAlgorithms";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import { Case2x2Diagram } from "@/views/Practice/components/Case2x2Diagram";
import { Case3DDiagram } from "@/views/Practice/components/Case3DDiagram";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { generateRandomSetup, EXERCISE_IDS } from "@cubeforge/training";
import type { SRSGrade } from "@cubeforge/training";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { TrainingBreadcrumb, VerdictOverlay } from "./components";
import {
  RotateCcw,
  SkipForward,
  Flame,
  Trophy,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  TriangleAlert,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ─────────────────────────────────────────────────────────────────────── */

type ReviewStage = "recognition" | "execution" | "grading";

const STAGES: { id: ReviewStage; label: string }[] = [
  { id: "recognition", label: "Recognize" },
  { id: "execution", label: "Execute" },
  { id: "grading", label: "Grade" },
];

const STAGE_ORDER: ReviewStage[] = ["recognition", "execution", "grading"];

const GRADES: { grade: SRSGrade; label: string; hint: string; cls: string }[] = [
  { grade: "again", label: "Again", hint: "Couldn't recall", cls: "bg-hold text-white" },
  { grade: "hard", label: "Hard", hint: "Struggled", cls: "bg-caution text-ink" },
  { grade: "good", label: "Good", hint: "Solid recall", cls: "bg-ready text-white" },
  { grade: "easy", label: "Easy", hint: "Instant", cls: "bg-phase-blue text-white" },
];

const REASON_LABEL: Record<string, string> = {
  overdue: "Overdue", review: "Due", weak: "Weak", new: "New",
};

const REASON_DOT: Record<string, string> = {
  overdue: "bg-caution", review: "bg-phase-blue", weak: "bg-phase-violet", new: "bg-phase-emerald",
};

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

function calculateTps(moves: string[], ms: number): string {
  if (ms <= 0 || moves.length === 0) return "--";
  return (moves.length / (ms / 1000)).toFixed(1);
}

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

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function isStageBefore(s: ReviewStage, current: ReviewStage): boolean {
  return STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(current);
}

function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <TrainingBreadcrumb
          onBack={onBack}
          segments={[{ label: "Training" }, { label: "Review", isCurrent: true }]}
        />
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Recognition step
   ─────────────────────────────────────────────────────────────────────── */

function RecognitionStep({
  caseData,
  algorithm,
  style,
  onRecognized,
  onNotRecognized,
}: {
  caseData: import("@cubeforge/algorithm-db").AlgorithmCase | null;
  algorithm: import("@cubeforge/algorithm-db").Algorithm | null;
  style: import("@cubeforge/algorithm-db").VisualizationStyle;
  onRecognized: () => void;
  onNotRecognized: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="shrink-0 flex items-center justify-center">
          {caseData && (caseData.diagramType === "3d-isometric" || caseData.diagramType === "3d" || (!caseData.diagram2D && caseData.setupScramble)) ? (
            <Case3DDiagram caseData={caseData} algorithm={algorithm ?? undefined} className="w-28 sm:w-36" />
          ) : caseData && caseData.diagramType === "2d-top" && caseData.diagram2D ? (
            caseData.puzzleType === "2x2x2" ? (
              <Case2x2Diagram
                faceletColors={caseData.diagram2D.faceletColors}
                setupScramble={caseData.setupScramble}
                moves={undefined}
                style={style}
                rotation={resolveAlgorithmDiagramRotation(algorithm ?? undefined)}
                className="w-28 sm:w-36"
              />
            ) : (
              <CaseDiagram
                arrows={caseData.diagram2D.arrows}
                setupScramble={caseData.setupScramble}
                moves={undefined}
                style={style}
                rotation={resolveAlgorithmDiagramRotation(algorithm ?? undefined)}
                className="w-28 sm:w-36"
              />
            )
          ) : (
            <div className="flex size-28 items-center justify-center rounded-lg bg-surface-2 sm:size-36">
              <span className="text-[0.6rem] text-ink-3/40">No diagram</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-semibold text-ink">Do you recognize this case?</p>
          <p className="text-[0.62rem] text-ink-3 mt-1">
            Recall which algorithm solves it. Your answer feeds the recognition
            metric — a separate signal from execution speed.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onNotRecognized}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[0.7rem] font-semibold text-ink transition-colors hover:bg-line max-lg:py-3"
        >
          <EyeOff className="size-3.5" /> Not recognized
        </button>
        <button
          onClick={onRecognized}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2.5 text-[0.7rem] font-semibold text-surface transition-colors hover:bg-ink/90 max-lg:py-3"
        >
          <Eye className="size-3.5" /> Recognized
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Execution step
   ─────────────────────────────────────────────────────────────────────── */

function ExecutionStep({
  currentSetup,
  displaySetup,
  hasSmartCube,
  validation,
  phase,
  time,
  stoppedTime,
  hintCtx,
  onPress,
  onRelease,
  showVerdict,
  tpsDisplay,
  onCorrect,
  onIncorrect,
  onSkipExecution,
}: {
  currentSetup: string;
  displaySetup: string;
  hasSmartCube: boolean;
  validation: ReturnType<typeof useDrillSmartCube>["validation"];
  phase: ReturnType<typeof useDrillTimer>["phase"];
  time: number;
  stoppedTime: number;
  hintCtx: HintContext;
  onPress: () => void;
  onRelease: () => void;
  showVerdict: boolean;
  tpsDisplay: string;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkipExecution: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-lg bg-surface-2/60 p-3">
        <p className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1.5">Setup scramble</p>
        {currentSetup ? (
          <ScrambleDisplay
            scramble={currentSetup}
            displayScramble={displaySetup}
            states={hasSmartCube ? validation.states : undefined}
            currentIndex={hasSmartCube ? validation.currentIndex : 0}
            errorMoves={hasSmartCube ? validation.displayErrorMoves : []}
            pendingHalfDouble={hasSmartCube ? validation.pendingHalfDouble : false}
            isScrambled={hasSmartCube ? validation.isScrambled : false}
            needsReset={hasSmartCube ? validation.needsReset : false}
            awaitingSolve={hasSmartCube ? validation.awaitingSolve : false}
          />
        ) : (
          <p className="nums text-[0.8rem] text-ink-3/40 italic">No setup available for this case</p>
        )}
      </div>

      <div className="relative min-h-52 overflow-hidden rounded-lg border border-line">
        <AnimatePresence>
          {showVerdict && (
            <VerdictOverlay
              timeDisplay={formatTime(stoppedTime)}
              tpsDisplay={tpsDisplay}
              onCorrect={onCorrect}
              onIncorrect={onIncorrect}
              onSkip={onSkipExecution}
            />
          )}
        </AnimatePresence>
        <TimerContainer
          phase={phase}
          time={time}
          lastTime={null}
          hintCtx={hintCtx}
          onPress={onPress}
          onRelease={onRelease}
          className="h-full min-h-0 py-3"
          timerClassName="text-[clamp(2rem,6vw,3.75rem)]"
        />
      </div>

      {!showVerdict && (
        <button
          onClick={onSkipExecution}
          className="self-center text-[0.62rem] text-ink-3 hover:text-ink transition-colors"
        >
          Skip execution — go straight to grading
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Grading step
   ─────────────────────────────────────────────────────────────────────── */

function GradingStep({
  current,
  defaultAlgorithm,
  onGrade,
  onSkip,
}: {
  current: import("@cubeforge/training").QueueItem;
  defaultAlgorithm: import("@cubeforge/algorithm-db").Algorithm | null;
  onGrade: (g: SRSGrade) => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Signal label="Retention" value={`${Math.round(current.retrievability * 100)}%`}
          tone={current.retrievability < 0.6 ? "text-hold" : current.retrievability < 0.85 ? "text-caution" : "text-ready"} />
        <Signal label="Mastery" value={`${current.mastery}%`}
          tone={current.mastery < 40 ? "text-hold" : current.mastery < 70 ? "text-caution" : "text-ready"} />
        <Signal label="Recognition" value={`${current.recognitionAccuracy}%`}
          tone={current.recognitionAccuracy < 60 ? "text-hold" : "text-ink"} />
      </div>

      {defaultAlgorithm && (
        <div className="rounded-lg bg-surface-2/60 p-3">
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1">Algorithm</p>
          <p className="nums text-[0.72rem] text-ink font-medium">{defaultAlgorithm.moves.join(" ")}</p>
        </div>
      )}

      <p className="rounded-lg bg-surface-2/60 p-3 text-[0.62rem] text-ink-2 leading-relaxed">
        Grade how well you remembered it. <span className="font-medium text-ink">Again</span> resets the
        interval, <span className="font-medium text-ink">Good</span> grows it at the case&apos;s own pace.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map((g) => (
          <button
            key={g.grade}
            onClick={() => onGrade(g.grade)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 font-semibold transition-all hover:brightness-105 active:scale-[0.98] max-lg:py-3",
              g.cls,
            )}
          >
            <span className="text-[0.75rem]">{g.label}</span>
            <span className="text-[0.55rem] font-medium opacity-75">{g.hint}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onSkip}
        className="inline-flex items-center justify-center gap-1.5 self-center rounded-md px-3 py-1.5 text-[0.62rem] text-ink-3 hover:text-ink transition-colors"
      >
        <SkipForward className="size-3" /> Skip
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Completion summary
   ─────────────────────────────────────────────────────────────────────── */

function CompletionSummary({
  session,
  onBack,
  onReviewAgain,
}: {
  session: ReturnType<typeof useSRSQueue>["session"];
  onBack: () => void;
  onReviewAgain: () => void;
}) {
  const results = session.results;
  const goodCount = results.filter((r) => r.grade === "good" || r.grade === "easy").length;

  return (
    <Shell onBack={onBack}>
      <div className="flex-1 flex flex-col items-center justify-center py-10 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="grid size-12 place-items-center rounded-full bg-ready-soft">
            <Trophy className="size-6 text-ready" />
          </div>
          <h2 className="text-[0.95rem] font-semibold text-ink">Review complete!</h2>
          <p className="text-[0.68rem] text-ink-3">
            {results.length === 0
              ? "No items were reviewed in this session."
              : `${results.length} case${results.length !== 1 ? "s" : ""} reviewed · ${goodCount} passed`}
          </p>

          {results.length > 0 && (
            <div className="mt-4 w-full max-w-sm rounded-xl border border-line bg-surface p-4">
              <div className="space-y-1.5">
                {results.map((r, i) => (
                  <div key={`${r.algorithmId}-${i}`} className="flex items-center gap-2.5">
                    <span className="nums text-[0.6rem] font-medium text-ink w-9 shrink-0">{r.caseNumber}</span>
                    <span className="text-[0.6rem] text-ink-2 flex-1 truncate">
                      {GRADES.find((g) => g.grade === r.grade)?.label}
                    </span>
                    <span className="nums text-[0.58rem] text-ink-3">{r.intervalDays}d</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={onReviewAgain}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[0.68rem] font-semibold text-surface hover:bg-ink/90"
            >
              <RotateCcw className="size-3.5" /> Review again
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-3.5 py-2 text-[0.68rem] font-semibold text-ink hover:bg-line"
            >
              <Zap className="size-3.5" /> Back to training
            </button>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────────────────────────────────── */

function Signal({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2/60 p-2.5">
      <span className="text-[0.55rem] text-ink-3">{label}</span>
      <span className={cn("nums text-[0.85rem] font-semibold", tone)}>{value}</span>
    </div>
  );
}
