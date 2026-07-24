"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData, SUBSET_VISUALIZATION } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, Algorithm, VisualizationStyle } from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  X,
  SkipForward,
  Shuffle,
  Target,
  TrendingUp,
  Clock,
  Cpu,
  Hand,
  Flame,
  RotateCcw,
  Lock,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type DrillMode = "single" | "random" | "sequential" | "weakness";

interface DrillAttempt {
  id: string;
  caseId: string;
  caseLabel: string;
  algorithm: string[];
  timeMs: number;
  correct: boolean;
  timestamp: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock data
   ─────────────────────────────────────────────────────────────────────── */

function mockCaseProgress(caseNumber: string) {
  const n = parseInt(caseNumber.replace(/\D/g, ""), 10) || 0;
  const mastery = 30 + ((n * 17) % 70);
  const bestTime = 800 + ((n * 53) % 2200);
  return { mastery: Math.min(99, mastery), bestTimeMs: bestTime, attempts: 3 + (n % 15) };
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

function calculateTps(moves: string[], ms: number): string {
  if (ms <= 0 || moves.length === 0) return "--";
  return ((moves.length / (ms / 1000))).toFixed(1);
}

let _attemptId = 0;
function nextAttemptId(): string {
  return `attempt-${++_attemptId}-${Date.now()}`;
}

const DRILL_MODES: { id: DrillMode; label: string; description: string }[] = [
  { id: "single", label: "Single", description: "Practice one case repeatedly" },
  { id: "random", label: "Random", description: "Random cases from the subset" },
  { id: "sequential", label: "Sequential", description: "All cases in order" },
  { id: "weakness", label: "Weakness", description: "Prioritize your worst cases" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface AlgorithmDrillViewProps {
  methodId: string;
  phaseId: string;
  subsetId: string;
  onBack: () => void;
  preselectedCaseId?: string | null;
}

export function AlgorithmDrillView({
  methodId, phaseId: _phaseId, subsetId, onBack, preselectedCaseId,
}: AlgorithmDrillViewProps) {
  void _phaseId; // reserved for future: stores attempts with phase context
  // ── Data ─────────────────────────────────────────────────────────────
  const { cases: allCases, algorithms: allAlgorithms } = useMemo(() => getSeedData(), []);
  const subset = useMemo(() => SUBSETS.find((s) => s.id === subsetId), [subsetId]);
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const subsetCases = useMemo(
    () => allCases.filter((c) => c.subsetId === subsetId).sort((a, b) => a.sortOrder - b.sortOrder),
    [allCases, subsetId],
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [drillMode, setDrillMode] = useState<DrillMode>("single");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(preselectedCaseId ?? null);
  const [showAlgorithm, setShowAlgorithm] = useState(true);
  const [revealIfFail, setRevealIfFail] = useState(false);
  const [timerPhase, setTimerPhase] = useState<"idle" | "running" | "verdict">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [attempts, setAttempts] = useState<DrillAttempt[]>([]);
  const [smartCubeMode, setSmartCubeMode] = useState(false);
  const [seqIndex, setSeqIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Visualization style (yellow-gray for OLL, full-color for PLL, etc.) ─
  const visualizationStyle = useMemo<VisualizationStyle>(() => {
    const config = subset?.name ? SUBSET_VISUALIZATION[subset.name] : undefined;
    return config?.style ?? 'full-color';
  }, [subset]);

  // ── Derived data ─────────────────────────────────────────────────────
  const selectedCase = useMemo(
    () => (selectedCaseId ? subsetCases.find((c) => c.id === selectedCaseId) ?? null : null),
    [selectedCaseId, subsetCases],
  );
  const selectedAlgorithms = useMemo(
    () => (selectedCaseId ? allAlgorithms.filter((a) => a.caseId === selectedCaseId) : []),
    [selectedCaseId, allAlgorithms],
  );
  const defaultAlgorithm = selectedAlgorithms.find((a) => a.isDefault) ?? selectedAlgorithms[0];

  const weaknessOrdered = useMemo(() => {
    return [...subsetCases].sort((a, b) => {
      return mockCaseProgress(a.caseNumber).mastery - mockCaseProgress(b.caseNumber).mastery;
    });
  }, [subsetCases]);

  const correctAttempts = attempts.filter((a) => a.correct);
  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].correct) s++; else break;
    }
    return s;
  }, [attempts]);

  const avgTime = useMemo(() => {
    const valid = attempts.filter((a) => a.correct);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, a) => sum + a.timeMs, 0) / valid.length;
  }, [attempts]);

  // ── Case navigation ──────────────────────────────────────────────────
  const selectNextCase = useCallback(() => {
    if (subsetCases.length === 0) return;
    if (drillMode === "sequential") {
      const next = (seqIndex + 1) % subsetCases.length;
      setSeqIndex(next);
      setSelectedCaseId(subsetCases[next].id);
    } else if (drillMode === "random") {
      const idx = Math.floor(Math.random() * subsetCases.length);
      setSelectedCaseId(subsetCases[idx].id);
    } else if (drillMode === "weakness") {
      setSelectedCaseId(weaknessOrdered[0].id);
    }
    // single: keep same case
  }, [drillMode, subsetCases, seqIndex, weaknessOrdered]);

  // ── Timer logic ──────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerPhase !== "idle") return;
    setTimerPhase("running");
    setCurrentTime(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setCurrentTime(Date.now() - startTimeRef.current);
    }, 10);
  }, [timerPhase]);

  const stopTimer = useCallback(() => {
    if (timerPhase !== "running") return;
    setTimerPhase("verdict");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentTime(Date.now() - startTimeRef.current);
  }, [timerPhase]);

  const recordAttempt = useCallback(
    (correct: boolean) => {
      const elapsed = Date.now() - startTimeRef.current;
      if (!selectedCase || !defaultAlgorithm) return;
      const attempt: DrillAttempt = {
        id: nextAttemptId(),
        caseId: selectedCase.id,
        caseLabel: selectedCase.caseNumber,
        algorithm: defaultAlgorithm.moves,
        timeMs: elapsed,
        correct,
        timestamp: Date.now(),
      };
      setAttempts((prev) => [attempt, ...prev]);
      if (!correct && revealIfFail) setShowAlgorithm(true);
    },
    [selectedCase, defaultAlgorithm, revealIfFail],
  );

  const handleMarkCorrect = useCallback(() => {
    recordAttempt(true);
    setTimerPhase("idle");
    selectNextCase();
  }, [recordAttempt, selectNextCase]);

  const handleMarkIncorrect = useCallback(() => {
    recordAttempt(false);
    setTimerPhase("idle");
    selectNextCase();
  }, [recordAttempt, selectNextCase]);

  const handleSkip = useCallback(() => {
    if (timerPhase === "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerPhase("idle");
    setCurrentTime(0);
    selectNextCase();
  }, [timerPhase, selectNextCase]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Timer tap ────────────────────────────────────────────────────────
  const handleTimerTap = useCallback(() => {
    if (timerPhase === "idle") startTimer();
    else if (timerPhase === "running") stopTimer();
    // "verdict": tapping restarts
    else if (timerPhase === "verdict") {
      setTimerPhase("idle");
      setCurrentTime(0);
    }
  }, [timerPhase, startTimer, stopTimer]);

  // ── Algorithm text ────────────────────────────────────────────────────
  const algoText = defaultAlgorithm?.moves.join(" ") ?? "";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <DrillHeader
          methodName={method?.name ?? "?"}
          subsetName={subset?.name ?? "?"}
          drillMode={drillMode}
          onModeChange={setDrillMode}
          masteredCount={subsetCases.filter((c) => mockCaseProgress(c.caseNumber).mastery >= 90).length}
          totalCount={subsetCases.length}
          onBack={onBack}
          smartCubeMode={smartCubeMode}
          onToggleSmartCube={() => setSmartCubeMode((v) => !v)}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row">
          {/* Left: Active drill area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Case diagram + algorithm */}
            <div className="shrink-0 flex items-start gap-4 p-4 rounded-xl border border-line bg-surface">
              <div className="shrink-0">
                {selectedCase && selectedCase.diagramType === "2d-top" && selectedCase.diagram2D ? (
                  <CaseDiagram
                    arrows={selectedCase.diagram2D.arrows}
                    setupScramble={selectedCase.setupScramble}
                    moves={defaultAlgorithm?.moves}
                    style={visualizationStyle}
                    className="w-32 sm:w-40"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center rounded-lg bg-surface-2">
                    <span className="text-ink-3/40 text-[0.6rem]">No diagram</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <span className="nums text-[0.85rem] font-semibold text-ink">{selectedCase?.caseNumber ?? "--"}</span>
                  <span className="text-[0.7rem] text-ink-2 ml-2">{selectedCase?.name ?? "Select a case"}</span>
                </div>

                <div className={cn("rounded-lg border p-3 transition-all duration-200", showAlgorithm ? "border-line bg-surface-2" : "border-line/50 bg-surface-2/50")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3">Algorithm</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[0.58rem] text-ink-3 cursor-pointer select-none">
                        <input type="checkbox" checked={revealIfFail} onChange={(e) => setRevealIfFail(e.target.checked)} className="size-3 rounded border-line accent-ink" />
                        Reveal if fail
                      </label>
                      <button onClick={() => setShowAlgorithm((v) => !v)} className="rounded p-0.5 text-ink-3 hover:text-ink transition-colors" title={showAlgorithm ? "Hide algorithm" : "Show algorithm"}>
                        {showAlgorithm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  {showAlgorithm ? (
                    <p className="nums text-[0.78rem] font-medium text-ink leading-relaxed">{algoText || "No algorithm available"}</p>
                  ) : (
                    <p className="nums text-[0.78rem] text-ink-3/40 italic select-none flex items-center gap-1.5"><Lock className="size-3" /> Algorithm hidden</p>
                  )}
                </div>

                {selectedCase?.setupScramble && (
                  <div>
                    <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60">Setup</span>
                    <p className="nums text-[0.65rem] text-ink-2/70 mt-0.5">{selectedCase.setupScramble}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timer area */}
            <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center rounded-xl border border-line bg-surface relative overflow-hidden">
              {/* Verdict overlay: mark correct / incorrect */}
              <AnimatePresence>
                {timerPhase === "verdict" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 rounded-xl bg-surface/95"
                  >
                    <span className="nums text-[2.8rem] sm:text-[3.5rem] font-bold text-ink tracking-tight">
                      {formatTime(currentTime)}
                    </span>
                    <span className="nums text-[0.8rem] text-ink-3">
                      TPS {calculateTps(defaultAlgorithm?.moves ?? [], currentTime)}
                    </span>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={handleMarkIncorrect}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-hold/30 bg-hold-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-hold hover:bg-hold-soft/60 hover:border-hold/50 transition-all"
                      >
                        <X className="size-5" />
                        Incorrect
                      </button>
                      <button
                        onClick={handleMarkCorrect}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-ready/30 bg-ready-soft/40 px-6 py-3 text-[0.85rem] font-semibold text-ready hover:bg-ready-soft/60 hover:border-ready/50 transition-all"
                      >
                        <Check className="size-5" />
                        Correct
                      </button>
                    </div>
                    <button
                      onClick={handleSkip}
                      className="text-[0.62rem] text-ink-3 hover:text-ink mt-1 transition-colors"
                    >
                      Skip without recording
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timer display */}
              <button
                onClick={handleTimerTap}
                className={cn(
                  "w-full h-full flex flex-col items-center justify-center gap-3 select-none outline-none transition-colors duration-150",
                  timerPhase !== "verdict" && "cursor-pointer hover:bg-surface-2/50",
                )}
              >
                <span className={cn(
                  "nums text-[2.5rem] sm:text-[3.5rem] font-bold tracking-tight tabular-nums transition-colors",
                  timerPhase === "running" ? "text-ink" : timerPhase === "idle" ? "text-ink-2" : "text-ink-3/30",
                )}>
                  {timerPhase === "idle" ? "0.00" : formatTime(currentTime)}
                </span>
                <span className="text-[0.65rem] text-ink-3">
                  {timerPhase === "idle" ? "Tap to start" : timerPhase === "running" ? "Tap to stop" : "Review result"}
                </span>
                <span className="flex items-center gap-1.5 text-[0.58rem] text-ink-3/70">
                  {smartCubeMode ? (<><Cpu className="size-3" /> Smart Cube</>) : (<><Hand className="size-3" /> Manual Timer</>)}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Sidebar */}
          <aside className="flex min-h-0 flex-col gap-4 lg:w-72 lg:shrink-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-line bg-surface">
              {drillMode === "single" && (
                <CaseSelectorPanel cases={subsetCases} algorithms={allAlgorithms} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
              )}
              {drillMode === "random" && (
                <RandomModePanel cases={subsetCases} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
              )}
              {drillMode === "sequential" && (
                <SequentialModePanel cases={subsetCases} currentIndex={seqIndex} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
              )}
              {drillMode === "weakness" && (
                <WeaknessModePanel cases={weaknessOrdered} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
              )}
            </div>

            <SessionStatsPanel totalAttempts={attempts.length} correctCount={correctAttempts.length} streak={streak} avgTime={avgTime} />
            <RecentAttemptsPanel attempts={attempts.slice(0, 20)} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drill Header
   ─────────────────────────────────────────────────────────────────────── */

function DrillHeader({
  methodName, subsetName, drillMode, onModeChange, masteredCount, totalCount, onBack, smartCubeMode, onToggleSmartCube,
}: {
  methodName: string; subsetName: string; drillMode: DrillMode; onModeChange: (m: DrillMode) => void;
  masteredCount: number; totalCount: number; onBack: () => void; smartCubeMode: boolean; onToggleSmartCube: () => void;
}) {
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0"><ArrowLeft className="size-3" />Back</button>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{methodName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{subsetName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-semibold text-ink">Drill</span>
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">{masteredCount}/{totalCount} mastered</span>
        <button onClick={onToggleSmartCube}
          className={cn("shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors border",
            smartCubeMode ? "border-ink/20 bg-ink text-surface" : "border-line bg-surface text-ink-3 hover:text-ink hover:border-ink/15")}>
          {smartCubeMode ? "Smart Cube" : "Manual"}
        </button>
      </div>
      <div className="flex gap-1">
        {DRILL_MODES.map((mode) => (
          <button key={mode.id} onClick={() => onModeChange(mode.id)}
            className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
              drillMode === mode.id ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")} title={mode.description}>
            {mode.label}
            {drillMode === mode.id && <motion.div layoutId="drill-mode-active" className="absolute inset-0 rounded-md bg-ink -z-10" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sidebar panels
   ─────────────────────────────────────────────────────────────────────── */

function CaseSelectorPanel({ cases, algorithms, selectedCaseId, onSelectCase }: {
  cases: AlgorithmCase[]; algorithms: Algorithm[]; selectedCaseId: string | null; onSelectCase: (id: string) => void;
}) {
  return (
    <div className="p-3">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2 px-1">Select Case</h4>
      <div className="grid grid-cols-2 gap-1.5">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          const progress = mockCaseProgress(c.caseNumber);
          const caseAlg = algorithms.find((a) => a.caseId === c.id && a.isDefault) ?? algorithms.find((a) => a.caseId === c.id);
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex flex-col gap-1 rounded-lg border p-2 text-left transition-all duration-150",
                isSelected ? "border-ink/30 bg-surface-2 ring-1 ring-ink/15" : "border-line bg-surface hover:border-ink/12 hover:bg-surface-2/60")}>
              <div className="flex items-center justify-between"><span className="nums text-[0.65rem] font-semibold text-ink">{c.caseNumber}</span><span className="nums text-[0.55rem] text-ink-3">{progress.mastery}%</span></div>
              {caseAlg && <span className="nums text-[0.52rem] text-ink-2/70 truncate leading-tight">{caseAlg.moves.join(" ")}</span>}
              <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                <div className={cn("h-full rounded-full", progress.mastery >= 90 ? "bg-ready" : progress.mastery >= 60 ? "bg-caution" : "bg-hold")} style={{ width: `${progress.mastery}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RandomModePanel({ cases, selectedCaseId, onSelectCase }: {
  cases: AlgorithmCase[]; selectedCaseId: string | null; onSelectCase: (id: string) => void;
}) {
  const selected = cases.find((c) => c.id === selectedCaseId);
  const progress = selected ? mockCaseProgress(selected.caseNumber) : null;
  return (
    <div className="p-3 flex flex-col items-center gap-4 h-full justify-center">
      <Shuffle className="size-8 text-ink-3/40" />
      <div className="text-center">
        <p className="text-[0.72rem] font-medium text-ink">{selected?.caseNumber ?? "—"}</p>
        <p className="text-[0.62rem] text-ink-3">{selected?.name ?? "No case"}</p>
      </div>
      {progress && (
        <div className="flex items-center gap-3 text-[0.62rem] text-ink-3">
          <span>Mastery: {progress.mastery}%</span><span>Best: {formatTime(progress.bestTimeMs)}</span>
        </div>
      )}
      <button onClick={() => { const idx = Math.floor(Math.random() * cases.length); onSelectCase(cases[idx].id); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-[0.7rem] font-medium text-ink hover:border-ink/15 hover:bg-surface-2 transition-colors">
        <SkipForward className="size-3.5" />Next Random Case
      </button>
      <p className="text-[0.58rem] text-ink-3/60 text-center max-w-[200px]">
        A random case from the {cases.length} {cases.length === 21 ? "PLL" : ""} cases will be selected each time.
      </p>
    </div>
  );
}

function SequentialModePanel({ cases, currentIndex, selectedCaseId, onSelectCase }: {
  cases: AlgorithmCase[]; currentIndex: number; selectedCaseId: string | null; onSelectCase: (id: string) => void;
}) {
  return (
    <div className="p-3">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2 px-1">Progress</h4>
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between text-[0.55rem] text-ink-3 mb-1">
          <span>Case {currentIndex + 1} of {cases.length}</span>
          <span>{Math.round(((currentIndex + 1) / cases.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full rounded-full bg-ink/60 transition-all duration-300" style={{ width: `${((currentIndex + 1) / cases.length) * 100}%` }} />
        </div>
      </div>
      <div className="space-y-0.5">
        {cases.map((c, idx) => {
          const isCurrent = c.id === selectedCaseId;
          const isCompleted = idx < currentIndex;
          const progress = mockCaseProgress(c.caseNumber);
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors",
                isCurrent && "bg-surface-2 ring-1 ring-ink/10", !isCurrent && "hover:bg-surface-2/50")}>
              <span className={cn("nums text-[0.62rem] font-medium shrink-0 w-5", isCompleted ? "text-ready" : isCurrent ? "text-ink" : "text-ink-3")}>
                {isCompleted ? "✓" : idx + 1}
              </span>
              <span className={cn("text-[0.62rem] truncate flex-1", isCurrent ? "text-ink font-medium" : "text-ink-3")}>
                {c.caseNumber} {c.name}
              </span>
              <span className="nums text-[0.55rem] text-ink-3 shrink-0">{progress.mastery}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeaknessModePanel({ cases, selectedCaseId, onSelectCase }: {
  cases: AlgorithmCase[]; selectedCaseId: string | null; onSelectCase: (id: string) => void;
}) {
  return (
    <div className="p-3">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2 px-1">Weakest Cases First</h4>
      <p className="text-[0.58rem] text-ink-3/60 px-1 mb-2">Prioritized by lowest mastery. Practice your weakest cases to improve overall consistency.</p>
      <div className="space-y-1">
        {cases.slice(0, 10).map((c, idx) => {
          const progress = mockCaseProgress(c.caseNumber);
          const isSelected = c.id === selectedCaseId;
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors",
                isSelected && "bg-surface-2 ring-1 ring-ink/10", !isSelected && "hover:bg-surface-2/50")}>
              <span className={cn("nums text-[0.58rem] font-medium shrink-0 w-4", idx < 3 ? "text-hold" : idx < 6 ? "text-caution" : "text-ink-3")}>{idx + 1}</span>
              <span className="text-[0.62rem] text-ink truncate flex-1">{c.caseNumber} {c.name}</span>
              <span className={cn("nums text-[0.55rem] shrink-0", progress.mastery < 50 ? "text-hold" : progress.mastery < 75 ? "text-caution" : "text-ink-3")}>{progress.mastery}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Session Stats + Recent Attempts
   ─────────────────────────────────────────────────────────────────────── */

function SessionStatsPanel({ totalAttempts, correctCount, streak, avgTime }: {
  totalAttempts: number; correctCount: number; streak: number; avgTime: number;
}) {
  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Target} label="Accuracy" value={`${accuracy}%`} />
        <StatChip icon={Flame} label="Streak" value={`${streak}`} />
        <StatChip icon={Clock} label="Avg Time" value={avgTime > 0 ? formatTime(avgTime) : "--"} />
        <StatChip icon={RotateCcw} label="Attempts" value={`${totalAttempts}`} />
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

function RecentAttemptsPanel({ attempts }: { attempts: DrillAttempt[] }) {
  if (attempts.length === 0) {
    return (
      <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">Recent Attempts</h4>
        <p className="text-[0.6rem] text-ink-3/50 text-center py-4">Complete a drill to see results here</p>
      </div>
    );
  }
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface flex flex-col min-h-0 max-h-48">
      <div className="shrink-0 p-3 pb-2"><h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">Recent Attempts</h4></div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {attempts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-surface-2/50">
            {a.correct ? <Check className="size-3 text-ready shrink-0" /> : <X className="size-3 text-hold shrink-0" />}
            <span className="text-[0.62rem] text-ink font-medium">{a.caseLabel}</span>
            <span className="nums text-[0.62rem] text-ink-2 ml-auto">{formatTime(a.timeMs)}</span>
            <span className="nums text-[0.55rem] text-ink-3">TPS {calculateTps(a.algorithm, a.timeMs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
