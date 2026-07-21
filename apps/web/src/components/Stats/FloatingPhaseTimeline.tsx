"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline } from "@/utils/insights";
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

  const { selectedSolve, derived } = useMemo(() => {
    const firstSolve = solves[0];
    const hasPending =
      selectedIdx === 0 && lastAnalysis && firstSolve && !firstSolve.analysis;
    const solve: Solve | null =
      solves[selectedIdx] ?? (solves.length > 0 ? solves[0] : null);

    if (!solve) return { selectedSolve: null, derived: null };

    const effectiveSolve: Solve = hasPending
      ? { ...solve, analysis: lastAnalysis! }
      : solve;
    const tl = deriveTimeline(effectiveSolve);
    return { selectedSolve: solve, derived: tl };
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
    () => solves.slice(0, MAX_SOLVES_IN_PICKER),
    [solves],
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [solves.length]);

  return (
    <FloatingWidgetWrapper
      widgetId="solve-timeline"
      icon={Activity}
      label="Solve Timeline"
      pillBadge={selectedSolve ? formatTime(selectedSolve.time) : undefined}
      pillBadge2={timelinePhaseEntries.length > 0 ? `${timelinePhaseEntries.length} phases` : undefined}
      panelWidth={340}
      panelMaxHeight={360}
      defaultPosition={{ x: 72, y: 120 }}
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
        ) : !selectedSolve.analysis && !(selectedIdx === 0 && lastAnalysis) ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No analysis yet</p>
            <p className="text-xs text-ink-3">
              {selectedSolve.source === "smart"
                ? "The analysis pipeline is running. Check back shortly."
                : "Manual entry. Connect a Smart Cube to get phase analysis."}
            </p>
          </div>
        ) : (
          <>
            {timelinePhaseEntries.length > 0 && (
              <>
                <div className="mb-2 flex h-7 w-full overflow-hidden rounded-md">
                  {timelinePhaseEntries.map((entry) => (
                    <div
                      key={entry.phaseName}
                      className="relative flex items-center justify-center text-[0.5rem] font-medium text-white transition-all"
                      style={{
                        width: `${Math.max(entry.fraction * 100, 4)}%`,
                        backgroundColor: entry.color,
                        opacity: 0.85,
                      }}
                      title={`${entry.phaseName}: ${formatTime(entry.durationMs)}`}
                    >
                      {entry.fraction > 0.1 && (
                        <span className="truncate px-0.5 drop-shadow-sm">
                          {entry.phaseName}
                        </span>
                      )}
                    </div>
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
                          <span className="flex items-center gap-0.5 text-caution/70" title={`${entry.pauseCount} pause${entry.pauseCount > 1 ? "s" : ""}: ${formatTime(entry.pauseDurationMs)}`}>
                            <Pause className="size-2.5" />
                            {formatTime(entry.pauseDurationMs)}
                          </span>
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

            {timelinePhaseEntries.length === 0 && selectedSolve.analysis && (
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
