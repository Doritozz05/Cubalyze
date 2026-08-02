"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb, MoveHorizontal } from "lucide-react";

export interface CrossOptimalViewProps {
  methodId: string; phaseId: string; phaseName: string; onBack: () => void;
}

export function CrossOptimalView({ methodId, phaseId, phaseName, onBack }: CrossOptimalViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: `optimal-${phaseId}` });

  const [userMoves, setUserMoves] = useState<number | null>(null);
  const underLimit = userMoves !== null && userMoves <= 8;

  const localCorrect = useCallback(() => { handleCorrect(); setUserMoves(null); }, [handleCorrect]);
  const localIncorrect = useCallback(() => { handleIncorrect(); setUserMoves(null); }, [handleIncorrect]);
  const localSkip = useCallback(() => { handleSkip(); setUserMoves(null); }, [handleSkip]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb onBack={onBack} segments={[{ label: method?.name ?? "?" }, { label: `${phaseName} · ≤8`, isCurrent: true }]} />
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">{attempts.length} attempts</span>
          {hasSmartCube && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">Smart Cube</span>}
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-2"><MoveHorizontal className="size-4 text-ink-2" /><span className="text-[0.7rem] font-semibold text-ink">Optimal {phaseName} (≤8 moves)</span></div>
              <p className="text-[0.62rem] text-ink-3 mb-3">Focus on efficiency. Plan your entire cross before starting. Enter your move count after each attempt.</p>
              <div className="flex items-center gap-2 text-[0.62rem]">
                <span className="text-ink-3">Your move count:</span>
                <input type="number" min={0} max={20} value={userMoves ?? ""} onChange={(e) => setUserMoves(parseInt(e.target.value, 10) || null)}
                  className="nums w-14 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] text-ink text-center" placeholder="8" />
                {userMoves !== null && (
                  <span className={cn("text-[0.65rem] font-semibold", underLimit ? "text-ready" : "text-hold")}>
                    {underLimit ? `${8 - userMoves} under limit` : `${userMoves - 8} over limit`}
                  </span>
                )}
              </div>
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
              <div className="flex items-center gap-2 mb-2"><Lightbulb className="size-3.5 text-caution" /><h4 className="text-[0.62rem] font-medium text-ink-2">Tips</h4></div>
              <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Plan your entire solution during inspection</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>World-class crosses are ≤ 6 moves</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Speed comes from efficiency, not rushing</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>If you need &gt;10 moves, look for a better solution</li>
              </ul>
            </div>
          </TouchAside>
        </div>
      </div>
    </div>
  );
}
