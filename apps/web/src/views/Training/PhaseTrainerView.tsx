"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { METHODS } from "@cubeforge/algorithm-db";
import {
  ArrowLeft, Target, Clock, Cpu, Hand, Flame, RotateCcw,
  Eye, Lightbulb, ChevronRight,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type PhaseTrainerMode = "plain" | "xcross" | "cn" | "blind" | "transition";

interface PhaseAttempt {
  id: string;
  mode: PhaseTrainerMode;
  timeMs: number;
  movesCount: number;
  optimalMoves: number;
  inspectionMs: number;
  tps: number;
  timestamp: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

let _pid = 0;
function nextId(): string { return `phase-${++_pid}-${Date.now()}`; }

const PHASE_MODES: { id: PhaseTrainerMode; label: string; desc: string }[] = [
  { id: "plain", label: "Plain", desc: "Standard cross solve" },
  { id: "xcross", label: "X-Cross", desc: "Cross + 1 F2L pair" },
  { id: "cn", label: "CN", desc: "Color-Neutral cross" },
  { id: "blind", label: "Blind", desc: "Inspect then solve blind" },
  { id: "transition", label: "Transition", desc: "Cross → F2L pause" },
];

/* ── Mock scramble ──────────────────────────────────────────────────── */
const MOCK_SCRAMBLE = "F R U2 L' B R' D' F2 L2 B2 R2 U' L D B R' F'";

/* ── Mock optimal ───────────────────────────────────────────────────── */
function mockOptimal(): number {
  return 5 + Math.floor(Math.random() * 4); // 5-8 moves
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface PhaseTrainerViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

export function PhaseTrainerView({
  methodId, phaseId: _phaseId, phaseName, onBack,
}: PhaseTrainerViewProps) {
  void _phaseId;
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const [trainerMode, setTrainerMode] = useState<PhaseTrainerMode>("plain");
  const [timerPhase, setTimerPhase] = useState<"idle" | "inspection" | "running" | "verdict">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [attempts, setAttempts] = useState<PhaseAttempt[]>([]);
  const [smartCubeMode, setSmartCubeMode] = useState(false);
  const [showOptimal, setShowOptimal] = useState(false);
  const scramble = MOCK_SCRAMBLE;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const optimalRef = useRef(mockOptimal());

  // Stats
  const validAttempts = attempts.filter((a) => a.timeMs > 0);
  const bestAttempt = validAttempts.length > 0 ? Math.min(...validAttempts.map((a) => a.timeMs)) : 0;
  const avgTime = validAttempts.length > 0 ? validAttempts.reduce((s, a) => s + a.timeMs, 0) / validAttempts.length : 0;
  const efficiency = validAttempts.length > 0
    ? Math.round((validAttempts.reduce((s, a) => s + a.optimalMoves, 0) / validAttempts.reduce((s, a) => s + a.movesCount, 0)) * 100)
    : 0;

  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].movesCount <= attempts[i].optimalMoves + 2) s++;
      else break;
    }
    return s;
  }, [attempts]);

  // ── Timer ──────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerPhase !== "idle") return;
    optimalRef.current = mockOptimal();
    if (trainerMode === "blind") {
      setTimerPhase("inspection");
      setCurrentTime(15000);
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const remaining = Math.max(0, 15000 - elapsed);
        setCurrentTime(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setTimerPhase("running");
          setCurrentTime(0);
          startRef.current = Date.now();
          timerRef.current = setInterval(() => {
            setCurrentTime(Date.now() - startRef.current);
          }, 10);
        }
      }, 10);
    } else {
      setTimerPhase("running");
      setCurrentTime(0);
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setCurrentTime(Date.now() - startRef.current);
      }, 10);
    }
  }, [timerPhase, trainerMode]);

  const stopTimer = useCallback(() => {
    if (timerPhase !== "running") return;
    setTimerPhase("verdict");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCurrentTime(Date.now() - startRef.current);
  }, [timerPhase]);

  const recordAttempt = useCallback(() => {
    const elapsed = Date.now() - startRef.current;
    const moves = 6 + Math.floor(Math.random() * 6);
    const optimal = optimalRef.current;
    setAttempts((prev) => [{
      id: nextId(),
      mode: trainerMode,
      timeMs: elapsed,
      movesCount: moves,
      optimalMoves: optimal,
      inspectionMs: trainerMode === "blind" ? 15000 : 0,
      tps: parseFloat(((moves / (elapsed / 1000))).toFixed(1)),
      timestamp: Date.now(),
    }, ...prev]);
  }, [trainerMode]);

  const handleTimerTap = useCallback(() => {
    if (timerPhase === "idle") startTimer();
    else if (timerPhase === "running") stopTimer();
    else if (timerPhase === "verdict") { recordAttempt(); setTimerPhase("idle"); setCurrentTime(0); }
  }, [timerPhase, startTimer, stopTimer, recordAttempt]);

  const handleSkip = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerPhase("idle");
    setCurrentTime(0);
  }, []);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <PhaseTrainerHeader
          methodName={method?.name ?? "?"}
          phaseName={phaseName}
          trainerMode={trainerMode}
          onModeChange={setTrainerMode}
          totalAttempts={attempts.length}
          onBack={onBack}
          smartCubeMode={smartCubeMode}
          onToggleSmartCube={() => setSmartCubeMode((v) => !v)}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row">
          {/* Left: 3D cube + scramble */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Scramble display */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60 block mb-1">Scramble</span>
              <p className="nums text-[0.78rem] font-medium text-ink leading-relaxed tracking-tight">{scramble}</p>
            </div>

            {/* 3D Cube placeholder — highlight pieces concept */}
            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface flex items-center justify-center relative overflow-hidden">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                {/* Simplified cross face diagram */}
                <div className="grid grid-cols-3 gap-1.5 w-32">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const isEdge = i === 1 || i === 3 || i === 5 || i === 7;
                    const isCorner = i === 0 || i === 2 || i === 6 || i === 8;
                    const isCenter = i === 4;
                    // Cross edges highlighted only on U face for cross phases
                    const isHighlighted = isEdge && trainerMode !== "transition";
                    return (
                      <div
                        key={i}
                        className={cn(
                          "aspect-square rounded-sm transition-all duration-300",
                          isCenter ? "bg-yellow-400" :
                          isHighlighted ? "bg-ink/80 shadow-sm ring-1 ring-ink/30" :
                          isCorner ? "bg-ink/15" : "bg-ink/10",
                        )}
                      />
                    );
                  })}
                </div>
                <div className="space-y-1">
                  <p className="text-[0.72rem] font-medium text-ink">3D Cube View</p>
                  <p className="text-[0.6rem] text-ink-3 max-w-55">
                    Cross edges highlighted in color.
                    Remaining pieces shown semi-transparent.
                  </p>
                  <p className="text-[0.55rem] text-ink-3/50 italic">Full 3D render coming in Phase 2</p>
                </div>
              </div>

              {/* Inspection overlay for Blind mode */}
              <AnimatePresence>
                {timerPhase === "inspection" && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 rounded-xl bg-caution-soft/60"
                  >
                    <span className="nums text-[3rem] font-bold text-caution">{formatTime(currentTime)}</span>
                    <span className="text-[0.7rem] font-medium text-caution/80">Inspection — memorize cross pieces</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Timer + Metrics */}
          <div className="flex min-h-0 flex-col gap-4 lg:w-80 lg:shrink-0 overflow-hidden">
            {/* Timer */}
            <div className="shrink-0 rounded-xl border border-line bg-surface relative overflow-hidden min-h-45 flex flex-col items-center justify-center">
              <AnimatePresence>
                {timerPhase === "verdict" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 rounded-xl bg-surface/95">
                    <span className="nums text-[2.5rem] font-bold text-ink">{formatTime(currentTime)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { recordAttempt(); setTimerPhase("idle"); setCurrentTime(0); }}
                        className="rounded-lg bg-ink px-4 py-2 text-[0.75rem] font-medium text-surface hover:bg-ink/90 transition-colors">
                        Record & Continue
                      </button>
                      <button onClick={handleSkip}
                        className="rounded-lg border border-line bg-surface px-4 py-2 text-[0.75rem] font-medium text-ink-2 hover:bg-surface-2 transition-colors">
                        Skip
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleTimerTap}
                className="w-full h-full flex flex-col items-center justify-center gap-2 select-none outline-none cursor-pointer hover:bg-surface-2/50 transition-colors">
                <span className={cn("nums text-[2.8rem] font-bold tracking-tight tabular-nums",
                  timerPhase === "running" ? "text-ink" : timerPhase === "idle" ? "text-ink-2" : "text-ink-3/30")}>
                  {timerPhase === "idle" ? "0.00" : formatTime(currentTime)}
                </span>
                <span className="text-[0.62rem] text-ink-3">
                  {timerPhase === "idle" ? "Tap to start" : timerPhase === "running" ? "Tap to stop" : ""}
                </span>
                <span className="flex items-center gap-1 text-[0.55rem] text-ink-3/60">
                  {smartCubeMode ? <><Cpu className="size-3" /> Smart Cube</> : <><Hand className="size-3" /> Manual</>}
                </span>
              </button>
            </div>

            {/* Metrics panel */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-4 space-y-3">
              <h3 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">Metrics</h3>

              {validAttempts.length === 0 ? (
                <p className="text-[0.62rem] text-ink-3/50 text-center py-2">Complete an attempt to see metrics</p>
              ) : (
                <>
                  <MetricRow label="Best time" value={formatTime(bestAttempt)} />
                  <MetricRow label="Avg time" value={formatTime(avgTime)} />
                  <MetricRow label="Efficiency" value={`${efficiency}%`}
                    color={efficiency >= 80 ? "text-ready" : efficiency >= 60 ? "text-caution" : "text-hold"} />
                  <MetricRow label="Streak" value={`${streak} ≤ optimal+2`} />

                  {/* Show Optimal toggle */}
                  <button
                    onClick={() => setShowOptimal((v) => !v)}
                    className={cn("flex items-center gap-1.5 text-[0.6rem] font-medium transition-colors w-full",
                      showOptimal ? "text-ink" : "text-ink-3 hover:text-ink-2")}
                  >
                    <Eye className="size-3" />
                    {showOptimal ? "Hide optimal solution" : "Show optimal solution"}
                  </button>

                  {showOptimal && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="rounded-lg bg-surface-2 p-2.5">
                      <p className="nums text-[0.62rem] text-ink-2/80 leading-relaxed">
                        D' R' F D2 R' F R <span className="text-ink-3/50">(7 HTM)</span>
                      </p>
                      <p className="text-[0.55rem] text-ink-3/60 mt-1">
                        Your last solve: {validAttempts[validAttempts.length - 1]?.movesCount ?? "?"} moves
                        {validAttempts.length > 0 && (() => {
                          const last = validAttempts[validAttempts.length - 1];
                          const diff = last.movesCount - last.optimalMoves;
                          return diff > 0 ? ` (${diff} moves above optimal)` : " (optimal!)";
                        })()}
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
              <SessionStatsPanel attempts={validAttempts.length} efficiency={efficiency} avgTime={avgTime} bestTime={bestAttempt} />
              <RecentAttemptsPanel attempts={attempts.slice(0, 15)} />
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

function PhaseTrainerHeader({
  methodName, phaseName, trainerMode, onModeChange, totalAttempts, onBack, smartCubeMode, onToggleSmartCube,
}: {
  methodName: string; phaseName: string; trainerMode: PhaseTrainerMode;
  onModeChange: (m: PhaseTrainerMode) => void; totalAttempts: number;
  onBack: () => void; smartCubeMode: boolean; onToggleSmartCube: () => void;
}) {
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0">
          <ArrowLeft className="size-3" />Back
        </button>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{methodName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-semibold text-ink">{phaseName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-semibold text-ink">Train</span>
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">{totalAttempts} attempts</span>
        <button onClick={onToggleSmartCube}
          className={cn("shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors border",
            smartCubeMode ? "border-ink/20 bg-ink text-surface" : "border-line bg-surface text-ink-3 hover:text-ink hover:border-ink/15")}>
          {smartCubeMode ? "Smart Cube" : "Manual"}
        </button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {PHASE_MODES.map((mode) => (
          <button key={mode.id} onClick={() => onModeChange(mode.id)}
            className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
              trainerMode === mode.id ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")}
            title={mode.desc}>
            {mode.label}
            {trainerMode === mode.id && (
              <motion.div layoutId="trainer-mode-active" className="absolute inset-0 rounded-md bg-ink -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }} />
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

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.6rem] text-ink-3">{label}</span>
      <span className={cn("nums text-[0.68rem] font-medium", color ?? "text-ink")}>{value}</span>
    </div>
  );
}

function SessionStatsPanel({ attempts, efficiency, avgTime, bestTime }: {
  attempts: number; efficiency: number; avgTime: number; bestTime: number;
}) {
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Target} label="Efficiency" value={`${efficiency}%`} />
        <StatChip icon={Flame} label="Attempts" value={`${attempts}`} />
        <StatChip icon={Clock} label="Best" value={bestTime > 0 ? formatTime(bestTime) : "--"} />
        <StatChip icon={RotateCcw} label="Avg" value={avgTime > 0 ? formatTime(avgTime) : "--"} />
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-2">
      <span className="flex items-center gap-1 text-[0.55rem] text-ink-3"><Icon className="size-2.5" />{label}</span>
      <span className="nums text-[0.75rem] font-semibold text-ink">{value}</span>
    </div>
  );
}

function RecentAttemptsPanel({ attempts }: { attempts: PhaseAttempt[] }) {
  if (attempts.length === 0) {
    return (
      <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">Recent Attempts</h4>
        <p className="text-[0.6rem] text-ink-3/50 text-center py-4">Complete a drill to see results here</p>
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface flex flex-col overflow-hidden">
      <div className="shrink-0 p-3 pb-2">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">Recent</h4>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {attempts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-surface-2/50">
            <span className="text-[0.55rem] text-ink-3 shrink-0 w-8">{PHASE_MODES.find((m) => m.id === a.mode)?.label ?? a.mode}</span>
            <span className="nums text-[0.62rem] text-ink font-medium">{formatTime(a.timeMs)}</span>
            <span className="nums text-[0.55rem] text-ink-3 ml-auto">{a.movesCount}/{a.optimalMoves} moves</span>
            <ChevronRight className="size-3 text-ink-3/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
