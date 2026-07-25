"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSubsetsForMethod } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
import { PhaseTrainerView } from "./PhaseTrainerView";
import { AlgorithmRecognizeView } from "./AlgorithmRecognizeView";
import { PhaseStatsView } from "./PhaseStatsView";
import { FullSolveView } from "./FullSolveView";
import { TrainingCalendar } from "./TrainingCalendar";
import {
  Box,
  Layers,
  Pyramid,
  Zap,
  Target,
  TrendingUp,
  Clock,
  Dumbbell,
  ArrowLeft,
  Crosshair,
  Grid3x3,
  Palette,
  Shuffle,
  Blocks,
  ArrowRightLeft,
  Gauge,
  MoveHorizontal,
  Grid2x2,
  Sparkles,
  Trophy,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Data: methods, phases, mock progress
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
    { id: "cross",   name: "Cross",   icon: Crosshair,    description: "Solve the cross efficiently. Fewer moves, faster solutions.", sortOrder: 1, hasAlgorithms: false },
    { id: "f2l",     name: "F2L",     icon: Grid3x3,      description: "First two layers — algorithmic pairs for every slot.",   sortOrder: 2, hasAlgorithms: true  },
    { id: "oll",     name: "OLL",     icon: Palette,       description: "Orient last layer — 57 cases to master.",                sortOrder: 3, hasAlgorithms: true  },
    { id: "pll",     name: "PLL",     icon: Shuffle,       description: "Permute last layer — 21 cases for the final step.",      sortOrder: 4, hasAlgorithms: true  },
  ],
  Roux: [
    { id: "first-block",  name: "First block",  icon: Box,              description: "Build a 1×2×3 block on the left.",         sortOrder: 1, hasAlgorithms: false },
    { id: "second-block", name: "Second block", icon: Blocks,           description: "Build the right 1×2×3 block efficiently.", sortOrder: 2, hasAlgorithms: false },
    { id: "cmll",         name: "CMLL",         icon: Palette,          description: "Corners of last layer — 42 cases.",         sortOrder: 3, hasAlgorithms: true  },
    { id: "lse",          name: "LSE",          icon: ArrowRightLeft,   description: "Last six edges — EO, UL/UR, M-slice.",     sortOrder: 4, hasAlgorithms: false },
  ],
  ZZ: [
    { id: "eoline", name: "EOLine",    icon: Zap,         description: "Edge Orientation + Line. No rotations needed.", sortOrder: 1, hasAlgorithms: false },
    { id: "f2l-zz", name: "F2L (ZZ)",  icon: Grid3x3,     description: "First two layers using only R, U, L moves.",   sortOrder: 2, hasAlgorithms: true  },
    { id: "ll-zz",  name: "Last layer",icon: Target,       description: "OCLL, COLL, ZZLL — last layer for ZZ.",        sortOrder: 3, hasAlgorithms: true  },
  ],
  Petrus: [
    { id: "block-222",  name: "2×2×2 block", icon: Grid2x2,    description: "Build the first 2×2×2 block.",                   sortOrder: 1, hasAlgorithms: false },
    { id: "block-223",  name: "2×2×3 block", icon: Grid3x3,     description: "Extend to a 2×2×3 block.",                      sortOrder: 2, hasAlgorithms: false },
    { id: "eo-petrus",  name: "EO",          icon: Gauge,       description: "Edge Orientation after blocks.",                 sortOrder: 3, hasAlgorithms: false },
    { id: "f2l-petrus", name: "F2L (Petrus)",icon: MoveHorizontal,description: "Finish F2L after EO.",                         sortOrder: 4, hasAlgorithms: true  },
    { id: "ll-petrus",  name: "Last layer",  icon: Target,      description: "COLL + EPLL for Petrus last layer.",             sortOrder: 5, hasAlgorithms: true  },
  ],
};

/** Map phase IDs to subset IDs for drill navigation. */
function findSubsetId(methodId: string, phaseId: string): string | null {
  const phaseToSubsetName: Record<string, string> = {
    "oll":       "OLL",
    "pll":       "PLL",
    "f2l":       "F2L",
    "cmll":      "CMLL",
    "f2l-zz":    "F2L",
    "ll-zz":     "OCLL",
    "f2l-petrus":"F2L",
    "ll-petrus": "COLL",
  };
  const subsetName = phaseToSubsetName[phaseId];
  if (!subsetName) return null;
  const subset = SUBSETS.find((s) => s.methodId === methodId && s.name === subsetName)
    ?? SUBSETS.find((s) => s.name === subsetName);
  return subset?.id ?? null;
}

