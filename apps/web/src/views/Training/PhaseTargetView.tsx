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
  Lightbulb,
  ChevronRight,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type PhaseTargetMode = "plain" | "xcross" | "cn" | "blind" | "transition";

interface PhaseAttempt {
  id: string;
  mode: PhaseTargetMode;
  timeMs: number;
  correct: boolean;
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
function nextId(): string { return `phase-${++_pid}-${Date.now()}`; }

/** Mode definitions per phase type */
function getPhaseModes(
  _methodId: string,
  _phaseId: string,
): { id: PhaseTargetMode; label: string; desc: string }[] {
  return [
    { id: "plain", label: "Plain", desc: "Standard execution" },
    { id: "blind", label: "Blind", desc: "Inspect then solve blind" },
    { id: "cn", label: "CN", desc: "Color-Neutral practice" },
    { id: "transition", label: "Transition", desc: "Focus on phase transition" },
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface PhaseTargetViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

export function PhaseTargetView({
  methodId,
  phaseId,
  phaseName,
  onBack,
}: PhaseTargetViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const phaseModes = useMemo(() => getPhaseModes(methodId, phaseId), [methodId, phaseId]);

  const [trainerMode, setTrainerMode] = useState<PhaseTargetMode>("plain");
  const [attempts, setAttempts] = useState<PhaseAttempt[]>([]);
  const [showOptimal, setShowOptimal] = useState(false);
  const [currentScramble, setCurrentScramble] = useState(
    () => RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );

  // ── Timer + Smart Cube (same infrastructure as DrillView) ───────────
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer();

  const { remapScramble, orientation: _orientation } = useOrientation();
  void _orientation;

  const smartCube = useDrillSmartCube({
    engine,
    setupScramble: currentScramble,
  });

  const hasSmartCube = smartCube.smartCubeConnected;
  const displayScramble = remapScramble(currentScramble);

  // Verdict overlay trigger
  const [showVerdict, setShowVerdict] = useState(false);
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) {
      setShowVerdict(true);
    } else if (phase !== "stopped") {
      setShowVerdict(false);
    }
  }, [phase, stoppedTime]);

