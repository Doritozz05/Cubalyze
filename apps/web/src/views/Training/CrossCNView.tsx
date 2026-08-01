"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb, Palette } from "lucide-react";

export interface CrossCNViewProps {
  methodId: string; phaseId: string; phaseName: string; onBack: () => void;
}

export function CrossCNView({ methodId, phaseId, phaseName, onBack }: CrossCNViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    regenerateScramble, currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: `cn-${phaseId}` });

  const [crossColor, setCrossColor] = useState(() => cnColors[Math.floor(Math.random() * cnColors.length)]);

  const localRegenerate = useCallback(() => {
    regenerateScramble();
    setCrossColor(cnColors[Math.floor(Math.random() * cnColors.length)]);
  }, [regenerateScramble]);

  const localCorrect = useCallback(() => { handleCorrect(); localRegenerate(); }, [handleCorrect, localRegenerate]);
  const localIncorrect = useCallback(() => { handleIncorrect(); localRegenerate(); }, [handleIncorrect, localRegenerate]);
  const localSkip = useCallback(() => { handleSkip(); localRegenerate(); }, [handleSkip, localRegenerate]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb onBack={onBack} segments={[{ label: method?.name ?? "?" }, { label: `${phaseName} · ${crossColor}`, isCurrent: true }]} />
          <span className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border border-purple-500/20 bg-purple-500/5 text-purple-400">{crossColor} cross</span>
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">{attempts.length} attempts</span>
          {hasSmartCube && <span className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400">Smart Cube</span>}
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-2"><Palette className="size-4 text-ink-2" /><span className="text-[0.7rem] font-semibold text-ink">Color-Neutral · {crossColor}</span></div>
              <p className="text-[0.62rem] text-ink-3">Solve the cross on {crossColor}. Changes with each new scramble.</p>
              <button onClick={localRegenerate} className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.62rem] font-medium bg-surface-2 text-ink-2 hover:bg-line hover:text-ink transition-colors">
                <Palette className="size-3" />New color & scramble
              </button>
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
                {showVerdict && <VerdictOverlay timeDisplay={formatTime(stoppedTime)} tpsDisplay="--" onCorrect={localCorrect} onIncorrect={localIncorrect} onSkip={localSkip} />}
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
              <div className="flex items-center gap-2 mb-2"><Lightbulb className="size-3.5 text-caution" /><h4 className="text-[0.62rem] font-medium text-ink-2">CN Tips</h4></div>
              <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Start with opposite color pairs (white/yellow)</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Red and orange are next easiest</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Dedicate full sessions to one new color</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>CN saves ~0.5s per solve on average</li>
              </ul>
            </div>
          </TouchAside>
        </div>
      </div>
    </div>
  );
}

const cnColors = ["White", "Yellow", "Red", "Orange", "Blue", "Green"];
