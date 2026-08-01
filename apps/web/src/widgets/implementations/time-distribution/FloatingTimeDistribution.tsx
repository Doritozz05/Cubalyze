"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { deriveHistogram } from "@/utils/insights";
import { formatTime, computeStats } from "@/utils/formatTime";
import { stdDeviation } from "@cubeforge/statistics";
import type { Solve, PuzzleCategory } from "@/types";

import { puzzleCategoryToType } from "@/utils/puzzleUtils";

export interface FloatingTimeDistributionProps {
  solves: Solve[];
  puzzle?: string;
}

/**
 * Floating histogram widget showing the distribution of solve times.
 * Inspired by csTimer's Time Distribution feature.
 *
 * Uses FloatingWidgetWrapper for all portal/drag/minimize behavior.
 */
export function FloatingTimeDistribution({ solves, puzzle }: FloatingTimeDistributionProps) {
  const filteredSolves = useMemo(() => {
    if (!puzzle) return solves;
    const targetType = puzzleCategoryToType(puzzle as PuzzleCategory);
    return solves.filter((s) => (s.puzzleType ?? "3x3x3") === targetType);
  }, [solves, puzzle]);

  const { histogram, stats } = useMemo(() => {
    const h = deriveHistogram(filteredSolves, 500);
    const s = computeStats(filteredSolves);
    return { histogram: h, stats: s };
  }, [filteredSolves]);

  const maxCount = useMemo(
    () => (histogram.length > 0 ? Math.max(...histogram.map((b) => b.count)) : 0),
    [histogram],
  );

  const BAR_HEIGHT = 120;
  // Reserved headroom at the top of the chart so hover tooltips render
  // INSIDE the panel instead of being clipped by the panel's overflow.
  const TOOLTIP_ZONE = 28;
  const CHART_HEIGHT = BAR_HEIGHT + TOOLTIP_ZONE;

  const headerActions = puzzle ? (
    <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-brand tracking-wider">
      {puzzle}
    </span>
  ) : null;

  return (
    <FloatingWidgetWrapper
      widgetId="time-distribution"
      icon={BarChart3}
      label="Distribution"
      pillBadge={`${stats.count} solves`}
      pillBadge2={puzzle}
      headerActions={headerActions}
      panelWidth={340}
      defaultPosition={{ x: 880, y: 72 }}
    >
      <div className="p-3">
        {histogram.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-[0.7rem] text-ink-3">
            No valid times to display
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div
              className="flex items-end gap-0.5"
              style={{ height: CHART_HEIGHT }}
            >
              {histogram.map((bin: { label: string; count: number }, i: number) => {
                const height = maxCount > 0 ? (bin.count / maxCount) * BAR_HEIGHT : 0;
                const isModal = bin.count === maxCount && maxCount > 0;
                return (
                  <div
                    key={i}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    style={{ height: CHART_HEIGHT }}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-100",
                        isModal ? "bg-ink-2" : "bg-ink-3/40",
                      )}
                      style={{ height: Math.max(2, height) }}
                    />
                    {/* Tooltip on hover — anchored to the top of the chart so it
                        stays inside the panel body (overflow-y-auto) and never
                        gets clipped above the chart. */}
                    <div className="pointer-events-none absolute top-0 mt-1 hidden flex-col items-center group-hover:flex">
                      <div className="rounded border border-line bg-surface px-2 py-1 text-[0.6rem] text-ink whitespace-nowrap shadow-lg">
                        <span className="font-medium">{bin.label}s</span>
                        <span className="ml-1.5 text-ink-3">{bin.count} solves</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            {histogram.length > 0 && (
              <div className="mt-1.5 flex justify-between text-[0.6rem] text-ink-3/70">
                <span className="nums">{histogram[0].label.split("–")[0]}s</span>
                {histogram.length > 2 && (
                  <span className="nums">
                    {histogram[Math.floor(histogram.length / 2)].label.split("–")[0]}s
                  </span>
                )}
                <span className="nums">
                  {histogram[histogram.length - 1].label.split("–")[1]}s
                </span>
              </div>
            )}

            {/* Stats summary */}
            <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2.5 text-[0.6rem] text-ink-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-ready" />
                  Mean {stats.mean != null ? formatTime(stats.mean) : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-ink-2" />
                  Best {stats.best != null ? formatTime(stats.best) : "—"}
                </span>
              </div>
              <span className="nums">
                σ {formatStdDeviation(solves, stats.mean)}
              </span>
            </div>
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}

/** Standard deviation formatted for display. */
function formatStdDeviation(solves: Solve[], mean: number | null): string {
  const sd = stdDeviation(solves, mean);
  return sd !== null ? formatTime(sd) : "—";
}
