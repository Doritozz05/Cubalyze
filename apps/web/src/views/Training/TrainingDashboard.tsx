"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod } from "@cubeforge/algorithm-db";
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
  /** Whether this phase has algorithms in the DB (drives Drill/Recall buttons). */
  hasAlgorithms: boolean;
}

/** Phase definitions per method — mirrors the TRAINING_SYSTEM_v2 spec. */
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

/* ── Method accent colours — semantic tokens with subtle tint ────── */
const METHOD_ACCENTS: Record<string, string> = {
  CFOP:   "bg-ink/70",
  Roux:   "bg-ink/60",
  ZZ:     "bg-ink/50",
  Petrus: "bg-ink/40",
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  CFOP: Layers,
  Roux: Box,
  ZZ: Zap,
  Petrus: Pyramid,
};

/* ── Mock data ─────────────────────────────────────────────────────── */
const MOCK_MASTERY: Record<string, number> = { CFOP: 80, Roux: 70, ZZ: 30, Petrus: 45 };
const MOCK_PB: Record<string, string> = { CFOP: "8.2s", Roux: "9.1s", ZZ: "12.0s", Petrus: "14.3s" };

/** Per-phase mastery & average time — mock. */
const MOCK_PHASE_DATA: Record<string, { mastery: number; avgTime: string }> = {
  "cfop/cross":   { mastery: 85, avgTime: "2.1s" },
  "cfop/f2l":     { mastery: 75, avgTime: "6.5s" },
  "cfop/oll":     { mastery: 60, avgTime: "1.8s" },
  "cfop/pll":     { mastery: 90, avgTime: "1.2s" },
  "roux/first-block":  { mastery: 70, avgTime: "3.1s" },
  "roux/second-block": { mastery: 65, avgTime: "2.4s" },
  "roux/cmll":         { mastery: 55, avgTime: "1.7s" },
  "roux/lse":          { mastery: 60, avgTime: "2.2s" },
  "zz/eoline":   { mastery: 40, avgTime: "3.8s" },
  "zz/f2l-zz":   { mastery: 45, avgTime: "6.8s" },
  "zz/ll-zz":    { mastery: 50, avgTime: "2.3s" },
  "petrus/block-222":  { mastery: 50, avgTime: "2.8s" },
  "petrus/block-223":  { mastery: 45, avgTime: "3.2s" },
  "petrus/eo-petrus":  { mastery: 40, avgTime: "1.5s" },
  "petrus/f2l-petrus": { mastery: 40, avgTime: "4.0s" },
  "petrus/ll-petrus":  { mastery: 35, avgTime: "2.8s" },
};

