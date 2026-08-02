"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb, ArrowRightLeft, ArrowUp, MoveVertical } from "lucide-react";

type LSESubPhase = "eo" | "ulur" | "mslice";

const SUB_INFO: Record<LSESubPhase, { label: string; icon: React.ElementType; tips: string[] }> = {
  eo: {
    label: "EO", icon: ArrowRightLeft,
    tips: ["Look at U and D faces to determine orientation", "'Good' edges are oriented — count them first", "Use M' U M' to flip edges efficiently", "4 bad edges is the most common case"],
  },
  ulur: {
    label: "UL/UR", icon: ArrowUp,
    tips: ["Place UL and UR edges using M2 and U moves", "Only 3 cases for UL/UR placement", "Learn to recognize from the BU sticker", "Aim for < 8 moves in this sub-step"],
  },
  mslice: {
    label: "M-Slice", icon: MoveVertical,
    tips: ["Only 4 edges remain in the M-slice", "Use U2 M2 U2 and similar patterns", "Only 4 possible permutations", "This should be the fastest sub-step"],
  },
};

export interface LSESubPhaseViewProps {
  methodId: string; phaseId: string; phaseName: string; subPhase: LSESubPhase; onBack: () => void;
}

export function LSESubPhaseView({ methodId, phaseId, phaseName, subPhase, onBack }: LSESubPhaseViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const info = SUB_INFO[subPhase];
  const Icon = info.icon;

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: `lse-${subPhase}-${phaseId}` });

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb onBack={onBack} segments={[{ label: method?.name ?? "?" }, { label: `${phaseName} · ${info.label}`, isCurrent: true }]} />
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">{attempts.length} attempts</span>
          {hasSmartCube && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">Smart Cube</span>}
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-2"><Icon className="size-4 text-ink-2" /><span className="text-[0.7rem] font-semibold text-ink">LSE: {info.label} Focus</span></div>
              <p className="text-[0.62rem] text-ink-3">Practice only the {info.label} sub-step of LSE in isolation.</p>
            </div>

            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">Scramble</span>
              <ScrambleDisplay scramble={currentScramble} displayScramble={displayScramble}
                states={hasSmartCube ? smartCube.validation.states : undefined} currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []} pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false} needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false} />
            </div>

            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface relative overflow-hidden">
              <AnimatePresence>
                {showVerdict && <VerdictOverlay timeDisplay={formatTime(stoppedTime)} tpsDisplay="--" onCorrect={handleCorrect} onIncorrect={handleIncorrect} onSkip={handleSkip} />}
              </AnimatePresence>
              <TimerContainer phase={phase} time={time} lastTime={null} hintCtx={hintCtx} onPress={press} onRelease={release} className="h-full" />
            </div>
          </div>

          <TouchAside title="Stats & Tips">
            {hasSmartCube && <MiniCube3DPanel className="shrink-0" />}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                <StatChip icon={Flame} label="Attempts" value={`${attempts.length}`} />
                <StatChip icon={Clock} label="Best" value={bestTime > 0 ? formatTime(bestTime) : "--"} />
                <StatChip icon={RotateCcw} label="Avg" value={avgTime > 0 ? formatTime(avgTime) : "--"} />
                <StatChip icon={Target} label="Streak" value={`${streak}`} />
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 mb-2"><Lightbulb className="size-3.5 text-caution" /><h4 className="text-[0.62rem] font-medium text-ink-2">Tips</h4></div>
              <ul className="space-y-2">
                {info.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-[0.58rem] text-ink-3/80 leading-relaxed"><span className="text-caution/60 shrink-0 mt-0.5">•</span>{tip}</li>
                ))}
              </ul>
            </div>
          </TouchAside>
        </div>
      </div>
    </div>
  );
}
