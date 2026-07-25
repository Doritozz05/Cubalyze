"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeStats, statLabel } from "@/utils/formatTime";
import type { Solve } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface SessionStatsProps {
  solves: Solve[];
  className?: string;
  /** When provided, the row becomes a clickable shortcut to the full Stats view. */
  onExpand?: () => void;
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
 *
 * When `onExpand` is supplied the whole row acts as a button that jumps to the
 * full Stats view — a lightweight affordance that "there's more to see"
 * without pushing the timer down.
 */
export function SessionStats({ solves, className, onExpand }: SessionStatsProps) {
  const stats = useMemo(() => computeStats(solves), [solves]);

  const cells: Cell[] = [
    { label: "Ao5", value: statLabel(stats.ao5) },
    { label: "Ao12", value: statLabel(stats.ao12) },
    { label: "Best", value: statLabel(stats.best), accent: Number.isFinite(stats.best) },
    { label: "Mean", value: statLabel(stats.mean) },
  ];

  const interactive = !!onExpand;

  const statsDiv = (
    <div
      className={cn(
        "grid grid-cols-4 overflow-hidden rounded-lg border border-line bg-surface transition-colors",
        interactive &&
          "cursor-pointer hover:border-ink-2/40 focus-visible:border-ink-2 focus-visible:outline-none",
        className,
      )}
      onClick={interactive ? onExpand : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExpand();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
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

  if (!interactive) return statsDiv;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {statsDiv}
      </TooltipTrigger>
      <TooltipContent side="bottom">View full stats</TooltipContent>
    </Tooltip>
  );
}
