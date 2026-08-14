"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Solve } from "@/types";
import { useBottomLayoutStats } from "./useBottomLayoutStats";
import type { BottomLayoutDefinition, BottomLayoutStatId } from "./types";

/** Display labels for stat cells: WCA shorthand is literal, the rest are i18n. */
const STAT_LABELS: Record<BottomLayoutStatId, { literal?: string; key?: string }> = {
  ao5: { literal: "Ao5" },
  ao12: { literal: "Ao12" },
  ao50: { literal: "Ao50" },
  ao100: { literal: "Ao100" },
  mo3: { literal: "Mo3" },
  best: { key: "best" },
  worst: { key: "worst" },
  mean: { key: "mean" },
  deviation: { key: "deviation" },
  count: { key: "count" },
  sessionTime: { key: "sessionTime" },
  tps: { key: "tps" },
  bestAo5: { key: "bestAo5" },
  bestAo12: { key: "bestAo12" },
};

function StatCell({ stat, value }: { stat: BottomLayoutStatId; value: string }) {
  const { t } = useTranslation("stats");
  const meta = STAT_LABELS[stat];
  const label = meta.literal ?? t(meta.key as never);
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 max-lg:gap-1.5">
      <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.18em] text-ink-3 max-lg:text-[0.52rem] max-lg:tracking-[0.12em]">
        {label}
      </span>
      <span className="nums truncate text-sm tabular-nums text-ink max-lg:text-xs">{value}</span>
    </div>
  );
}

export interface GenericBottomLayoutProps {
  template: BottomLayoutDefinition;
  solves: Solve[];
  puzzleFilter?: string;
  className?: string;
  /** Injected scramble element rendered in `scramble` cells. */
  scramble?: ReactNode;
  /** Injected 2D scramble net rendered in `scramble-2d` cells. */
  scramble2d?: ReactNode;
  /** Injected timer element rendered in `timer` cells (future). */
  timer?: ReactNode;
}

/**
 * Data-driven renderer for bottom layout templates.
 *
 * It renders the template's `columns` as a weighted grid and each `cell` by
 * kind: `stat` cells are computed from `solves`, while `scramble`/`timer`
 * cells render an element injected by the caller (they need props that live
 * in `TimerStage`, not in the template data).
 */
export function GenericBottomLayout({
  template,
  solves,
  puzzleFilter,
  className,
  scramble,
  scramble2d,
  timer,
}: GenericBottomLayoutProps) {
  const values = useBottomLayoutStats(solves, puzzleFilter);

  const gridTemplateColumns = (
    template.weights && template.weights.length === template.columns.length
      ? template.weights
      : template.columns.map(() => 1)
  )
    .map((weight) => `${weight}fr`)
    .join(" ");

  return (
    <div
      className={cn(
        "grid w-full items-stretch gap-4 rounded-lg border border-line bg-surface px-4 py-3 max-lg:gap-2 max-lg:px-2.5 max-lg:py-2",
        className,
      )}
      style={{ gridTemplateColumns }}
    >
      {template.columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1.5 max-lg:gap-1",
            columnIndex > 0 && "border-l border-line pl-4 max-lg:pl-2",
          )}
        >
          {column.cells.map((cell, cellIndex) => {
            if (cell.kind === "stat") {
              return (
                <StatCell
                  key={cellIndex}
                  stat={cell.stat}
                  value={values[cell.stat]}
                />
              );
            }
            if (cell.kind === "scramble") {
              return (
                <div
                  key={cellIndex}
                  className="flex min-w-0 items-center justify-center"
                >
                  {scramble}
                </div>
              );
            }
            if (cell.kind === "scramble-2d") {
              return (
                <div
                  key={cellIndex}
                  className="flex min-w-0 items-center justify-center"
                >
                  {scramble2d}
                </div>
              );
            }
            return (
              <div key={cellIndex} className="flex items-center justify-center">
                {timer}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
