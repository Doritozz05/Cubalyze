"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ActivityHeatmapProps {
  /**
   * Flat array of daily counts, oldest first. The grid renders the last
   * `weeks * 7` entries. Missing/undefined days are treated as 0.
   */
  counts: number[];
  /** Number of weeks to display (columns). Default 12. */
  weeks?: number;
  className?: string;
}

/**
 * Intensity scale (0–4) mapped to flat background tones. No green glow —
 * just a progressive shift from the surface to ink, matching the
 * utilitarian palette.
 */
const INTENSITY_BG = [
  "bg-surface-2",
  "bg-ink-3/30",
  "bg-ink-3/55",
  "bg-ink-2/70",
  "bg-ink",
] as const;

function intensity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/**
 * GitHub-style practice-frequency heatmap. Columns = weeks, rows = days
 * (Mon→Sun). Flat tones, no glow. A small legend sits below.
 *
 * Data shape: `counts` is a flat array of daily solve counts (oldest first).
 * The component slices the last `weeks * 7` entries and arranges them into
 * a week-column / day-row grid. Columns stretch (flex-1) with aspect-square
 * cells so the grid always fills the full width of its container.
 */
export const ActivityHeatmap = memo(function ActivityHeatmap({
  counts,
  weeks = 12,
  className,
}: ActivityHeatmapProps) {
  const { grid, max } = useMemo(() => {
    const total = weeks * 7;
    const slice = counts.slice(-total);
    // Pad the front with zeros so the grid aligns to full weeks.
    const padded = new Array(Math.max(0, total - slice.length)).fill(0).concat(slice);
    const cols: number[][] = [];
    for (let w = 0; w < weeks; w++) {
      cols.push(padded.slice(w * 7, w * 7 + 7));
    }
    const m = Math.max(1, ...padded);
    return { grid: cols, max: m };
  }, [counts, weeks]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex w-full gap-[3px]">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-1 flex-col gap-[3px]">
            {week.map((count, di) => {
              const lvl = intensity(count, max);
              return (
                <Tooltip key={di}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square w-full rounded-[2px]",
                        INTENSITY_BG[lvl],
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[0.55rem]">
                    {count > 0 ? `${count} solve${count > 1 ? "s" : ""}` : "No solves"}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[0.58rem] text-ink-3">
        <span>Less</span>
        <div className="flex items-center gap-[3px]">
          {INTENSITY_BG.map((bg, i) => (
            <div key={`${bg}-${i}`} className={cn("size-[10px] rounded-[2px]", bg)} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
});
