"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, type AlgorithmMethod } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
import { AlgorithmRecognizeView } from "./AlgorithmRecognizeView";
import { PhaseStatsView } from "./PhaseStatsView";
import { FullSolveView } from "./FullSolveView";
import { TrainingCalendar } from "./TrainingCalendar";
import { PlainPracticeView } from "./PlainPracticeView";
import { BlindPracticeView } from "./BlindPracticeView";
import { CrossTrainerView } from "./CrossTrainerView";
import { LSESubPhaseView } from "./LSESubPhaseView";
import { EODetectView } from "./EODetectView";
import { EOEfficiencyView } from "./EOEfficiencyView";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import type { PuzzleCategory } from "@/types";
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
  RotateCcw,
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
  Layout,
  ArrowUp,
  MoveVertical,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Phase definitions (pure data)
   ─────────────────────────────────────────────────────────────────────── */

type PhaseId = string;

interface PhaseDef {
  id: PhaseId;
  name: string;
  icon: React.ElementType;
  description: string;
  sortOrder: number;
  hasAlgorithms: boolean;
}

const METHOD_PHASES: Record<string, PhaseDef[]> = {
  CFOP: [
    { id: "cross", name: "Cross", icon: Crosshair, description: "Solve the cross efficiently. Fewer moves, faster solutions.", sortOrder: 1, hasAlgorithms: false },
    { id: "f2l", name: "F2L", icon: Grid3x3, description: "Basic first two layers — 41 algorithmic pairs.", sortOrder: 2, hasAlgorithms: true },
    { id: "af2l", name: "Advanced F2L", icon: Layers, description: "Advanced first two layers — 54 trapped & keyhole cases.", sortOrder: 3, hasAlgorithms: true },
    { id: "oll", name: "OLL", icon: Palette, description: "Orient last layer — 57 cases to master.", sortOrder: 4, hasAlgorithms: true },
    { id: "pll", name: "PLL", icon: Shuffle, description: "Permute last layer — 21 cases for the final step.", sortOrder: 5, hasAlgorithms: true },
  ],
  Roux: [
    { id: "first-block", name: "First block", icon: Box, description: "Build a 1×2×3 block on the left.", sortOrder: 1, hasAlgorithms: false },
    { id: "second-block", name: "Second block", icon: Blocks, description: "Build the right 1×2×3 block efficiently.", sortOrder: 2, hasAlgorithms: false },
    { id: "cmll", name: "CMLL", icon: Palette, description: "Corners of last layer — 42 cases.", sortOrder: 3, hasAlgorithms: true },
    { id: "lse", name: "LSE", icon: ArrowRightLeft, description: "Last six edges — EO, UL/UR, M-slice.", sortOrder: 4, hasAlgorithms: false },
  ],
  ZZ: [
    { id: "eoline", name: "EOLine", icon: Zap, description: "Edge Orientation + Line. No rotations needed.", sortOrder: 1, hasAlgorithms: false },
    { id: "f2l-zz", name: "F2L (ZZ)", icon: Grid3x3, description: "First two layers using only R, U, L moves.", sortOrder: 2, hasAlgorithms: true },
    { id: "ll-zz", name: "Last layer", icon: Target, description: "OCLL, COLL, ZZLL — last layer for ZZ.", sortOrder: 3, hasAlgorithms: true },
  ],
  Petrus: [
    { id: "block-222", name: "2×2×2 block", icon: Grid2x2, description: "Build the first 2×2×2 block.", sortOrder: 1, hasAlgorithms: false },
    { id: "block-223", name: "2×2×3 block", icon: Grid3x3, description: "Extend to a 2×2×3 block.", sortOrder: 2, hasAlgorithms: false },
    { id: "eo-petrus", name: "EO", icon: Gauge, description: "Edge Orientation after blocks.", sortOrder: 3, hasAlgorithms: false },
    { id: "f2l-petrus", name: "F2L (Petrus)", icon: MoveHorizontal, description: "Finish F2L after EO.", sortOrder: 4, hasAlgorithms: true },
    { id: "ll-petrus", name: "Last layer", icon: Target, description: "COLL + EPLL for Petrus last layer.", sortOrder: 5, hasAlgorithms: true },
  ],
  Ortega: [
    { id: "oll", name: "OLL (2×2)", icon: Palette, description: "Orient top face — 7 cases to master.", sortOrder: 1, hasAlgorithms: true },
    { id: "pbl", name: "PBL", icon: Shuffle, description: "Permute Both Layers — 6 cases for 2×2.", sortOrder: 2, hasAlgorithms: true },
  ],
  CLL: [
    { id: "cll", name: "CLL", icon: Layers, description: "Corners of Last Layer — 42 cases for 2×2.", sortOrder: 1, hasAlgorithms: true },
  ],
  EG: [
    { id: "eg1", name: "EG-1", icon: Grid2x2, description: "Bottom layer adjacent swap — 42 cases.", sortOrder: 1, hasAlgorithms: true },
    { id: "eg2", name: "EG-2", icon: Grid2x2, description: "Bottom layer diagonal swap — 42 cases.", sortOrder: 2, hasAlgorithms: true },
  ],
};