  // Timer hint context
  const hintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube,
    inspection: false,
    isScrambled: smartCube.validation.isScrambled,
  }), [hasSmartCube, smartCube.validation.isScrambled]);

  // ── Stats ──────────────────────────────────────────────────────────
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestAttempt = validAttempts.length > 0
    ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0
    ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;

  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].timeMs > 0) s++; else break;
    }
    return s;
  }, [attempts]);

  // ── Handlers ───────────────────────────────────────────────────────
  const recordAttempt = useCallback((correct: boolean) => {
    setAttempts((prev) => [{
      id: nextId(),
      mode: trainerMode,
      timeMs: stoppedTime,
      correct,
      timestamp: Date.now(),
    }, ...prev]);
  }, [trainerMode, stoppedTime]);

  const handleCorrect = useCallback(() => {
    recordAttempt(true);
    reset();
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
  }, [recordAttempt, reset]);

  const handleIncorrect = useCallback(() => {
    recordAttempt(false);
    reset();
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
  }, [recordAttempt, reset]);

  const handleSkip = useCallback(() => {
    reset();
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
  }, [reset]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <PhaseTargetHeader
          methodName={method?.name ?? "?"}
          phaseName={phaseName}
          trainerMode={trainerMode}
          phaseModes={phaseModes}
          onModeChange={setTrainerMode}
          totalAttempts={attempts.length}
          onBack={onBack}
          smartCubeConnected={hasSmartCube}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Left: Scramble + Timer */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
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
            <div className="flex-1 min-h-45 rounded-xl border border-line bg-surface relative overflow-hidden">
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

          {/* Right: Mini 3D Cube + Stats */}
          <div className="flex min-h-0 flex-col gap-4 lg:w-80 lg:shrink-0 overflow-hidden">
            {/* Mini 3D Cube */}
            {hasSmartCube && (
              <MiniCube3DPanel className="shrink-0" />
            )}

            {/* Metrics panel */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4 space-y-3">
              <h3 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">
                Metrics
              </h3>

              {validAttempts.length === 0 ? (
                <p className="text-[0.62rem] text-ink-3/50 text-center py-2">
                  Complete an attempt to see metrics
                </p>
              ) : (
                <>
                  <MetricRow label="Best time" value={formatTime(bestAttempt)} />
                  <MetricRow label="Avg time" value={formatTime(avgTime)} />
                  <MetricRow label="Streak" value={`${streak}`} />

                  <button
                    onClick={() => setShowOptimal((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 text-[0.6rem] font-medium transition-colors w-full",
                      showOptimal ? "text-ink" : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    <Eye className="size-3" />
                    {showOptimal ? "Hide tips" : "Show tips"}
                  </button>

                  {showOptimal && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="rounded-lg bg-surface-2 p-2.5"
                    >
                      <p className="nums text-[0.62rem] text-ink-2/80 leading-relaxed">
                        Practice inspection planning. Focus on efficiency — fewer moves
                        means faster solves. Track your times to measure improvement.
                      </p>
                    </motion.div>
                  )}

                  <button className="flex items-center gap-1.5 text-[0.6rem] font-medium text-ink-3 hover:text-ink-2 transition-colors w-full">
                    <Lightbulb className="size-3" />
                    AI Hint
                  </button>
                </>
              )}
            </div>

            {/* Session stats + recent */}
            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
              <SessionStatsPanel
                attempts={validAttempts.length}
                avgTime={avgTime}
                bestTime={bestAttempt}
              />
              <RecentAttemptsPanel
                attempts={attempts.slice(0, 15)}
                phaseModes={phaseModes}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function PhaseTargetHeader({
  methodName,
  phaseName,
  trainerMode,
  phaseModes,
  onModeChange,
  totalAttempts,
  onBack,
  smartCubeConnected,
}: {
  methodName: string;
  phaseName: string;
  trainerMode: PhaseTargetMode;
  phaseModes: { id: PhaseTargetMode; label: string; desc: string }[];
  onModeChange: (m: PhaseTargetMode) => void;
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
        {phaseModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
              trainerMode === mode.id
                ? "bg-ink text-surface"
                : "text-ink-3 hover:text-ink hover:bg-surface-2",
            )}
            title={mode.desc}
          >
            {mode.label}
            {trainerMode === mode.id && (
              <motion.div
                layoutId="phase-target-mode-active"
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
   Sub-components
   ─────────────────────────────────────────────────────────────────────── */

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.6rem] text-ink-3">{label}</span>
      <span className={cn("nums text-[0.68rem] font-medium", color ?? "text-ink")}>
        {value}
      </span>
    </div>
  );
}

function SessionStatsPanel({
  attempts,
  avgTime,
  bestTime,
}: {
  attempts: number;
  avgTime: number;
  bestTime: number;
}) {
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Flame} label="Attempts" value={`${attempts}`} />
        <StatChip
          icon={Clock}
          label="Best"
          value={bestTime > 0 ? formatTime(bestTime) : "--"}
        />
        <StatChip icon={RotateCcw} label="Avg" value={avgTime > 0 ? formatTime(avgTime) : "--"} />
        <StatChip icon={Target} label="Phase" value={"--"} />
      </div>
    </div>
  );
}

function RecentAttemptsPanel({
  attempts,
  phaseModes,
}: {
  attempts: PhaseAttempt[];
  phaseModes: { id: string; label: string }[];
}) {
  if (attempts.length === 0) {
    return (
      <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">
          Recent Attempts
        </h4>
        <p className="text-[0.6rem] text-ink-3/50 text-center py-4">
          Complete a drill to see results here
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface flex flex-col overflow-hidden">
      <div className="shrink-0 p-3 pb-2">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">
          Recent
        </h4>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {attempts.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-surface-2/50"
          >
            <span className="text-[0.55rem] text-ink-3 shrink-0 w-8">
              {phaseModes.find((m) => m.id === a.mode)?.label ?? a.mode}
            </span>
            <span className="nums text-[0.62rem] text-ink font-medium">
              {formatTime(a.timeMs)}
            </span>
            <ChevronRight className="size-3 text-ink-3/30 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
