"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData, SUBSET_VISUALIZATION } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, Algorithm, VisualizationStyle } from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillTimer } from "@/hooks/useDrillTimer";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { generateRandomSetup } from "@/lib/training/setupGenerator";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  X,
  SkipForward,
  Shuffle,
  Target,
  Clock,
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

/** Face letter → color name for orientation indicator (WCA standard). */
const FACE_COLOR_NAMES: Record<string, string> = {
  U: 'White', R: 'Red', F: 'Green', D: 'Yellow', L: 'Orange', B: 'Blue',
};

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
    () => allCases.filter((c) => c.subsetId === subsetId).sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, undefined, { numeric: true })),
    [allCases, subsetId],
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [drillMode, setDrillMode] = useState<DrillMode>("single");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(preselectedCaseId ?? null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [revealIfFail, setRevealIfFail] = useState(false);
  const [attempts, setAttempts] = useState<DrillAttempt[]>([]);
  const [seqIndex, setSeqIndex] = useState(0);
  const [currentSetup, setCurrentSetup] = useState("");
  const [showVerdict, setShowVerdict] = useState(false);
  const [setupVersion, setSetupVersion] = useState(0);

  // ── Orientation (remaps scramble display to match cube orientation) ──
  const { remapScramble, orientation } = useOrientation();

  // ── Drill timer (hold-to-arm, space key) ───────────────────────────────
  const { phase, time, stoppedTime, press, release, reset, engine } = useDrillTimer();

  // ── Smart Cube wiring (BLE + scramble validation + auto-arm) ───────────
  const drillSmartCube = useDrillSmartCube({
    engine,
    setupScramble: currentSetup,
  });

  // Show verdict overlay when timer stops, hide when engine leaves stopped
  useEffect(() => {
    if (phase === "stopped" && stoppedTime > 0) {
      setShowVerdict(true);
    } else if (phase !== "stopped") {
      setShowVerdict(false);
    }
  }, [phase, stoppedTime]);

  // ── Visualization style (yellow-gray for OLL, full-color for PLL, etc.) ─
  const visualizationStyle = useMemo<VisualizationStyle>(() => {
    const config = subset?.name ? SUBSET_VISUALIZATION[subset.name] : undefined;
    return config?.style ?? 'full-color';
  }, [subset]);

  // ── Timer hint context (controls TimerDisplay hint text) ─────────────
  const hasSmartCube = drillSmartCube.smartCubeConnected;
  const drillHintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube,
    inspection: false,
    isScrambled: drillSmartCube.validation.isScrambled,
  }), [hasSmartCube, drillSmartCube.validation.isScrambled]);

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

  // ── Case navigation & mode change ─────────────────────────────────────
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

  const handleModeChange = useCallback(
    (newMode: DrillMode) => {
      setDrillMode(newMode);
      if (subsetCases.length > 0) {
        if (newMode === "random") {
          const idx = Math.floor(Math.random() * subsetCases.length);
          setSelectedCaseId(subsetCases[idx].id);
        } else if (newMode === "sequential") {
          setSeqIndex(0);
          setSelectedCaseId(subsetCases[0].id);
        } else if (newMode === "weakness" && weaknessOrdered.length > 0) {
          setSelectedCaseId(weaknessOrdered[0].id);
        }
      }
    },
    [subsetCases, weaknessOrdered],
  );

  // Auto-select initial case on load or when drillMode is random and nothing is selected
  useEffect(() => {
    if (!selectedCaseId && subsetCases.length > 0) {
      if (drillMode === "random") {
        const idx = Math.floor(Math.random() * subsetCases.length);
        setSelectedCaseId(subsetCases[idx].id);
      } else {
        setSelectedCaseId(subsetCases[0].id);
      }
    }
  }, [selectedCaseId, subsetCases, drillMode]);

  // ── Random setup generation (when case or setupVersion changes) ──────
  useEffect(() => {
    if (defaultAlgorithm?.moves) {
      const setup = generateRandomSetup(defaultAlgorithm.moves);
      setCurrentSetup(setup || selectedCase?.setupScramble || "");
    } else {
      setCurrentSetup("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId, defaultAlgorithm?.id, setupVersion]);

  // ── Verdict handlers ──────────────────────────────────────────────────
  const recordAttempt = useCallback(
    (correct: boolean) => {
      if (!selectedCase || !defaultAlgorithm) return;
      const attempt: DrillAttempt = {
        id: nextAttemptId(),
        caseId: selectedCase.id,
        caseLabel: selectedCase.caseNumber,
        algorithm: defaultAlgorithm.moves,
        timeMs: stoppedTime,
        correct,
        timestamp: Date.now(),
      };
      setAttempts((prev) => [attempt, ...prev]);
      if (!correct && revealIfFail) setShowAlgorithm(true);
    },
    [selectedCase, defaultAlgorithm, revealIfFail, stoppedTime],
  );

  const handleMarkCorrect = useCallback(() => {
    recordAttempt(true);
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [recordAttempt, reset, selectNextCase]);

  const handleMarkIncorrect = useCallback(() => {
    recordAttempt(false);
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [recordAttempt, reset, selectNextCase]);

  const handleSkip = useCallback(() => {
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [reset, selectNextCase]);

  // ── Orientation-adapted display scramble (matches user's cube) ─────────
  const displaySetup = remapScramble(currentSetup);

  // ── Orientation indicator: which color is on U (top) and F (front) ────
  const topColor = FACE_COLOR_NAMES[orientation.faceMap['U']] ?? '?';
  const frontColor = FACE_COLOR_NAMES[orientation.faceMap['F']] ?? '?';

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
          onModeChange={handleModeChange}
          masteredCount={subsetCases.filter((c) => mockCaseProgress(c.caseNumber).mastery >= 90).length}
          totalCount={subsetCases.length}
          onBack={onBack}
          smartCubeConnected={drillSmartCube.smartCubeConnected}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row">
          {/* Left: Active drill area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Case info bar (compact) */}
            <div className="shrink-0 flex items-center gap-3 px-1">
              <span className="nums text-[0.85rem] font-semibold text-ink">{selectedCase?.caseNumber ?? "--"}</span>
              <span className="text-[0.7rem] text-ink-2">{selectedCase?.name ?? "Select a case"}</span>
              {hasSmartCube && (
                <span className="text-[0.55rem] text-ink-3/60 ml-auto flex items-center gap-1.5">
                  <span className="flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-yellow-400" />
                    {topColor}
                  </span>
                  <span className="text-ink-3/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-green-400" />
                    {frontColor}
                  </span>
                </span>
              )}
            </div>

            {/* Row: Case diagram (left) + Setup scramble (right) */}
            <div className="shrink-0 flex items-stretch gap-4 rounded-xl border border-line bg-surface p-4">
              {/* Left: Case diagram */}
              <div className="shrink-0 flex items-center justify-center">
                {selectedCase && selectedCase.diagramType === "2d-top" && selectedCase.diagram2D ? (
                  <CaseDiagram
                    arrows={selectedCase.diagram2D.arrows}
                    setupScramble={selectedCase.setupScramble}
                    moves={defaultAlgorithm?.moves}
                    style={visualizationStyle}
                    className="w-28 sm:w-36"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center rounded-lg bg-surface-2">
                    <span className="text-ink-3/40 text-[0.6rem]">No diagram</span>
                  </div>
                )}
              </div>

              {/* Right: Setup scramble with ScrambleDisplay (same component as practice timer, compact) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                {currentSetup ? (
                  <ScrambleDisplay
                    scramble={currentSetup}
                    displayScramble={displaySetup}
                    states={hasSmartCube ? drillSmartCube.validation.states : undefined}
                    currentIndex={hasSmartCube ? drillSmartCube.validation.currentIndex : 0}
                    errorMoves={hasSmartCube ? drillSmartCube.validation.displayErrorMoves : []}
                    pendingHalfDouble={hasSmartCube ? drillSmartCube.validation.pendingHalfDouble : false}
                    isScrambled={hasSmartCube ? drillSmartCube.validation.isScrambled : false}
                    needsReset={hasSmartCube ? drillSmartCube.validation.needsReset : false}
                    awaitingSolve={hasSmartCube ? drillSmartCube.validation.awaitingSolve : false}
                  />
                ) : (
                  <p className="nums text-[0.85rem] text-ink-3/40 italic px-1">Select a case to generate setup</p>
                )}
              </div>
            </div>

            {/* Algorithm section — hidden by default, compact */}
            <div className="shrink-0 rounded-xl border border-line/60 bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3">Algorithm</span>
                  {showAlgorithm && (
                    <span className="nums text-[0.65rem] text-ink-2/80 truncate max-w-75">
                      {algoText || "No algorithm available"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[0.58rem] text-ink-3 cursor-pointer select-none">
                    <input type="checkbox" checked={revealIfFail} onChange={(e) => setRevealIfFail(e.target.checked)} className="size-3 rounded border-line accent-ink" />
                    Reveal if fail
                  </label>
                  <button
                    onClick={() => setShowAlgorithm((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors bg-surface-2 text-ink-3 hover:text-ink hover:bg-line"
                    title={showAlgorithm ? "Hide algorithm" : "Show algorithm"}
                  >
                    {showAlgorithm ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showAlgorithm ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {!showAlgorithm && (
                <p className="text-[0.6rem] text-ink-3/40 italic flex items-center gap-1.5 mt-1">
                  <Lock className="size-3" /> Algorithm hidden — reveal after attempting
                </p>
              )}
            </div>

            {/* Timer area (BIG) with verdict overlay */}
            <div className="flex-1 min-h-50 rounded-xl border border-line bg-surface relative overflow-hidden">
              {/* Verdict overlay */}
              <AnimatePresence>
                {showVerdict && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 rounded-xl bg-surface/98"
                  >
                    <span className="nums text-[2.5rem] sm:text-[3rem] font-bold text-ink tracking-tight">
                      {formatTime(stoppedTime)}
                    </span>
                    <span className="nums text-[0.75rem] text-ink-3">
                      TPS {calculateTps(defaultAlgorithm?.moves ?? [], stoppedTime)}
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

              {/* TimerContainer — BIG, fills the space */}
              <TimerContainer
                phase={phase}
                time={time}
                lastTime={null}
                hintCtx={drillHintCtx}
                onPress={press}
                onRelease={release}
                className="h-full"
              />
            </div>
          </div>

          {/* Right: Sidebar */}
          <aside className="flex min-h-0 flex-col gap-4 lg:w-80 lg:shrink-0 overflow-hidden">
            {/* Mini 3D Cube Panel — only when smart cube is connected */}
            {hasSmartCube && (
              <MiniCube3DPanel className="shrink-0" />
            )}

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
  methodName, subsetName, drillMode, onModeChange, masteredCount, totalCount, onBack, smartCubeConnected,
}: {
  methodName: string; subsetName: string; drillMode: DrillMode; onModeChange: (m: DrillMode) => void;
  masteredCount: number; totalCount: number; onBack: () => void; smartCubeConnected: boolean;
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
        {smartCubeConnected && (
          <span className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400">
            Smart Cube
          </span>
        )}
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
    <div className="p-3.5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
        <h4 className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-3">Select Case</h4>
        <span className="nums text-[0.62rem] text-ink-3/70 font-medium">{cases.length} cases</span>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-0.5">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          const progress = mockCaseProgress(c.caseNumber);
          const caseAlg = algorithms.find((a) => a.caseId === c.id && a.isDefault) ?? algorithms.find((a) => a.caseId === c.id);
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all duration-150 shadow-xs",
                isSelected ? "border-ink/40 bg-surface-2 ring-2 ring-ink/15 shadow-sm" : "border-line bg-surface hover:border-ink/20 hover:bg-surface-2/60")}>
              <div className="flex items-center justify-between">
                <span className="nums text-[0.78rem] font-bold text-ink">{c.caseNumber}</span>
                <span className="nums text-[0.6rem] font-semibold text-ink-3">{progress.mastery}%</span>
              </div>
              {caseAlg && <span className="nums text-[0.58rem] font-medium text-ink-2/80 truncate leading-tight">{caseAlg.moves.join(" ")}</span>}
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-0.5">
                <div className={cn("h-full rounded-full transition-all duration-300", progress.mastery >= 90 ? "bg-ready" : progress.mastery >= 60 ? "bg-caution" : "bg-hold")} style={{ width: `${progress.mastery}%` }} />
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
      <p className="text-[0.58rem] text-ink-3/60 text-center max-w-50">
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
