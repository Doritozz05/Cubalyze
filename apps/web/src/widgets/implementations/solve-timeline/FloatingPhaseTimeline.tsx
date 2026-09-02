"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import type { SolveMetrics, DetectedCase } from "@cubeforge/types";

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

function getPhaseDetails(
  phaseName: string,
  effectiveAnalysis?: SolveMetrics | null,
): { caseInfo?: Pick<DetectedCase, "caseNumber" | "caseName"> | null; recogMs: number; detail?: string } {
  if (!effectiveAnalysis) return { recogMs: 0 };
  if (phaseName === "OLL") {
    return {
      caseInfo: effectiveAnalysis.cfop?.ollCase ?? null,
      recogMs: effectiveAnalysis.cfop?.ollRecognitionMs ?? 0,
    };
  }
  if (phaseName === "PLL") {
    return {
      caseInfo: effectiveAnalysis.cfop?.pllCase ?? null,
      recogMs: effectiveAnalysis.cfop?.pllRecognitionMs ?? 0,
    };
  }
  if (phaseName === "Cross") {
    return {
      recogMs: 0,
    };
  }
  return { recogMs: 0 };
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

  const { selectedSolve, derived, skippedPhases, pairSegments, effectiveAnalysis } = useMemo(() => {
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
        effectiveAnalysis: null,
      };
    }

    const effectiveAnalysis = hasPending ? lastAnalysis! : solve.analysis;
    if (!isComparablePhaseAnalysis(effectiveAnalysis)) {
      return {
        selectedSolve: solve,
        derived: null,
        skippedPhases: [] as string[],
        pairSegments: [] as PairSegment[],
        effectiveAnalysis: null,
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
    return { selectedSolve: solve, derived: tl, skippedPhases, pairSegments, effectiveAnalysis };
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
                <div className="mb-2 flex h-7 w-full gap-px overflow-hidden rounded-md border border-line/60 bg-surface-2">
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
                          <HoverCard key={`f2l-pair-${seg.pairNumber}`} openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <div
                                className={cn(
                                  "relative flex h-full items-center justify-center text-[0.62rem] font-bold text-white transition-all select-none",
                                  seekable && "cursor-pointer",
                                )}
                                style={{
                                  flex: `${Math.max(seg.durationMs, 1)} 1 0%`,
                                  minWidth: "14px",
                                  backgroundColor: pairColor(seg.pairNumber),
                                  opacity: 0.9,
                                }}
                                role={seekable ? "button" : undefined}
                                tabIndex={seekable ? 0 : undefined}
                                onClick={
                                  seekable
                                    ? (e) => {
                                        e.stopPropagation();
                                        onSeekToMove!(seg.moveStartIndex);
                                      }
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
                                {segPct >= 3.5 && (
                                  <span className="truncate px-0.5 drop-shadow-sm">
                                    {seg.pairNumber}
                                  </span>
                                )}
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" align="center" sideOffset={8} className="w-60 p-3 text-xs shadow-lg">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block size-2.5 shrink-0 rounded-sm"
                                  style={{ background: pairColor(seg.pairNumber) }}
                                />
                                <span className="font-semibold text-ink">
                                  {t("panel.solveTimeline.f2lPair", {
                                    count: seg.pairNumber,
                                  })}
                                </span>
                                {seg.slot && (
                                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-ink-2">
                                    {seg.slot}
                                  </span>
                                )}
                                <span className="ml-auto nums text-[0.65rem] text-ink-3">
                                  {Math.round(segPct)}%
                                </span>
                              </div>
                              {seg.caseName && (
                                <div className="mt-1.5 flex items-baseline gap-2">
                                  <span className="text-[0.74rem] font-medium text-ink-2">
                                    {seg.caseName}
                                  </span>
                                  {seg.caseNumber && (
                                    <span className="font-mono text-[0.58rem] text-ink-3">
                                      {seg.caseNumber}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="mt-2 flex items-baseline justify-between border-t border-line/40 pt-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    {t("panel.solveTimeline.time")}
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {formatTime(seg.durationMs)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    {t("panel.solveTimeline.moves")}
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {seg.moves}m
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    TPS
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {seg.tps.toFixed(1)}
                                  </span>
                                </div>
                                {seg.recognitionMs > 50 && (
                                  <div className="flex flex-col">
                                    <span className="text-[0.58rem] uppercase tracking-wider text-caution">
                                      {t("panel.solveTimeline.recog")}
                                    </span>
                                    <span className="nums text-sm font-semibold text-caution">
                                      +{formatTime(seg.recognitionMs)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      });
                    }

                    const phasePct = totalMs > 0 ? (entry.durationMs / totalMs) * 100 : 0;
                    const phaseDetails = getPhaseDetails(entry.phaseName, effectiveAnalysis);

                    return (
                      <HoverCard key={entry.phaseName} openDelay={120} closeDelay={80}>
                        <HoverCardTrigger asChild>
                          <div
                            className="relative flex h-full items-center justify-center text-[0.62rem] font-bold text-white transition-all select-none"
                            style={{
                              flex: `${Math.max(entry.durationMs, 1)} 1 0%`,
                              minWidth: "18px",
                              backgroundColor: entry.color,
                              opacity: 0.9,
                            }}
                          >
                            {phasePct >= 5 && (
                              <span className="truncate px-0.5 drop-shadow-sm">
                                {entry.phaseName}
                              </span>
                            )}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="center" sideOffset={8} className="w-56 p-3 text-xs shadow-lg">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block size-2.5 shrink-0 rounded-sm"
                              style={{ background: entry.color }}
                            />
                            <span className="font-semibold text-ink">{entry.phaseName}</span>
                            {phaseDetails.detail && (
                              <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-ink-2">
                                {phaseDetails.detail}
                              </span>
                            )}
                            <span className="ml-auto nums text-[0.65rem] text-ink-3">
                              {Math.round(phasePct)}%
                            </span>
                          </div>
                          {phaseDetails.caseInfo && (
                            <div className="mt-1.5 flex items-baseline gap-2">
                              <span className="text-[0.74rem] font-medium text-ink-2">
                                {phaseDetails.caseInfo.caseName}
                              </span>
                              {phaseDetails.caseInfo.caseNumber && (
                                <span className="font-mono text-[0.58rem] text-ink-3">
                                  {phaseDetails.caseInfo.caseNumber}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="mt-2 flex items-baseline justify-between border-t border-line/40 pt-2">
                            <div className="flex flex-col">
                              <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                {t("panel.solveTimeline.time")}
                              </span>
                              <span className="nums text-sm font-semibold text-ink">
                                {formatTime(entry.durationMs)}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                {t("panel.solveTimeline.moves")}
                              </span>
                              <span className="nums text-sm font-semibold text-ink">
                                {entry.moveCount}m
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                TPS
                              </span>
                              <span className="nums text-sm font-semibold text-ink">
                                {entry.tps.toFixed(1)}
                              </span>
                            </div>
                            {phaseDetails.recogMs > 50 && (
                              <div className="flex flex-col">
                                <span className="text-[0.58rem] uppercase tracking-wider text-caution">
                                  {t("panel.solveTimeline.recog")}
                                </span>
                                <span className="nums text-sm font-semibold text-caution">
                                  +{formatTime(phaseDetails.recogMs)}
                                </span>
                              </div>
                            )}
                          </div>
                          {entry.pauseCount > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 border-t border-line/40 pt-1.5 text-[0.62rem] text-caution">
                              <Pause className="size-2.5 shrink-0" />
                              <span>
                                {t("panel.solveTimeline.pauseCount", {
                                  count: entry.pauseCount,
                                  time: formatTime(entry.pauseDurationMs),
                                })}
                              </span>
                            </div>
                          )}
                        </HoverCardContent>
                      </HoverCard>
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
                          <HoverCard openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <span className="flex items-center gap-0.5 text-caution/70 cursor-help">
                                <Pause className="size-2.5" />
                                {formatTime(entry.pauseDurationMs)}
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" align="end" sideOffset={6} className="w-auto p-2 text-xs shadow-md">
                              <span className="text-ink text-[0.68rem] font-medium">
                                {t("panel.solveTimeline.pauseCount", {
                                  count: entry.pauseCount,
                                  time: formatTime(entry.pauseDurationMs),
                                })}
                              </span>
                            </HoverCardContent>
                          </HoverCard>
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
