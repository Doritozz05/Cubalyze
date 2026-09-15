"use client";

import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { resolveAlgorithmDiagramRotation } from "@cubalyze/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { Case2x2Diagram } from "@/views/Algorithms/components/Case2x2Diagram";
import { Case3DDiagram } from "@/views/Algorithms/components/Case3DDiagram";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import type { HintContext } from "@/components/Timer/hintFor";
import type { useDrillTimer } from "@/hooks/useDrillTimer";
import type { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import type { SRSGrade } from "@cubalyze/training";
import type { ParseKeys } from "i18next";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { TrainingBreadcrumb, VerdictOverlay } from "./";
import { RotateCcw, SkipForward, Trophy, Eye, EyeOff, Zap } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Config shared with the review view
   ─────────────────────────────────────────────────────────────────────── */

export type ReviewStage = "recognition" | "execution" | "grading";

export const STAGES: { id: ReviewStage; labelKey: ParseKeys<"training"> }[] = [
  { id: "recognition", labelKey: "review.session.stageRecognition" },
  { id: "execution", labelKey: "review.session.stageExecution" },
  { id: "grading", labelKey: "review.session.stageGrading" },
];

export const STAGE_ORDER: ReviewStage[] = ["recognition", "execution", "grading"];

export const GRADES: { grade: SRSGrade; labelKey: ParseKeys<"training">; hintKey: ParseKeys<"training">; cls: string }[] = [
  { grade: "again", labelKey: "review.session.gradeAgain", hintKey: "review.session.gradeAgainHint", cls: "bg-hold text-white" },
  { grade: "hard", labelKey: "review.session.gradeHard", hintKey: "review.session.gradeHardHint", cls: "bg-caution text-ink" },
  { grade: "good", labelKey: "review.session.gradeGood", hintKey: "review.session.gradeGoodHint", cls: "bg-ready text-white" },
  { grade: "easy", labelKey: "review.session.gradeEasy", hintKey: "review.session.gradeEasyHint", cls: "bg-phase-blue text-white" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

export function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

export function calculateTps(moves: string[], ms: number): string {
  if (ms <= 0 || moves.length === 0) return "--";
  return (moves.length / (ms / 1000)).toFixed(1);
}

export function isStageBefore(s: ReviewStage, current: ReviewStage): boolean {
  return STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(current);
}

export function Signal({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2/60 p-2.5">
      <span className="text-[0.55rem] text-ink-3">{label}</span>
      <span className={cn("nums text-[0.85rem] font-semibold", tone)}>{value}</span>
    </div>
  );
}

export function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  const { t, i18n } = useTranslation("training");
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <TrainingBreadcrumb
          onBack={onBack}
          segments={[{ label: i18n.t("nav:training") }, { label: t("review.title"), isCurrent: true }]}
        />
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Recognition step
   ─────────────────────────────────────────────────────────────────────── */

export function RecognitionStep({
  caseData,
  algorithm,
  style,
  onRecognized,
  onNotRecognized,
}: {
  caseData: import("@cubalyze/algorithm-db").AlgorithmCase | null;
  algorithm: import("@cubalyze/algorithm-db").Algorithm | null;
  style: import("@cubalyze/algorithm-db").VisualizationStyle;
  onRecognized: () => void;
  onNotRecognized: () => void;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="shrink-0 flex items-center justify-center">
          {caseData && (caseData.diagramType === "3d-isometric" || caseData.diagramType === "3d") ? (
            <Case3DDiagram caseData={caseData} algorithm={algorithm ?? undefined} className="w-28 sm:w-36" />
          ) : caseData && (caseData.diagramType === "2d-top" || caseData.diagram2D) ? (
            caseData.puzzleType === "222" ? (
              <Case2x2Diagram
                faceletColors={caseData.diagram2D?.faceletColors}
                setupScramble={caseData.setupScramble}
                moves={undefined}
                style={style}
                rotation={resolveAlgorithmDiagramRotation(algorithm ?? undefined)}
                className="w-28 sm:w-36"
              />
            ) : (
              <CaseDiagram
                arrows={caseData.diagram2D?.arrows}
                setupScramble={caseData.setupScramble}
                moves={undefined}
                style={style}
                rotation={resolveAlgorithmDiagramRotation(algorithm ?? undefined)}
                className="w-28 sm:w-36"
              />
            )
          ) : (
            <div className="flex size-28 items-center justify-center rounded-lg bg-surface-2 sm:size-36">
              <span className="text-[0.6rem] text-ink-3/40">{t("noDiagram")}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-semibold text-ink">{t("review.session.doYouRecognize")}</p>
          <p className="text-[0.62rem] text-ink-3 mt-1">
            {t("review.session.recognitionHint")}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onNotRecognized}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[0.7rem] font-semibold text-ink transition-colors hover:bg-line max-lg:py-3"
        >
          <EyeOff className="size-3.5" /> {t("review.session.notRecognized")}
        </button>
        <button
          onClick={onRecognized}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2.5 text-[0.7rem] font-semibold text-surface transition-colors hover:bg-ink/90 max-lg:py-3"
        >
          <Eye className="size-3.5" /> {t("review.session.recognized")}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Execution step
   ─────────────────────────────────────────────────────────────────────── */

export function ExecutionStep({
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
  const { t } = useTranslation("training");
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-lg bg-surface-2/60 p-3">
        <p className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1.5">{t("review.session.setupScramble")}</p>
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
          <p className="nums text-[0.8rem] text-ink-3/40 italic">{t("review.session.noSetup")}</p>
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
          {t("review.session.skipExecution")}
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Grading step
   ─────────────────────────────────────────────────────────────────────── */

export function GradingStep({
  current,
  defaultAlgorithm,
  onGrade,
  onSkip,
}: {
  current: import("@cubalyze/training").QueueItem;
  defaultAlgorithm: import("@cubalyze/algorithm-db").Algorithm | null;
  onGrade: (g: SRSGrade) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation("training");
  const gradeLabel = (g: SRSGrade): ParseKeys<"training"> =>
    GRADES.find((x) => x.grade === g)?.labelKey ?? "review.session.gradeAgain";
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Signal label={t("review.session.retention")} value={`${Math.round(current.retrievability * 100)}%`}
          tone={current.retrievability < 0.6 ? "text-hold" : current.retrievability < 0.85 ? "text-caution" : "text-ready"} />
        <Signal label={t("review.session.mastery")} value={`${current.mastery}%`}
          tone={current.mastery < 40 ? "text-hold" : current.mastery < 70 ? "text-caution" : "text-ready"} />
        <Signal label={t("review.session.recognition")} value={`${current.recognitionAccuracy}%`}
          tone={current.recognitionAccuracy < 60 ? "text-hold" : "text-ink"} />
      </div>

      {defaultAlgorithm && (
        <div className="rounded-lg bg-surface-2/60 p-3">
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-1">{t("review.session.algorithm")}</p>
          <p className="nums text-[0.72rem] text-ink font-medium">{defaultAlgorithm.moves.join(" ")}</p>
        </div>
      )}

      <p className="rounded-lg bg-surface-2/60 p-3 text-[0.62rem] text-ink-2 leading-relaxed">
        {t("review.session.gradePrompt", {
          again: t(gradeLabel("again")),
          good: t(gradeLabel("good")),
        })}
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
            <span className="text-[0.75rem]">{t(g.labelKey)}</span>
            <span className="text-[0.55rem] font-medium opacity-75">{t(g.hintKey)}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onSkip}
        className="inline-flex items-center justify-center gap-1.5 self-center rounded-md px-3 py-1.5 text-[0.62rem] text-ink-3 hover:text-ink transition-colors"
      >
        <SkipForward className="size-3" /> {t("review.session.skip")}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Completion summary
   ─────────────────────────────────────────────────────────────────────── */

export function CompletionSummary({
  session,
  onBack,
  onReviewAgain,
}: {
  session: ReturnType<typeof useSRSQueue>["session"];
  onBack: () => void;
  onReviewAgain: () => void;
}) {
  const { t } = useTranslation("training");
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
          <h2 className="text-[0.95rem] font-semibold text-ink">{t("review.session.completeTitle")}</h2>
          <p className="text-[0.68rem] text-ink-3">
            {results.length === 0
              ? t("review.session.noItemsReviewed")
              : t("review.session.reviewedSummary", { count: results.length, passed: goodCount })}
          </p>

          {results.length > 0 && (
            <div className="mt-4 w-full max-w-sm rounded-xl border border-line bg-surface p-4">
              <div className="space-y-1.5">
                {results.map((r, i) => (
                  <div key={`${r.algorithmId}-${i}`} className="flex items-center gap-2.5">
                    <span className="nums text-[0.6rem] font-medium text-ink w-9 shrink-0">{r.caseNumber}</span>
                    <span className="text-[0.6rem] text-ink-2 flex-1 truncate">
                      {t(GRADES.find((g) => g.grade === r.grade)?.labelKey ?? "review.session.gradeAgain")}
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
              <RotateCcw className="size-3.5" /> {t("review.session.reviewAgain")}
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-3.5 py-2 text-[0.68rem] font-semibold text-ink hover:bg-line"
            >
              <Zap className="size-3.5" /> {t("backToTraining")}
            </button>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
