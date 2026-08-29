"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { PhaseSkipBadge } from "@/widgets/components/PhaseSkipBadge";
import { formatTime } from "@/utils/formatTime";
import {
  deriveTimeline,
  derivePairSegments,
  isComparablePhaseAnalysis,
  type PairSegment,
} from "@/utils/insights";
import { phaseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

const MAX_SOLVES_IN_PICKER = 3;

/**
 * Light → dark green so the four F2L pairs read as slices of ONE divided
 * F2L bar (pair 1 lightest … pair 4 darkest).
 */
const PAIR_COLORS = ["#86EFAC", "#4ADE80", "#22C55E", "#15803D"];
const pairColor = (pairNumber: number) =>
  PAIR_COLORS[(pairNumber - 1) % PAIR_COLORS.length];

export interface FloatingPhaseTimelineProps {
  solves: Solve[];
  lastAnalysis?: SolveMetrics | null;
  /**
   * Optional: clicking an F2L pair row seeks the 3D replay to the pair's
   * first move. Not wired from the widget host yet — the hook is ready for
   * the N2 replay integration.
   */
  onSeekToMove?: (moveIndex: number) => void;
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
  onSeekToMove,
}: FloatingPhaseTimelineProps) {
  const { t } = useTranslation("widgets");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { selectedSolve, derived, skippedPhases, pairSegments } = useMemo(() => {
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

    if (!solve) {
      return {
        selectedSolve: null,
        derived: null,
        skippedPhases: [] as string[],
        pairSegments: [] as PairSegment[],
      };
    }

    const effectiveAnalysis = hasPending ? lastAnalysis! : solve.analysis;
    if (!isComparablePhaseAnalysis(effectiveAnalysis)) {
      return {
        selectedSolve: solve,
        derived: null,
        skippedPhases: [] as string[],
        pairSegments: [] as PairSegment[],
      };
    }
    const effectiveSolve: Solve = { ...solve, analysis: effectiveAnalysis };
    const tl = deriveTimeline(effectiveSolve);
    const skippedPhases = effectiveAnalysis.phases
      .filter((phase) => phase.skipped || (phase.durationMs === 0 && phase.moveCount === 0))
      .map((phase) => phase.phaseName);
    const pairSegments = derivePairSegments(
      effectiveAnalysis,
      effectiveSolve.moves,
    );
    return { selectedSolve: solve, derived: tl, skippedPhases, pairSegments };
  }, [solves, selectedIdx, lastAnalysis]);

  const timelinePhaseEntries = useMemo<TimelineEntry[]>(() => {
    if (!derived || derived.stageSegments.length === 0) return [];
    return derived.stageSegments.map((seg) => {
      const pauseMarks = derived.pauseMarks.filter(
        (p) => p.phase === seg.phaseName,
      );
      const totalPauseMs = pauseMarks.reduce((s: number, p) => s + p.durationMs, 0);
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
  const totalPauseMs = derived?.pauseMarks.reduce((s: number, p) => s + p.durationMs, 0) ?? 0;
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
      label={t("def.solveTimeline")}
      pillBadge={selectedSolve ? formatTime(selectedSolve.time) : undefined}
      pillBadge2={
        timelinePhaseEntries.length > 0
          ? t("panel.solveTimeline.phases", {
              count: timelinePhaseEntries.length,
            })
          : undefined
      }
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
                className="ml-auto rounded bg-ready-soft px-2 py-1 text-[0.6rem] font-medium uppercase tracking-wide text-ready transition-colors hover:bg-ready-soft/80"
              >
                {t("panel.solveTimeline.backToLatest")}
              </button>
            )}
          </div>
        )}

        {!selectedSolve ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">{t("panel.solveTimeline.noSolvesYet")}</p>
            <p className="text-xs text-ink-3">{t("panel.solveTimeline.noSolvesHint")}</p>
          </div>
        ) : !derived ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">{t("panel.solveTimeline.noAnalysis")}</p>
            <p className="text-xs text-ink-3">
              {selectedSolve.source === "smart" || selectedSolve.source === "virtual"
                ? selectedSolve.analysis
                  ? t("panel.solveTimeline.incompleteAnalysis")
                  : t("panel.solveTimeline.pipelineRunning")
                : t("panel.solveTimeline.manualEntry")}
            </p>
          </div>
        ) : (
          <>
            {skippedPhases.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5 rounded-md border border-line/60 bg-surface-2/50 px-2 py-1.5">
                <span className="text-[0.56rem] font-medium uppercase tracking-wide text-ink-3">
                  {t("panel.solveTimeline.skips")}
                </span>
                {skippedPhases.map((phase) => (
                  <PhaseSkipBadge key={phase} phaseName={phase} compact />
                ))}
              </div>
            )}
            {timelinePhaseEntries.length > 0 && (
              /* ── Per-phase breakdown — the F2L bar itself is divided into
                  its pairs (light→dark green slices) with rich hover info ── */
              <>
                <div className="mb-2 flex h-7 w-full overflow-hidden rounded-md">
                  {timelinePhaseEntries.map((entry) => {
                    // The F2L phase bar is divided into its pairs: one
                    // light→dark green slice per pair, hover shows the pair's
                    // slot / case / moves / time / TPS, click seeks the replay.
                    if (entry.phaseName === "F2L" && pairSegments.length > 0) {
                      return pairSegments.map((seg) => {
                        const segPct =
                          totalMs > 0 ? (seg.durationMs / totalMs) * 100 : 0;
                        const seekable = !!onSeekToMove && seg.moveStartIndex >= 0;
                        return (
                          <Tooltip key={`f2l-pair-${seg.pairNumber}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "relative flex items-center justify-center text-[0.6rem] font-medium text-white transition-all",
                                  seekable && "cursor-pointer",
                                )}
                                style={{
                                  width: `${Math.max(segPct, 4)}%`,
                                  backgroundColor: pairColor(seg.pairNumber),
                                  opacity: 0.85,
                                }}
                                role={seekable ? "button" : undefined}
                                tabIndex={seekable ? 0 : undefined}
                                onClick={
                                  seekable
                                    ? () => onSeekToMove!(seg.moveStartIndex)
                                    : undefined
                                }
                                onKeyDown={
                                  seekable
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          onSeekToMove!(seg.moveStartIndex);
                                        }
                                      }
                                    : undefined
                                }
                              >
                                {segPct > 10 && (
                                  <span className="truncate px-0.5 drop-shadow-sm">
                                    {seg.pairNumber}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="w-56 text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block size-2.5 shrink-0 rounded-sm"
                                  style={{ background: pairColor(seg.pairNumber) }}
                                />
                                <span className="font-medium text-ink">
                                  {t("panel.solveTimeline.f2lPair", {
                                    count: seg.pairNumber,
                                  })}
                                </span>
                                {seg.slot && (
                                  <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.54rem] font-medium text-ink-2">
                                    {seg.slot}
                                  </span>
                                )}
                              </div>
                              {seg.caseName && (
                                <div className="mt-1.5 flex items-baseline gap-2">
                                  <span className="text-[0.72rem] font-medium text-ink-2">
                                    {seg.caseName}
                                  </span>
                                  {seg.caseNumber && (
                                    <span className="font-mono text-[0.56rem] text-ink-3">
                                      {seg.caseNumber}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="mt-2 flex items-baseline gap-3">
                                <span className="nums text-sm font-medium text-ink">
                                  {formatTime(seg.durationMs)}
                                </span>
                                <span className="text-ink-2">{seg.tps.toFixed(1)} TPS</span>
                                <span className="text-ink-3">{seg.moves}m</span>
                                {seg.pauseBeforeMs > 50 && (
                                  <span className="text-caution/70">
                                    +{formatTime(seg.pauseBeforeMs)}
                                  </span>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      });
                    }

                    return (
                      <Tooltip key={entry.phaseName}>
                        <TooltipTrigger asChild>
                          <div
                            className="relative flex items-center justify-center text-[0.6rem] font-medium text-white transition-all"
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
                        <TooltipContent side="top">
                          {entry.phaseName}: {formatTime(entry.durationMs)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
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
                            <TooltipContent side="top">
                              {t("panel.solveTimeline.pauseCount", {
                                count: entry.pauseCount,
                                time: formatTime(entry.pauseDurationMs),
                              })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between text-[0.6rem] text-ink-3">
                  <span>
                    {t("panel.solveTimeline.movesTotal", {
                      count: selectedSolve.moves?.length ?? 0,
                      time: formatTime(totalMs),
                    })}
                  </span>
                  {pauseCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-1.5 rounded-sm" style={{ backgroundColor: PAUSE_COLOR_BY_CATEGORY["mid-phase"] }} />
                      {t("panel.solveTimeline.pauseCount", {
                        count: pauseCount,
                        time: formatTime(totalPauseMs),
                      })}
                    </span>
                  )}
                </div>
              </>
            )}

            {timelinePhaseEntries.length === 0 && derived && (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <p className="text-xs text-ink-3">{t("panel.solveTimeline.timelineUnavailable")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
