"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, Algorithm } from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import {
  ArrowLeft, Eye, EyeOff, Check, X, Zap, Cpu, Hand,
  Lightbulb, RotateCcw, Flame, ChevronRight, Target, Brain,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type RecallStep = "show" | "drill" | "recall" | "verify";

interface RecallState {
  step: RecallStep;
  caseId: string;
  drillRepetitions: number;   // how many times user practiced in drill step
  timeMs: number;
  correct: boolean | null;    // null = not yet judged
  revealedInRecall: boolean;  // user peeked at the algorithm during recall
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock helpers
   ─────────────────────────────────────────────────────────────────────── */

function mockCaseMastery(caseNumber: string) {
  const n = parseInt(caseNumber.replace(/\D/g, ""), 10) || 0;
  return Math.min(99, 30 + ((n * 17) % 70));
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

const RECALL_STEPS: { id: RecallStep; label: string; num: number; desc: string }[] = [
  { id: "show",   label: "Show",   num: 1, desc: "Learn the algorithm" },
  { id: "drill",  label: "Drill",  num: 2, desc: "Practice with guidance" },
  { id: "recall", label: "Recall", num: 3, desc: "Execute from memory" },
  { id: "verify", label: "Verify", num: 4, desc: "Review your attempt" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Flash Recognition Mode
   ─────────────────────────────────────────────────────────────────────── */

function FlashRecognitionPanel({
  cases, onClose,
}: {
  cases: AlgorithmCase[]; onClose: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "showing" | "guessing" | "result">("idle");
  const [currentCase, setCurrentCase] = useState<AlgorithmCase | null>(null);
  const [options, setOptions] = useState<AlgorithmCase[]>([]);
  const [selection, setSelection] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateRound = useCallback(() => {
    if (cases.length < 4) return;
    const correct = cases[Math.floor(Math.random() * cases.length)];
    // Pick 3 distractors (different cases)
    const others = cases.filter((c) => c.id !== correct.id);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [correct, ...shuffled].sort(() => Math.random() - 0.5);
    setCurrentCase(correct);
    setOptions(opts);
    setSelection(null);
    setPhase("showing");
    // Hide after 500ms
    flashTimerRef.current = setTimeout(() => {
      setPhase("guessing");
    }, 500);
  }, [cases]);

  const handleGuess = (caseId: string) => {
    if (phase !== "guessing") return;
    setSelection(caseId);
    const isCorrect = caseId === currentCase?.id;
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setPhase("result");
  };

  const handleNext = () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    generateRound();
  };

  useEffect(() => {
    generateRound();
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, [generateRound]);

  return (
    <div className="flex flex-col items-center gap-6 h-full justify-center p-4">
      <button onClick={onClose} className="text-[0.62rem] text-ink-3 hover:text-ink self-start transition-colors">← Exit Flash</button>

      <div className="text-center">
        <Zap className="size-8 text-caution mx-auto mb-2" />
        <h3 className="text-[0.85rem] font-semibold text-ink">Flash Recognition</h3>
        <p className="text-[0.62rem] text-ink-3 mt-1">Case shown for 0.5s — identify it!</p>
      </div>

      {/* Case display area */}
      <div className="w-40 h-40 flex items-center justify-center rounded-xl border border-line bg-surface relative overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === "showing" && currentCase?.diagramType === "2d-top" && currentCase.diagram2D ? (
            <motion.div key="flash" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <CaseDiagram arrows={currentCase.diagram2D.arrows} moves={[]} style="full-color" className="w-36" />
            </motion.div>
          ) : phase === "guessing" ? (
            <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
              <EyeOff className="size-6 text-ink-3/40" />
              <span className="text-[0.58rem] text-ink-3/60">What case was it?</span>
            </motion.div>
          ) : phase === "result" ? (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
              {selection === currentCase?.id ? (
                <Check className="size-8 text-ready" />
              ) : (
                <X className="size-8 text-hold" />
              )}
              <span className="nums text-[0.7rem] font-semibold text-ink">{currentCase?.caseNumber}</span>
              <span className="text-[0.58rem] text-ink-2">{currentCase?.name}</span>
            </motion.div>
          ) : (
            <span className="text-[0.6rem] text-ink-3/40">Ready?</span>
          )}
        </AnimatePresence>
      </div>

      {/* Options */}
      {phase === "guessing" && (
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
          {options.map((opt) => (
            <button key={opt.id} onClick={() => handleGuess(opt.id)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-[0.7rem] font-medium text-ink hover:border-ink/20 hover:bg-surface-2 transition-all text-center">
              {opt.caseNumber}
            </button>
          ))}
        </div>
      )}

      {/* Result feedback */}
      {phase === "result" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-[0.62rem]">
            <span className="text-ready">✓ {score.correct}</span>
            <span className="text-ink-3">|</span>
            <span className="text-hold">✗ {score.total - score.correct}</span>
            <span className="text-ink-3">|</span>
            <span className="text-ink-2">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</span>
          </div>
          <button onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[0.7rem] font-medium text-surface hover:bg-ink/90 transition-colors">
            Next Case <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface AlgorithmRecallViewProps {
  methodId: string;
  phaseId: string;
  subsetId: string;
  onBack: () => void;
}

export function AlgorithmRecallView({
  methodId, phaseId: _phaseId, subsetId, onBack,
}: AlgorithmRecallViewProps) {
  void _phaseId;

  // ── Data ─────────────────────────────────────────────────────────────
  const { cases: allCases, algorithms: allAlgorithms } = useMemo(() => getSeedData(), []);
  const subset = useMemo(() => SUBSETS.find((s) => s.id === subsetId), [subsetId]);
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const subsetCases = useMemo(
    () => allCases.filter((c) => c.subsetId === subsetId).sort((a, b) => a.sortOrder - b.sortOrder),
    [allCases, subsetId],
  );

  // Find weakest cases first
  const weaknessOrdered = useMemo(
    () => [...subsetCases].sort((a, b) => mockCaseMastery(a.caseNumber) - mockCaseMastery(b.caseNumber)),
    [subsetCases],
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [recallState, setRecallState] = useState<RecallState>({
    step: "show",
    caseId: weaknessOrdered[0]?.id ?? "",
    drillRepetitions: 0,
    timeMs: 0,
    correct: null,
    revealedInRecall: false,
  });
  const [flashMode, setFlashMode] = useState(false);
  const [showAlgorithmInDrill, setShowAlgorithmInDrill] = useState(true);
  const [timerPhase, setTimerPhase] = useState<"idle" | "running" | "stopped">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [completedCases, setCompletedCases] = useState<string[]>([]);
  const [smartCubeMode, setSmartCubeMode] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Derived ──────────────────────────────────────────────────────────
  const currentCase = useMemo(
    () => subsetCases.find((c) => c.id === recallState.caseId) ?? null,
    [subsetCases, recallState.caseId],
  );
  const currentAlgorithms = useMemo(
    () => (recallState.caseId ? allAlgorithms.filter((a) => a.caseId === recallState.caseId) : []),
    [recallState.caseId, allAlgorithms],
  );
  const defaultAlgorithm = currentAlgorithms.find((a) => a.isDefault) ?? currentAlgorithms[0];
  const algoText = defaultAlgorithm?.moves.join(" ") ?? "";

  const nextUnlearnedCase = useMemo(() => {
    return weaknessOrdered.find((c) => !completedCases.includes(c.id));
  }, [weaknessOrdered, completedCases]);

  // ── Step navigation ───────────────────────────────────────────────────
  const advanceStep = useCallback(() => {
    setRecallState((prev) => {
      const idx = RECALL_STEPS.findIndex((s) => s.id === prev.step);
      const next = RECALL_STEPS[idx + 1];
      return next ? { ...prev, step: next.id } : prev;
    });
  }, []);

  const startNewCase = useCallback(() => {
    const nextCase = nextUnlearnedCase;
    if (!nextCase) {
      // All cases completed
      setRecallState((prev) => ({ ...prev, step: "verify", correct: null }));
      return;
    }
    setRecallState({
      step: "show",
      caseId: nextCase.id,
      drillRepetitions: 0,
      timeMs: 0,
      correct: null,
      revealedInRecall: false,
    });
    setShowAlgorithmInDrill(true);
    setTimerPhase("idle");
    setCurrentTime(0);
  }, [nextUnlearnedCase]);

  // ── Drill: track repetitions ──────────────────────────────────────────
  const incrementDrill = useCallback(() => {
    setRecallState((prev) => ({ ...prev, drillRepetitions: prev.drillRepetitions + 1 }));
  }, []);

  // ── Recall timer ─────────────────────────────────────────────────────
  const startRecallTimer = useCallback(() => {
    setTimerPhase("running");
    setCurrentTime(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setCurrentTime(Date.now() - startTimeRef.current);
    }, 10);
  }, []);

  const stopRecallTimer = useCallback(() => {
    if (timerPhase !== "running") return;
    setTimerPhase("stopped");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const elapsed = Date.now() - startTimeRef.current;
    setCurrentTime(elapsed);
    setRecallState((prev) => ({ ...prev, timeMs: elapsed }));
  }, [timerPhase]);

  const handleRecallTimerTap = useCallback(() => {
    if (timerPhase === "idle") startRecallTimer();
    else if (timerPhase === "running") stopRecallTimer();
    else if (timerPhase === "stopped") advanceStep();
  }, [timerPhase, startRecallTimer, stopRecallTimer, advanceStep]);

  // ── Verify: mark correct/incorrect ────────────────────────────────────
  const markResult = useCallback((correct: boolean) => {
    setRecallState((prev) => ({ ...prev, correct }));
    setCompletedCases((prev) => [...prev, recallState.caseId]);
  }, [recallState.caseId]);

  // ── Reveal algorithm during recall ────────────────────────────────────
  const revealDuringRecall = useCallback(() => {
    setRecallState((prev) => ({ ...prev, revealedInRecall: true }));
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Flash mode ────────────────────────────────────────────────────────
  if (flashMode) {
    return (
      <div className="relative flex-1 min-h-0 w-full h-full">
        <div className="absolute inset-0 flex flex-col overflow-hidden">
          <header className="shrink-0 flex items-center gap-3 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
            <span className="text-[0.72rem] font-semibold text-ink">{method?.name} › {subset?.name} › Flash</span>
          </header>
          <div className="flex-1 min-h-0">
            <FlashRecognitionPanel cases={subsetCases} onClose={() => setFlashMode(false)} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header with step progress */}
        <RecallHeader
          methodName={method?.name ?? "?"}
          subsetName={subset?.name ?? "?"}
          currentStep={recallState.step}
          completedCount={completedCases.length}
          totalCount={subsetCases.length}
          onBack={onBack}
          onFlashMode={() => setFlashMode(true)}
          smartCubeMode={smartCubeMode}
          onToggleSmartCube={() => setSmartCubeMode((v) => !v)}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row">
          {/* Left: Case diagram + algorithm + step-specific content */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Case diagram */}
            <div className="shrink-0 p-4 rounded-xl border border-line bg-surface flex items-start gap-4">
              <div className="shrink-0">
                {currentCase?.diagramType === "2d-top" && currentCase.diagram2D ? (
                  <CaseDiagram
                    arrows={currentCase.diagram2D.arrows}
                    moves={defaultAlgorithm?.moves}
                    style="full-color"
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
                  <span className="nums text-[0.85rem] font-semibold text-ink">{currentCase?.caseNumber ?? "--"}</span>
                  <span className="text-[0.7rem] text-ink-2 ml-2">{currentCase?.name ?? "Select a case"}</span>
                  <span className="nums text-[0.58rem] text-ink-3 ml-2">mastery {currentCase ? mockCaseMastery(currentCase.caseNumber) : 0}%</span>
                </div>

                {/* Algorithm panel — visibility depends on step */}
                <AlgorithmPanel
                  algoText={algoText}
                  step={recallState.step}
                  revealedInRecall={recallState.revealedInRecall}
                  onReveal={revealDuringRecall}
                  showInDrill={showAlgorithmInDrill}
                  onToggleDrill={() => setShowAlgorithmInDrill((v) => !v)}
                />

                {currentCase?.setupScramble && (
                  <div>
                    <span className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3/60">Setup</span>
                    <p className="nums text-[0.65rem] text-ink-2/70 mt-0.5">{currentCase.setupScramble}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Step-specific content area */}
            <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center rounded-xl border border-line bg-surface relative overflow-hidden p-6">
              {recallState.step === "show" && <ShowStepContent algoText={algoText} onReady={advanceStep} />}
              {recallState.step === "drill" && (
                <DrillStepContent
                  algoText={algoText}
                  drillCount={recallState.drillRepetitions}
                  onDrill={incrementDrill}
                  onReady={advanceStep}
                />
              )}
              {recallState.step === "recall" && (
                <RecallStepContent
                  timeMs={currentTime}
                  timerPhase={timerPhase}
                  onTimerTap={handleRecallTimerTap}
                  onReveal={revealDuringRecall}
                  revealed={recallState.revealedInRecall}
                  smartCubeMode={smartCubeMode}
                />
              )}
              {recallState.step === "verify" && (
                <VerifyStepContent
                  timeMs={recallState.timeMs}
                  correct={recallState.correct}
                  algoText={algoText}
                  revealedInRecall={recallState.revealedInRecall}
                  isComplete={completedCases.length >= subsetCases.length}
                  onMarkCorrect={() => markResult(true)}
                  onMarkIncorrect={() => markResult(false)}
                  onNextCase={startNewCase}
                  onBackToMethods={onBack}
                />
              )}
            </div>
          </div>

          {/* Right: Case queue + stats */}
          <aside className="flex min-h-0 flex-col gap-3 lg:w-64 lg:shrink-0 overflow-hidden">
            <CaseQueuePanel
              cases={weaknessOrdered}
              currentCaseId={recallState.caseId}
              completedCases={completedCases}
              onSelectCase={(id) => setRecallState((prev) => ({ ...prev, caseId: id, step: "show", drillRepetitions: 0, timeMs: 0, correct: null, revealedInRecall: false }))}
            />
            <RecallStatsPanel
              completedCount={completedCases.length}
              totalCount={subsetCases.length}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Header
   ─────────────────────────────────────────────────────────────────────── */

function RecallHeader({
  methodName, subsetName, currentStep, completedCount, totalCount,
  onBack, onFlashMode, smartCubeMode, onToggleSmartCube,
}: {
  methodName: string; subsetName: string; currentStep: RecallStep;
  completedCount: number; totalCount: number;
  onBack: () => void; onFlashMode: () => void;
  smartCubeMode: boolean; onToggleSmartCube: () => void;
}) {
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0">
          <ArrowLeft className="size-3" />Back
        </button>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{methodName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{subsetName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-semibold text-ink">Recall</span>
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">{completedCount}/{totalCount} learned</span>
        <button onClick={onFlashMode}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-caution/30 bg-caution-soft/30 px-2 py-1 text-[0.6rem] font-medium text-caution hover:bg-caution-soft/50 transition-colors">
          <Zap className="size-3" />Flash
        </button>
        <button onClick={onToggleSmartCube}
          className={cn("shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors border",
            smartCubeMode ? "border-ink/20 bg-ink text-surface" : "border-line bg-surface text-ink-3 hover:text-ink hover:border-ink/15")}>
          {smartCubeMode ? "Smart Cube" : "Manual"}
        </button>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-0.5">
        {RECALL_STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isPast = RECALL_STEPS.findIndex((s) => s.id === currentStep) > idx;
          return (
            <div key={step.id} className="flex items-center gap-0.5 flex-1">
              <div className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
                isActive && "bg-ink text-surface",
                isPast && "bg-surface-2 text-ink-2",
                !isActive && !isPast && "bg-surface-2/50 text-ink-3/60",
              )}>
                <span className={cn("grid size-4 place-items-center rounded-full text-[0.5rem] font-bold",
                  isActive ? "bg-surface/20 text-surface" : isPast ? "bg-ready text-surface" : "bg-ink-3/20 text-ink-3")}>
                  {isPast ? "✓" : step.num}
                </span>
                <span className="text-[0.65rem] font-medium leading-none">{step.label}</span>
              </div>
              {idx < RECALL_STEPS.length - 1 && (
                <div className={cn("h-px flex-1", isPast ? "bg-ready/50" : "bg-line")} />
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Step Content Panels
   ─────────────────────────────────────────────────────────────────────── */

function ShowStepContent({ algoText, onReady }: { algoText: string; onReady: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="space-y-2">
        <Brain className="size-8 text-ink-2 mx-auto" />
        <h3 className="text-[0.85rem] font-semibold text-ink">Step 1: Learn</h3>
        <p className="text-[0.62rem] text-ink-3 max-w-xs">
          Study the algorithm above. Repeat it mentally or on your cube until it feels familiar.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-surface-2 min-w-[240px]">
        <span className="text-[0.55rem] font-medium uppercase tracking-[0.12em] text-ink-3">Algorithm to learn</span>
        <p className="nums text-[0.95rem] font-bold text-ink leading-relaxed tracking-tight">{algoText || "No algorithm"}</p>
        <div className="flex gap-2 text-[0.58rem] text-ink-3/60">
          <span>Repeat 3× on your cube</span>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onReady}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors">
          I've got it <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DrillStepContent({
  algoText, drillCount, onDrill, onReady,
}: {
  algoText: string; drillCount: number; onDrill: () => void; onReady: () => void;
}) {
  const enoughDrills = drillCount >= 3;
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="space-y-2">
        <RotateCcw className="size-8 text-ink-2 mx-auto" />
        <h3 className="text-[0.85rem] font-semibold text-ink">Step 2: Drill</h3>
        <p className="text-[0.62rem] text-ink-3 max-w-xs">
          Execute the algorithm while looking at it. Build muscle memory. Repeat at least 3 times.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-surface-2 min-w-[200px]">
        <span className="text-[0.55rem] font-medium uppercase tracking-[0.12em] text-ink-3">Repetitions</span>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cn(
              "size-8 grid place-items-center rounded-full border-2 transition-all",
              drillCount >= n ? "border-ready bg-ready-soft text-ready" : "border-line text-ink-3/30",
            )}>
              {drillCount >= n ? <Check className="size-4" /> : <span className="nums text-[0.65rem]">{n}</span>}
            </div>
          ))}
        </div>
        <span className="text-[0.58rem] text-ink-3">{drillCount} of 3 minimum</span>
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onDrill}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-[0.7rem] font-medium text-ink hover:border-ink/15 hover:bg-surface-2 transition-colors">
          <RotateCcw className="size-3.5" /> Execute Again
        </button>
        <button onClick={onReady}
          className={cn("inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[0.75rem] font-semibold transition-colors",
            enoughDrills ? "bg-ink text-surface hover:bg-ink/90" : "bg-surface-2 text-ink-3 cursor-not-allowed opacity-50")}
          disabled={!enoughDrills}>
          Ready for Recall <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function RecallStepContent({
  timeMs, timerPhase, onTimerTap, onReveal, revealed, smartCubeMode,
}: {
  timeMs: number; timerPhase: "idle" | "running" | "stopped";
  onTimerTap: () => void; onReveal: () => void; revealed: boolean;
  smartCubeMode: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center w-full">
      <div className="space-y-2">
        <EyeOff className="size-8 text-ink-2 mx-auto" />
        <h3 className="text-[0.85rem] font-semibold text-ink">Step 3: Recall</h3>
        <p className="text-[0.62rem] text-ink-3 max-w-xs">
          Algorithm is hidden. Execute it from memory. Tap to start the timer.
        </p>
      </div>

      {/* Timer button */}
      <button onClick={onTimerTap}
        className={cn(
          "w-full max-w-[300px] flex flex-col items-center justify-center gap-3 py-10 rounded-xl border select-none outline-none transition-all duration-150",
          timerPhase === "idle" && "border-line bg-surface hover:bg-surface-2/50 cursor-pointer",
          timerPhase === "running" && "border-ink/10 bg-surface cursor-pointer",
          timerPhase === "stopped" && "border-ready/30 bg-ready-soft/20",
        )}>
        <span className={cn("nums text-[2.8rem] font-bold tracking-tight tabular-nums",
          timerPhase === "running" ? "text-ink" : timerPhase === "idle" ? "text-ink-2" : "text-ink")}>
          {timerPhase === "idle" ? "0.00" : formatTime(timeMs)}
        </span>
        <span className="text-[0.62rem] text-ink-3">
          {timerPhase === "idle" ? "Tap to start timer" : timerPhase === "running" ? "Tap when done" : "Time recorded"}
        </span>
        <span className="flex items-center gap-1.5 text-[0.55rem] text-ink-3/70">
          {smartCubeMode ? <><Cpu className="size-3" />Smart Cube</> : <><Hand className="size-3" />Manual</>}
        </span>
      </button>

      {/* Reveal button (only during recall, before timer is stopped) */}
      {timerPhase !== "stopped" && !revealed && (
        <button onClick={onReveal}
          className="inline-flex items-center gap-1.5 text-[0.62rem] text-ink-3 hover:text-ink transition-colors">
          <Eye className="size-3" /> I forgot, show algorithm
        </button>
      )}

      {revealed && (
        <span className="text-[0.58rem] text-caution">Peeked at algorithm — keep trying!</span>
      )}

      {/* Continue to verify */}
      {timerPhase === "stopped" && (
        <button onClick={onTimerTap}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors">
          Continue to Verify <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

function VerifyStepContent({
  timeMs, correct, algoText, revealedInRecall, isComplete,
  onMarkCorrect, onMarkIncorrect, onNextCase, onBackToMethods,
}: {
  timeMs: number; correct: boolean | null; algoText: string;
  revealedInRecall: boolean; isComplete: boolean;
  onMarkCorrect: () => void; onMarkIncorrect: () => void;
  onNextCase: () => void; onBackToMethods: () => void;
}) {
  if (isComplete && correct !== null) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="space-y-2">
          <Flame className="size-10 text-caution mx-auto" />
          <h3 className="text-[0.9rem] font-semibold text-ink">All Cases Learned!</h3>
          <p className="text-[0.65rem] text-ink-3 max-w-xs">
            You've completed the Recall session for this subset. Return tomorrow for spaced repetition review.
          </p>
        </div>
        <button onClick={onBackToMethods}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors">
          <ArrowLeft className="size-4" /> Back to Methods
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="space-y-2">
        <Target className="size-8 text-ink-2 mx-auto" />
        <h3 className="text-[0.85rem] font-semibold text-ink">Step 4: Verify</h3>
        <p className="text-[0.62rem] text-ink-3 max-w-xs">
          Did you execute the algorithm correctly? Be honest — this drives your spaced repetition schedule.
        </p>
      </div>

      {/* Time and details */}
      <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-surface-2 min-w-[200px]">
        <span className="nums text-[1.5rem] font-bold text-ink">{formatTime(timeMs)}</span>
        <span className="text-[0.58rem] text-ink-3">Recall time</span>
        {revealedInRecall && (
          <span className="text-[0.58rem] text-caution">⚠ Peeked at algorithm</span>
        )}
      </div>

      {/* Algorithm revealed for comparison */}
      <div className="p-3 rounded-lg bg-surface-2 max-w-xs">
        <span className="text-[0.55rem] font-medium uppercase tracking-[0.12em] text-ink-3 block mb-1">Expected Algorithm</span>
        <p className="nums text-[0.72rem] font-medium text-ink leading-relaxed">{algoText}</p>
      </div>

      {/* Mark buttons (only if not yet judged) */}
      {correct === null ? (
        <div className="flex gap-3 mt-2">
          <button onClick={onMarkIncorrect}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-hold/30 bg-hold-soft/40 px-5 py-2.5 text-[0.75rem] font-semibold text-hold hover:bg-hold-soft/60 hover:border-hold/50 transition-all">
            <X className="size-4" /> Incorrect
          </button>
          <button onClick={onMarkCorrect}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-ready/30 bg-ready-soft/40 px-5 py-2.5 text-[0.75rem] font-semibold text-ready hover:bg-ready-soft/60 hover:border-ready/50 transition-all">
            <Check className="size-4" /> Correct
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 mt-2">
          <span className={cn("text-[0.7rem] font-semibold", correct ? "text-ready" : "text-hold")}>
            {correct ? "✓ Marked Correct — Review in 1 day" : "✗ Marked Incorrect — Review again soon"}
          </span>
          <button onClick={onNextCase}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[0.7rem] font-semibold text-surface hover:bg-ink/90 transition-colors">
            Next Case <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Algorithm Panel (shared)
   ─────────────────────────────────────────────────────────────────────── */

function AlgorithmPanel({
  algoText, step, revealedInRecall, onReveal, showInDrill, onToggleDrill,
}: {
  algoText: string; step: RecallStep; revealedInRecall: boolean;
  onReveal: () => void; showInDrill: boolean; onToggleDrill: () => void;
}) {
  const isVisible = step === "show"
    || (step === "drill" && showInDrill)
    || (step === "recall" && revealedInRecall)
    || step === "verify";

  return (
    <div className={cn("rounded-lg border p-3 transition-all duration-200",
      isVisible ? "border-line bg-surface-2" : "border-line/50 bg-surface-2/50")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3">Algorithm</span>
        <div className="flex items-center gap-2">
          {step === "drill" && (
            <button onClick={onToggleDrill}
              className="rounded p-0.5 text-ink-3 hover:text-ink transition-colors"
              title={showInDrill ? "Hide algorithm" : "Show algorithm"}>
              {showInDrill ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
          {step === "recall" && !revealedInRecall && (
            <button onClick={onReveal}
              className="rounded p-0.5 text-ink-3 hover:text-ink transition-colors"
              title="Reveal algorithm">
              <Eye className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {isVisible ? (
        <p className="nums text-[0.78rem] font-medium text-ink leading-relaxed">{algoText || "No algorithm available"}</p>
      ) : (
        <p className="nums text-[0.78rem] text-ink-3/40 italic select-none">Algorithm hidden 🔒</p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Case Queue Panel
   ─────────────────────────────────────────────────────────────────────── */

function CaseQueuePanel({
  cases, currentCaseId, completedCases, onSelectCase,
}: {
  cases: AlgorithmCase[]; currentCaseId: string; completedCases: string[];
  onSelectCase: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface flex flex-col overflow-hidden">
      <div className="shrink-0 p-3 pb-2">
        <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">Learning Queue</h4>
        <p className="text-[0.55rem] text-ink-3/60 mt-0.5">Weakest cases first</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {cases.map((c) => {
          const isCurrent = c.id === currentCaseId;
          const isDone = completedCases.includes(c.id);
          const mastery = mockCaseMastery(c.caseNumber);
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors",
                isCurrent && "bg-surface-2 ring-1 ring-ink/10",
                isDone && !isCurrent && "opacity-50",
                !isCurrent && !isDone && "hover:bg-surface-2/50")}>
              <span className={cn("shrink-0 grid size-4 place-items-center rounded-full text-[0.45rem] font-bold",
                isDone ? "bg-ready text-surface" : isCurrent ? "bg-ink text-surface" : "bg-ink-3/15 text-ink-3")}>
                {isDone ? "✓" : ""}
              </span>
              <span className={cn("nums text-[0.6rem] flex-1 truncate", isCurrent ? "text-ink font-medium" : "text-ink-3")}>
                {c.caseNumber}
              </span>
              <span className={cn("nums text-[0.5rem] shrink-0", mastery < 50 ? "text-hold" : mastery < 75 ? "text-caution" : "text-ink-3")}>
                {mastery}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecallStatsPanel({ completedCount, totalCount }: { completedCount: number; totalCount: number }) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.58rem] text-ink-3">Progress</span>
          <span className="nums text-[0.62rem] font-medium text-ink">{completedCount}/{totalCount}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="h-full rounded-full bg-ink/60" />
        </div>
        <span className="text-[0.55rem] text-ink-3">{pct}% complete</span>
      </div>
      <div className="mt-2 pt-2 border-t border-line flex items-center gap-1 text-[0.55rem] text-ink-3/70">
        <Lightbulb className="size-2.5" />
        Spaced repetition: review in 1d, 3d, 7d...
      </div>
    </div>
  );
}
