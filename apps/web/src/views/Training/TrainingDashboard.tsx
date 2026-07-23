"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSubsetsForMethod } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
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
    { id: "f2l",     name: "F2L",     icon: Grid3x3,      description: "First Two Layers — algorithmic pairs for every slot.",   sortOrder: 2, hasAlgorithms: true  },
    { id: "oll",     name: "OLL",     icon: Palette,       description: "Orient Last Layer — 57 cases to master.",                sortOrder: 3, hasAlgorithms: true  },
    { id: "pll",     name: "PLL",     icon: Shuffle,       description: "Permute Last Layer — 21 cases for the final step.",      sortOrder: 4, hasAlgorithms: true  },
  ],
  Roux: [
    { id: "first-block",  name: "First Block",  icon: Box,              description: "Build a 1×2×3 block on the left.",         sortOrder: 1, hasAlgorithms: false },
    { id: "second-block", name: "Second Block", icon: Blocks,           description: "Build the right 1×2×3 block efficiently.", sortOrder: 2, hasAlgorithms: false },
    { id: "cmll",         name: "CMLL",         icon: Palette,          description: "Corners of Last Layer — 42 cases.",         sortOrder: 3, hasAlgorithms: true  },
    { id: "lse",          name: "LSE",          icon: ArrowRightLeft,   description: "Last Six Edges — EO, UL/UR, M-slice.",     sortOrder: 4, hasAlgorithms: false },
  ],
  ZZ: [
    { id: "eoline", name: "EOLine",    icon: Zap,         description: "Edge Orientation + Line. No rotations needed.", sortOrder: 1, hasAlgorithms: false },
    { id: "f2l-zz", name: "F2L (ZZ)",  icon: Grid3x3,     description: "First Two Layers using only R, U, L moves.",   sortOrder: 2, hasAlgorithms: true  },
    { id: "ll-zz",  name: "Last Layer",icon: Target,       description: "OCLL, COLL, ZZLL — last layer for ZZ.",        sortOrder: 3, hasAlgorithms: true  },
  ],
  Petrus: [
    { id: "block-222",  name: "2×2×2 Block", icon: Grid2x2,    description: "Build the first 2×2×2 block.",                   sortOrder: 1, hasAlgorithms: false },
    { id: "block-223",  name: "2×2×3 Block", icon: Grid3x3,     description: "Extend to a 2×2×3 block.",                      sortOrder: 2, hasAlgorithms: false },
    { id: "eo-petrus",  name: "EO",          icon: Gauge,       description: "Edge Orientation after blocks.",                 sortOrder: 3, hasAlgorithms: false },
    { id: "f2l-petrus", name: "F2L (Petrus)",icon: MoveHorizontal,description: "Finish F2L after EO.",                         sortOrder: 4, hasAlgorithms: true  },
    { id: "ll-petrus",  name: "Last Layer",  icon: Target,      description: "COLL + EPLL for Petrus last layer.",             sortOrder: 5, hasAlgorithms: true  },
  ],
};

/** Map phase IDs to subset IDs for drill navigation.
 *  Looks for a method-specific subset first, then falls back to any subset with
 *  that name (handles cross-method subsets like F2L shared across CFOP/ZZ/Petrus). */
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
  // First try method-specific, then fall back to any method
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
   Queue section (shared)
   ─────────────────────────────────────────────────────────────────────── */