/** Maps a phase ID to its specialized practice type for non-algorithmic phases. */
type PhasePracticeType = "cross" | "block" | "lse" | "eo";

function getPhasePracticeType(phaseId: string): PhasePracticeType | null {
  const crossPhases = new Set(["cross", "eoline"]);
  const blockPhases = new Set(["first-block", "second-block", "block-222", "block-223"]);
  const lsePhases = new Set(["lse"]);
  const eoPhases = new Set(["eo-petrus"]);
  if (crossPhases.has(phaseId)) return "cross";
  if (blockPhases.has(phaseId)) return "block";
  if (lsePhases.has(phaseId)) return "lse";
  if (eoPhases.has(phaseId)) return "eo";
  return null;
}

/** Exercise modes available per phase type. Each is a direct button in the card. */
interface PhaseModeDef {
  id: string;
  label: string;
  icon: React.ElementType;
}

const PHASE_MODES: Record<PhasePracticeType, PhaseModeDef[]> = {
  cross: [
    { id: "plain", label: "Plain", icon: Clock },
    { id: "blind", label: "Blind", icon: EyeOff },
    { id: "optimal", label: "≤8", icon: MoveHorizontal },
    { id: "cn", label: "CN", icon: Palette },
  ],
  block: [
    { id: "plain", label: "Plain", icon: Clock },
    { id: "blind", label: "Blind", icon: EyeOff },
    { id: "speed-vs-eff", label: "S/E", icon: Gauge },
  ],
  lse: [
    { id: "plain", label: "Full", icon: Layout },
    { id: "eo", label: "EO", icon: ArrowRightLeft },
    { id: "ulur", label: "UL/UR", icon: ArrowUp },
    { id: "mslice", label: "M", icon: MoveVertical },
  ],
  eo: [
    { id: "plain", label: "Plain", icon: Clock },
    { id: "detect", label: "Detect", icon: Eye },
    { id: "efficiency", label: "≤mvs", icon: Gauge },
  ],
};

function getPhaseModes(phaseType: PhasePracticeType): PhaseModeDef[] {
  return PHASE_MODES[phaseType] ?? [];
}

function findSubsetId(methodId: string, phaseId: string): string | null {
  const phaseToSubsetName: Record<string, string> = {
    "oll": "OLL", "pll": "PLL", "f2l": "Basic F2L", "af2l": "Advanced F2L", "cmll": "CMLL",
    "f2l-zz": "Basic F2L", "ll-zz": "OCLL", "f2l-petrus": "Basic F2L", "ll-petrus": "COLL",
    "pbl": "PBL", "cll": "CLL", "eg1": "EG-1", "eg2": "EG-2",
  };
  const subsetName = phaseToSubsetName[phaseId];
  if (!subsetName) return null;
  const subset = SUBSETS.find((s) => s.methodId === methodId && s.name === subsetName)
    ?? SUBSETS.find((s) => s.name === subsetName);
  return subset?.id ?? null;
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
  if (pct >= 90) return "Mastered";
  if (pct >= 60) return "Learning";
  if (pct > 0) return "Beginner";
  return "New";
}

/* ── Mock fallback (used only when DB is not ready) ──────────────────────── */

