"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline, isComparablePhaseAnalysis } from "@/utils/insights";
import { phaseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

const MAX_SOLVES_IN_PICKER = 3;

export interface FloatingPhaseTimelineProps {
  solves: Solve[];
  lastAnalysis?: SolveMetrics | null;
}

interface TimelineEntry {
  phaseName: string;
  durationMs: number;
  color: string;
  fraction: number;
  moveCount: number;
  tps: number;
  pauseCount: number;
  pauseDurationMs: number;
}

/**
 * Floating widget showing the phase breakdown + pauses of the last solve.
 * Uses FloatingWidgetWrapper for all portal/drag/minimize behavior.
 */
export function FloatingPhaseTimeline({
  solves,
  lastAnalysis,
}: FloatingPhaseTimelineProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { selectedSolve, derived, skippedPhases } = useMemo(() => {
    const orderedSolves = [...solves].sort((a, b) => b.timestamp - a.timestamp);
    const firstSolve = orderedSolves[0];
    const hasPending =
      selectedIdx === 0
      && lastAnalysis
      && firstSolve
      && firstSolve.id === lastAnalysis.solveId
      && isComparablePhaseAnalysis(lastAnalysis);
    const solve: Solve | null =
      orderedSolves[selectedIdx] ?? (orderedSolves.length > 0 ? orderedSolves[0] : null);

    if (!solve) return { selectedSolve: null, derived: null, skippedPhases: [] as string[] };

    const effectiveAnalysis = hasPending ? lastAnalysis! : solve.analysis;
    if (!isComparablePhaseAnalysis(effectiveAnalysis)) {
      return { selectedSolve: solve, derived: null, skippedPhases: [] as string[] };
    }
    const effectiveSolve: Solve = { ...solve, analysis: effectiveAnalysis };
    const tl = deriveTimeline(effectiveSolve);
    const skippedPhases = effectiveAnalysis.phases
      .filter((phase) => phase.skipped || (phase.durationMs === 0 && phase.moveCount === 0))
      .map((phase) => phase.phaseName);
    return { selectedSolve: solve, derived: tl, skippedPhases };
  }, [solves, selectedIdx, lastAnalysis]);

  const timelinePhaseEntries = useMemo<TimelineEntry[]>(() => {
    if (!derived || derived.stageSegments.length === 0) return [];
    return derived.stageSegments.map((seg) => {
      const pauseMarks = derived.pauseMarks.filter(
        (p) => p.phase === seg.phaseName,
      );
      const totalPauseMs = pauseMarks.reduce((s, p) => s + p.durationMs, 0);
      return {
        phaseName: seg.phaseName,
        durationMs: seg.durationMs,
        color: phaseColorHex(seg.phaseName, derived.stageSegments.indexOf(seg)),
        fraction: derived.totalMs > 0 ? seg.durationMs / derived.totalMs : 0,
        moveCount: seg.moveCount,
        tps: seg.tps,
        pauseCount: pauseMarks.length,
        pauseDurationMs: totalPauseMs,
      };
    });
  }, [derived]);

  const pauseCount = derived?.pauseMarks.length ?? 0;
  const totalPauseMs = derived?.pauseMarks.reduce((s, p) => s + p.durationMs, 0) ?? 0;
  const totalMs = derived?.totalMs ?? 0;

  const recentSolves = useMemo(
    () => [...solves]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_SOLVES_IN_PICKER),
    [solves],
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [solves.length]);

  return (
    <FloatingWidgetWrapper
      widgetId="solve-timeline"
      icon={Activity}
      label="Solve timeline"
      pillBadge={selectedSolve ? formatTime(selectedSolve.time) : undefined}
      pillBadge2={timelinePhaseEntries.length > 0 ? `${timelinePhaseEntries.length} phases` : undefined}
      panelWidth={340}
      panelMaxHeight={360}
      defaultPosition={{ x: 420, y: 72 }}
    >
      <div className="p-3">
        {/* Solve picker */}
        {recentSolves.length > 1 && (
          <div className="mb-3 flex items-center gap-1">
            {recentSolves.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  "rounded px-2 py-1 text-[0.6rem] transition-colors",
                  i === selectedIdx
                    ? "bg-ink text-surface"
                    : "bg-surface-2 text-ink-3 hover:text-ink",
                )}
              >
                #{solves.length - i}{" "}
                <span className="nums">{formatTime(s.time)}</span>
              </button>
            ))}
            {selectedIdx !== 0 && (
              <button
                onClick={() => setSelectedIdx(0)}
                className="ml-auto rounded bg-ready-soft px-2 py-1 text-[0.55rem] font-medium uppercase tracking-wide text-ready transition-colors hover:bg-ready-soft/80"
              >
                Back to latest
              </button>
            )}
          </div>
        )}

        {!selectedSolve ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No solves yet</p>
            <p className="text-xs text-ink-3">Complete a solve to see the phase timeline.</p>
          </div>
        ) : !derived ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No analysis yet</p>
            <p className="text-xs text-ink-3">
              {selectedSolve.source === "smart"
                ? selectedSolve.analysis
                  ? "This solve has an incomplete analysis. Re-analyze it to show comparable phases."
                  : "The analysis pipeline is running. Check back shortly."
                : "Manual entry. Connect a Smart Cube to get phase analysis."}
            </p>
          </div>
        ) : (
          <>
            {skippedPhases.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5 rounded-md border border-line/60 bg-surface-2/50 px-2 py-1.5">
                <span className="text-[0.56rem] font-medium uppercase tracking-wide text-ink-3">Skips</span>
                {skippedPhases.map((phase) => (
                  <span
                    key={phase}
                    className="rounded border border-ink-3/25 bg-surface px-1.5 py-0.5 text-[0.55rem] font-semibold text-ink-2"
                  >
                    {phase} skip
                  </span>
                ))}
              </div>
            )}
            {timelinePhaseEntries.length > 0 && (
              <>
                <div className="mb-2 flex h-7 w-full overflow-hidden rounded-md">
                  {timelinePhaseEntries.map((entry) => (
                    <Tooltip key={entry.phaseName}>
                      <TooltipTrigger asChild>
                        <div
                          className="relative flex items-center justify-center text-[0.5rem] font-medium text-white transition-all"
                          style={{
                            width: `${Math.max(entry.fraction * 100, 4)}%`,
                            backgroundColor: entry.color,
                            opacity: 0.85,
                          }}
                        >
                      {entry.fraction > 0.1 && (
                        <span className="truncate px-0.5 drop-shadow-sm">
                          {entry.phaseName}
                        </span>
                      )}
                    </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">{entry.phaseName}: {formatTime(entry.durationMs)}</TooltipContent>
                  </Tooltip>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-line/60">
                  {timelinePhaseEntries.map((entry, i) => (
                    <div
                      key={entry.phaseName}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 text-xs",
                        i !== timelinePhaseEntries.length - 1 && "border-b border-line/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                        <span className="font-medium text-ink-2 uppercase tracking-wide text-[0.6rem]">
                          {entry.phaseName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 nums text-[0.6rem] text-ink-3">
                        <span>{formatTime(entry.durationMs)}</span>
                        <span className="text-ink-2">{entry.tps.toFixed(1)} TPS</span>
                        <span>{entry.moveCount}m</span>
                        {entry.pauseCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-0.5 text-caution/70">
                                <Pause className="size-2.5" />
                                {formatTime(entry.pauseDurationMs)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{entry.pauseCount} pause{entry.pauseCount > 1 ? "s" : ""}: {formatTime(entry.pauseDurationMs)}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between text-[0.55rem] text-ink-3">
                  <span>
                    {selectedSolve.moves?.length ?? 0} moves ·{" "}
                    {formatTime(totalMs)} total
                  </span>
                  {pauseCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-1.5 rounded-sm" style={{ backgroundColor: PAUSE_COLOR_BY_CATEGORY["mid-phase"] }} />
                      {pauseCount} pause{pauseCount > 1 ? "s" : ""} ·{" "}
                      {formatTime(totalPauseMs)}
                    </span>
                  )}
                </div>
              </>
            )}

            {timelinePhaseEntries.length === 0 && derived && (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <p className="text-xs text-ink-3">Timeline data unavailable for this solve.</p>
              </div>
            )}
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