function QueueSection({ items, title }: { items: typeof MOCK_QUEUE; title: string }) {
  return (
    <section className="shrink-0 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-ink-2" />
        <h2 className="text-[0.75rem] font-semibold text-ink">{title}</h2>
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[0.68rem] text-ink-3 py-3 text-center">No items in the queue for this method.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2">
              <span className={cn("size-2 shrink-0 rounded-full",
                item.priority === "high" && "bg-hold", item.priority === "medium" && "bg-caution",
                item.priority === "low" && "bg-ready", item.priority === "new" && "bg-ink-2")} />
              <div className="flex-1 min-w-0 flex items-center gap-2.5">
                <span className="text-[0.72rem] font-medium text-ink truncate">{item.caseLabel}</span>
                <span className="text-[0.58rem] text-ink-3 shrink-0 px-1.5 py-0.5 rounded bg-surface-2">{item.method}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.priority === "new" ? <span className="text-[0.6rem] font-medium text-ink-2">New</span> : (
                  <><span className="nums text-[0.65rem] text-ink-3">{item.daysAgo}d ago</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-10 overflow-hidden rounded-full bg-surface-2">
                        <div className={cn("h-full rounded-full", item.mastery >= 90 ? "bg-ready" : item.mastery >= 70 ? "bg-caution" : "bg-hold")} style={{ width: `${item.mastery}%` }} />
                      </div>
                      <span className="nums text-[0.6rem] text-ink-3 w-7">{item.mastery}%</span>
                    </div></>
                )}
              </div>
              <span className={cn("shrink-0 rounded-md px-2.5 py-1 text-[0.62rem] font-medium", item.priority === "new" ? "bg-ink text-surface" : "bg-surface-2 text-ink-2")}>
                {item.priority === "new" ? "Learn" : "Practice"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 1: Method grid
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
      <section className="shrink-0 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[0.75rem] font-medium text-ink hover:border-ink/15 hover:bg-surface-2 transition-colors"><Zap className="size-3.5 text-ink-2" />Quick Drill</button>
        <button className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.75rem] font-medium text-surface hover:bg-ink/90 transition-colors"><Target className="size-3.5" />Start Full Solve</button>
      </section>
      <QueueSection items={MOCK_QUEUE} title="Today's Queue" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 2: Method Phase Dashboard
   ─────────────────────────────────────────────────────────────────────── */

function Level2MethodPhase({
  method,
  onBack,
  onDrillPhase,
}: {
  method: AlgorithmMethod;
  onBack: () => void;
  onDrillPhase: (phaseId: string, subsetId: string) => void;
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
              }} />
          ))}
        </div>
      </section>

      <section className="shrink-0 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 mb-4"><Target className="size-4 text-ink-2" /><h2 className="text-[0.75rem] font-semibold text-ink">Phase Targets</h2></div>
        <div className={cn("grid gap-3", phases.length <= 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
          {phases.map((phase) => {
            const key = `${method.name.toLowerCase()}/${phase.id}`;
            const target = MOCK_PHASE_TARGETS[key];
            if (!target) return null;
            const pct = percentToTarget(target.actual, target.target);
            return (
              <div key={phase.id} className="space-y-1.5">
                <div className="flex items-center justify-between"><span className="text-[0.65rem] font-medium text-ink-2">{phase.name}</span><span className="nums text-[0.62rem] text-ink-3">{target.actual} / {target.target}</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    className={cn("h-full rounded-full", pct >= 90 ? "bg-ready" : pct >= 60 ? "bg-caution" : "bg-hold")} />
                </div>
                <span className={cn("text-[0.55rem]", pct >= 90 ? "text-ready" : pct >= 60 ? "text-caution" : "text-hold")}>{pct}% of target</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 pt-3 border-t border-line">
          <div className="flex items-center gap-2"><span className="text-[0.62rem] text-ink-3">Total target</span><span className="nums text-[0.72rem] font-semibold text-ink">{computePhaseTotals(method.name, phases).totalTarget.toFixed(1)}s</span></div>
          <div className="flex items-center gap-2"><span className="text-[0.62rem] text-ink-3">Actual</span><span className="nums text-[0.72rem] font-semibold text-ink">{computePhaseTotals(method.name, phases).totalActual.toFixed(1)}s</span></div>
          <button className="ml-auto inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[0.7rem] font-medium text-surface hover:bg-ink/90 transition-colors"><Target className="size-3.5" />Start Full Solve</button>
        </div>
      </section>

      <QueueSection items={methodQueue} title={`${method.name} Queue`} />
      <div className="shrink-0 h-4" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Phase card
   ─────────────────────────────────────────────────────────────────────── */

function PhaseCard({
  phase, methodName, accent, onDrill,
}: {
  phase: PhaseDef; methodName: string; accent: string; onDrill: () => void;
}) {
  const data = MOCK_PHASE_DATA[`${methodName.toLowerCase()}/${phase.id}`] ?? { mastery: 0, avgTime: "--" };
  const Icon = phase.icon;
  const modeButtons = phase.hasAlgorithms ? (["Drill", "Recall", "Stats"] as const) : (["Train", "Stats"] as const);

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2"><Icon className="size-3.5 text-ink-2" /></div>
        <div className="min-w-0"><span className="block text-[0.78rem] font-semibold text-ink leading-tight">{phase.name}</span><span className="nums text-[0.6rem] text-ink-3">avg {data.avgTime}</span></div>
      </div>
      <p className="text-[0.65rem] text-ink-2 leading-relaxed line-clamp-2">{phase.description}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between"><span className="nums text-[0.68rem] font-medium text-ink">{data.mastery}%</span><span className="text-[0.55rem] text-ink-3">{masteryLabel(data.mastery)}</span></div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div initial={{ width: 0 }} animate={{ width: `${data.mastery}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className={cn("h-full rounded-full", accent)} />
        </div>
      </div>
      <div className="flex gap-1.5 pt-1 border-t border-line">
        {modeButtons.map((label) => {
          const isDrill = label === "Drill";
          const isTrain = label === "Train";
          if (isDrill) {
            return (
              <button key={label} onClick={onDrill}
                className="rounded-md px-2.5 py-1 text-[0.6rem] font-medium transition-colors bg-surface-2 text-ink-2 hover:bg-line hover:text-ink cursor-pointer">
                {label}
              </button>
            );
          }
          return (
            <span key={label} className={cn("rounded-md px-2.5 py-1 text-[0.6rem] font-medium transition-colors cursor-default",
              isTrain ? "bg-surface-2 text-ink-2 group-hover:bg-line group-hover:text-ink" : "text-ink-3 group-hover:text-ink-2")}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Top-level dashboard (L1 → L2 → L3 routing)
   ─────────────────────────────────────────────────────────────────────── */

interface DrillViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

export function TrainingDashboard() {
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<DrillViewState | null>(null);

  const selectedMethod = useMemo(
    () => (selectedMethodId ? METHODS.find((m) => m.id === selectedMethodId) ?? null : null),
    [selectedMethodId],
  );

  const handleDrillPhase = (phaseId: string, subsetId: string) => {
    if (!selectedMethodId) return;
    setDrillView({ methodId: selectedMethodId, phaseId, subsetId });
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
          />
        ) : (
          <Level1MethodGrid onSelect={setSelectedMethodId} />
        )}
      </div>
    </div>
  );
}
