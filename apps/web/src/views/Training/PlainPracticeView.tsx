"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import { EXERCISE_IDS } from "@cubeforge/training";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface PlainPracticeViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
  exerciseLabel?: string;
  /** Canonical exercise id — defaults to plain-<method>-<phase>. Override for
      variant modes (e.g. Speed vs Efficiency → se-<method>-<phase>). */
  exerciseId?: string;
}

export function PlainPracticeView({
  methodId, phaseId, phaseName, onBack, exerciseLabel, exerciseId,
}: PlainPracticeViewProps) {
  const { t, i18n } = useTranslation("training");
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: exerciseId ?? EXERCISE_IDS.plain(methodId, phaseId) });

  // Phase tips live in the locale (training:tips.<phaseId>) as arrays.
  // The key is dynamic, so the global `i18n.t` is narrowed via a cast.
  const tipsRaw = (i18n.t as (key: string, options?: object) => unknown)(
    `training:tips.${phaseId}`,
    { returnObjects: true, defaultValue: [] },
  );
  const tips: string[] = Array.isArray(tipsRaw) ? (tipsRaw as string[]) : [];

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <PlainHeader
          methodName={method?.name ?? "?"}
          phaseName={phaseName}
          exerciseLabel={exerciseLabel}
          totalAttempts={attempts.length}
          onBack={onBack}
          smartCubeConnected={hasSmartCube}
        />

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">{t("practice.scramble")}</span>
              <ScrambleDisplay
                scramble={currentScramble} displayScramble={displayScramble}
                states={hasSmartCube ? smartCube.validation.states : undefined}
                currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []}
                pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false}
                needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false}
              />
            </div>

            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface relative overflow-hidden">
              <AnimatePresence>
                {showVerdict && (
                  <VerdictOverlay timeDisplay={formatTime(stoppedTime)} tpsDisplay="--"
                    onCorrect={handleCorrect} onIncorrect={handleIncorrect} onSkip={handleSkip} />
                )}
              </AnimatePresence>
              <TimerContainer phase={phase} time={time} lastTime={null} hintCtx={hintCtx} onPress={press} onRelease={release} className="h-full" />
            </div>
          </div>

          <TouchAside title={t("practice.statsAndTips")}>
            {hasSmartCube && <MiniCube3DPanel className="shrink-0" />}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                <StatChip icon={Flame} label={t("practice.attempts")} value={`${attempts.length}`} />
                <StatChip icon={Clock} label={t("practice.best")} value={bestTime > 0 ? formatTime(bestTime) : "--"} />
                <StatChip icon={RotateCcw} label={t("practice.avg")} value={avgTime > 0 ? formatTime(avgTime) : "--"} />
                <StatChip icon={Target} label={t("practice.streak")} value={`${streak}`} />
              </div>
            </div>
            {tips.length > 0 && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center gap-2 mb-2"><Lightbulb className="size-3.5 text-caution" /><h4 className="text-[0.62rem] font-medium text-ink-2">{t("practice.tips")}</h4></div>
                <ul className="space-y-2">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[0.58rem] text-ink-3/80 leading-relaxed"><span className="text-caution/60 shrink-0 mt-0.5">•</span>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </TouchAside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function PlainHeader({
  methodName, phaseName, exerciseLabel, totalAttempts, onBack, smartCubeConnected,
}: {
  methodName: string; phaseName: string; exerciseLabel?: string;
  totalAttempts: number; onBack: () => void; smartCubeConnected: boolean;
}) {
  const { t } = useTranslation("training");
  return (
    <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <TrainingBreadcrumb onBack={onBack} segments={[{ label: methodName }, { label: phaseName, isCurrent: true }]} />
      {exerciseLabel && <span className="text-[0.62rem] font-medium text-ink-2 bg-surface-2 rounded-md px-2 py-0.5">{exerciseLabel}</span>}
      <span className="nums text-[0.62rem] text-ink-3 ml-auto">{t("practice.attemptsCount", { count: totalAttempts })}</span>
      {smartCubeConnected && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">{t("practice.smartCube")}</span>}
    </header>
  );
}