const METHOD_ACCENTS: Record<string, string> = {
  CFOP: "bg-ink/70", Roux: "bg-ink/60", ZZ: "bg-ink/50", Petrus: "bg-ink/40",
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  CFOP: Layers, Roux: Box, ZZ: Zap, Petrus: Pyramid,
};

/** Phase color dots for visual distinction */
const PHASE_DOT: Record<string, string> = {
  cross: "bg-blue-400", f2l: "bg-emerald-400", oll: "bg-amber-400", pll: "bg-violet-400",
  "first-block": "bg-rose-400", "second-block": "bg-orange-400", cmll: "bg-violet-400", lse: "bg-cyan-400",
  eoline: "bg-sky-400", "f2l-zz": "bg-emerald-400", "ll-zz": "bg-amber-400",
  "block-222": "bg-rose-400", "block-223": "bg-orange-400", "eo-petrus": "bg-cyan-400",
  "f2l-petrus": "bg-emerald-400", "ll-petrus": "bg-amber-400",
};

/* ── Mock data ─────────────────────────────────────────────────────── */
const MOCK_MASTERY: Record<string, number> = { CFOP: 80, Roux: 70, ZZ: 30, Petrus: 45 };
const MOCK_PB: Record<string, string> = { CFOP: "8.2s", Roux: "9.1s", ZZ: "12.0s", Petrus: "14.3s" };

const MOCK_PHASE_DATA: Record<string, { mastery: number; avgTime: string }> = {
  "cfop/cross": { mastery: 85, avgTime: "2.1s" }, "cfop/f2l": { mastery: 75, avgTime: "6.5s" },
  "cfop/oll": { mastery: 60, avgTime: "1.8s" },   "cfop/pll": { mastery: 90, avgTime: "1.2s" },
  "roux/first-block": { mastery: 70, avgTime: "3.1s" }, "roux/second-block": { mastery: 65, avgTime: "2.4s" },
  "roux/cmll": { mastery: 55, avgTime: "1.7s" },        "roux/lse": { mastery: 60, avgTime: "2.2s" },
  "zz/eoline": { mastery: 40, avgTime: "3.8s" }, "zz/f2l-zz": { mastery: 45, avgTime: "6.8s" }, "zz/ll-zz": { mastery: 50, avgTime: "2.3s" },
  "petrus/block-222": { mastery: 50, avgTime: "2.8s" }, "petrus/block-223": { mastery: 45, avgTime: "3.2s" },
  "petrus/eo-petrus": { mastery: 40, avgTime: "1.5s" }, "petrus/f2l-petrus": { mastery: 40, avgTime: "4.0s" },
  "petrus/ll-petrus": { mastery: 35, avgTime: "2.8s" },
};

const MOCK_PHASE_TARGETS: Record<string, { target: string; actual: string }> = {
  "cfop/cross": { target: "2.0s", actual: "2.4s" }, "cfop/f2l": { target: "6.0s", actual: "7.1s" },
  "cfop/oll": { target: "1.5s", actual: "1.8s" },   "cfop/pll": { target: "1.2s", actual: "1.5s" },
  "roux/first-block": { target: "2.5s", actual: "3.1s" }, "roux/second-block": { target: "2.0s", actual: "2.4s" },
  "roux/cmll": { target: "1.5s", actual: "1.7s" },        "roux/lse": { target: "2.0s", actual: "2.2s" },
  "zz/eoline": { target: "3.0s", actual: "3.8s" }, "zz/f2l-zz": { target: "6.0s", actual: "6.8s" }, "zz/ll-zz": { target: "2.0s", actual: "2.3s" },
  "petrus/block-222": { target: "2.5s", actual: "2.8s" }, "petrus/block-223": { target: "2.8s", actual: "3.2s" },
  "petrus/eo-petrus": { target: "1.2s", actual: "1.5s" }, "petrus/f2l-petrus": { target: "3.5s", actual: "4.0s" },
  "petrus/ll-petrus": { target: "2.5s", actual: "2.8s" },
};

