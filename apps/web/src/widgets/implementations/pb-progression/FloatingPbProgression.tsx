"use client";

import { useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { effectiveTime } from "@/types";
import { formatTime } from "@/utils/formatTime";
import type { Solve, PuzzleCategory } from "@/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";

export interface FloatingPbProgressionProps {
  solves: Solve[];
  puzzle?: string;
}

interface PbMilestone {
  solveNumber: number;
  timestamp: number;
  time: number;
  delta: number | null;
  isCurrent: boolean;
  solveId: string;
}

/**
 * Floating widget showing Personal Best progression over time.
 * Designed with minimalist, flat, speedcubing-grade aesthetics.
 */
export function FloatingPbProgression({ solves, puzzle }: FloatingPbProgressionProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filteredSolves = useMemo(() => {
    if (!puzzle) return solves;
    const targetType = puzzleCategoryToType(puzzle as PuzzleCategory);
    return solves.filter((s) => (s.puzzleType ?? "3x3x3") === targetType);
  }, [solves, puzzle]);

  // Chronological milestones (oldest to newest)
  const milestonesChrono = useMemo(() => {
    const chrono = [...filteredSolves].reverse();
    let runningPb = Infinity;
    const pbs: PbMilestone[] = [];
    let previousPb: number | null = null;

    for (let i = 0; i < chrono.length; i++) {
      const solve = chrono[i];
      const t = effectiveTime(solve);
      if (!Number.isFinite(t)) continue;
      if (t < runningPb) {
        const delta = previousPb !== null ? t - previousPb : null;
        pbs.push({
          solveNumber: i + 1,
          timestamp: solve.timestamp,
          time: t,
          delta,
          isCurrent: false,
          solveId: solve.id,
        });
        previousPb = t;
        runningPb = t;
      }
    }

    if (pbs.length > 0) {
      pbs[pbs.length - 1].isCurrent = true;
    }

    return pbs;
  }, [filteredSolves]);

  // Reversed for timeline list (newest first)
  const milestonesList = useMemo(() => {
    return [...milestonesChrono].reverse();
  }, [milestonesChrono]);

  const currentPb = milestonesChrono[milestonesChrono.length - 1];
  const initialPb = milestonesChrono[0];
  const pbCount = milestonesChrono.length;
  const totalDrop = initialPb && currentPb ? initialPb.time - currentPb.time : 0;
  const percentageDrop =
    initialPb && currentPb && initialPb.time > 0
      ? ((totalDrop / initialPb.time) * 100).toFixed(1)
      : "0";

  // Step Chart SVG Data
  const chartData = useMemo(() => {
    if (milestonesChrono.length < 2) return null;

    const width = 276;
    const height = 44;
    const paddingX = 10;
    const paddingTop = 6;
    const paddingBottom = 8;

    const times = milestonesChrono.map((m) => m.time);
    const maxT = Math.max(...times);
    const minT = Math.min(...times);
    const range = maxT - minT || 1;

    const points = milestonesChrono.map((m, idx) => {
      const x =
        paddingX + (idx / (milestonesChrono.length - 1)) * (width - 2 * paddingX);
      const y =
        paddingTop +
        ((m.time - minT) / range) * (height - paddingTop - paddingBottom);
      return { x, y, milestone: m, index: idx };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i - 1].y} L ${points[i].x} ${points[i].y}`;
    }

    return { points, pathD, width, height };
  }, [milestonesChrono]);

  const headerActions = puzzle ? (
    <span className="rounded bg-surface-2 border border-line px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-2 font-mono">
      {puzzle}
    </span>
  ) : null;

  return (
    <FloatingWidgetWrapper
      widgetId="pb-progression"
      icon={TrendingDown}
      label="PB progression"
      pillBadge={currentPb ? formatTime(currentPb.time) : undefined}
      pillBadge2={puzzle ?? (pbCount > 0 ? `${pbCount} PB${pbCount !== 1 ? "s" : ""}` : undefined)}
      headerActions={headerActions}
      panelWidth={310}
      panelMaxHeight={340}
      defaultPosition={{ x: 880, y: 440 }}
    >
      <div className="p-3 space-y-3 select-none">
        {milestonesChrono.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
            <TrendingDown className="size-6 text-ink-3/30" />
            <p className="text-xs font-medium text-ink-2">No PBs recorded</p>
            <p className="text-[0.65rem] text-ink-3">
              Complete solves to track your progression timeline.
            </p>
          </div>
        ) : (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface-2/40 p-2 text-left">
              <div>
                <span className="block text-[0.55rem] font-medium uppercase tracking-wider text-ink-3">
                  Current
                </span>
                <span className="nums text-sm font-semibold text-ink">
                  {currentPb ? formatTime(currentPb.time) : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[0.55rem] font-medium uppercase tracking-wider text-ink-3">
                  Total Drop
                </span>
                <span className="nums text-sm font-medium text-ready">
                  {totalDrop > 0 ? `−${formatTime(totalDrop)}` : "0.00s"}
                </span>
              </div>
              <div>
                <span className="block text-[0.55rem] font-medium uppercase tracking-wider text-ink-3">
                  Faster
                </span>
                <span className="nums text-sm font-medium text-ink-2">
                  {percentageDrop}%
                </span>
              </div>
            </div>

            {/* Step Staircase Graph (if 2+ PBs) */}
            {chartData && (
              <div className="rounded-lg border border-line/60 bg-surface-2/20 p-2">
                <div className="flex items-center justify-between mb-1 text-[0.55rem] font-mono text-ink-3 px-1">
                  <span>Staircase Trend</span>
                  <span>{milestonesChrono.length} Milestones</span>
                </div>
                <div className="relative w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                    className="w-full h-11 overflow-visible select-none"
                  >
                    {/* Background grid lines */}
                    <line
                      x1="10"
                      y1="6"
                      x2={chartData.width - 10}
                      y2="6"
                      stroke="currentColor"
                      className="text-line-2/40"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="10"
                      y1={chartData.height - 8}
                      x2={chartData.width - 10}
                      y2={chartData.height - 8}
                      stroke="currentColor"
                      className="text-line-2/40"
                      strokeDasharray="2 2"
                    />

                    {/* Step line */}
                    <path
                      d={chartData.pathD}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-ink-2"
                    />

                    {/* Points */}
                    {chartData.points.map((pt) => {
                      const isHovered = hoveredIndex === pt.index;
                      const isLast = pt.milestone.isCurrent;
                      return (
                        <g
                          key={pt.milestone.solveId}
                          onMouseEnter={() => setHoveredIndex(pt.index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 4 : isLast ? 3 : 2.5}
                            className={cn(
                              "transition-all duration-150",
                              isLast
                                ? "fill-ready stroke-ready"
                                : "fill-surface stroke-ink-2 hover:stroke-ink",
                            )}
                            strokeWidth={1.5}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Timeline Milestones List */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[0.55rem] uppercase tracking-wider font-semibold text-ink-3 font-mono px-0.5 pb-1 border-b border-line/50">
                <span>Milestone History</span>
                <span>{milestonesList.length} PBs</span>
              </div>

              <div className="relative pt-1">
                {/* Vertical connecting line */}
                <div className="absolute left-2 top-2.5 bottom-2.5 w-px bg-line-2/60" />

                <div className="space-y-1.5">
                  {milestonesList.map((pb) => {
                    const improvement = pb.delta !== null && pb.delta < 0;

                    return (
                      <div
                        key={pb.solveId}
                        className="relative flex items-start gap-2.5 text-left group"
                      >
                        {/* Dot indicator */}
                        <div className="relative z-10 mt-1.5 flex size-3.5 items-center justify-center shrink-0">
                          {pb.isCurrent ? (
                            <div className="size-2 rounded-full bg-ready border border-surface shadow-xs" />
                          ) : (
                            <div className="size-1.5 rounded-full border border-ink-3/50 bg-surface" />
                          )}
                        </div>

                        {/* Content row */}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2/50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "nums text-xs font-mono font-semibold tracking-tight",
                                  pb.isCurrent ? "text-ink" : "text-ink-2",
                                )}
                              >
                                {formatTime(pb.time)}
                              </span>
                              {pb.isCurrent && (
                                <span className="rounded border border-line bg-surface-2 px-1 py-0.2 text-[0.5rem] font-mono font-medium text-ink-2">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="nums text-[0.6rem] font-mono text-ink-3">
                              #{pb.solveNumber}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[0.6rem] font-mono text-ink-3">
                            {pb.delta !== null ? (
                              <span className={cn("nums", improvement ? "text-ready font-medium" : "text-ink-3")}>
                                {improvement ? "−" : "+"}{formatTime(Math.abs(pb.delta))}
                              </span>
                            ) : (
                              <span className="text-ink-3/70">Initial PB</span>
                            )}
                            <span>{formatTimestamp(pb.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
