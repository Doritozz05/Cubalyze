"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/useDraggable";
import { deriveHistogram, type HistogramBin } from "@/utils/insights";
import { formatTime, computeStats } from "@/utils/formatTime";
import type { Solve } from "@/types";

const STORAGE_KEY = "cubeforge:timeDistPanelPos";
const DEFAULT_POS = { x: 420, y: 120 };

export interface FloatingTimeDistributionProps {
  solves: Solve[];
}

/**
 * Floating histogram widget showing the distribution of solve times.
 * Inspired by csTimer's Time Distribution feature.
 *
 * Bins are computed from all valid (non-DNF) solves using 0.5s intervals.
 * The modal bin (most solves) and the mean line are highlighted.
 */
export function FloatingTimeDistribution({ solves }: FloatingTimeDistributionProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => setMounted(true), []);

  const drag = useDraggable<HTMLDivElement>(DEFAULT_POS, {
    storageKey: STORAGE_KEY,
    clickThreshold: 4,
  });

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
  const BAR_W = 28;
  const BAR_GAP = 2;

  if (!mounted) return null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <BarChart3 className="size-3.5 text-ink-3" />
        <span className="text-xs font-medium text-ink">Distribution</span>
        <span className="nums text-[0.6rem] text-ink-3">
          {stats.count} solves
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized((m) => !m);
          }}
          className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>
    </>
  );

  // ── Minimized pill ─────────────────────────────────────────────────
  if (minimized) {
    return createPortal(
      <motion.div
        ref={drag.elementRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{ left: drag.position.x, top: drag.position.y }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "fixed z-45 flex touch-none select-none items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-3 pr-2 shadow-lg",
          drag.isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
          "transition-colors hover:border-ink-2/40",
        )}
      >
        <BarChart3 className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">Distribution</span>
        <span className="nums text-[0.6rem] text-ink-3">{stats.count}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Expand"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────
  return createPortal(
    <motion.div
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{ left: drag.position.x, top: drag.position.y, width: 340 }}
      className={cn(
        "fixed z-45 flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
        drag.isDragging && "shadow-2xl",
      )}
    >
      {/* Header */}
      <div
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "flex items-center justify-between border-b border-line px-3 py-2",
          drag.isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {headerContent}
      </div>

      {/* Body */}
      <div className="p-3">
        {histogram.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-[0.7rem] text-ink-3">
            No valid times to display
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="flex items-end gap-[2px]" style={{ height: BAR_HEIGHT }}>
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
                      <div className="rounded bg-ink px-2 py-1 text-[0.55rem] text-surface whitespace-nowrap shadow-lg">
                        <span className="font-medium">{bin.label}s</span>
                        <span className="ml-1.5 text-ink-3">{bin.count} solves</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels (first, middle, last) */}
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
                σ {computeStdDeviation(solves, stats.mean)}
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

/** Compute standard deviation of solve times (excluding DNFs). */
function computeStdDeviation(solves: Solve[], mean: number | null): string {
  if (mean === null || solves.length < 2) return "—";
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => s.time)
    .filter((t) => Number.isFinite(t));
  if (valid.length < 2) return "—";
  const sumSq = valid.reduce((acc, t) => acc + (t - mean) ** 2, 0);
  const stdDev = Math.sqrt(sumSq / valid.length);
  return formatTime(stdDev);
}