/** Phase targets — what the user aims for. Mock. */
const MOCK_PHASE_TARGETS: Record<string, { target: string; actual: string }> = {
  "cfop/cross":   { target: "2.0s", actual: "2.4s" },
  "cfop/f2l":     { target: "6.0s", actual: "7.1s" },
  "cfop/oll":     { target: "1.5s", actual: "1.8s" },
  "cfop/pll":     { target: "1.2s", actual: "1.5s" },
  "roux/first-block":  { target: "2.5s", actual: "3.1s" },
  "roux/second-block": { target: "2.0s", actual: "2.4s" },
  "roux/cmll":         { target: "1.5s", actual: "1.7s" },
  "roux/lse":          { target: "2.0s", actual: "2.2s" },
  "zz/eoline":   { target: "3.0s", actual: "3.8s" },
  "zz/f2l-zz":   { target: "6.0s", actual: "6.8s" },
  "zz/ll-zz":    { target: "2.0s", actual: "2.3s" },
  "petrus/block-222":  { target: "2.5s", actual: "2.8s" },
  "petrus/block-223":  { target: "2.8s", actual: "3.2s" },
  "petrus/eo-petrus":  { target: "1.2s", actual: "1.5s" },
  "petrus/f2l-petrus": { target: "3.5s", actual: "4.0s" },
  "petrus/ll-petrus":  { target: "2.5s", actual: "2.8s" },
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
  // Parse "2.4s" -> 2.4
  const a = parseFloat(actual);
  const t = parseFloat(target);
  if (!a || !t) return 0;
  // Lower is better — percentage of target achieved
  const pct = (t / a) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Sum target/actual times across all phases of a method. */
function computePhaseTotals(methodName: string, phases: PhaseDef[]): { totalTarget: number; totalActual: number } {
  let totalTarget = 0;
  let totalActual = 0;
  for (const phase of phases) {
    const key = `${methodName.toLowerCase()}/${phase.id}`;
    const t = MOCK_PHASE_TARGETS[key];
    if (t) {
      totalTarget += parseFloat(t.target);
      totalActual += parseFloat(t.actual);
    }
  }
  return { totalTarget, totalActual };
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 1: Method grid
   ─────────────────────────────────────────────────────────────────────── */

function Level1MethodGrid({ onSelect }: { onSelect: (methodId: string) => void }) {
  return (
    <>
      {/* Header */}
      <header className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-md bg-ink text-surface">
            <Dumbbell className="size-3.5" />
          </div>
          <h1 className="text-[1.05rem] font-semibold tracking-tight text-ink">
            Training
          </h1>
        </div>
        <p className="text-[0.72rem] text-ink-3 max-w-lg">
          Select a method to start training. Each method has its own phases,
          drills, and progress tracking tailored to your solves.
        </p>
      </header>

      {/* Method cards */}
      <section className="shrink-0">
        <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">
          Select your method
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((method) => (
            <MethodCard key={method.id} method={method} onClick={() => onSelect(method.id)} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="shrink-0 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[0.75rem] font-medium text-ink hover:border-ink/15 hover:bg-surface-2 transition-colors">
          <Zap className="size-3.5 text-ink-2" />
          Quick Drill
        </button>
        <button className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.75rem] font-medium text-surface hover:bg-ink/90 transition-colors">
          <Target className="size-3.5" />
          Start Full Solve
        </button>
      </section>

      {/* Global SRS Queue */}
      <QueueSection items={MOCK_QUEUE} title="Today's Queue" />
    </>
  );
}

function MethodCard({ method, onClick }: { method: AlgorithmMethod; onClick: () => void }) {
  const accent = METHOD_ACCENTS[method.name] ?? METHOD_ACCENTS.CFOP;
  const Icon = METHOD_ICONS[method.name] ?? Layers;
  const mastery = MOCK_MASTERY[method.name] ?? 0;
  const pb = MOCK_PB[method.name] ?? "--";
  const subsets = getSubsetsForMethod(method.id).filter((s) => s.sortOrder > 0);

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm"
    >
      {/* Icon + name */}
      <div className="flex items-center gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2">
          <Icon className="size-4 text-ink" />
        </div>
        <div className="min-w-0">
          <span className="block text-[0.82rem] font-semibold text-ink leading-tight">
            {method.name}
          </span>
          <span className="block text-[0.62rem] text-ink-3 leading-tight">
            {subsets.length} subset{subsets.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[0.68rem] text-ink-2 leading-relaxed line-clamp-2">
        {method.description}
      </p>

      {/* Mastery bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="nums text-[0.7rem] font-medium text-ink">{mastery}%</span>
          <span className="text-[0.58rem] text-ink-3">{masteryLabel(mastery)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${mastery}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className={cn("h-full rounded-full", accent)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[0.62rem]">
        <span className="flex items-center gap-1 text-ink-3">
          <Clock className="size-3" /> PB {pb}
        </span>
        <span className="flex items-center gap-1 text-ink-3">
          <Target className="size-3" />
          {mastery >= 90 ? "Complete" : `${Math.max(0, 90 - mastery)}% to master`}
        </span>
      </div>
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Queue section (shared by L1 & L2)
   ─────────────────────────────────────────────────────────────────────── */

function QueueSection({
  items,
  title,
}: {
  items: typeof MOCK_QUEUE;
  title: string;
}) {
  return (
    <section className="shrink-0 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-ink-2" />
        <h2 className="text-[0.75rem] font-semibold text-ink">{title}</h2>
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-[0.68rem] text-ink-3 py-3 text-center">
          No items in the queue for this method.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function QueueRow({ item }: { item: (typeof MOCK_QUEUE)[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2">
      {/* Priority dot */}
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          item.priority === "high" && "bg-hold",
          item.priority === "medium" && "bg-caution",
          item.priority === "low" && "bg-ready",
          item.priority === "new" && "bg-ink-2",
        )}
      />

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <span className="text-[0.72rem] font-medium text-ink truncate">{item.caseLabel}</span>
        <span className="text-[0.58rem] text-ink-3 shrink-0 px-1.5 py-0.5 rounded bg-surface-2">
          {item.method}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 shrink-0">
        {item.priority === "new" ? (
          <span className="text-[0.6rem] font-medium text-ink-2">New</span>
        ) : (
          <>
            <span className="nums text-[0.65rem] text-ink-3">{item.daysAgo}d ago</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-10 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full rounded-full",
                    item.mastery >= 90 ? "bg-ready" : item.mastery >= 70 ? "bg-caution" : "bg-hold",
                  )}
                  style={{ width: `${item.mastery}%` }}
                />
              </div>
              <span className="nums text-[0.6rem] text-ink-3 w-7">{item.mastery}%</span>
            </div>
          </>
        )}
      </div>

      {/* Action button — stub, no onClick */}
      <span
        className={cn(
          "shrink-0 rounded-md px-2.5 py-1 text-[0.62rem] font-medium transition-colors",
          item.priority === "new"
            ? "bg-ink text-surface"
            : "bg-surface-2 text-ink-2",
        )}
      >
        {item.priority === "new" ? "Learn" : "Practice"}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Level 2: Method Phase Dashboard
   ─────────────────────────────────────────────────────────────────────── */

function Level2MethodPhase({
  method,
  onBack,
}: {
  method: AlgorithmMethod;
  onBack: () => void;
}) {
  const phases = METHOD_PHASES[method.name] ?? [];
  const methodMastery = MOCK_MASTERY[method.name] ?? 0;
  const methodPb = MOCK_PB[method.name] ?? "--";

  // Filter queue by this method
  const methodQueue = useMemo(
    () => MOCK_QUEUE.filter((q) => q.method === method.name),
    [method.name],
  );

  return (
    <>
      {/* ── Header with breadcrumb ────────────────────────────────── */}
      <header className="flex flex-col gap-2 shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="size-3" />
          Back to methods
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2">
              {(() => {
                const Icon = METHOD_ICONS[method.name] ?? Layers;
                return <Icon className="size-4 text-ink" />;
              })()}
            </div>
            <div>
              <h1 className="text-[1.05rem] font-semibold tracking-tight text-ink">
                {method.name}
              </h1>
              <p className="text-[0.62rem] text-ink-3">{method.description}</p>
            </div>
          </div>

          {/* Global stats badges */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="nums text-[0.72rem] font-semibold text-ink tabular-nums">
              {methodMastery}%
            </span>
            <span className="text-[0.58rem] text-ink-3">{masteryLabel(methodMastery)}</span>
            <span className="w-px h-4 bg-line" />
            <span className="flex items-center gap-1 text-[0.62rem] text-ink-3">
              <Clock className="size-3" /> PB {methodPb}
            </span>
            <span className="flex items-center gap-1 text-[0.62rem] text-ink-3">
              <TrendingUp className="size-3" /> 12d streak
            </span>
          </div>
        </div>
      </header>

      {/* ── Phase cards ────────────────────────────────────────────── */}
      <section className="shrink-0">
        <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">
          Phases
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {phases.map((phase) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              methodName={method.name}
              accent={METHOD_ACCENTS[method.name] ?? "bg-ink/60"}
            />
          ))}
        </div>
      </section>

      {/* ── Phase Targets ──────────────────────────────────────────── */}
      <section className="shrink-0 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="size-4 text-ink-2" />
          <h2 className="text-[0.75rem] font-semibold text-ink">Phase Targets</h2>
        </div>

        <div className={cn(
          "grid gap-3",
          phases.length <= 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}>
          {phases.map((phase) => {
            const key = `${method.name.toLowerCase()}/${phase.id}`;
            const target = MOCK_PHASE_TARGETS[key];
            if (!target) return null;
            const pct = percentToTarget(target.actual, target.target);

            return (
              <div key={phase.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.65rem] font-medium text-ink-2">{phase.name}</span>
                  <span className="nums text-[0.62rem] text-ink-3">
                    {target.actual} / {target.target}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    className={cn(
                      "h-full rounded-full",
                      pct >= 90 ? "bg-ready" : pct >= 60 ? "bg-caution" : "bg-hold",
                    )}
                  />
                </div>
                <span className={cn(
                  "text-[0.55rem]",
                  pct >= 90 ? "text-ready" : pct >= 60 ? "text-caution" : "text-hold",
                )}>
                  {pct}% of target
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 pt-3 border-t border-line">
          <div className="flex items-center gap-2">
            <span className="text-[0.62rem] text-ink-3">Total target</span>
            <span className="nums text-[0.72rem] font-semibold text-ink">
              {computePhaseTotals(method.name, phases).totalTarget.toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.62rem] text-ink-3">Actual</span>
            <span className="nums text-[0.72rem] font-semibold text-ink">
              {computePhaseTotals(method.name, phases).totalActual.toFixed(1)}s
            </span>
          </div>
          <button className="ml-auto inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[0.7rem] font-medium text-surface hover:bg-ink/90 transition-colors">
            <Target className="size-3.5" />
            Start Full Solve
          </button>
        </div>
      </section>

      {/* ── Method SRS Queue ────────────────────────────────────────── */}
      <QueueSection items={methodQueue} title={`${method.name} Queue`} />

      {/* Spacer */}
      <div className="shrink-0 h-4" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Phase card (Level 2)
   ─────────────────────────────────────────────────────────────────────── */

function PhaseCard({
  phase,
  methodName,
  accent,
}: {
  phase: PhaseDef;
  methodName: string;
  accent: string;
}) {
  const key = `${methodName.toLowerCase()}/${phase.id}`;
  const data = MOCK_PHASE_DATA[key] ?? { mastery: 0, avgTime: "--" };
  const Icon = phase.icon;

  // Determine available training mode buttons based on hasAlgorithms
  const modeButtons = phase.hasAlgorithms
    ? (["Drill", "Recall", "Stats"] as const)
    : (["Train", "Stats"] as const);

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
          <Icon className="size-3.5 text-ink-2" />
        </div>
        <div className="min-w-0">
          <span className="block text-[0.78rem] font-semibold text-ink leading-tight">
            {phase.name}
          </span>
          <span className="nums text-[0.6rem] text-ink-3">
            avg {data.avgTime}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[0.65rem] text-ink-2 leading-relaxed line-clamp-2">
        {phase.description}
      </p>

      {/* Mastery bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="nums text-[0.68rem] font-medium text-ink">{data.mastery}%</span>
          <span className="text-[0.55rem] text-ink-3">{masteryLabel(data.mastery)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.mastery}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className={cn("h-full rounded-full", accent)}
          />
        </div>
      </div>

      {/* Action buttons — stubs, no onClick yet */}
      <div className="flex gap-1.5 pt-1 border-t border-line">
        {modeButtons.map((label) => (
          <span
            key={label}
            className={cn(
              "rounded-md px-2.5 py-1 text-[0.6rem] font-medium transition-colors cursor-default",
              label === "Drill" || label === "Train"
                ? "bg-surface-2 text-ink-2 group-hover:bg-line group-hover:text-ink"
                : "text-ink-3 group-hover:text-ink-2",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Top-level dashboard (routing between L1 and L2)
   ─────────────────────────────────────────────────────────────────────── */

export function TrainingDashboard() {
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const selectedMethod = useMemo(
    () => (selectedMethodId ? METHODS.find((m) => m.id === selectedMethodId) ?? null : null),
    [selectedMethodId],
  );

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {selectedMethod ? (
          <Level2MethodPhase
            method={selectedMethod}
            onBack={() => setSelectedMethodId(null)}
          />
        ) : (
          <Level1MethodGrid onSelect={setSelectedMethodId} />
        )}
      </div>
    </div>
  );
}
