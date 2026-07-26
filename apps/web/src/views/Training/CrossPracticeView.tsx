"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Eye,
  EyeOff,
  Lightbulb,
  MoveHorizontal,
  Shuffle,
  Palette,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type CrossMode = "plain" | "blind" | "optimal" | "cn";

interface CrossAttempt {
  id: string;
  mode: CrossMode;
  timeMs: number;
  correct: boolean;
  moves?: number;
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
function nextId(): string { return `cross-${++_pid}-${Date.now()}`; }

const CROSS_COLORS = ["White", "Yellow", "Red", "Orange", "Blue", "Green"];

const CROSS_MODES: { id: CrossMode; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "plain", label: "Plain", desc: "Standard timed cross execution", icon: Clock },
  { id: "blind", label: "Blind", desc: "Inspect 15s, then solve cross blindfolded", icon: EyeOff },
  { id: "optimal", label: "Optimal", desc: "Solve cross in ≤ 8 moves", icon: MoveHorizontal },
  { id: "cn", label: "CN", desc: "Random cross color each attempt", icon: Palette },
];

function pickRandomCrossColor(): string {
  return CROSS_COLORS[Math.floor(Math.random() * CROSS_COLORS.length)];
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface CrossPracticeViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

export function CrossPracticeView({
  methodId,
  phaseId,
  phaseName,
  onBack,
}: CrossPracticeViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const [mode, setMode] = useState<CrossMode>("plain");
  const [attempts, setAttempts] = useState<CrossAttempt[]>([]);
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );
  const [crossColor, setCrossColor] = useState("White");
  const [showScramble, setShowScramble] = useState(true);
  const [blindInspectPhase, setBlindInspectPhase] = useState<"idle" | "inspecting" | "solving">("idle");
  const [optimalMoves, setOptimalMoves] = useState<number | null>(null);
  const blindTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer + Smart Cube ──────────────────────────────────────────────
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer();
  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  const smartCube = useDrillSmartCube({ engine, setupScramble: currentScramble });
  const hasSmartCube = smartCube.smartCubeConnected;

  // ── DB persistence ──────────────────────────────────────────────────
  const { recordAttempt: dbPersistAttempt } = useTrainingProgress();

  // Verdict overlay trigger
  const [showVerdict, setShowVerdict] = useState(false);
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) {
      setShowVerdict(true);
      setBlindInspectPhase("idle");
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

  // ── Blind mode inspection ──────────────────────────────────────────
  const startBlindInspect = useCallback(() => {
    setBlindInspectPhase("inspecting");
    setShowScramble(true);
    blindTimerRef.current = setTimeout(() => {
      setBlindInspectPhase("solving");
      setShowScramble(false);
    }, 15000); // 15s inspection
  }, []);

  useEffect(() => {
    return () => { if (blindTimerRef.current) clearTimeout(blindTimerRef.current); };
  }, []);

  // ── CN mode ────────────────────────────────────────────────────────
  const regenerateScramble = useCallback(() => {
    if (mode === "cn") {
      setCrossColor(pickRandomCrossColor());
    }
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
    setShowScramble(true);
    setBlindInspectPhase("idle");
    setOptimalMoves(null);
  }, [mode]);

  // ── Stats ──────────────────────────────────────────────────────────
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestTime = validAttempts.length > 0
    ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0
    ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;

  const perModeStats = useMemo(() => {
    const map = new Map<CrossMode, { count: number; bestMs: number; avgMs: number }>();
    for (const m of CROSS_MODES) {
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
    (correct: boolean, moves?: number) => {
      const attempt: CrossAttempt = {
        id: nextId(),
        mode,
        timeMs: stoppedTime,
        correct,
        moves,
        timestamp: Date.now(),
      };
      setAttempts((prev) => [attempt, ...prev]);

      dbPersistAttempt({
        exerciseId: `cross-practice-${phaseId}`,
        methodId,
        phaseId,
        timeMs: stoppedTime,
        verdict: correct ? "correct" : "incorrect",
        playMode: hasSmartCube ? "smart-cube" : "manual",
        scramble: currentScramble,
      }).catch((err) => {
        console.error("[CrossPractice] Failed to persist:", err);
      });
    },
    [mode, stoppedTime, dbPersistAttempt, methodId, phaseId, hasSmartCube, currentScramble],
  );

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

  const handleStartBlind = useCallback(() => {
    startBlindInspect();
    // Don't start timer yet - user starts when ready
  }, [startBlindInspect]);

  // ── Optimal mode: show move counter ──────────────────────────────────
  const moveInputRef = useRef<HTMLInputElement>(null);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <CrossHeader
          methodName={method?.name ?? "?"}
          phaseName={phaseName}
          mode={mode}
          modes={CROSS_MODES}
          onModeChange={(m) => { setMode(m); setBlindInspectPhase("idle"); setShowScramble(true); }}
          totalAttempts={attempts.length}
          onBack={onBack}
          smartCubeConnected={hasSmartCube}
          crossColor={mode === "cn" ? crossColor : undefined}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Left: Main area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Blind mode inspection UI */}
            {mode === "blind" && blindInspectPhase === "idle" && (
              <div className="shrink-0 rounded-xl border-2 border-caution/30 bg-caution/5 p-6 text-center">
                <EyeOff className="size-10 text-caution mx-auto mb-3" />
                <h3 className="text-[0.8rem] font-semibold text-ink mb-1">Blind Cross Practice</h3>
                <p className="text-[0.65rem] text-ink-3 mb-4">
                  You'll get 15 seconds to inspect the scramble, then the cross color will be hidden.
                  Solve without looking!
                </p>
                <button
                  onClick={handleStartBlind}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors"
                >
                  <Eye className="size-4" /> Start Inspection (15s)
                </button>
              </div>
            )}

            {mode === "blind" && blindInspectPhase === "inspecting" && (
              <div className="shrink-0 rounded-xl border-2 border-caution/30 bg-caution/5 p-4 text-center">
                <p className="text-[0.75rem] font-semibold text-caution animate-pulse">
                  Memorizing... {Math.ceil(15)}s remaining
                </p>
                <p className="text-[0.6rem] text-ink-3 mt-1">The scramble will disappear when time is up</p>
              </div>
            )}

            {mode === "blind" && blindInspectPhase === "solving" && (
              <div className="shrink-0 rounded-xl border-2 border-ready/30 bg-ready/5 p-4 text-center">
                <p className="text-[0.75rem] font-semibold text-ready">Scramble hidden — solve blind!</p>
                <p className="text-[0.6rem] text-ink-3 mt-1">Press space to start the timer</p>
              </div>
            )}

            {/* Optimal mode info */}
            {mode === "optimal" && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MoveHorizontal className="size-4 text-ink-2" />
                  <span className="text-[0.7rem] font-semibold text-ink">Optimal Cross Challenge</span>
                </div>
                <p className="text-[0.62rem] text-ink-3">
                  Aim to solve the cross in ≤ 8 moves. Efficiency over speed — plan your solution before starting!
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[0.6rem] text-ink-3">How many moves did you use?</span>
                  <input
                    ref={moveInputRef}
                    type="number"
                    min={0}
                    max={20}
                    defaultValue={8}
                    className="nums w-16 rounded-md border border-line bg-surface-2 px-2 py-1 text-[0.7rem] text-ink text-center"
                    placeholder="8"
                    onChange={(e) => setOptimalMoves(parseInt(e.target.value, 10) || null)}
                  />
                </div>
              </div>
            )}

            {/* Scramble display (hidden in blind solving phase) */}
            {showScramble && blindInspectPhase !== "solving" && (
              <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
                <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">
                  Scramble{mode === "cn" ? ` (${crossColor} cross)` : ""}
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
            )}

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
                {CROSS_MODES.map((m) => {
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
            <CrossTips phaseName={phaseName} mode={mode} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function CrossHeader({
  methodName,
  phaseName,
  mode,
  modes,
  onModeChange,
  totalAttempts,
  onBack,
  smartCubeConnected,
  crossColor,
}: {
  methodName: string;
  phaseName: string;
  mode: CrossMode;
  modes: typeof CROSS_MODES;
  onModeChange: (m: CrossMode) => void;
  totalAttempts: number;
  onBack: () => void;
  smartCubeConnected: boolean;
  crossColor?: string;
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
        {crossColor && (
          <span className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border border-purple-500/20 bg-purple-500/5 text-purple-400">
            {crossColor} cross
          </span>
        )}
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
                layoutId="cross-mode-active"
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

function CrossTips({ phaseName: _phaseName, mode }: { phaseName: string; mode: CrossMode }) {
  void _phaseName;
  const tips: Record<CrossMode, string[]> = {
    plain: [
      "Always solve cross on bottom (D face) for better lookahead",
      "Plan your entire cross during inspection — don't improvise",
      "Aim for 8 moves or fewer for an efficient cross",
      "Track your first F2L pair while solving the cross",
    ],
    blind: [
      "Memorize piece positions, not the scramble sequence",
      "Break the cross into 2-3 sub-goals",
      "Use a fixed solving order (e.g., DL → DR → DF → DB)",
      "Practice with easier scrambles first (≤ 6 move crosses)",
    ],
    optimal: [
      "Count your moves — efficiency beats speed at this stage",
      "A ≤ 8 move cross is the gold standard",
      "Use your inspection to find the optimal solution",
      "If you need > 10 moves, you missed a better solution",
    ],
    cn: [
      "Start with opposite color pairs (white/yellow first)",
      "Red and orange are the next easiest to add",
      "Blue and green are the hardest — practice them last",
      "Dedicate full sessions to a single new color",
    ],
  };

  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-caution" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">Tips</h4>
      </div>
      <ul className="space-y-2">
        {tips[mode].map((tip, i) => (
          <li key={i} className="flex gap-2 text-[0.58rem] text-ink-3/80 leading-relaxed">
            <span className="text-caution/60 shrink-0 mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