const FALLBACK_MASTERY: Record<string, number> = { CFOP: 80, Roux: 70, ZZ: 30, Petrus: 45, Ortega: 60, CLL: 0, EG: 0 };

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
  onDrill,
  onRecognize,
  onPracticeMode,
  onStats,
  onFullSolve,
  dueCount,
  dbReady,
}: {
  selectedPuzzle: PuzzleCategory;
  onSelectPuzzle: (puzzle: PuzzleCategory) => void;
  puzzleMethods: AlgorithmMethod[];
  activeMethodId: string;
  onSelectMethod: (methodId: string) => void;
  methodMasteries: Record<string, number>;
  onDrill: (methodId: string, phaseId: string, subsetId: string) => void;
  onRecognize: (methodId: string, phaseId: string, subsetId: string) => void;
  onPracticeMode: (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => void;
  onStats: (methodId: string, phaseId: string, phaseName: string) => void;
  onFullSolve: (methodId: string) => void;
  dueCount: number;
  dbReady: boolean;
}) {
  const method = METHODS.find((m) => m.id === activeMethodId);
  const phases = method ? METHOD_PHASES[method.name] ?? [] : [];
  const mastery = method ? (methodMasteries[method.name] ?? FALLBACK_MASTERY[method.name] ?? 0) : 0;

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
            <span className="nums shrink-0 inline-flex items-center gap-1.5 rounded-full bg-caution/20 border border-caution/40 px-2.5 py-0.5 text-[0.6rem] font-semibold text-ink ml-auto">
              <span className="size-1.5 rounded-full bg-caution shrink-0" />
              {dueCount} due for review
            </span>
          )}
        </div>

        {/* Method tabs — filtered by selected puzzle */}
        <div className="flex gap-1 flex-wrap items-center max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:pb-1 max-lg:scrollbar-none">
          {puzzleMethods.map((m) => {
            const MIcon = METHOD_ICONS[m.name] ?? Layers;
            const isActive = m.id === activeMethodId;
            const mPct = methodMasteries[m.name] ?? FALLBACK_MASTERY[m.name] ?? 0;
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
                      ? (() => { const pt = getPhasePracticeType(phase.id); return pt ? getPhaseModes(pt) : []; })()
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
                  const phasePct = methodMasteries[method.name]
                    ? Math.min(99, Math.round(mastery * 0.8 + phase.sortOrder * 3))
                    : 0;
                  return (
                    <div key={phase.id} className="flex items-center gap-2">
                      <div className={cn("size-1.5 rounded-full", PHASE_DOT[phase.id] ?? "bg-ink-3")} />
                      <span className="text-[0.62rem] text-ink-2 flex-1">{phase.name}</span>
                      <span className="nums text-[0.58rem] font-medium text-ink">
                        {phasePct}%
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

          {/* Quick Start — SRS due items */}
          {dueCount > 0 && (
            <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="size-3.5 text-caution" />
                <h2 className="text-[0.72rem] font-semibold text-ink">Review Queue</h2>
                <span className="nums text-[0.6rem] text-ink-3 ml-auto">{dueCount} item{dueCount !== 1 ? "s" : ""} due</span>
              </div>
              <p className="text-[0.62rem] text-ink-3">
                Spaced repetition items are ready for review. Practice these to lock in long-term retention.
              </p>
            </section>
          )}
          {dbReady && dueCount === 0 && (
            <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="size-3.5 text-ink-3/30" />
                <h2 className="text-[0.72rem] font-semibold text-ink">Review Queue</h2>
                <span className="nums text-[0.6rem] text-ink-3 ml-auto">All caught up!</span>
              </div>
              <p className="text-[0.62rem] text-ink-3">
                Nothing due for review. Start a new drill to build your practice history.
              </p>
            </section>
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

  // Progress tracking
  const { ready: dbReady, getMethodMastery, getDueForReview } = useTrainingProgress();
  const [methodMasteries, setMethodMasteries] = useState<Record<string, number>>({});
  const [dueCount, setDueCount] = useState(0);

  // Load method masteries and SRS due count
  useEffect(() => {
    if (!dbReady) return;
    async function load() {
      const masteries: Record<string, number> = {};
      for (const method of METHODS) {
        try {
          const m = await getMethodMastery(method.id);
          masteries[method.name] = m;
        } catch {
          masteries[method.name] = FALLBACK_MASTERY[method.name] ?? 0;
        }
      }
      setMethodMasteries(masteries);

      try {
        const due = await getDueForReview(50);
        setDueCount(due.length);
      } catch {
        setDueCount(0);
      }
    }
    load();
  }, [dbReady, getMethodMastery, getDueForReview]);

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

  const handleBackFromSubView = () => {
    setDrillView(null);
    setPracticeView(null);
    setRecognizeView(null);
    setStatsView(null);
    setFullSolveView(null);
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

  if (practiceView) {
    const { methodId, phaseId, phaseName, phaseType, modeId } = practiceView;
    const props = { methodId, phaseId, phaseName, onBack: handleBackFromSubView };

    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          {/* Generic: plain + speed-vs-eff */}
          {(modeId === "plain" || modeId === "speed-vs-eff") && (
            <PlainPracticeView {...props} exerciseLabel={modeId === "speed-vs-eff" ? "Speed vs Efficiency" : undefined} />
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
          onDrill={handleDrill}
          onRecognize={handleRecognize}
          onPracticeMode={handlePracticeMode}
          onStats={handleStats}
          onFullSolve={handleFullSolve}
          dueCount={dueCount}
          dbReady={dbReady}
        />
      </div>
    </div>
  );
}
