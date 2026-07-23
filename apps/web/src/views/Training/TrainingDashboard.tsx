"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod } from "@cubeforge/algorithm-db";
import {
  Box,
  Layers,
  Pyramid,
  Zap,
  Target,
  TrendingUp,
  Clock,
  Dumbbell,
} from "lucide-react";

/* ── Method accent colours — use semantic tokens with subtle tint ────── */
const METHOD_ACCENTS: Record<string, { bg: string; text: string; bar: string }> = {
  CFOP: {
    bg: "bg-surface-2",
    text: "text-ink",
    bar: "bg-ink/70",
  },
  Roux: {
    bg: "bg-surface-2",
    text: "text-ink",
    bar: "bg-ink/60",
  },
  ZZ: {
    bg: "bg-surface-2",
    text: "text-ink",
    bar: "bg-ink/50",
  },
  Petrus: {
    bg: "bg-surface-2",
    text: "text-ink",
    bar: "bg-ink/40",
  },
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  CFOP: Layers,
  Roux: Box,
  ZZ: Zap,
  Petrus: Pyramid,
};

/* ── Simulated mastery data (placeholder until ProgressTracker is wired) ── */
const MOCK_MASTERY: Record<string, number> = {
  CFOP: 80,
  Roux: 70,
  ZZ: 30,
  Petrus: 45,
};

const MOCK_PB: Record<string, string> = {
  CFOP: "8.2s",
  Roux: "9.1s",
  ZZ: "12.0s",
  Petrus: "14.3s",
};

/* ── Simulated SRS queue ───────────────────────────────────────────────── */
const MOCK_QUEUE = [
  {
    id: "1",
    caseLabel: "OLL 21",
    method: "CFOP",
    daysAgo: 3,
    mastery: 78,
    priority: "high" as const,
  },
  {
    id: "2",
    caseLabel: "CMLL A2",
    method: "Roux",
    daysAgo: 2,
    mastery: 85,
    priority: "medium" as const,
  },
  {
    id: "3",
    caseLabel: "PLL Aa",
    method: "CFOP",
    daysAgo: 1,
    mastery: 92,
    priority: "low" as const,
  },
  {
    id: "4",
    caseLabel: "EOLine",
    method: "ZZ",
    daysAgo: 0,
    mastery: 0,
    priority: "new" as const,
  },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function masteryLabel(pct: number): string {
  if (pct >= 90) return "Mastered";
  if (pct >= 60) return "Learning";
  if (pct > 0) return "Beginner";
  return "New";
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function TrainingDashboard() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* ── Header ───────────────────────────────────────────────── */}
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

        {/* ── Method cards ──────────────────────────────────────────── */}
        <section className="shrink-0">
          <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 mb-3">
            Select your method
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {METHODS.map((method) => {
              const accent = METHOD_ACCENTS[method.name] ?? METHOD_ACCENTS.CFOP;
              const Icon = METHOD_ICONS[method.name] ?? Layers;
              const mastery = MOCK_MASTERY[method.name] ?? 0;
              const pb = MOCK_PB[method.name] ?? "--";
              const subsets = getSubsetsForMethod(method.id).filter(
                (s) => s.sortOrder > 0,
              );
              const isSelected = selectedMethod === method.id;

              return (
                <motion.button
                  key={method.id}
                  onClick={() =>
                    setSelectedMethod((prev) =>
                      prev === method.id ? null : method.id,
                    )
                  }
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                    isSelected
                      ? "border-ink/30 bg-surface-2 ring-1 ring-ink/15 shadow-sm"
                      : "border-line bg-surface hover:border-ink/12 hover:bg-surface-2/60 hover:shadow-sm",
                  )}
                >
                  {/* Icon + name row */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg border border-line",
                        accent.bg,
                      )}
                    >
                      <Icon className={cn("size-4", accent.text)} />
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
                      <span className="nums text-[0.7rem] font-medium text-ink">
                        {mastery}%
                      </span>
                      <span className="text-[0.58rem] text-ink-3">
                        {masteryLabel(mastery)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${mastery}%` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                        className={cn("h-full rounded-full", accent.bar)}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-[0.62rem]">
                    <span className="flex items-center gap-1 text-ink-3">
                      <Clock className="size-3" />
                      PB {pb}
                    </span>
                    <span className="flex items-center gap-1 text-ink-3">
                      <Target className="size-3" />
                      {mastery >= 90
                        ? "Complete"
                        : `${Math.max(0, 90 - mastery)}% to master`}
                    </span>
                  </div>

                  {/* Selected: show phases */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 flex flex-wrap gap-1.5 pt-2 border-t border-line">
                        {subsets.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full border border-line bg-surface px-2 py-0.5 text-[0.6rem] text-ink-2"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── Quick Actions ──────────────────────────────────────────── */}
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

        {/* ── Today's Queue ──────────────────────────────────────────── */}
        <section className="shrink-0 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-ink-2" />
            <h2 className="text-[0.75rem] font-semibold text-ink">
              Today&apos;s Queue
            </h2>
            <span className="nums text-[0.62rem] text-ink-3 ml-auto">
              {MOCK_QUEUE.length} items
            </span>
          </div>

          <div className="space-y-1.5">
            {MOCK_QUEUE.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
              >
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
                  <span className="text-[0.72rem] font-medium text-ink truncate">
                    {item.caseLabel}
                  </span>
                  <span className="text-[0.58rem] text-ink-3 shrink-0 px-1.5 py-0.5 rounded bg-surface-2">
                    {item.method}
                  </span>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 shrink-0">
                  {item.priority === "new" ? (
                    <span className="text-[0.6rem] font-medium text-ink-2">
                      New
                    </span>
                  ) : (
                    <>
                      <span className="nums text-[0.65rem] text-ink-3">
                        {item.daysAgo}d ago
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-10 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              item.mastery >= 90
                                ? "bg-ready"
                                : item.mastery >= 70
                                  ? "bg-caution"
                                  : "bg-hold",
                            )}
                            style={{ width: `${item.mastery}%` }}
                          />
                        </div>
                        <span className="nums text-[0.6rem] text-ink-3 w-7">
                          {item.mastery}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action */}
                <button
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-[0.62rem] font-medium transition-colors",
                    item.priority === "new"
                      ? "bg-ink text-surface hover:bg-ink/90"
                      : "bg-surface-2 text-ink-2 hover:bg-line hover:text-ink",
                  )}
                >
                  {item.priority === "new" ? "Learn" : "Practice"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Spacer for bottom scroll padding ──────────────────────── */}
        <div className="shrink-0 h-4" />
      </div>
    </div>
  );
}


