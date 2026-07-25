"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import {
  ArrowLeft, Target, Flame, X, Check, Trophy,
  Cpu, Hand, RotateCcw,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type FullSolveMode = "targets" | "move-limit" | "tps-challenge" | "rotationless";

interface PhaseSplit {
  phaseId: string;
  phaseName: string;
  targetS: number;       // target time in seconds
  actualMs: number;      // actual duration in ms
  status: "pending" | "active" | "done";
}

interface SolveResult {
  totalMs: number;
  splits: PhaseSplit[];
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock data per method
   ─────────────────────────────────────────────────────────────────────── */

function getPhaseTargets(methodName: string): { phaseId: string; phaseName: string; targetS: number }[] {
  switch (methodName) {
    case "CFOP": return [
      { phaseId: "cross", phaseName: "Cross", targetS: 2.0 },
      { phaseId: "f2l", phaseName: "F2L", targetS: 6.0 },
      { phaseId: "oll", phaseName: "OLL", targetS: 1.5 },
      { phaseId: "pll", phaseName: "PLL", targetS: 1.2 },
    ];
    case "Roux": return [
      { phaseId: "first-block", phaseName: "First block", targetS: 2.5 },
      { phaseId: "second-block", phaseName: "Second block", targetS: 2.0 },
      { phaseId: "cmll", phaseName: "CMLL", targetS: 1.5 },
      { phaseId: "lse", phaseName: "LSE", targetS: 2.0 },
    ];
    case "ZZ": return [
      { phaseId: "eoline", phaseName: "EOLine", targetS: 3.0 },
      { phaseId: "f2l-zz", phaseName: "F2L (ZZ)", targetS: 6.0 },
      { phaseId: "ll-zz", phaseName: "Last layer", targetS: 2.0 },
    ];
    case "Petrus": return [
      { phaseId: "block-222", phaseName: "2×2×2", targetS: 2.5 },
      { phaseId: "block-223", phaseName: "2×2×3", targetS: 2.8 },
      { phaseId: "eo-petrus", phaseName: "EO", targetS: 1.2 },
      { phaseId: "f2l-petrus", phaseName: "F2L", targetS: 3.5 },
      { phaseId: "ll-petrus", phaseName: "Last layer", targetS: 2.5 },
    ];
    default: return [];
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

const SOLVE_MODES: { id: FullSolveMode; label: string; desc: string }[] = [
  { id: "targets", label: "Phase targets", desc: "Track each phase vs your target times" },
  { id: "move-limit", label: "Move limit", desc: "Solve in ≤ X moves" },
  { id: "tps-challenge", label: "TPS challenge", desc: "Maintain TPS above threshold" },
  { id: "rotationless", label: "Rotationless", desc: "Zero cube rotations" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface FullSolveViewProps {
  methodId: string;
  onBack: () => void;
}

export function FullSolveView({ methodId, onBack }: FullSolveViewProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const phaseTargets = useMemo(() => getPhaseTargets(method?.name ?? ""), [method]);

  const [solveMode, setSolveMode] = useState<FullSolveMode>("targets");
  const [timerPhase, setTimerPhase] = useState<"idle" | "inspection" | "running" | "done">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [splits, setSplits] = useState<PhaseSplit[]>(() =>
    phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" as const })),
  );
  const [activeSplitIdx, setActiveSplitIdx] = useState(-1);
  const [smartCubeMode, setSmartCubeMode] = useState(false);
  const [lastSolve, setLastSolve] = useState<SolveResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartRef = useRef<number>(0);
  const splitStartRef = useRef<number>(0);

  const activeSplit = splits[activeSplitIdx];
  const totalTarget = phaseTargets.reduce((s, pt) => s + pt.targetS, 0);
  const totalActual = splits.reduce((s, sp) => s + sp.actualMs / 1000, 0);

  // ── Start inspection ─────────────────────────────────────────────────
  const startInspection = useCallback(() => {
    setTimerPhase("inspection");
    setCurrentTime(15000);
    solveStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - solveStartRef.current;
      const remaining = Math.max(0, 15000 - elapsed);
      setCurrentTime(remaining);
      if (remaining <= 0) {
        // Auto-start solve after inspection
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setTimerPhase("running");
        setCurrentTime(0);
        solveStartRef.current = Date.now();
        splitStartRef.current = Date.now();
        setActiveSplitIdx(0);
        setSplits((prev) => prev.map((s, i) => i === 0 ? { ...s, status: "active" } : s));
        timerRef.current = setInterval(() => {
          setCurrentTime(Date.now() - solveStartRef.current);
        }, 10);
      }
    }, 10);
  }, []);

  // ── Stop / mark split ───────────────────────────────────────────────
  const markSplit = useCallback(() => {
    if (timerPhase !== "running" || activeSplitIdx < 0) return;
    const now = Date.now();
    const splitDuration = now - splitStartRef.current;

    setSplits((prev) => {
      const next = [...prev];
      next[activeSplitIdx] = { ...next[activeSplitIdx], actualMs: splitDuration, status: "done" };
      const nextIdx = activeSplitIdx + 1;
      if (nextIdx < next.length) {
        next[nextIdx] = { ...next[nextIdx], status: "active" };
      }
      return next;
    });

    if (activeSplitIdx + 1 >= phaseTargets.length) {
      // All phases done
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const totalMs = now - solveStartRef.current;
      setCurrentTime(totalMs);
      setTimerPhase("done");
      setActiveSplitIdx(-1);

      // Build result
      const resultSplits: PhaseSplit[] = splits.map((s, i) =>
        i === activeSplitIdx ? { ...s, actualMs: splitDuration, status: "done" as const }
        : s,
      );
      setLastSolve({ totalMs, splits: resultSplits });
    } else {
      setActiveSplitIdx((prev) => prev + 1);
      splitStartRef.current = now;
    }
  }, [timerPhase, activeSplitIdx, phaseTargets.length, splits]);

  // ── Timer display tap ───────────────────────────────────────────────
  const handleTimerTap = useCallback(() => {
    if (timerPhase === "idle") {
      // Start full solve immediately (no inspection)
      setTimerPhase("running");
      setCurrentTime(0);
      solveStartRef.current = Date.now();
      splitStartRef.current = Date.now();
      setActiveSplitIdx(0);
      setSplits((prev) => prev.map((s, i) => i === 0 ? { ...s, status: "active" } : { ...s, actualMs: 0, status: "pending" }));
      setLastSolve(null);
      timerRef.current = setInterval(() => {
        setCurrentTime(Date.now() - solveStartRef.current);
      }, 10);
    } else if (timerPhase === "running") {
      markSplit();
    } else if (timerPhase === "done") {
      // Reset
      setTimerPhase("idle");
      setCurrentTime(0);
      setSplits(phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" })));
      setActiveSplitIdx(-1);
    }
  }, [timerPhase, markSplit, phaseTargets]);

  // ── Cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0">
              <ArrowLeft className="size-3" />Back
            </button>
            <span className="text-[0.6rem] text-ink-3/50">›</span>
            <span className="text-[0.72rem] font-semibold text-ink">{method?.name ?? "?"}</span>
            <span className="text-[0.6rem] text-ink-3/50">›</span>
            <span className="text-[0.72rem] font-semibold text-ink">Full Solve</span>
            <span className="nums text-[0.62rem] text-ink-3 ml-auto">
              {timerPhase === "done" ? formatTime(currentTime) : ""}
            </span>
            <button onClick={() => setSmartCubeMode((v) => !v)}
              className={cn("shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors border",
                smartCubeMode ? "border-ink/20 bg-ink text-surface" : "border-line bg-surface text-ink-3 hover:text-ink hover:border-ink/15")}>
              {smartCubeMode ? "Smart Cube" : "Manual"}
            </button>
          </div>

          {/* Sub-mode tabs */}
          <div className="flex gap-1 flex-wrap">
            {SOLVE_MODES.map((mode) => (
              <button key={mode.id} onClick={() => setSolveMode(mode.id)}
                className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
                  solveMode === mode.id ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")}
                title={mode.desc}>
                {mode.label}
                {solveMode === mode.id && (
                  <motion.div layoutId="fullsolve-mode-active" className="absolute inset-0 rounded-md bg-ink -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8">
          {/* Phase progress bar */}
          <div className="shrink-0 flex items-center gap-1">
            {splits.map((split) => {
              const isDone = split.status === "done";
              const isActive = split.status === "active";
              const pct = split.targetS > 0 ? Math.min(100, Math.round((split.actualMs / 1000 / split.targetS) * 100)) : 0;
              return (
                <div key={split.phaseId} className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[0.55rem] font-medium truncate",
                      isDone ? "text-ready" : isActive ? "text-ink" : "text-ink-3/40")}>
                      {split.phaseName}
                    </span>
                    <span className={cn("nums text-[0.5rem] shrink-0 ml-1",
                      isDone ? "text-ready" : isActive ? "text-ink-2" : "text-ink-3/30")}>
                      {isDone ? `${(split.actualMs / 1000).toFixed(1)}s` : split.targetS.toFixed(1) + "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    {isDone && (
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        className={cn("h-full rounded-full", pct <= 100 ? "bg-ready" : "bg-hold")} />
                    )}
                    {isActive && (
                      <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
                        transition={{ duration: (split.targetS * 1000) / 1000, ease: "linear" }}
                        className="h-full rounded-full bg-ink/15" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main area: timer + result */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
            {/* Timer / Result area */}
            <div className="flex-1 min-h-70 flex flex-col items-center justify-center rounded-xl border border-line bg-surface relative overflow-hidden">
              {/* Inspection overlay */}
              <AnimatePresence>
                {timerPhase === "inspection" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 rounded-xl bg-caution-soft/60">
                    <span className="nums text-[3rem] font-bold text-caution">{formatTime(currentTime)}</span>
                    <span className="text-[0.7rem] font-medium text-caution/80">Inspection</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Done result overlay */}
              <AnimatePresence>
                {timerPhase === "done" && lastSolve && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col gap-4 z-10 rounded-xl bg-surface/98 p-6 overflow-y-auto">
                    <div className="flex flex-col items-center gap-2">
                      <Trophy className="size-10 text-caution" />
                      <span className="nums text-[2.5rem] font-bold text-ink">{formatTime(lastSolve.totalMs)}</span>
                      <span className="text-[0.65rem] text-ink-3">Total solve time</span>
                    </div>

                    <div className="space-y-2 w-full max-w-sm mx-auto">
                      {lastSolve.splits.map((split) => {
                        const overTarget = split.actualMs / 1000 > split.targetS;
                        return (
                          <div key={split.phaseId} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
                            <span className="text-[0.62rem] font-medium text-ink-2 w-20 shrink-0">{split.phaseName}</span>
                            <span className={cn("nums text-[0.65rem] font-medium", overTarget ? "text-hold" : "text-ready")}>
                              {(split.actualMs / 1000).toFixed(2)}s
                            </span>
                            <span className="nums text-[0.55rem] text-ink-3/60">/ {split.targetS.toFixed(1)}s</span>
                            <div className="ml-auto flex items-center gap-1 shrink-0">
                              {overTarget ? (
                                <X className="size-3.5 text-hold" />
                              ) : (
                                <Check className="size-3.5 text-ready" />
                              )}
                              <span className={cn("nums text-[0.55rem]", overTarget ? "text-hold" : "text-ready")}>
                                {overTarget ? `+${((split.actualMs / 1000) - split.targetS).toFixed(1)}s` : "OK"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5 text-[0.6rem] text-ink-3">
                        <Target className="size-3" />
                        Total target: {totalTarget.toFixed(1)}s
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[0.6rem] font-medium",
                        totalActual <= totalTarget ? "text-ready" : "text-hold")}>
                        Actual: {totalActual.toFixed(1)}s
                      </div>
                    </div>

                    <button onClick={() => { setTimerPhase("idle"); setCurrentTime(0); setSplits(phaseTargets.map((pt) => ({ ...pt, actualMs: 0, status: "pending" }))); setActiveSplitIdx(-1); }}
                      className="mx-auto inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[0.7rem] font-semibold text-surface hover:bg-ink/90 transition-colors">
                      <RotateCcw className="size-3.5" /> New Solve
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timer button */}
              <button onClick={handleTimerTap}
                className={cn("w-full h-full flex flex-col items-center justify-center gap-3 select-none outline-none transition-colors",
                  timerPhase !== "done" && "cursor-pointer hover:bg-surface-2/50")}>
                <span className={cn("nums text-[3rem] sm:text-[4rem] font-bold tracking-tight tabular-nums transition-colors",
                  timerPhase === "running" ? "text-ink" : timerPhase === "idle" ? "text-ink-2" : "text-ink-3/30")}>
                  {timerPhase === "idle" ? "0.00" : formatTime(currentTime)}
                </span>
                <span className="text-[0.65rem] text-ink-3">
              {timerPhase === "idle" ? "Tap to start solve" :
               timerPhase === "inspection" ? "Inspecting..." :
               timerPhase === "running" ? `Tap when ${activeSplit?.phaseName ?? "next phase"} is done` :
               timerPhase === "done" ? "Tap for new solve" : ""}
            </span>
            {timerPhase === "idle" && (
              <button onClick={(e) => { e.stopPropagation(); startInspection(); }}
                className="text-[0.55rem] text-ink-3/60 hover:text-ink transition-colors mt-1">
                or start with 15s inspection
              </button>
            )}
                <span className="flex items-center gap-1.5 text-[0.55rem] text-ink-3/70">
                  {smartCubeMode ? <><Cpu className="size-3" /> Smart Cube</> : <><Hand className="size-3" /> Manual</>}
                </span>
              </button>
            </div>

            {/* Right: phase detail panel */}
            <aside className="min-h-0 lg:w-64 lg:shrink-0 flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">Phase Targets</h3>
                <div className="space-y-2.5">
                  {splits.map((split) => {
                    const isDone = split.status === "done";
                    const isActive = split.status === "active";
                    const pct = split.targetS > 0 ? Math.min(100, Math.round((split.actualMs / 1000 / split.targetS) * 100)) : 0;
                    return (
                      <div key={split.phaseId} className={cn("rounded-lg p-2.5 transition-colors",
                        isActive && "bg-surface-2 ring-1 ring-ink/10",
                        isDone && "bg-surface-2/50",
                        !isActive && !isDone && "opacity-40")}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-[0.62rem] font-medium", isActive ? "text-ink" : "text-ink-3")}>
                            {split.phaseName}
                          </span>
                          <span className={cn("nums text-[0.55rem]", isDone ? "text-ready" : "text-ink-3/60")}>
                            {isDone ? `${(split.actualMs / 1000).toFixed(1)}s / ${split.targetS.toFixed(1)}s` : `${split.targetS.toFixed(1)}s`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          {isDone && (
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4 }}
                              className={cn("h-full rounded-full", pct <= 100 ? "bg-ready" : "bg-hold")} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                  <span className="text-[0.6rem] text-ink-3">Total target</span>
                  <div className="flex items-center gap-2">
                    <span className="nums text-[0.68rem] font-semibold text-ink">{totalTarget.toFixed(1)}s</span>
                    {totalActual > 0 && (
                      <span className={cn("nums text-[0.62rem]", totalActual <= totalTarget ? "text-ready" : "text-hold")}>
                        ({(totalActual).toFixed(1)}s)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick tips */}
              <div className="rounded-xl border border-line bg-surface p-3">
                <div className="flex gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2">
                    <Flame className="size-3.5 text-caution" />
                  </div>
                  <div>
                    <p className="text-[0.6rem] text-ink-2 leading-relaxed">
                      Tap when you finish each phase. The timer keeps running between phases — no pauses allowed.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
