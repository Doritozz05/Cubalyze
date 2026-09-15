"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubalyze/algorithm-db";
import { EXERCISE_IDS } from "@cubalyze/training";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb, Eye } from "lucide-react";

export interface EODetectViewProps {
  methodId: string; phaseId: string; phaseName: string; onBack: () => void;
}

export function EODetectView({ methodId, phaseId, phaseName, onBack }: EODetectViewProps) {
  const { t, i18n } = useTranslation("training");
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const [badEdges, setBadEdges] = useState<number | null>(null);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  // EO Detect is a recognition-type exercise — attempts must never dilute the
  // execution accuracy of drill/plain practice for the same phase.
  } = usePracticeSession({ methodId, phaseId, exerciseId: EXERCISE_IDS.eoDetect(methodId, phaseId), metricKind: "recognition" });

  const localCorrect = useCallback(() => { handleCorrect(); setBadEdges(null); }, [handleCorrect]);
  const localIncorrect = useCallback(() => { handleIncorrect(); setBadEdges(null); }, [handleIncorrect]);
  const localSkip = useCallback(() => { handleSkip(); setBadEdges(null); }, [handleSkip]);

  const tipsRaw = (i18n.t as (key: string, options?: object) => unknown)(
    "training:eoDetect.tips",
    { returnObjects: true, defaultValue: [] },
  );
  const tips: string[] = Array.isArray(tipsRaw) ? (tipsRaw as string[]) : [];

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb onBack={onBack} segments={[{ label: method?.name ?? "?" }, { label: `${phaseName} · ${t("eoDetect.detect")}`, isCurrent: true }]} />
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">{t("practice.attemptsCount", { count: attempts.length })}</span>
          {hasSmartCube && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">{t("practice.smartCube")}</span>}
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3"><Eye className="size-4 text-ink-2" /><span className="text-[0.7rem] font-semibold text-ink">{t("eoDetect.edgeDetection")}</span></div>
              <p className="text-[0.62rem] text-ink-3 mb-3">{t("eoDetect.instruction")}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.62rem] font-medium text-ink-2">{t("eoDetect.badEdgesLabel")}</span>
                {[0, 2, 4, 6, 8, 10, 12].map((n) => (
                  <button key={n} onClick={() => setBadEdges(n)} className={cn("rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors",
                    badEdges === n ? "bg-ink text-surface" : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-line")}>{n}</button>
                ))}
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">{t("practice.scramble")}</span>
              <ScrambleDisplay scramble={currentScramble} displayScramble={displayScramble}
                smartCubeConnected={hasSmartCube}
                states={hasSmartCube ? smartCube.validation.states : undefined} currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []} pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false} needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false} />
            </div>

            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface relative overflow-hidden">
              <AnimatePresence>
                {showVerdict && <VerdictOverlay timeDisplay={formatTime(stoppedTime)} tpsDisplay="--" onCorrect={localCorrect} onIncorrect={localIncorrect} onSkip={localSkip} />}
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
                <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>{tip}</li>
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