const MOCK_QUEUE = [
  { id: "1", caseLabel: "OLL 21",  method: "CFOP", daysAgo: 3, mastery: 78, priority: "high" as const },
  { id: "2", caseLabel: "CMLL A2", method: "Roux", daysAgo: 2, mastery: 85, priority: "medium" as const },
  { id: "3", caseLabel: "PLL Aa",  method: "CFOP", daysAgo: 1, mastery: 92, priority: "low" as const },
  { id: "4", caseLabel: "EOLine",  method: "ZZ",   daysAgo: 0, mastery: 0,  priority: "new" as const },
  { id: "5", caseLabel: "OLL 33",  method: "CFOP", daysAgo: 0, mastery: 0,  priority: "new" as const },
  { id: "6", caseLabel: "H Perm",  method: "CFOP", daysAgo: 4, mastery: 65, priority: "high" as const },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */

function masteryLabel(pct: number): string {
  if (pct >= 90) return "Mastered";
  if (pct >= 60) return "Learning";
  if (pct > 0) return "Beginner";
  return "New";
}

function percentToTarget(actual: string, target: string): number {
  const a = parseFloat(actual); const t = parseFloat(target);
  if (!a || !t) return 0;
  return Math.min(100, Math.max(0, Math.round((t / a) * 100)));
}

function computePhaseTotals(methodName: string, phases: PhaseDef[]): { totalTarget: number; totalActual: number } {
  let totalTarget = 0, totalActual = 0;
  for (const phase of phases) {
    const t = MOCK_PHASE_TARGETS[`${methodName.toLowerCase()}/${phase.id}`];
    if (t) { totalTarget += parseFloat(t.target); totalActual += parseFloat(t.actual); }
  }
  return { totalTarget, totalActual };
}

/* ──────────────────────────────────────────────────────────────────────────
   Queue section — compact version (used in L2 only)
   ─────────────────────────────────────────────────────────────────────── */

function QueueSection({ items, title }: { items: typeof MOCK_QUEUE; title: string }) {
  if (items.length === 0) return null;
  return (
    <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-3.5 text-ink-2" />
        <h2 className="text-[0.72rem] font-semibold text-ink">{title}</h2>
        <span className="nums text-[0.6rem] text-ink-3 ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2">
            <span className={cn("size-2 shrink-0 rounded-full",
              item.priority === "high" && "bg-hold", item.priority === "medium" && "bg-caution",
              item.priority === "low" && "bg-ready", item.priority === "new" && "bg-ink-2")} />
            <span className="text-[0.68rem] font-medium text-ink truncate flex-1">{item.caseLabel}</span>
            {item.priority === "new" ? (
              <span className="text-[0.58rem] font-medium text-ink-2 shrink-0">New</span>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full rounded-full", item.mastery >= 90 ? "bg-ready" : item.mastery >= 70 ? "bg-caution" : "bg-hold")}
                    style={{ width: `${item.mastery}%` }} />
                </div>
                <span className="nums text-[0.58rem] text-ink-3 w-6 text-right">{item.mastery}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 1: Method grid — same as original but Queue replaced with Summary
   ─────────────────────────────────────────────────────────────────────── */

function Level1MethodGrid({ onSelect }: { onSelect: (methodId: string) => void }) {
  return (
    <>
      <header className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-md bg-ink text-surface"><Dumbbell className="size-3.5" /></div>
          <h1 className="text-[1.05rem] font-semibold tracking-tight text-ink">Training</h1>
        </div>
        <p className="text-[0.72rem] text-ink-3 max-w-lg">Select a method to start training. Each method has its own phases, drills, and progress tracking tailored to your solves.</p>
      </header>
      <section className="shrink-0">
        <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">Select your method</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((method) => (
            <motion.button key={method.id} onClick={() => onSelect(method.id)} whileTap={{ scale: 0.98 }}
              className="group relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2">
                  {(() => { const Icon = METHOD_ICONS[method.name] ?? Layers; return <Icon className="size-4 text-ink" />; })()}
                </div>
                <div className="min-w-0">
                  <span className="block text-[0.82rem] font-semibold text-ink leading-tight">{method.name}</span>
                  <span className="block text-[0.62rem] text-ink-3 leading-tight">{getSubsetsForMethod(method.id).filter((s) => s.sortOrder > 0).length} subsets</span>
                </div>
              </div>
              <p className="text-[0.68rem] text-ink-2 leading-relaxed line-clamp-2">{method.description}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="nums text-[0.7rem] font-medium text-ink">{MOCK_MASTERY[method.name] ?? 0}%</span>
                  <span className="text-[0.58rem] text-ink-3">{masteryLabel(MOCK_MASTERY[method.name] ?? 0)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${MOCK_MASTERY[method.name] ?? 0}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className={cn("h-full rounded-full", METHOD_ACCENTS[method.name] ?? "bg-ink/60")} />
                </div>
              </div>
              <div className="flex items-center gap-4 text-[0.62rem]">
                <span className="flex items-center gap-1 text-ink-3"><Clock className="size-3" /> PB {MOCK_PB[method.name] ?? "--"}</span>
                <span className="flex items-center gap-1 text-ink-3"><Target className="size-3" />{(MOCK_MASTERY[method.name] ?? 0) >= 90 ? "Complete" : `${Math.max(0, 90 - (MOCK_MASTERY[method.name] ?? 0))}% to master`}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Compact summary */}
      <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-3.5 text-ink-2" />
          <h2 className="text-[0.7rem] font-semibold text-ink">Quick Summary</h2>
          <span className="nums text-[0.58rem] text-ink-3 ml-auto">12d streak</span>
        </div>
        <div className="flex items-center gap-3 text-[0.65rem] text-ink-2">
          <span className="flex items-center gap-1.5"><Trophy className="size-3.5 text-ready" /> Strongest: PLL (90%)</span>
          <span className="text-ink-3/40">·</span>
          <span className="flex items-center gap-1.5"><TrendingUp className="size-3.5 text-caution" /> Focus: ZZ EOLine (40%)</span>
        </div>
      </section>

      {/* Training Schedule Calendar */}
      <TrainingCalendar />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 2: Method Phase Dashboard — slightly bigger buttons, compact Phase Targets
   ─────────────────────────────────────────────────────────────────────── */

function Level2MethodPhase({
  method,
  onBack,    onDrillPhase,
  onTrainPhase,    onRecognizePhase,
  onStatsPhase,
  onFullSolve,
}: {
  method: AlgorithmMethod;
  onBack: () => void;
  onDrillPhase: (phaseId: string, subsetId: string) => void;
  onTrainPhase: (phaseId: string, phaseName: string) => void;
  onRecognizePhase: (phaseId: string, subsetId: string) => void;
  onStatsPhase: (phaseId: string, phaseName: string) => void;
  onFullSolve: () => void;
}) {
  const phases = METHOD_PHASES[method.name] ?? [];
  const methodQueue = useMemo(() => MOCK_QUEUE.filter((q) => q.method === method.name), [method.name]);

  return (
    <>
      <header className="flex flex-col gap-2 shrink-0">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors w-fit"><ArrowLeft className="size-3" />Back to methods</button>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2">
              {(() => { const Icon = METHOD_ICONS[method.name] ?? Layers; return <Icon className="size-4 text-ink" />; })()}
            </div>
            <div><h1 className="text-[1.05rem] font-semibold tracking-tight text-ink">{method.name}</h1><p className="text-[0.62rem] text-ink-3">{method.description}</p></div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="nums text-[0.72rem] font-semibold text-ink tabular-nums">{MOCK_MASTERY[method.name] ?? 0}%</span>
            <span className="text-[0.58rem] text-ink-3">{masteryLabel(MOCK_MASTERY[method.name] ?? 0)}</span>
            <span className="w-px h-4 bg-line" />
            <span className="flex items-center gap-1 text-[0.62rem] text-ink-3"><Clock className="size-3" />PB {MOCK_PB[method.name] ?? "--"}</span>
            <span className="flex items-center gap-1 text-[0.62rem] text-ink-3"><TrendingUp className="size-3" />12d streak</span>
          </div>
        </div>
      </header>

      <section className="shrink-0">
        <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">Phases</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {phases.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} methodName={method.name}
              accent={METHOD_ACCENTS[method.name] ?? "bg-ink/60"}
              onDrill={() => {
                const sid = findSubsetId(method.id, phase.id);
                if (sid) onDrillPhase(phase.id, sid);
              }}
              onTrain={() => onTrainPhase(phase.id, phase.name)}
              onRecall={() => {
                const sid = findSubsetId(method.id, phase.id);
                if (sid) onRecognizePhase(phase.id, sid);
              }}
              onStats={() => onStatsPhase(phase.id, phase.name)}
            />
          ))}
        </div>
      </section>

      {/* Phase Targets — more compact: thinner bars, tighter spacing, no "X% of target" labels */}
      <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="size-3.5 text-ink-2" />
          <h2 className="text-[0.72rem] font-semibold text-ink">Phase Targets</h2>
          <span className="nums text-[0.6rem] text-ink-3 ml-auto">Total: {computePhaseTotals(method.name, phases).totalTarget.toFixed(1)}s</span>
        </div>
        <div className="space-y-2">
          {phases.map((phase) => {
            const key = `${method.name.toLowerCase()}/${phase.id}`;
            const target = MOCK_PHASE_TARGETS[key];
            if (!target) return null;
            const pct = percentToTarget(target.actual, target.target);
            return (
              <div key={phase.id} className="flex items-center gap-2.5">
                <span className="text-[0.6rem] font-medium text-ink-2 w-16 shrink-0">{phase.name}</span>
                <div className="flex-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    className={cn("h-full rounded-full", pct >= 90 ? "bg-ready" : pct >= 60 ? "bg-caution" : "bg-hold")} />
                </div>
                <span className="nums text-[0.55rem] text-ink-3 w-14 text-right shrink-0">{target.actual} / {target.target}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-line">
          <div className="flex items-center gap-1.5"><span className="text-[0.6rem] text-ink-3">Actual</span><span className="nums text-[0.65rem] font-semibold text-ink">{computePhaseTotals(method.name, phases).totalActual.toFixed(1)}s</span></div>
          <button onClick={onFullSolve} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.65rem] font-medium text-surface hover:bg-ink/90 transition-colors"><Target className="size-3" />Full Solve</button>
        </div>
      </section>

      <QueueSection items={methodQueue} title={`${method.name} Queue`} />
      <div className="shrink-0 h-4" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Phase card — buttons slightly bigger (0.68rem vs original 0.6rem), color dot added
   ─────────────────────────────────────────────────────────────────────── */

function PhaseCard({
  phase, methodName, accent, onDrill, onTrain, onRecall, onStats,
}: {
  phase: PhaseDef; methodName: string; accent: string; onDrill: () => void; onTrain: () => void; onRecall: () => void; onStats: () => void;
}) {
  const data = MOCK_PHASE_DATA[`${methodName.toLowerCase()}/${phase.id}`] ?? { mastery: 0, avgTime: "--" };
  const Icon = phase.icon;
  const dotColor = PHASE_DOT[phase.id] ?? "bg-ink-3";

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2"><Icon className="size-3.5 text-ink-2" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="block text-[0.78rem] font-semibold text-ink leading-tight">{phase.name}</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", dotColor)} />
          </div>
          <span className="nums text-[0.6rem] text-ink-3">avg {data.avgTime}</span>
        </div>
      </div>
      <p className="text-[0.65rem] text-ink-2 leading-relaxed line-clamp-2">{phase.description}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="nums text-[0.68rem] font-medium text-ink">{data.mastery}%</span>
          <span className="text-[0.55rem] text-ink-3">{masteryLabel(data.mastery)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div initial={{ width: 0 }} animate={{ width: `${data.mastery}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className={cn("h-full rounded-full", accent)} />
        </div>
      </div>
      <div className="flex gap-1.5 pt-1 border-t border-line">
        {phase.hasAlgorithms ? (
          <>
            <button onClick={onDrill}
              className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer">
              Drill
            </button>
            <button onClick={onRecall}
              className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer">
              Recognize
            </button>
            <button onClick={onStats}
              className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer ml-auto">
              Stats
            </button>
          </>
        ) : (
          <>
            <button onClick={onTrain}
              className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer">
              Train
            </button>
            <button onClick={onStats}
              className="rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer ml-auto">
              Stats
            </button>
          </>
        )}
      </div>
    </div>
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

interface TrainViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
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
   Top-level dashboard (L1 → L2 → L3 routing)
   ─────────────────────────────────────────────────────────────────────── */

export interface TrainingDashboardProps {
  /** When set from Algorithms → Training bridge, auto-navigates to Drill with case preselected. */
  preset?: { subsetId: string; caseId: string } | null;
  /** Called after the preset has been consumed so the parent can clear it. */
  onPresetConsumed?: () => void;
}

export function TrainingDashboard({ preset, onPresetConsumed }: TrainingDashboardProps = {}) {
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [trainView, setTrainView] = useState<TrainViewState | null>(null);
  const [recognizeView, setRecognizeView] = useState<RecognizeViewState | null>(null);
  const [statsView, setStatsView] = useState<StatsViewState | null>(null);
  const [fullSolveView, setFullSolveView] = useState<FullSolveViewState | null>(null);

  const selectedMethod = useMemo(
    () => (selectedMethodId ? METHODS.find((m) => m.id === selectedMethodId) ?? null : null),
    [selectedMethodId],
  );

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
  }, []);

  const [drillView, setDrillView] = useState<DrillViewState | null>(initialDrillView);

  useEffect(() => {
    if (preset?.subsetId) {
      const subset = SUBSETS.find((s) => s.id === preset.subsetId);
      if (subset) setSelectedMethodId(subset.methodId);
      onPresetConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrillPhase = (phaseId: string, subsetId: string) => {
    if (!selectedMethodId) return;
    setDrillView({ methodId: selectedMethodId, phaseId, subsetId });
  };

  const handleTrainPhase = (phaseId: string, phaseName: string) => {
    if (!selectedMethodId) return;
    setTrainView({ methodId: selectedMethodId, phaseId, phaseName });
  };

  const handleRecallPhase = (phaseId: string, subsetId: string) => {
    if (!selectedMethodId) return;
    setRecognizeView({ methodId: selectedMethodId, phaseId, subsetId });
  };

  const handleStatsPhase = (phaseId: string, phaseName: string) => {
    if (!selectedMethodId) return;
    setStatsView({ methodId: selectedMethodId, phaseId, phaseName });
  };

  const handleFullSolve = () => {
    if (!selectedMethodId) return;
    setFullSolveView({ methodId: selectedMethodId });
  };

  // L3: Algorithm Drill View
  if (drillView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmDrillView
            methodId={drillView.methodId}
            phaseId={drillView.phaseId}
            subsetId={drillView.subsetId}
            onBack={() => setDrillView(null)}
            preselectedCaseId={drillPresetCaseId}
          />
        </div>
      </div>
    );
  }

  // L3: Algorithm Recognize View
  if (recognizeView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmRecognizeView
            methodId={recognizeView.methodId}
            phaseId={recognizeView.phaseId}
            subsetId={recognizeView.subsetId}
            onBack={() => setRecognizeView(null)}
          />
        </div>
      </div>
    );
  }

  // L3: Phase Stats View
  if (statsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <PhaseStatsView
            methodId={statsView.methodId}
            phaseId={statsView.phaseId}
            phaseName={statsView.phaseName}
            onBack={() => setStatsView(null)}
          />
        </div>
      </div>
    );
  }

  // L3: Full Solve View
  if (fullSolveView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <FullSolveView
            methodId={fullSolveView.methodId}
            onBack={() => setFullSolveView(null)}
          />
        </div>
      </div>
    );
  }

  // L3: Phase Trainer View
  if (trainView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <PhaseTrainerView
            methodId={trainView.methodId}
            phaseId={trainView.phaseId}
            phaseName={trainView.phaseName}
            onBack={() => setTrainView(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {selectedMethod ? (
          <Level2MethodPhase
            method={selectedMethod}
            onBack={() => setSelectedMethodId(null)}
            onDrillPhase={handleDrillPhase}
            onTrainPhase={handleTrainPhase}
            onRecognizePhase={handleRecallPhase}
            onStatsPhase={handleStatsPhase}
            onFullSolve={handleFullSolve}
          />
        ) : (
          <Level1MethodGrid onSelect={setSelectedMethodId} />
        )}
      </div>
    </div>
  );
}
