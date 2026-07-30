"use client";

import { useMemo } from "react";
import { Trophy, Sparkles } from "lucide-react";
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
 * Uses FloatingWidgetWrapper for all portal/drag/minimize behavior.
 */
export function FloatingPbProgression({ solves, puzzle }: FloatingPbProgressionProps) {
  const filteredSolves = useMemo(() => {
    if (!puzzle) return solves;
    const targetType = puzzleCategoryToType(puzzle as PuzzleCategory);
    return solves.filter((s) => (s.puzzleType ?? "3x3x3") === targetType);
  }, [solves, puzzle]);

  const milestones = useMemo(() => {
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
          solveNumber: filteredSolves.length - i,
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

    return pbs.reverse();
  }, [filteredSolves]);

  const currentPb = milestones.find((m) => m.isCurrent);
  const pbCount = milestones.length;

  const headerActions = puzzle ? (
    <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-brand tracking-wider">
      {puzzle}
    </span>
  ) : null;

  return (
    <FloatingWidgetWrapper
      widgetId="pb-progression"
      icon={Trophy}
      label="PB progression"
      pillBadge={currentPb ? formatTime(currentPb.time) : undefined}
      pillBadge2={puzzle ?? (pbCount > 0 ? `${pbCount} PB${pbCount !== 1 ? "s" : ""}` : undefined)}
      headerActions={headerActions}
      panelWidth={300}
      panelMaxHeight={320}
      defaultPosition={{ x: 880, y: 440 }}
    >
      <div className="p-3">
        {milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Trophy className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No PB yet</p>
            <p className="text-xs text-ink-3">Complete a solve to set your first PB.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-2.75 top-2 bottom-2 w-px bg-ink-3/20" />

            {milestones.map((pb, i) => {
              const isFirst = i === 0;
              const improvement = pb.delta !== null && pb.delta < 0;

              return (
                <div key={pb.solveId} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  <div className="relative z-10 mt-1">
                    {pb.isCurrent ? (
                      <div className="flex size-5.5 items-center justify-center rounded-full bg-ready-soft">
                        <Sparkles className="size-3 text-ready" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "size-5.5 rounded-full border-2 flex items-center justify-center",
                          isFirst
                            ? "border-ink-3/30 bg-surface"
                            : "border-ink-3/20 bg-surface",
                        )}
                      >
                        <div className="size-1.5 rounded-full bg-ink-3/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("nums text-sm font-medium", pb.isCurrent ? "text-ready" : "text-ink")}>
                        {formatTime(pb.time)}
                      </span>
                      <span className="nums text-[0.55rem] text-ink-3">
                        Solve #{pb.solveNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[0.6rem] text-ink-3">
                      {pb.delta !== null && (
                        <span className={cn("nums", improvement ? "text-ready" : "text-ink-3")}>
                          {improvement ? "−" : "+"}{formatTime(Math.abs(pb.delta))}
                          {improvement ? " improvement" : ""}
                        </span>
                      )}
                      <span>{formatTimestamp(pb.timestamp)}</span>
                    </div>

                    {pb.isCurrent && (
                      <span className="mt-0.5 inline-flex w-fit rounded bg-ready-soft px-1.5 py-0.5 text-[0.5rem] font-medium uppercase tracking-wide text-ready">
                        Current PB
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {milestones.length > 1 && currentPb && (
          <div className="mt-2 border-t border-line/50 pt-2.5 text-center text-[0.55rem] text-ink-3">
            {milestones.length} PB{milestones.length !== 1 ? "s" : ""} across {solves.length} solves
            {" · "}
            Total improvement:{" "}
            <span className="nums text-ready">
              −{formatTime(milestones[0].time - (milestones[milestones.length - 1]?.time ?? milestones[0].time))}
            </span>
          </div>
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
