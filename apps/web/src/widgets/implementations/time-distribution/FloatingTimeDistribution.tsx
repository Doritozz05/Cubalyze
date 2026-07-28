"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { deriveHistogram } from "@/utils/insights";
import { formatTime, computeStats } from "@/utils/formatTime";
import { stdDeviation } from "@cubeforge/statistics";
import type { Solve } from "@/types";

export interface FloatingTimeDistributionProps {
  solves: Solve[];
}

/**
 * Floating histogram widget showing the distribution of solve times.
 * Inspired by csTimer's Time Distribution feature.
 *
 * Uses FloatingWidgetWrapper for all portal/drag/minimize behavior.
 */
export function FloatingTimeDistribution({ solves }: FloatingTimeDistributionProps) {
  const { histogram, stats } = useMemo(() => {
    const h = deriveHistogram(solves, 500);
    const s = computeStats(solves);
    return { histogram: h, stats: s };
  }, [solves]);

  const maxCount = useMemo(
    () => (histogram.length > 0 ? Math.max(...histogram.map((b) => b.count)) : 0),
    [histogram],
  );

  const BAR_HEIGHT = 120;

  return (
    <FloatingWidgetWrapper
      widgetId="time-distribution"
      icon={BarChart3}
      label="Distribution"
      pillBadge={`${stats.count} solves`}
      panelWidth={340}
      defaultPosition={{ x: 420, y: 120 }}
    >
      <div className="p-3">
        {histogram.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-[0.7rem] text-ink-3">
            No valid times to display
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="flex items-end gap-0.5" style={{ height: BAR_HEIGHT }}>
              {histogram.map((bin, i) => {
                const height = maxCount > 0 ? (bin.count / maxCount) * BAR_HEIGHT : 0;
                const isModal = bin.count === maxCount && maxCount > 0;
                return (
                  <div
                    key={i}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    style={{ height: BAR_HEIGHT }}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-100",
                        isModal ? "bg-ink-2" : "bg-ink-3/40",
                      )}
                      style={{ height: Math.max(2, height) }}
                    />
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute bottom-full mb-1 hidden flex-col items-center group-hover:flex">
                      <div className="rounded border border-line bg-surface px-2 py-1 text-[0.55rem] text-ink whitespace-nowrap shadow-lg">
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
              <div className="mt-1.5 flex justify-between text-[0.5rem] text-ink-3/70">
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
                  Best {formatTime(stats.best)}
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
