"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/solver-engine";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import {
  TrainingBreadcrumb,
  VerdictOverlay,
  StatChip,
} from "./components";
import {
  Target,
  Clock,
  Flame,
  RotateCcw,
  Lightbulb,
  Gauge,
  Eye,
  Zap,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type EOMode = "plain" | "detect" | "efficiency";

interface EOAttempt {
  id: string;
  mode: EOMode;
  timeMs: number;
  correct: boolean;
  badEdges?: number;
  timestamp: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2)
    : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

let _pid = 0;
function nextId(): string { return `eo-${++_pid}-${Date.now()}`; }

const EO_MODES: { id: EOMode; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "plain", label: "Plain", desc: "Standard EO execution", icon: Clock },
  { id: "detect", label: "Detection", desc: "Count bad edges before solving", icon: Eye },
  { id: "efficiency", label: "Efficiency", desc: "Minimize moves for EO", icon: Gauge },
];

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface EOPhasePracticeViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

export function EOPhasePracticeView({
  methodId,
  phaseId,
  phaseName,
  onBack,
}: EOPhasePracticeViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const [mode, setMode] = useState<EOMode>("plain");
  const [attempts, setAttempts] = useState<EOAttempt[]>([]);
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );
  const [badEdgeCount, setBadEdgeCount] = useState<number | null>(null);
  const [showEOGuide, setShowEOGuide] = useState(false);

  // ── Timer + Smart Cube ──────────────────────────────────────────────
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer();
  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  const smartCube = useDrillSmartCube({ engine, setupScramble: currentScramble });
  const hasSmartCube = smartCube.smartCubeConnected;

  const { recordAttempt: dbPersistAttempt } = useTrainingProgress();

  const [showVerdict, setShowVerdict] = useState(false);
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) {
      setShowVerdict(true);
    } else if (phase !== "stopped") {
      setShowVerdict(false);
    }
  }, [phase, stoppedTime]);

  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube,
    inspection: false,
    isScrambled: smartCube.validation.isScrambled,
  }), [hasSmartCube, smartCube.validation.isScrambled]);

  // ── Stats ──────────────────────────────────────────────────────────
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestTime = validAttempts.length > 0
    ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0
    ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;

  const perModeStats = useMemo(() => {
    const map = new Map<EOMode, { count: number; bestMs: number; avgMs: number }>();
    for (const m of EO_MODES) {
      const modeAttempts = validAttempts.filter((a) => a.mode === m.id);
      map.set(m.id, {
        count: modeAttempts.length,
        bestMs: modeAttempts.length > 0 ? Math.min(...modeAttempts.map((a) => a.timeMs)) : 0,
        avgMs: modeAttempts.length > 0
          ? modeAttempts.reduce((s, a) => s + a.timeMs, 0) / modeAttempts.length : 0,
      });
    }
    return map;
  }, [validAttempts]);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].correct) s++; else break;
    }
    return s;
  }, [attempts]);

  // ── Handlers ───────────────────────────────────────────────────────
  const recordAttempt = useCallback(
    (correct: boolean) => {
      setAttempts((prev) => [{
        id: nextId(),
        mode,
        timeMs: stoppedTime,
        correct,
        badEdges: badEdgeCount ?? undefined,
        timestamp: Date.now(),
      }, ...prev]);

      dbPersistAttempt({
        exerciseId: `eo-practice-${phaseId}`,
        methodId,
        phaseId,
        timeMs: stoppedTime,
        verdict: correct ? "correct" : "incorrect",
        playMode: hasSmartCube ? "smart-cube" : "manual",
        scramble: currentScramble,
      }).catch((err) => {
        console.error("[EOPhasePractice] Failed to persist:", err);
      });
    },
    [mode, stoppedTime, badEdgeCount, dbPersistAttempt, methodId, phaseId, hasSmartCube, currentScramble],
  );

  const regenerateScramble = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
    setBadEdgeCount(null);
  }, []);

  const handleCorrect = useCallback(() => {
    recordAttempt(true);
    reset();
    regenerateScramble();
  }, [recordAttempt, reset, regenerateScramble]);

  const handleIncorrect = useCallback(() => {
    recordAttempt(false);
    reset();
    regenerateScramble();
  }, [recordAttempt, reset, regenerateScramble]);

  const handleSkip = useCallback(() => {
    reset();
    regenerateScramble();
  }, [reset, regenerateScramble]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <EOHeader
          methodName={method?.name ?? "?"}
          phaseName={phaseName}
          mode={mode}
          modes={EO_MODES}
          onModeChange={setMode}
          totalAttempts={attempts.length}
          onBack={onBack}
          smartCubeConnected={hasSmartCube}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Left: Main area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Detection mode UI */}
            {mode === "detect" && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="size-4 text-ink-2" />
                  <span className="text-[0.7rem] font-semibold text-ink">Edge Detection Practice</span>
                </div>
                <p className="text-[0.62rem] text-ink-3 mb-3">
                  Before starting the timer, count how many bad edges are on the cube.
                  Bad edges are edges that can't be solved using only {method?.name === "Petrus" ? "<R, U>" : "<R, U, L, D>"} moves.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[0.62rem] font-medium text-ink-2">Bad edges:</span>
                  {[0, 2, 4, 6, 8, 10, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBadEdgeCount(n)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors",
                        badEdgeCount === n
                          ? "bg-ink text-surface"
                          : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-line",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Efficiency mode info */}
            {mode === "efficiency" && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="size-4 text-ink-2" />
                  <span className="text-[0.7rem] font-semibold text-ink">Efficient EO</span>
                </div>
                <p className="text-[0.62rem] text-ink-3 mb-3">
                  Focus on solving edge orientation in the fewest moves possible.
                  4 bad edges = optimal 4-5 moves. Take your time — speed will come with practice.
                </p>
                <button
                  onClick={() => setShowEOGuide((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[0.6rem] font-medium text-ink-3 hover:text-ink transition-colors"
                >
                  <Zap className="size-3" />
                  {showEOGuide ? "Hide EO guide" : "Show EO guide"}
                </button>
                {showEOGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 pt-3 border-t border-line"
                  >
                    <div className="grid grid-cols-2 gap-2 text-[0.58rem]">
                      <div className="rounded-md bg-surface-2 p-2">
                        <span className="font-medium text-ink-2">2 bad edges</span>
                        <p className="text-ink-3/70 mt-0.5">Place them in UF/UB or UL/UR, use M' U M'</p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-2">
                        <span className="font-medium text-ink-2">4 bad edges</span>
                        <p className="text-ink-3/70 mt-0.5">Most common case. M' U M' U2 M' U M'</p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-2">
                        <span className="font-medium text-ink-2">6 bad edges</span>
                        <p className="text-ink-3/70 mt-0.5">Same as 2 bad edges inverted: 6 bad = 2 good</p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-2">
                        <span className="font-medium text-ink-2">All bad (0/12)</span>
                        <p className="text-ink-3/70 mt-0.5">Rare but simple — just M' U M' repeated patterns</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Scramble display */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">
                Scramble
              </span>
              <ScrambleDisplay
                scramble={currentScramble}
                displayScramble={displayScramble}
                states={hasSmartCube ? smartCube.validation.states : undefined}
                currentIndex={hasSmartCube ? smartCube.validation.currentIndex : 0}
                errorMoves={hasSmartCube ? smartCube.validation.displayErrorMoves : []}
                pendingHalfDouble={hasSmartCube ? smartCube.validation.pendingHalfDouble : false}
                isScrambled={hasSmartCube ? smartCube.validation.isScrambled : false}
                needsReset={hasSmartCube ? smartCube.validation.needsReset : false}
                awaitingSolve={hasSmartCube ? smartCube.validation.awaitingSolve : false}
              />
            </div>

            {/* Timer area */}
            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface relative overflow-hidden">
              <AnimatePresence>
                {showVerdict && (
                  <VerdictOverlay
                    timeDisplay={formatTime(stoppedTime)}
                    tpsDisplay="--"
                    onCorrect={handleCorrect}
                    onIncorrect={handleIncorrect}
                    onSkip={handleSkip}
                  />
                )}
              </AnimatePresence>

              <TimerContainer
                phase={phase}
                time={time}
                lastTime={null}
                hintCtx={hintCtx}
                onPress={press}
                onRelease={release}
                className="h-full"
              />
            </div>
          </div>

          {/* Right: Sidebar */}
          <aside className="flex min-h-0 flex-col gap-4 lg:w-72 lg:shrink-0 overflow-hidden">
            {hasSmartCube && <MiniCube3DPanel className="shrink-0" />}

            {/* Per-mode stats */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <h3 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">
                Mode Breakdown
              </h3>
              <div className="space-y-2">
                {EO_MODES.map((m) => {
                  const stats = perModeStats.get(m.id);
                  const isActive = mode === m.id;
                  return (
                    <div key={m.id} className={cn(
                      "rounded-lg p-2.5 transition-colors",
                      isActive ? "bg-surface-2 ring-1 ring-ink/10" : "bg-surface-2/50",
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.6rem] font-medium text-ink-2">{m.label}</span>
                        <span className="nums text-[0.55rem] text-ink-3">
                          {stats?.count ?? 0} attempts
                        </span>
                      </div>
                      {stats && stats.count > 0 && (
                        <div className="flex gap-3 text-[0.55rem] text-ink-3/70">
                          <span>Best: {formatTime(stats.bestMs)}</span>
                          <span>Avg: {formatTime(stats.avgMs)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session stats */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
              <div className="grid grid-cols-2 gap-2">
                <StatChip icon={Flame} label="Attempts" value={`${attempts.length}`} />
                <StatChip icon={Clock} label="Best" value={bestTime > 0 ? formatTime(bestTime) : "--"} />
                <StatChip icon={RotateCcw} label="Avg" value={avgTime > 0 ? formatTime(avgTime) : "--"} />
                <StatChip icon={Target} label="Streak" value={`${streak}`} />
              </div>
            </div>

            {/* Tips */}
            <EOTips />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function EOHeader({
  methodName,
  phaseName,
  mode,
  modes,
  onModeChange,
  totalAttempts,
  onBack,
  smartCubeConnected,
}: {
  methodName: string;
  phaseName: string;
  mode: EOMode;
  modes: typeof EO_MODES;
  onModeChange: (m: EOMode) => void;
  totalAttempts: number;
  onBack: () => void;
  smartCubeConnected: boolean;
}) {
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="flex items-center gap-3">
        <TrainingBreadcrumb
          onBack={onBack}
          segments={[
            { label: methodName },
            { label: phaseName, isCurrent: true },
          ]}
        />
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">
          {totalAttempts} attempts
        </span>
        {smartCubeConnected && (
          <span className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400">
            Smart Cube
          </span>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
              mode === m.id
                ? "bg-ink text-surface"
                : "text-ink-3 hover:text-ink hover:bg-surface-2",
            )}
            title={m.desc}
          >
            <m.icon className="size-3" />
            {m.label}
            {mode === m.id && (
              <motion.div
                layoutId="eo-mode-active"
                className="absolute inset-0 rounded-md bg-ink -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tips Panel
   ─────────────────────────────────────────────────────────────────────── */

function EOTips() {
  const tips = [
    "Bad edges are edges that require F or B moves to orient",
    "Count bad edges: look at U/D stickers and F/B stickers",
    "Only M/M' and U moves are needed for EO in Roux/Petrus",
    "4 bad edges is most common — practice this case the most",
    "Aim for EO in < 1.5s with ≤ 7 moves",
  ];

  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-caution" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">EO Tips</h4>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2 text-[0.58rem] text-ink-3/80 leading-relaxed">
            <span className="text-caution/60 shrink-0 mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
