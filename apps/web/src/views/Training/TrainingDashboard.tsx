"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, type AlgorithmMethod } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
import { AlgorithmRecognizeView } from "./AlgorithmRecognizeView";
import { PhaseStatsView } from "./PhaseStatsView";
import { FullSolveView } from "./FullSolveView";
import { SRSReviewView } from "./SRSReviewView";
import { SRSInsightsView } from "./SRSInsightsView";
import { TrainingCalendar } from "./TrainingCalendar";
import { PlainPracticeView } from "./PlainPracticeView";
import { BlindPracticeView } from "./BlindPracticeView";
import { CrossTrainerView } from "./CrossTrainerView";
import { LSESubPhaseView } from "./LSESubPhaseView";
import { EODetectView } from "./EODetectView";
import { EOEfficiencyView } from "./EOEfficiencyView";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { ReviewQueueSection } from "./components";
import type { PuzzleCategory } from "@/types";
import type { PhaseStatsRecord, PhaseDefinition, PhaseModeDefinition, PhasePracticeType } from "@cubeforge/training";
import { EXERCISE_IDS, buildMethodPhases, findSubsetId, getPhaseModes, getPhasePracticeType, masteryLevel, MASTERY_LABEL_TEXT } from "@cubeforge/training";
import { puzzleCategoryToType, PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Box,
  Layers,
  Pyramid,
  Zap,
  Target,
  Sparkles,
  Crosshair,
  Grid3x3,
  Palette,
  Shuffle,
  Blocks,
  ArrowRightLeft,
  Gauge,
  MoveHorizontal,
  Grid2x2,
  Clock,
  EyeOff,
  Eye,
  ArrowUp,
  MoveVertical,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Phase presentation
   Phase identities, practice modes, subset resolution and mastery labels
   come from the @cubeforge/training catalog (single source of truth).
   This file only adds ICONS — pure presentation.
   ─────────────────────────────────────────────────────────────────────── */

/** phase id → icon (UI-only). */
const PHASE_ICONS: Record<string, React.ElementType> = {
  cross: Crosshair, f2l: Grid3x3, af2l: Layers, oll: Palette, pll: Shuffle, pbl: Shuffle,
  cll: Layers, eg1: Grid2x2, eg2: Grid2x2,
  "first-block": Box, "second-block": Blocks, cmll: Palette, lse: ArrowRightLeft,
  eoline: Zap, "f2l-zz": Grid3x3, "ll-zz": Target,
  "block-222": Grid2x2, "block-223": Grid3x3, "eo-petrus": Gauge,
  "f2l-petrus": MoveHorizontal, "ll-petrus": Target,
};

type PhaseDef = PhaseDefinition & { icon: React.ElementType };

/** Phases for a method (identity from the catalog) with presentation icons. */
function getPhasesForMethod(methodName: string): PhaseDef[] {
  return buildMethodPhases(methodName).map((phase) => ({
    ...phase,
    icon: PHASE_ICONS[phase.id] ?? Sparkles,
  }));
}

type PhaseModeDef = PhaseModeDefinition & { icon: React.ElementType };

/** mode id → icon (UI-only). */
const PHASE_MODE_ICONS: Record<string, React.ElementType> = {
  plain: Clock, blind: EyeOff, optimal: MoveHorizontal, cn: Palette,
  "speed-vs-eff": Gauge, eo: ArrowRightLeft, ulur: ArrowUp, mslice: MoveVertical,
  detect: Eye, efficiency: Gauge,
};

/** Modes for a phase type (identity from the catalog) with presentation icons. */
function getPhaseModesWithIcons(phaseType: PhasePracticeType): PhaseModeDef[] {
  return getPhaseModes(phaseType).map((mode) => ({
    ...mode,
    icon: PHASE_MODE_ICONS[mode.id] ?? Clock,
  }));
}

const METHOD_ACCENTS: Record<string, string> = {
  CFOP: "bg-ink/70", Roux: "bg-ink/60", ZZ: "bg-ink/50", Petrus: "bg-ink/40",
  Ortega: "bg-ink/70", CLL: "bg-ink/60", EG: "bg-ink/50",
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  CFOP: Layers, Roux: Box, ZZ: Zap, Petrus: Pyramid,
  Ortega: Grid2x2, CLL: Layers, EG: Grid2x2,
};

const PHASE_DOT: Record<string, string> = {
  cross: "bg-phase-blue", f2l: "bg-phase-emerald", af2l: "bg-phase-teal", oll: "bg-phase-amber", pll: "bg-phase-violet", pbl: "bg-phase-purple",
  cll: "bg-phase-indigo", eg1: "bg-phase-rose", eg2: "bg-phase-cyan",
  "first-block": "bg-phase-rose", "second-block": "bg-phase-orange", cmll: "bg-phase-violet", lse: "bg-phase-cyan",
  eoline: "bg-phase-sky", "f2l-zz": "bg-phase-emerald", "ll-zz": "bg-phase-amber",
  "block-222": "bg-phase-rose", "block-223": "bg-phase-orange", "eo-petrus": "bg-phase-cyan",
  "f2l-petrus": "bg-phase-emerald", "ll-petrus": "bg-phase-amber",
};

function masteryLabel(pct: number): string {
  return MASTERY_LABEL_TEXT[masteryLevel(pct)];
}

/* ── Mastery helpers ────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
   Flat Dashboard (Fase 6)
   ─────────────────────────────────────────────────────────────────────── */

function FlatDashboard({
  selectedPuzzle,
  onSelectPuzzle,
  puzzleMethods,
  activeMethodId,
  onSelectMethod,
  methodMasteries,
  phaseStatsMap,
  onDrill,
  onRecognize,
  onPracticeMode,
  onStats,
  onFullSolve,
  onStartReview,
  onOpenInsights,
  onDueCountChange,
  dueCount,
  dbReady,
}: {
  selectedPuzzle: PuzzleCategory;
  onSelectPuzzle: (puzzle: PuzzleCategory) => void;
  puzzleMethods: AlgorithmMethod[];
  activeMethodId: string;
  onSelectMethod: (methodId: string) => void;
  methodMasteries: Record<string, number>;
  /** Real per-phase accuracy (0-100) keyed by phaseId — shown in Quick Summary. */
  phaseStatsMap: Record<string, PhaseStatsRecord | null>;
  onDrill: (methodId: string, phaseId: string, subsetId: string) => void;
  onRecognize: (methodId: string, phaseId: string, subsetId: string) => void;
  onPracticeMode: (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => void;
  onStats: (methodId: string, phaseId: string, phaseName: string) => void;
  onFullSolve: (methodId: string) => void;
  onStartReview: (methodId?: string) => void;
  onOpenInsights: (methodId?: string) => void;
  onDueCountChange: (due: number) => void;
  dueCount: number;
  dbReady: boolean;
}) {
  const method = METHODS.find((m) => m.id === activeMethodId);
  const phases = method ? getPhasesForMethod(method.name) : [];
  const mastery = method ? (methodMasteries[method.name] ?? 0) : 0;

  return (
    <>
      <header className="flex flex-col gap-3 shrink-0">
        {/* Header row: Dropdown puzzle selector + SRS badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-3">Puzzle</span>
            <Select value={selectedPuzzle} onValueChange={(val) => onSelectPuzzle(val as PuzzleCategory)}>
              <SelectTrigger className="h-8 w-36 gap-2 rounded-lg border-line bg-surface px-2.5 text-[0.7rem] font-semibold text-ink shadow-xs">
                <SelectValue placeholder="Select puzzle" />
              </SelectTrigger>
              <SelectContent>
                {PUZZLE_CATEGORIES.map((p) => {
                  const is2x2 = p === "2x2";
                  const is3x3 = p === "3x3";
                  return (
                    <SelectItem key={p} value={p} className="text-[0.7rem]">
                      <div className="flex items-center gap-2 font-medium">
                        {is2x2 ? (
                          <Grid2x2 className="size-3.5 text-ink-2" />
                        ) : is3x3 ? (
                          <Grid3x3 className="size-3.5 text-ink-2" />
                        ) : (
                          <Box className="size-3.5 text-ink-2" />
                        )}
                        <span>{p}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {dueCount > 0 && (
            <span className="nums shrink-0 inline-flex items-center gap-1.5 rounded-full bg-caution px-2.5 py-0.5 text-[0.6rem] font-semibold text-surface ml-auto">
              <span className="size-1.5 rounded-full bg-surface shrink-0" />
              {dueCount} due for review
            </span>
          )}
        </div>

        {/* Method tabs — filtered by selected puzzle */}
        <div className="flex gap-1 flex-wrap items-center max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:pb-1 max-lg:scrollbar-none">
          {puzzleMethods.map((m) => {
            const MIcon = METHOD_ICONS[m.name] ?? Layers;
            const isActive = m.id === activeMethodId;
            const mPct = methodMasteries[m.name] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMethod(m.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors cursor-pointer",
                  // Touch: scroll-snap chips with >=40px tap targets.
                  "max-lg:h-10 max-lg:shrink-0 max-lg:snap-start max-lg:px-3.5",
                  isActive
                    ? "bg-ink text-surface"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="method-tab-active"
                    className="absolute inset-0 rounded-md bg-ink -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <MIcon className="size-3" />
                {m.name}
                <span className="nums text-[0.55rem] opacity-70 ml-0.5">{mPct}%</span>
              </button>
            );
          })}
        </div>
      </header>

      {!method ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[0.72rem] text-ink-3">Select a method above to see exercises</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto min-h-0 pb-4">
          {/* Method mastery header */}
          <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2">
                  {(() => { const Icon = METHOD_ICONS[method.name] ?? Layers; return <Icon className="size-4 text-ink" />; })()}
                </div>
                <div>
                  <h2 className="text-[0.82rem] font-semibold text-ink">{method.name}</h2>
                  <p className="text-[0.62rem] text-ink-3">{method.description}</p>
                </div>
              </div>
              <button
                onClick={() => onFullSolve(method.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.65rem] font-medium text-surface hover:bg-ink/90 transition-colors"
              >
                <Target className="size-3" />Full Solve
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 rounded-full bg-surface-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${mastery}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className={cn("h-full rounded-full", METHOD_ACCENTS[method.name] ?? "bg-ink/60")}
                  />
                </div>
                <span className="nums text-[0.68rem] font-medium text-ink">{mastery}%</span>
                <span className="text-[0.58rem] text-ink-3">{masteryLabel(mastery)}</span>
              </div>
            </div>
          </section>

          {/* Exercise cards */}
          <section className="shrink-0">
            <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">Exercises</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {phases.map((phase) => (
                <ExerciseCard
                  key={phase.id}
                  phase={phase}
                  onDrill={() => {
                    const sid = findSubsetId(method.id, phase.id);
                    if (sid) onDrill(method.id, phase.id, sid);
                  }}
                  onRecognize={() => {
                    const sid = findSubsetId(method.id, phase.id);
                    if (sid) onRecognize(method.id, phase.id, sid);
                  }}
                  onPracticeMode={(modeId) => {
                    const pt = getPhasePracticeType(phase.id);
                    if (pt) onPracticeMode(method.id, phase.id, phase.name, pt, modeId);
                  }}
                  onStats={() => onStats(method.id, phase.id, phase.name)}
                  phaseModes={
                    !phase.hasAlgorithms
                      ? (() => { const pt = getPhasePracticeType(phase.id); return pt ? getPhaseModesWithIcons(pt) : []; })()
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* Quick Summary + Calendar */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="lg:col-span-1 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-3.5 text-ink-2" />
                <h2 className="text-[0.7rem] font-semibold text-ink">Quick Summary</h2>
              </div>
              <div className="space-y-2.5">
                {phases.slice(0, 5).map((phase) => {
                  const stats = phaseStatsMap[phase.id];
                  const hasData = stats != null && stats.totalAttempts > 0;
                  return (
                    <div key={phase.id} className="flex items-center gap-2">
                      <div className={cn("size-1.5 rounded-full", PHASE_DOT[phase.id] ?? "bg-ink-3")} />
                      <span className="text-[0.62rem] text-ink-2 flex-1">{phase.name}</span>
                      <span className={cn(
                        "nums text-[0.58rem] font-medium",
                        hasData ? (stats.accuracy >= 80 ? "text-ready" : stats.accuracy >= 50 ? "text-caution" : "text-hold") : "text-ink-3/50",
                      )}>
                        {hasData ? `${stats.accuracy}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-2 rounded-xl border border-line bg-surface p-4">
              <TrainingCalendar />
            </section>
          </div>

          {/* Quick Start — SRS daily review queue */}
          {dbReady && (
            <ReviewQueueSection
              onStartReview={onStartReview}
              onOpenInsights={onOpenInsights}
              onDueCountChange={onDueCountChange}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Exercise card (direct navigation — no L2)
   ─────────────────────────────────────────────────────────────────────── */

function ExerciseCard({
  phase,
  onDrill,
  onRecognize,
  onPracticeMode,
  onStats,
  phaseModes,
}: {
  phase: PhaseDef;
  onDrill: () => void;
  onRecognize: () => void;
  onPracticeMode: (modeId: string) => void;
  onStats: () => void;
  phaseModes: PhaseModeDef[] | null;
}) {
  const dotColor = PHASE_DOT[phase.id] ?? "bg-ink-3";
  const Icon = phase.icon;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
          <Icon className="size-3.5 text-ink-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="block text-[0.78rem] font-semibold text-ink leading-tight">{phase.name}</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", dotColor)} />
          </div>
          <span className="nums text-[0.6rem] text-ink-3">{phase.hasAlgorithms ? "Algorithmic" : "Intuitive"}</span>
        </div>
      </div>
      <p className="text-[0.65rem] text-ink-2 leading-relaxed line-clamp-2">{phase.description}</p>
      <div className="flex gap-1 pt-1 border-t border-line mt-auto flex-wrap max-lg:grid max-lg:grid-cols-3 max-lg:gap-1.5 max-lg:pt-2">
        {phase.hasAlgorithms ? (
          <>
            <button onClick={onDrill} className="rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer max-lg:py-2.5 max-lg:text-[0.7rem]">
              Drill
            </button>
            <button onClick={onRecognize} className="rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer max-lg:py-2.5 max-lg:text-[0.7rem]">
              Recognize
            </button>
            <button onClick={onStats} className="rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer ml-auto max-lg:ml-0 max-lg:py-2.5 max-lg:text-[0.7rem]">
              Stats
            </button>
          </>
        ) : phaseModes && phaseModes.length > 0 ? (
          <>
            {phaseModes.map((pm) => (
              <button
                key={pm.id}
                onClick={() => onPracticeMode(pm.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.62rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer max-lg:justify-center max-lg:py-2.5 max-lg:text-[0.68rem]"
                title={pm.label}
              >
                <pm.icon className="size-3" />
                {pm.label}
              </button>
            ))}
            <button onClick={onStats} className="rounded-md px-2.5 py-1 text-[0.65rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer ml-auto max-lg:ml-0 max-lg:py-2.5 max-lg:text-[0.7rem]">
              Stats
            </button>
          </>
        ) : (
          <button onClick={onStats} className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer max-lg:col-span-3 max-lg:py-2.5 max-lg:text-[0.7rem]">
            Stats
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   L3 sub-view state types
   ─────────────────────────────────────────────────────────────────────── */

interface DrillViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface PracticeViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
  phaseType: PhasePracticeType;
  modeId: string;
}

interface RecognizeViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface StatsViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
}

interface FullSolveViewState {
  methodId: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Top-level dashboard (flat: method tabs → exercise cards → sub-views)
   ─────────────────────────────────────────────────────────────────────── */

export interface TrainingDashboardProps {
  preset?: { subsetId: string; caseId: string } | null;
  onPresetConsumed?: () => void;
  puzzle?: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
}

export function TrainingDashboard({
  preset,
  onPresetConsumed,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
}: TrainingDashboardProps = {}) {
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleCategory>(puzzleProp);

  // Synchronize internal puzzle selection with header/app puzzle prop
  useEffect(() => {
    if (puzzleProp) {
      setSelectedPuzzle(puzzleProp);
    }
  }, [puzzleProp]);

  const targetPuzzleType = puzzleCategoryToType(selectedPuzzle);

  const puzzleMethods = useMemo(() => {
    return METHODS.filter((m) => (m.puzzleType ?? "3x3x3") === targetPuzzleType);
  }, [targetPuzzleType]);

  const [activeMethodId, setActiveMethodId] = useState<string>(() => puzzleMethods[0]?.id ?? METHODS[0]?.id ?? "");

  // Auto-switch activeMethodId when puzzle changes if current method is not compatible
  useEffect(() => {
    if (puzzleMethods.length > 0 && !puzzleMethods.some((m) => m.id === activeMethodId)) {
      setActiveMethodId(puzzleMethods[0].id);
    }
  }, [puzzleMethods, activeMethodId]);

  const handleSelectPuzzle = (p: PuzzleCategory) => {
    setSelectedPuzzle(p);
    onPuzzleChange?.(p);
    const newTargetType = puzzleCategoryToType(p);
    const newMethods = METHODS.filter((m) => (m.puzzleType ?? "3x3x3") === newTargetType);
    if (newMethods.length > 0) {
      setActiveMethodId(newMethods[0].id);
    }
  };

  // Sub-view routing (direct from exercise cards, no L2)
  const [drillView, setDrillView] = useState<DrillViewState | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeViewState | null>(null);
  const [recognizeView, setRecognizeView] = useState<RecognizeViewState | null>(null);
  const [statsView, setStatsView] = useState<StatsViewState | null>(null);
  const [fullSolveView, setFullSolveView] = useState<FullSolveViewState | null>(null);
  const [reviewView, setReviewView] = useState<{ methodId?: string } | null>(null);
  const [insightsView, setInsightsView] = useState<{ methodId?: string } | null>(null);

  // Progress tracking
  const { ready: dbReady, getMethodMastery, getPhaseStats } = useTrainingProgress();
  const [methodMasteries, setMethodMasteries] = useState<Record<string, number>>({});
  const [phaseStatsMap, setPhaseStatsMap] = useState<Record<string, PhaseStatsRecord | null>>({});
  const [dueCount, setDueCount] = useState(0);
  const [masteriesKey, setMasteriesKey] = useState(0);

  // Load method masteries. Re-runs on `masteriesKey` bump so the tab percentages
  // reflect drills/recognize/review sessions the moment the user returns.
  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    async function load() {
      const masteries: Record<string, number> = {};
      for (const method of METHODS) {
        try {
          const m = await getMethodMastery(method.id);
          masteries[method.name] = m;
        } catch {
          masteries[method.name] = 0;
        }
      }
      if (!cancelled) setMethodMasteries(masteries);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dbReady, getMethodMastery, masteriesKey]);

  // Load real per-phase accuracy for the active method's Quick Summary —
  // replaces the old fabricated formula (mastery * 0.8 + sortOrder * 3).
  useEffect(() => {
    if (!dbReady || !activeMethodId) return;
    let cancelled = false;
    const method = METHODS.find((m) => m.id === activeMethodId);
    const phases = method ? getPhasesForMethod(method.name) : [];
    void Promise.all(
      phases.map((phase) => getPhaseStats(activeMethodId, phase.id).catch(() => null)),
    ).then((stats) => {
      if (cancelled) return;
      const map: Record<string, PhaseStatsRecord | null> = {};
      phases.forEach((phase, i) => { map[phase.id] = stats[i]; });
      setPhaseStatsMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [dbReady, activeMethodId, getPhaseStats, masteriesKey]);

  // The "N due for review" badge is derived from the live review queue
  // (ReviewQueueSection reports it) — single source of truth, never stale.
  const handleDueCountChange = useCallback((due: number) => setDueCount(due), []);

  // ── Algorithms → Training bridge ─────────────────────────────────────
  const [drillPresetCaseId, setDrillPresetCaseId] = useState<string | null>(
    () => preset?.caseId ?? null,
  );
  if (preset?.caseId && preset.caseId !== drillPresetCaseId) {
    setDrillPresetCaseId(preset.caseId);
  }

  const initialDrillView = useMemo(() => {
    if (!preset?.subsetId) return null;
    const subset = SUBSETS.find((s) => s.id === preset.subsetId);
    if (!subset) return null;
    return { methodId: subset.methodId, phaseId: "", subsetId: preset.subsetId };
  }, [preset?.subsetId]);

  useEffect(() => {
    if (preset?.subsetId) {
      const subset = SUBSETS.find((s) => s.id === preset.subsetId);
      if (subset) {
        setActiveMethodId(subset.methodId);
        const method = METHODS.find((m) => m.id === subset.methodId);
        if (method?.puzzleType === "2x2x2") {
          setSelectedPuzzle("2x2");
        } else if (method?.puzzleType === "3x3x3") {
          setSelectedPuzzle("3x3");
        }
      }
      onPresetConsumed?.();
    }
  }, [preset?.subsetId, onPresetConsumed]);

  useEffect(() => {
    if (initialDrillView && !drillView) {
      setDrillView(initialDrillView);
    }
  }, [initialDrillView, drillView]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleDrill = (methodId: string, phaseId: string, subsetId: string) => {
    setDrillView({ methodId, phaseId, subsetId });
  };

  const handleRecognize = (methodId: string, phaseId: string, subsetId: string) => {
    setRecognizeView({ methodId, phaseId, subsetId });
  };

  const handlePracticeMode = (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => {
    setPracticeView({ methodId, phaseId, phaseName, phaseType, modeId: mode });
  };

  const handleStats = (methodId: string, phaseId: string, phaseName: string) => {
    setStatsView({ methodId, phaseId, phaseName });
  };

  const handleFullSolve = (methodId: string) => {
    setFullSolveView({ methodId });
  };

  const handleStartReview = (methodId?: string) => {
    setReviewView({ methodId });
  };

  const handleOpenInsights = (methodId?: string) => {
    setInsightsView(methodId ? { methodId } : {});
  };

  const handleBackFromSubView = () => {
    setDrillView(null);
    setPracticeView(null);
    setRecognizeView(null);
    setStatsView(null);
    setFullSolveView(null);
    setReviewView(null);
    setInsightsView(null);
    // Refresh the method mastery tabs after any drill/recognize/review session.
    setMasteriesKey((k) => k + 1);
  };

  // ── L3 Sub-views ────────────────────────────────────────────────────

  if (drillView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmDrillView
            methodId={drillView.methodId}
            phaseId={drillView.phaseId}
            subsetId={drillView.subsetId}
            onBack={handleBackFromSubView}
            preselectedCaseId={drillPresetCaseId}
          />
        </div>
      </div>
    );
  }

  if (recognizeView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmRecognizeView
            methodId={recognizeView.methodId}
            phaseId={recognizeView.phaseId}
            subsetId={recognizeView.subsetId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (statsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <PhaseStatsView
            methodId={statsView.methodId}
            phaseId={statsView.phaseId}
            phaseName={statsView.phaseName}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (fullSolveView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <FullSolveView
            methodId={fullSolveView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (reviewView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSReviewView
            methodId={reviewView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (insightsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSInsightsView
            methodId={insightsView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (practiceView) {
    const { methodId, phaseId, phaseName, phaseType, modeId } = practiceView;
    const props = { methodId, phaseId, phaseName, onBack: handleBackFromSubView };

    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          {/* Generic: plain + speed-vs-eff (S/E persists its own exercise id) */}
          {modeId === "plain" && <PlainPracticeView {...props} />}
          {modeId === "speed-vs-eff" && (
            <PlainPracticeView
              {...props}
              exerciseLabel="Speed vs Efficiency"
              exerciseId={EXERCISE_IDS.speedEfficiency(methodId, phaseId)}
            />
          )}
          {/* Generic: blind */}
          {modeId === "blind" && <BlindPracticeView {...props} />}

          {/* Cross-specific */}
          {phaseType === "cross" && (modeId === "optimal" || modeId === "cn") && (
            <CrossTrainerView {...props} />
          )}

          {/* LSE-specific */}
          {phaseType === "lse" && (modeId === "eo" || modeId === "ulur" || modeId === "mslice") && (
            <LSESubPhaseView {...props} subPhase={modeId} />
          )}

          {/* EO-specific */}
          {phaseType === "eo" && modeId === "detect" && <EODetectView {...props} />}
          {phaseType === "eo" && modeId === "efficiency" && <EOEfficiencyView {...props} />}
        </div>
      </div>
    );
  }

  // ── Flat Dashboard ─────────────────────────────────────────────────

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FlatDashboard
          selectedPuzzle={selectedPuzzle}
          onSelectPuzzle={handleSelectPuzzle}
          puzzleMethods={puzzleMethods}
          activeMethodId={activeMethodId}
          onSelectMethod={setActiveMethodId}
          methodMasteries={methodMasteries}
          phaseStatsMap={phaseStatsMap}
          onDrill={handleDrill}
          onRecognize={handleRecognize}
          onPracticeMode={handlePracticeMode}
          onStats={handleStats}
          onFullSolve={handleFullSolve}
          onStartReview={handleStartReview}
          onOpenInsights={handleOpenInsights}
          onDueCountChange={handleDueCountChange}
          dueCount={dueCount}
          dbReady={dbReady}
        />
      </div>
    </div>
  );
}
