"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeStats, formatTime, formatDuration, statLabel } from "@/utils/formatTime";
import type { Solve } from "@/types";
import { TrendChart } from "./TrendChart";

export interface StatsPanelProps {
  solves: Solve[];
  /** Personal best across all sessions (mock). */
  pb?: number;
  className?: string;
}

interface Tile {
  label: string;
  value: string;
  sub?: string;
}

/**
 * Detailed statistics view (sidebar "Stats" tab). A best-single highlight up
 * top, a flat Ao5 trend chart, then a clean tile grid. Keeps the look flat.
 */
export function StatsPanel({ solves, pb, className }: StatsPanelProps) {
  const stats = useMemo(() => computeStats(solves), [solves]);

  const bestSingle = Number.isFinite(stats.best) ? stats.best : null;
  const isPb = pb != null && bestSingle !== null && bestSingle <= pb;
  const pbDelta =
    pb != null && bestSingle !== null && Number.isFinite(bestSingle)
      ? bestSingle - pb
      : null;

  const tiles: Tile[] = [
    { label: "Best", value: statLabel(stats.best) },
    { label: "Worst", value: statLabel(stats.worst) },
    { label: "Mean", value: statLabel(stats.mean) },
    { label: "Ao5", value: statLabel(stats.ao5) },
    { label: "Ao12", value: statLabel(stats.ao12) },
    { label: "Ao100", value: statLabel(stats.ao100) },
    {
      label: "Solves",
      value: `${stats.count}`,
      sub: stats.total !== stats.count ? `${stats.total} total` : undefined,
    },
    { label: "Session", value: formatDuration(stats.sessionTime) },
  ];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Best single highlight */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.62rem] uppercase tracking-[0.2em] text-ink-3">
            Best single
          </span>
          {isPb ? (
            <span className="rounded bg-ready-soft px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-ready">
              PB
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="nums text-3xl text-ink">
            {bestSingle !== null ? formatTime(bestSingle) : "—"}
          </p>
          {pbDelta !== null && !isPb ? (
            <span className="nums text-[0.7rem] text-ink-3">
              +{formatTime(Math.abs(pbDelta))} off PB
            </span>
          ) : null}
        </div>
      </div>

      {/* Ao5 trend */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <TrendChart solves={solves} defaultWindow={5} />
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 bg-surface px-3.5 py-3"
          >
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
              {t.label}
            </span>
            <span className="nums text-lg text-ink">{t.value}</span>
            {t.sub ? (
              <span className="nums text-[0.65rem] text-ink-3">{t.sub}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
