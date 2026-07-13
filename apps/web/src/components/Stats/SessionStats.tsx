"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeStats, statLabel } from "@/utils/formatTime";
import type { Solve } from "@/types";

export interface SessionStatsProps {
  solves: Solve[];
  className?: string;
}

interface Cell {
  label: string;
  value: string;
  /** Highlight: the best single stands out subtly. */
  accent?: boolean;
}

/**
 * Compact, flat summary row shown beneath the timer: Ao5, Ao12, Best, Mean.
 * The "Best" cell is emphasized with a faint green tint so the eye lands on it.
 */
export function SessionStats({ solves, className }: SessionStatsProps) {
  const stats = useMemo(() => computeStats(solves), [solves]);

  const cells: Cell[] = [
    { label: "Ao5", value: statLabel(stats.ao5) },
    { label: "Ao12", value: statLabel(stats.ao12) },
    { label: "Best", value: statLabel(stats.best), accent: Number.isFinite(stats.best) },
    { label: "Mean", value: statLabel(stats.mean) },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-4 overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3 sm:px-3",
            i !== 0 && "border-l border-line",
            c.accent && "bg-ready-soft/40",
          )}
        >
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
            {c.label}
          </span>
          <span
            className={cn(
              "nums text-sm tabular-nums text-ink sm:text-[0.95rem]",
              c.accent && "text-ready",
            )}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}
