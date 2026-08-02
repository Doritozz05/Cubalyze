"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import { usePracticeSession, formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb, VerdictOverlay, StatChip, TouchAside } from "./components";
import { Target, Clock, Flame, RotateCcw, Lightbulb } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Tips per phase
   ─────────────────────────────────────────────────────────────────────── */

const PHASE_TIPS: Record<string, string[]> = {
  cross: [
    "Always solve cross on bottom (D face) for better lookahead",
    "Plan your entire cross during inspection — don't improvise",
    "Aim for 8 moves or fewer for an efficient cross",
    "Track your first F2L pair while solving the cross",
  ],
  eoline: [
    "Count bad edges before starting — know your EO case",
    "Place the line edges while orienting — combine steps",
    "Use only R, U, L, D moves after EO is done",
    "Plan both EO and line during inspection",
  ],
  "first-block": [
    "Build a 1×2×3 block on the left side",
    "Use R, U, r, u moves for efficient block building",
    "Look for pre-formed pairs during inspection",
    "Don't restrict yourself — use the whole cube",
  ],
  "second-block": [
    "Build the right 1×2×3 block efficiently",
    "Use only R, U, r, M moves to preserve the first block",
    "Track your next pair while inserting the current one",
    "Aim to solve each pair in ≤ 8 moves",
  ],
  "block-222": [
    "Build a 2×2×2 block in any corner — full freedom",
    "Look for pre-formed pairs or a 1×1×2 block",
    "Don't lock into one face — use the whole cube",
    "Aim for ≤ 5 moves for the 2×2×2 block",
  ],
  "block-223": [
    "Extend your 2×2×2 to a 2×2×3 block",
    "Use the freedom of the unsolved side",
    "Look for easy pairs to attach to the 2×2×2",
    "Plan your extension during inspection",
  ],
  lse: [
    "LSE should take ~2-3 seconds at advanced level",
    "Use M and U moves only — no cube rotations",
    "EO → UL/UR placement → M-slice permutation",
    "Target: EO in < 1s, UL/UR in < 1s, M-slice in < 0.5s",
  ],
  "eo-petrus": [
    "Bad edges are edges that require F or B moves",
    "4 bad edges is the most common case — drill it",
    "Use M' U M' patterns to flip edges efficiently",
    "Aim for EO in < 1.5s with ≤ 7 moves",
  ],
};

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface PlainPracticeViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
  exerciseLabel?: string;
}

export function PlainPracticeView({
  methodId, phaseId, phaseName, onBack, exerciseLabel,
}: PlainPracticeViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const {
    phase, time, stoppedTime, press, release,
    displayScramble, hasSmartCube, smartCube, hintCtx,
    showVerdict, attempts, bestTime, avgTime, streak,
    handleCorrect, handleIncorrect, handleSkip,
    currentScramble,
  } = usePracticeSession({ methodId, phaseId, exerciseId: `plain-${phaseId}` });

  const tips = PHASE_TIPS[phaseId] ?? PHASE_TIPS["cross"];

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
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">Scramble</span>
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
                {tips.map((tip, i) => (
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

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function PlainHeader({
  methodName, phaseName, exerciseLabel, totalAttempts, onBack, smartCubeConnected,
}: {
  methodName: string; phaseName: string; exerciseLabel?: string;
  totalAttempts: number; onBack: () => void; smartCubeConnected: boolean;
}) {
  return (
    <header className="flex items-center gap-3 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <TrainingBreadcrumb onBack={onBack} segments={[{ label: methodName }, { label: phaseName, isCurrent: true }]} />
      {exerciseLabel && <span className="text-[0.62rem] font-medium text-ink-2 bg-surface-2 rounded-md px-2 py-0.5">{exerciseLabel}</span>}
      <span className="nums text-[0.62rem] text-ink-3 ml-auto">{totalAttempts} attempts</span>
      {smartCubeConnected && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">Smart Cube</span>}
    </header>
  );
}
