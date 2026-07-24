"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData, SUBSET_VISUALIZATION } from "@cubeforge/algorithm-db";
import type { AlgorithmCase, VisualizationStyle } from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Practice/components/CaseDiagram";
import {
  ArrowLeft, Check, X, ChevronRight, Target, Brain,
  Shuffle, TrendingDown,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type QuizMode = "weakest" | "random";

interface QuizRound {
  /** The case being quizzed */
  caseId: string;
  /** The 4 option cases (includes the correct one) */
  options: AlgorithmCase[];
  /** User's selected option id, null = not yet answered */
  selectedId: string | null;
  /** Whether the round has been answered */
  answered: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock helpers  (will be replaced with real mastery data later)
   ─────────────────────────────────────────────────────────────────────── */

function mockCaseMastery(caseNumber: string) {
  const n = parseInt(caseNumber.replace(/\D/g, ""), 10) || 0;
  return Math.min(99, 30 + ((n * 17) % 70));
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

/** Pick `count` random items from `arr`, excluding items with id in `excludeIds` */
function pickRandom<T extends { id: string }>(arr: T[], count: number, excludeIds: Set<string>): T[] {
  const pool = arr.filter((item) => !excludeIds.has(item.id));
  const result: T[] = [];
  const used = new Set<number>();
  while (result.length < count && result.length < pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!used.has(idx)) {
      used.add(idx);
      result.push(pool[idx]);
    }
  }
  return result;
}

/** Shuffle an array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface AlgorithmRecognizeViewProps {
  methodId: string;
  phaseId: string;
  subsetId: string;
  onBack: () => void;
}

export function AlgorithmRecognizeView({
  methodId, phaseId: _phaseId, subsetId, onBack,
}: AlgorithmRecognizeViewProps) {
  void _phaseId;

  // ── Data ─────────────────────────────────────────────────────────────
  const { cases: allCases } = useMemo(() => getSeedData(), []);
  const subset = useMemo(() => SUBSETS.find((s) => s.id === subsetId), [subsetId]);
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const subsetCases = useMemo(
    () =>
      allCases
        .filter(
          (c): c is typeof c & { id: string } =>
            Boolean(c.id && c.subsetId === subsetId)
        )
        .sort((a, b) =>
          a.caseNumber.localeCompare(b.caseNumber, undefined, { numeric: true })
        ),
    [allCases, subsetId]
  );

  // Weakest cases first (sorted by ascending mastery)
  const weaknessOrdered = useMemo(
    () => [...subsetCases].sort((a, b) => mockCaseMastery(a.caseNumber) - mockCaseMastery(b.caseNumber)),
    [subsetCases],
  );

  // ── Visualization style ────────────────────────────────────────────────
  const visualizationStyle = useMemo<VisualizationStyle>(() => {
    const config = subset?.name ? SUBSET_VISUALIZATION[subset.name] : undefined;
    return config?.style ?? 'full-color';
  }, [subset]);

  // ── State ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<QuizMode>("weakest");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [seenCaseIds, setSeenCaseIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<QuizRound | null>(null);
  const roundIndexRef = useRef(0); // for weakest mode ordering



  // ── Generate a new round ─────────────────────────────────────────────
  const generateRound = useCallback(() => {
    if (subsetCases.length < 2) return;

    // Pick the target case
    let targetCase: AlgorithmCase;

    if (mode === "weakest") {
      // Go through weakest-ordered cases sequentially
      const idx = roundIndexRef.current % weaknessOrdered.length;
      targetCase = weaknessOrdered[idx];
      roundIndexRef.current = idx + 1;
    } else {
      // Random — pick any case
      targetCase = subsetCases[Math.floor(Math.random() * subsetCases.length)];
    }

    // Pick 3 distractors (different from the target)
    const distractors = pickRandom(subsetCases, 3, new Set([targetCase.id]));

    // Shuffle options (target + distractors)
    const options = shuffle([targetCase, ...distractors]);

    setRound({
      caseId: targetCase.id,
      options,
      selectedId: null,
      answered: false,
    });
  }, [mode, subsetCases, weaknessOrdered]);

  // Generate first round on mount / mode change
  useEffect(() => {
    roundIndexRef.current = 0;
    setScore({ correct: 0, total: 0 });
    setSeenCaseIds(new Set());
    generateRound();
  }, [mode, subsetId]);

  // ── Handle answer selection ──────────────────────────────────────────
  const handleSelect = useCallback((selectedId: string) => {
    if (!round || round.answered) return;

    const isCorrect = selectedId === round.caseId;

    setRound((prev) => prev ? { ...prev, selectedId, answered: true } : prev);
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setSeenCaseIds((prev) => new Set(prev).add(round.caseId));
  }, [round]);

  // ── Go to next round ────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    generateRound();
  }, [generateRound]);

  // ── Derived data ────────────────────────────────────────────────────
  const currentCase = useMemo(
    () => (round ? subsetCases.find((c) => c.id === round.caseId) ?? null : null),
    [subsetCases, round],
  );



  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <RecognizeHeader
          methodName={method?.name ?? "?"}
          subsetName={subset?.name ?? "?"}
          mode={mode}
          onModeChange={setMode}
          completedCount={seenCaseIds.size}
          totalCount={subsetCases.length}
          accuracy={accuracy}
          onBack={onBack}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Left: Main quiz area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {round && currentCase && (
              <QuizPanel
                round={round}
                currentCase={currentCase}
                visualizationStyle={visualizationStyle}
                subsetCases={subsetCases}
                onSelect={handleSelect}
                onNext={handleNext}
              />
            )}
          </div>

          {/* Right: Progress sidebar */}
          <aside className="flex min-h-0 flex-col gap-3 lg:w-56 lg:shrink-0 overflow-hidden">
            <RecognizeStatsPanel
              completedCount={seenCaseIds.size}
              totalCount={subsetCases.length}
              accuracy={accuracy}
              correct={score.correct}
              incorrect={score.total - score.correct}
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

function RecognizeHeader({
  methodName, subsetName, mode, onModeChange,
  completedCount, totalCount, accuracy, onBack,
}: {
  methodName: string; subsetName: string;
  mode: QuizMode; onModeChange: (m: QuizMode) => void;
  completedCount: number; totalCount: number; accuracy: number;
  onBack: () => void;
}) {
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      {/* Breadcrumb + mode toggle row */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0">
          <ArrowLeft className="size-3" />Back
        </button>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{methodName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-medium text-ink">{subsetName}</span>
        <span className="text-[0.6rem] text-ink-3/50">›</span>
        <span className="text-[0.72rem] font-semibold text-ink">Recognize</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
          <button
            onClick={() => onModeChange("weakest")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.65rem] font-medium transition-all",
              mode === "weakest"
                ? "bg-ink text-surface shadow-sm"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <TrendingDown className="size-3" />
            Weakest
          </button>
          <button
            onClick={() => onModeChange("random")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.65rem] font-medium transition-all",
              mode === "random"
                ? "bg-ink text-surface shadow-sm"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <Shuffle className="size-3" />
            Random
          </button>
        </div>

        {/* Stats */}
        <span className="text-[0.55rem] text-ink-3/50 flex items-center gap-2">
          {totalCount > 0 && (
            <>
              <span className="flex items-center gap-1">
                <Check className="size-2.5 text-ready" />
                <span className="nums">{completedCount}/{totalCount}</span>
              </span>
              <span className="text-ink-3/30">·</span>
              <span className="flex items-center gap-1">
                <Target className="size-2.5 text-ink-2" />
                <span className="nums">{accuracy}%</span>
              </span>
            </>
          )}
        </span>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Quiz Panel — the core quiz experience
   ─────────────────────────────────────────────────────────────────────── */

interface QuizPanelProps {
  round: QuizRound;
  currentCase: AlgorithmCase;
  visualizationStyle: VisualizationStyle;
  subsetCases: AlgorithmCase[];
  onSelect: (id: string) => void;
  onNext: () => void;
}

function QuizPanel({
  round, currentCase, visualizationStyle,
  subsetCases, onSelect, onNext,
}: QuizPanelProps) {
  const correctCase = subsetCases.find((c) => c.id === round.caseId);
  const isCorrect = round.answered && round.selectedId === round.caseId;

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-line bg-surface overflow-hidden">
      {/* Top section: Diagram + Scramble */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 sm:p-8">
        {/* Case diagram — large, no label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={round.caseId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              {currentCase.diagramType === "2d-top" && currentCase.diagram2D ? (
                <CaseDiagram
                  arrows={currentCase.diagram2D.arrows}
                  setupScramble={currentCase.setupScramble}
                  style={visualizationStyle}
                  className="w-44 sm:w-52 lg:w-60"
                />
              ) : (
                <div className="w-44 h-44 sm:w-52 sm:h-52 lg:w-60 lg:h-60 flex items-center justify-center rounded-lg bg-surface-2">
                  <span className="text-ink-3/40 text-[0.6rem]">No diagram</span>
                </div>
              )}

              {/* Feedback overlay */}
              {round.answered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "absolute -top-2 -right-2 grid size-8 place-items-center rounded-full shadow-lg",
                    isCorrect ? "bg-ready" : "bg-hold",
                  )}
                >
                  {isCorrect ? (
                    <Check className="size-5 text-white" />
                  ) : (
                    <X className="size-5 text-white" />
                  )}
                </motion.div>
              )}
            </div>

            {/* Scramble */}
            {currentCase.setupScramble && (
              <div className="text-center">
                <span className="text-[0.55rem] font-medium uppercase tracking-[0.12em] text-ink-3/60">Setup</span>
                <p className="nums text-[0.72rem] text-ink-2/80 mt-0.5 leading-relaxed">{currentCase.setupScramble}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Options grid */}
        <div className="w-full max-w-sm">
          {!round.answered ? (
            <div className="grid grid-cols-2 gap-2.5">
              {round.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onSelect(opt.id)}
                  className={cn(
                    "rounded-xl border-2 bg-surface px-4 py-3.5 text-center transition-all",
                    "border-line hover:border-ink/25 hover:bg-surface-2 hover:shadow-sm",
                    "active:scale-[0.97]",
                  )}
                >
                  <span className="nums text-[0.82rem] font-semibold text-ink">{opt.caseNumber}</span>
                  {opt.name && opt.name !== opt.caseNumber && (
                    <span className="block text-[0.58rem] text-ink-3/70 mt-0.5 truncate">{opt.name}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Answered options with color feedback */}
              <div className="grid grid-cols-2 gap-2.5">
                {round.options.map((opt) => {
                  const isThisCorrect = opt.id === round.caseId;
                  const isThisSelected = opt.id === round.selectedId;
                  return (
                    <div
                      key={opt.id}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3.5 text-center transition-all",
                        isThisCorrect
                          ? "border-ready/50 bg-ready-soft/30"
                          : isThisSelected
                            ? "border-hold/50 bg-hold-soft/30"
                            : "border-line/50 bg-surface opacity-50",
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {isThisCorrect && <Check className="size-3.5 text-ready shrink-0" />}
                        {isThisSelected && !isThisCorrect && <X className="size-3.5 text-hold shrink-0" />}
                        <span className={cn(
                          "nums text-[0.82rem] font-semibold",
                          isThisCorrect ? "text-ready" : isThisSelected ? "text-hold" : "text-ink-3",
                        )}>
                          {opt.caseNumber}
                        </span>
                      </div>
                      {opt.name && opt.name !== opt.caseNumber && (
                        <span className={cn(
                          "block text-[0.55rem] mt-0.5 truncate",
                          isThisCorrect ? "text-ready/70" : isThisSelected ? "text-hold/70" : "text-ink-3/50",
                        )}>{opt.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feedback message + Next button */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 pt-2"
              >
                <span className={cn(
                  "text-[0.7rem] font-semibold",
                  isCorrect ? "text-ready" : "text-hold",
                )}>
                  {isCorrect
                    ? "✓ Correct!"
                    : `✗ It was ${correctCase?.caseNumber ?? "?"}`}
                </span>

                <button
                  onClick={onNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[0.75rem] font-semibold text-surface hover:bg-ink/90 transition-colors"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sidebar: Stats / Progress
   ─────────────────────────────────────────────────────────────────────── */

function RecognizeStatsPanel({
  completedCount, totalCount, accuracy, correct, incorrect,
}: {
  completedCount: number; totalCount: number; accuracy: number;
  correct: number; incorrect: number;
}) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-4">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">Progress</h4>

      <div className="flex flex-col gap-3">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[0.58rem] text-ink-3">Cases seen</span>
            <span className="nums text-[0.62rem] font-medium text-ink">{completedCount}/{totalCount}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="h-full rounded-full bg-ink/60" />
          </div>
        </div>

        {/* Accuracy */}
        <div className="flex items-center justify-between text-[0.58rem]">
          <span className="text-ink-3">Accuracy</span>
          <span className={cn("nums font-semibold", accuracy >= 80 ? "text-ready" : accuracy >= 50 ? "text-caution" : "text-hold")}>
            {accuracy}%
          </span>
        </div>

        {/* Correct / Incorrect split */}
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <div className="flex-1 text-center">
            <span className="nums text-[0.9rem] font-bold text-ready block">{correct}</span>
            <span className="text-[0.5rem] text-ink-3">Correct</span>
          </div>
          <div className="w-px h-6 bg-line" />
          <div className="flex-1 text-center">
            <span className="nums text-[0.9rem] font-bold text-hold block">{incorrect}</span>
            <span className="text-[0.5rem] text-ink-3">Incorrect</span>
          </div>
        </div>

        {/* Tip */}
        <div className="pt-2 border-t border-line flex items-start gap-1.5 text-[0.52rem] text-ink-3/60">
          <Brain className="size-2.5 mt-0.5 shrink-0" />
          <span>Weakest mode targets cases you struggle with most</span>
        </div>
      </div>
    </div>
  );
}
