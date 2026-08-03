"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import { EXERCISE_IDS } from "@cubeforge/training";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb, Eye, EyeOff } from "lucide-react";

export interface BlindPracticeViewProps {
  methodId: string; phaseId: string; phaseName: string; onBack: () => void;
}

export function BlindPracticeView({ methodId, phaseId, phaseName, onBack }: BlindPracticeViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: EXERCISE_IDS.blind(methodId, phaseId) });

  const [showScramble, setShowScramble] = useState(true);
  const [blindPhase, setBlindPhase] = useState<"idle" | "inspecting" | "solving">("idle");
  const blindTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) setBlindPhase("idle");
  }, [phase, stoppedTime]);

  const startInspection = useCallback(() => {
    setBlindPhase("inspecting"); setShowScramble(true);
    blindTimerRef.current = setTimeout(() => { setBlindPhase("solving"); setShowScramble(false); }, 15000);
  }, []);
  useEffect(() => { return () => { if (blindTimerRef.current) clearTimeout(blindTimerRef.current); }; }, []);

  const resetBlindState = useCallback(() => { setShowScramble(true); setBlindPhase("idle"); }, []);

  const localCorrect = useCallback(() => { handleCorrect(); resetBlindState(); }, [handleCorrect, resetBlindState]);
  const localIncorrect = useCallback(() => { handleIncorrect(); resetBlindState(); }, [handleIncorrect, resetBlindState]);
  const localSkip = useCallback(() => { handleSkip(); resetBlindState(); }, [handleSkip, resetBlindState]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <TrainingBreadcrumb onBack={onBack} segments={[{ label: method?.name ?? "?" }, { label: `${phaseName} · Blind`, isCurrent: true }]} />
          <span className="nums text-[0.62rem] text-ink-3 ml-auto">{attempts.length} attempts</span>
          {hasSmartCube && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">Smart Cube</span>}
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {blindPhase === "idle" && (
              <div className="shrink-0 rounded-xl border-2 border-caution/30 bg-caution/5 p-6 text-center">
                <EyeOff className="size-10 text-caution mx-auto mb-3" />
                <h3 className="text-[0.8rem] font-semibold text-ink mb-1">Blind {phaseName}</h3>
                <p className="text-[0.65rem] text-ink-3 mb-4">15 seconds to inspect, then the scramble is hidden. Solve without looking!</p>
                <button onClick={startInspection} className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors"><Eye className="size-4" /> Start Inspection (15s)</button>
              </div>
            )}
            {blindPhase === "inspecting" && (
              <div className="shrink-0 rounded-xl border-2 border-caution/30 bg-caution/5 p-4 text-center">
                <p className="text-[0.75rem] font-semibold text-caution animate-pulse">Memorizing... 15s remaining</p>
                <p className="text-[0.6rem] text-ink-3 mt-1">Scramble will be hidden when time is up</p>
              </div>
            )}
            {blindPhase === "solving" && (
              <div className="shrink-0 rounded-xl border-2 border-ready/30 bg-ready/5 p-4 text-center">
                <p className="text-[0.75rem] font-semibold text-ready">Scramble hidden — solve blind!</p>
                <p className="text-[0.6rem] text-ink-3 mt-1">Press space to start the timer</p>
              </div>
            )}
            {showScramble && blindPhase !== "solving" && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
                <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">Scramble</span>
                <ScrambleDisplay scramble={currentScramble} displayScramble={displayScramble}
                  states={hasSmartCube ? smartCube.validation.states : undefined} currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                  errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []} pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                  isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false} needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                  awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false} />
              </div>
            )}
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
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Memorize piece positions, not the scramble sequence</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Break the {phaseName.toLowerCase()} into 2-3 sub-goals</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Use a fixed solving order for consistency</li>
                <li className="flex gap-2"><span className="text-caution/60 shrink-0 mt-0.5">•</span>Practice with easier scrambles first</li>
              </ul>
            </div>
          </TouchAside>
        </div>
      </div>
    </div>
  );
}
