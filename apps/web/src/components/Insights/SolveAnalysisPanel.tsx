"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Clipboard, ClipboardCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline, type TimelineData, type TimelineSegment } from "@/utils/insights";
import { phaseColorHex, pauseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics, RotationMetrics, EfficiencyMetrics, F2LPairMetrics } from "@cubeforge/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  SectionHeader,
  EmptyState,
  MetricRing,
  AlgorithmNotation,
  type RingColor,
} from "./atoms";

export interface SolveAnalysisPanelProps {
  solve: Solve;
  /** Pending analysis from the just-completed live solve (not yet persisted). */
  liveMetrics: SolveMetrics | null;
  isLive: boolean;
  onUpdateSolve: (updates: { penalty?: Penalty; note?: string | null }) => void;
  onDeleteSolve: () => void;
  onBackToOverview: () => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMELINE_HEIGHT = 92;
const TPS_AREA_TOP = 4;
const TPS_AREA_BOTTOM = 34; // TPS chart occupies the top band
const SEG_TOP = 44;        // unified segment blocks (phases + pauses) live here
const SEG_BOTTOM = 82;

const EMPTY_ROTATION: RotationMetrics = {
  totalCount: 0,
  byAxis: { x: 0, y: 0, z: 0 },
  estimatedRotationTimeMs: 0,
  consecutiveCount: 0,
  byPhase: {},
  rotationToMoveRatio: 0,
  redundantRotations: 0,
};

const EMPTY_EFFICIENCY: EfficiencyMetrics = {
  moveEfficiencyRatio: 0,
  optimalMoveCount: 0,
  redundancies: 0,
  cancellations: 0,
  overturns: 0,
  forwardDrift: 0,
};

// ─── Main component ────────────────────────────────────────────────────────

export function SolveAnalysisPanel({
  solve,
  liveMetrics,
  isLive,
  onUpdateSolve,
  onDeleteSolve,
  onBackToOverview,
  className,
}: SolveAnalysisPanelProps) {
  const cyclePenalty = () => {
    const next: Penalty =
      solve.penalty === "none" ? "+2" : solve.penalty === "+2" ? "DNF" : "none";
    onUpdateSolve({ penalty: next });
  };

  const m = liveMetrics;
  const timeline = useMemo<TimelineData>(
    () => (m ? deriveTimeline({ ...solve, analysis: m }) : deriveTimeline(solve)),
    [solve, m],
  );

  // Lifted cross-highlight state: hovering a timeline block or a phase
  // breakdown row highlights the other. Null = nothing highlighted.
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col gap-4 px-1 pb-4", className)}>
      {/* Back to overview */}
      <button
        onClick={onBackToOverview}
        className="flex items-center gap-1.5 self-start text-[0.72rem] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Overview
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface px-5 py-3">
        <div className="flex flex-col gap-1.5">
          <span className="nums text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            {formatTimestampFull(solve.timestamp)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={cyclePenalty}
              className={cn(
                "rounded px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide transition-colors hover:opacity-80",
                solve.penalty === "DNF"
                  ? "bg-dnf-soft text-dnf"
                  : solve.penalty === "+2"
                    ? "bg-plus2-soft text-plus2"
                    : "bg-surface-2 text-ink-3",
              )}
              title="Click to cycle penalty"
            >
              {solve.penalty === "none" ? "Clean" : solve.penalty}
            </button>
            {solve.method ? (
              <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-ink-2">
                {solve.method}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide",
                solve.source === "smart" ? "text-ink-2" : "text-ink-3",
              )}
            >
              {solve.source === "smart" ? "Smart Cube" : "Manual"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeleteSolve}
          className="h-7 gap-1 px-2 text-xs text-ink-3 hover:text-dnf"
        >
          <Trash2 className="size-3" />
          Delete
        </Button>
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-3">
            Solve
          </span>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-ink-2">
              <span className="size-1.5 animate-pulse rounded-full bg-ready/70" />
              Live
            </span>
          ) : null}
        </div>
        <p className="nums text-4xl text-ink">
          {solve.penalty === "DNF" ? "DNF" : formatTime(solve.time)}
        </p>
        {m ? (
          <p className="text-[0.7rem] text-ink-3">
            {m.totalMoves} moves · {m.phases.length} phases ·{" "}
            TPS {m.tps.global.toFixed(2)} · {m.pauses.totalCount} pauses
          </p>
        ) : (
          <p className="text-[0.7rem] text-ink-3">No analysis yet</p>
        )}
      </div>

      {/* Analysis sections or empty banner */}
      {!m ? (
        <EmptyState
          title="No analysis for this solve"
          description={
            solve.source === "smart"
              ? "The analysis pipeline didn't run. Re-solve this scramble to generate analysis."
              : "Manual entry. Connect a Smart Cube and solve this scramble to get per-move analysis."
          }
          className="py-12"
        />
      ) : (
        <>
          {/* ── Interactive timeline ────────────────────────────────────── */}
          <TimelineSection
            timeline={timeline}
            meanTps={m.tps.global}
            hoveredPhase={hoveredPhase}
            onHoverPhase={setHoveredPhase}
          />

          {/* ── Key metric rings ────────────────────────────────────────── */}
          <MetricRingsSection metrics={m} />

          {/* ── Phase breakdown ─────────────────────────────────────────── */}
          <PhaseBreakdownSection
            metrics={m}
            hoveredPhase={hoveredPhase}
            onHoverPhase={setHoveredPhase}
          />

          {/* ── Pauses with probable causes ─────────────────────────────── */}
          {/* (removed — pauses are now integrated in the timeline above) */}

          {/* ── Method-specific details ─────────────────────────────────── */}
          {m.cfop && <CfopDetailsSection metrics={m} />}
          {m.roux && <RouxDetailsSection metrics={m} />}

          {/* ── Rotations & efficiency ──────────────────────────────────── */}
          <RotEfficiencySection metrics={m} />
        </>
      )}

      {/* Scramble block */}
      <ScrambleBlock solve={solve} />
    </div>
  );
}

// ─── Timeline section ──────────────────────────────────────────────────────

function TimelineSection({
  timeline,
  meanTps,
  hoveredPhase,
  onHoverPhase,
}: {
  timeline: TimelineData;
  meanTps: number;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { totalMs, moveTicks, tpsSamples, segments, pauseMarks } = timeline;
  const width = 600; // viewBox width; scales to container via preserveAspectRatio

  // TPS scale: data-driven ceiling rounded up to a sensible tick.
  const maxTps = useMemo(() => {
    const max = Math.max(...tpsSamples.map((s) => s.tps), 0);
    if (max <= 0) return 5;
    // Round up to the next whole number with a little headroom (no arbitrary +1 floor).
    return Math.max(Math.ceil(max + 0.5), 3);
  }, [tpsSamples]);

  const xForMs = useCallback(
    (ms: number) => (totalMs > 0 ? (ms / totalMs) * width : 0),
    [totalMs, width],
  );

  // TPS value at a given time offset (linear interpolation between samples).
  const tpsAtMs = useCallback(
    (ms: number): number => {
      if (tpsSamples.length === 0) return 0;
      if (ms <= tpsSamples[0].offsetMs) return tpsSamples[0].tps;
      const last = tpsSamples[tpsSamples.length - 1];
      if (ms >= last.offsetMs) return last.tps;
      for (let i = 0; i < tpsSamples.length - 1; i++) {
        const a = tpsSamples[i];
        const b = tpsSamples[i + 1];
        if (ms >= a.offsetMs && ms <= b.offsetMs) {
          const t = b.offsetMs > a.offsetMs ? (ms - a.offsetMs) / (b.offsetMs - a.offsetMs) : 0;
          return a.tps + (b.tps - a.tps) * t;
        }
      }
      return last.tps;
    },
    [tpsSamples],
  );

  // Segment under the hover cursor (for the readout line).
  const hoverSegment = useMemo<TimelineSegment | null>(() => {
    if (hoverMs === null) return null;
    return segments.find((s) => hoverMs >= s.startMs && hoverMs < s.endMs) ?? null;
  }, [hoverMs, segments]);

  const handleMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || totalMs <= 0) return;
      const rect = svg.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ms = Math.max(0, Math.min(totalMs, ratio * totalMs));
      setHoverMs(ms);
      // Find nearest move tick (only meaningful while inside the moves span).
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < moveTicks.length; i++) {
        const d = Math.abs(moveTicks[i].offsetMs - ms);
        if (d < minDist) {
          minDist = d;
          nearest = i;
        }
      }
      setHoverIdx(nearest);
    },
    [moveTicks, totalMs],
  );

  const handleLeave = useCallback(() => {
    setHoverMs(null);
    setHoverIdx(null);
  }, []);

  // TPS area path — always closes at the right edge (totalMs).
  const tpsPath = useMemo(() => {
    if (tpsSamples.length < 2) return "";
    return tpsSamples
      .map((s, i) => {
        const x = xForMs(s.offsetMs);
        const y = TPS_AREA_BOTTOM - (s.tps / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [tpsSamples, xForMs, maxTps]);

  const tpsAreaPath = useMemo(() => {
    if (tpsPath === "") return "";
    const lastX = xForMs(tpsSamples[tpsSamples.length - 1]?.offsetMs ?? totalMs);
    return `${tpsPath} L${lastX.toFixed(1)},${TPS_AREA_BOTTOM} L0,${TPS_AREA_BOTTOM} Z`;
  }, [tpsPath, tpsSamples, xForMs, totalMs]);

  // Total pause time for the eyebrow.
  const totalPauseMs = useMemo(
    () => pauseMarks.reduce((s, p) => s + p.durationMs, 0),
    [pauseMarks],
  );
  const meanPauseMs = pauseMarks.length > 0 ? totalPauseMs / pauseMarks.length : 0;

  // P1.c — Y-axis TPS ticks (0 … maxTps)
  const yTickCount = 4;
  const yTicks = useMemo(
    () => Array.from({ length: yTickCount }, (_, i) => (i / (yTickCount - 1)) * maxTps),
    [maxTps],
  );
  // P1.a — X-axis tick fractions (0/25/50/75/100%)
  const xTickFracs = [0, 0.25, 0.5, 0.75, 1];
  // P1.c — Mean TPS reference line y-position (clamped to the TPS band)
  const meanTpsY =
    TPS_AREA_BOTTOM - (Math.min(meanTps, maxTps) / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
  // Y-axis label column width (px)
  const Y_LABEL_W = 26;

  // P1.d — Segment highlight state for cross-highlight
  const segHighlight = (seg: TimelineSegment): "active" | "dim" | "normal" => {
    if (hoveredPhase === null) return "normal";
    return seg.phaseName === hoveredPhase ? "active" : "dim";
  };

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader
        title="Timeline"
        eyebrow={`${moveTicks.length} moves · ${formatTime(totalMs)}${
          totalPauseMs > 0 ? ` · ${formatTime(totalPauseMs)} paused` : ""
        }`}
      />

      <div className="mt-3">
        {/* Chart row: Y-labels column + SVG + pause overlays */}
        <div className="flex items-stretch gap-1">
          {/* P1.c — Y-axis TPS labels (HTML, not stretched by SVG) */}
          <div className="relative shrink-0" style={{ width: Y_LABEL_W, height: TIMELINE_HEIGHT }}>
            {yTicks.map((t, i) => {
              const y = TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
              return (
                <span
                  key={`yt-${i}`}
                  className="absolute right-0 nums text-[0.5rem] leading-none text-ink-3"
                  style={{ top: y, transform: "translateY(-50%)" }}
                >
                  {t.toFixed(0)}
                </span>
              );
            })}
            <span className="absolute right-0 top-0 text-[0.42rem] uppercase tracking-wide text-ink-3/50">
              tps
            </span>
          </div>

          {/* SVG + pause popover overlays */}
          <div className="relative flex-1" style={{ height: TIMELINE_HEIGHT }}>
            <svg
              ref={svgRef}
              width="100%"
              height={TIMELINE_HEIGHT}
              viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`}
              preserveAspectRatio="none"
              className="overflow-visible"
              role="img"
              aria-label={`Solve timeline: ${segments.length} segments over ${formatTime(totalMs)}`}
              onPointerMove={handleMove}
              onPointerLeave={handleLeave}
            >
              <defs>
                <linearGradient id="timeline-tps-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ink-2)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--ink-2)" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* P1.a — Vertical gridlines at 0/25/50/75/100% */}
              {xTickFracs.map((f, i) => (
                <line
                  key={`gx-${i}`}
                  x1={f * width}
                  y1={TPS_AREA_TOP}
                  x2={f * width}
                  y2={SEG_BOTTOM}
                  stroke="var(--ink-3)"
                  strokeWidth={0.5}
                  strokeOpacity={0.15}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* P1.c — Horizontal TPS gridlines */}
              {yTicks.map((t, i) => (
                <line
                  key={`gy-${i}`}
                  x1={0}
                  y1={TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP)}
                  x2={width}
                  y2={TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP)}
                  stroke="var(--ink-3)"
                  strokeWidth={0.5}
                  strokeOpacity={0.1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* TPS area fill */}
              {tpsAreaPath && <path d={tpsAreaPath} fill="url(#timeline-tps-fill)" />}
              {/* TPS line */}
              {tpsPath && (
                <path
                  d={tpsPath}
                  fill="none"
                  stroke="var(--ink-2)"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* P1.c — Mean TPS dashed reference line */}
              {meanTps > 0 && (
                <line
                  x1={0}
                  y1={meanTpsY}
                  x2={width}
                  y2={meanTpsY}
                  stroke="var(--ready)"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Unified segment blocks with P1.d cross-highlight dimming */}
              {segments.map((seg, i) => {
                const x = xForMs(seg.startMs);
                const w = Math.max(0.5, xForMs(seg.endMs) - x);
                const isPause = seg.kind === "pause";
                const color = isPause
                  ? pauseColorHex(seg.pauseCategory ?? "mid-phase")
                  : phaseColorHex(seg.phaseName ?? "", i);
                const hl = segHighlight(seg);
                const fillOpacity = isPause
                  ? hl === "dim" ? 0.15 : 0.45
                  : hl === "dim" ? 0.08 : hl === "active" ? 0.35 : 0.22;
                const showStroke = hl === "active" || isPause;
                return (
                  <rect
                    key={`${seg.kind}-${i}`}
                    x={x}
                    y={SEG_TOP}
                    width={w}
                    height={SEG_BOTTOM - SEG_TOP}
                    fill={color}
                    fillOpacity={fillOpacity}
                    rx={isPause ? 1 : 2}
                    stroke={showStroke ? color : "none"}
                    strokeOpacity={hl === "active" ? 0.9 : 0.5}
                    strokeWidth={hl === "active" ? 1.2 : 0.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: isPause ? "none" : "all" }}
                    onMouseEnter={() => onHoverPhase(seg.phaseName ?? null)}
                    onMouseLeave={() => onHoverPhase(null)}
                  />
                );
              })}

              {/* Move ticks */}
              {moveTicks.map((tick) => (
                <line
                  key={tick.index}
                  x1={xForMs(tick.offsetMs)}
                  y1={TPS_AREA_BOTTOM + 1}
                  x2={xForMs(tick.offsetMs)}
                  y2={SEG_TOP - 2}
                  stroke="var(--ink-3)"
                  strokeWidth={0.6}
                  strokeOpacity={0.3}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Hover playhead */}
              {hoverMs !== null && (
                <line
                  x1={xForMs(hoverMs)}
                  y1={TPS_AREA_TOP}
                  x2={xForMs(hoverMs)}
                  y2={SEG_BOTTOM}
                  stroke="var(--ink)"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* P1.c — Mean TPS badge (HTML, not stretched) */}
            {meanTps > 0 && (
              <span
                className="pointer-events-none absolute right-0 nums text-[0.5rem] leading-none text-ready/70"
                style={{ top: meanTpsY, transform: "translateY(-50%)" }}
              >
                avg {meanTps.toFixed(1)}
              </span>
            )}

            {/* P1.b — Pause popover triggers: invisible divs over each pause block */}
            {totalMs > 0 &&
              segments
                .filter((s) => s.kind === "pause")
                .map((seg, i) => {
                  const leftPct = (seg.startMs / totalMs) * 100;
                  const widthPct = (seg.durationMs / totalMs) * 100;
                  const topPct = (SEG_TOP / TIMELINE_HEIGHT) * 100;
                  const heightPct = ((SEG_BOTTOM - SEG_TOP) / TIMELINE_HEIGHT) * 100;
                  // Adjacent moves for the popover
                  const startIdx = seg.moveStartIndex ?? 0;
                  const endIdx = seg.moveEndIndex ?? 0;
                  const before = [-2, -1]
                    .map((d) => startIdx + d)
                    .filter((j) => j >= 0)
                    .map((j) => moveTicks[j])
                    .filter(Boolean);
                  const after = [1, 2]
                    .map((d) => endIdx + d)
                    .filter((j) => j < moveTicks.length)
                    .map((j) => moveTicks[j])
                    .filter(Boolean);
                  const cause = seg.probableCause ?? seg.label;
                  const category = seg.pauseCategory ?? "mid-phase";
                  const catColor = pauseColorHex(category);
                  const vsMean =
                    meanPauseMs > 0 ? ((seg.durationMs - meanPauseMs) / meanPauseMs) * 100 : 0;

                  return (
                    <HoverCard key={`pause-${i}`} openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div
                          className="absolute cursor-help"
                          style={{
                            left: `${leftPct}%`,
                            width: `max(${widthPct}%, 6px)`,
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            minHeight: 10,
                          }}
                          onMouseEnter={() => onHoverPhase(seg.phaseName ?? null)}
                          onMouseLeave={() => onHoverPhase(null)}
                        />
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="w-72 p-3 text-xs"
                      >
                        {/* Cause */}
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-sm"
                            style={{ background: catColor }}
                          />
                          <span className="font-medium text-ink">{cause}</span>
                        </div>
                        {/* Category badge + phase */}
                        <div className="mt-1.5 flex items-center gap-2 text-[0.6rem] text-ink-3">
                          <span
                            className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
                            style={{ background: `${catColor}22`, color: catColor }}
                          >
                            {category}
                          </span>
                          <span className="uppercase tracking-wide">{seg.phaseName}</span>
                        </div>
                        {/* Duration + comparison vs avg */}
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="nums text-base font-medium text-ink">
                            {formatTime(seg.durationMs)}
                          </span>
                          {meanPauseMs > 0 && (
                            <span
                              className={cn(
                                "nums text-[0.6rem] font-medium",
                                vsMean > 20
                                  ? "text-dnf"
                                  : vsMean < -20
                                    ? "text-ready"
                                    : "text-ink-3",
                              )}
                            >
                              {vsMean > 0 ? "+" : ""}
                              {Math.round(vsMean)}% vs avg
                            </span>
                          )}
                        </div>
                        {/* Adjacent moves */}
                        {(before.length > 0 || after.length > 0) && (
                          <div className="mt-2 border-t border-line/40 pt-2">
                            <span className="text-[0.55rem] uppercase tracking-wide text-ink-3">
                              Adjacent moves
                            </span>
                            <div className="mt-1 flex items-center gap-1 font-mono text-[0.65rem]">
                              {before.map((m, j) => (
                                <span key={`b-${j}`} className="text-ink-3">
                                  {m.label}
                                </span>
                              ))}
                              <span className="text-dnf">‖</span>
                              {after.map((m, j) => (
                                <span key={`a-${j}`} className="font-medium text-ink-2">
                                  {m.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
          </div>
        </div>

        {/* P1.a — X-axis time labels */}
        <div className="relative" style={{ height: 14, marginLeft: Y_LABEL_W + 4 }}>
          {xTickFracs.map((f, i) => (
            <span
              key={`xt-${i}`}
              className="absolute nums text-[0.5rem] leading-none text-ink-3/70"
              style={{
                left: `${f * 100}%`,
                transform:
                  i === 0
                    ? "translateX(0)"
                    : i === xTickFracs.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {formatTime(f * totalMs)}
            </span>
          ))}
        </div>

        {/* Hover readout — time, segment, nearest move, TPS at cursor */}
        <div className="mt-1 flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[0.62rem] text-ink-3">
          <span className="nums">
            {hoverMs !== null ? formatTime(hoverMs) : formatTime(0)}
          </span>
          {hoverSegment ? (
            <span
              className="flex items-center gap-1.5 font-medium"
              style={{
                color:
                  hoverSegment.kind === "phase"
                    ? phaseColorHex(hoverSegment.phaseName ?? "", 0)
                    : pauseColorHex(hoverSegment.pauseCategory ?? "mid-phase"),
              }}
            >
              <span
                className="inline-block size-2 rounded-sm"
                style={{
                  background:
                    hoverSegment.kind === "phase"
                      ? phaseColorHex(hoverSegment.phaseName ?? "", 0)
                      : pauseColorHex(hoverSegment.pauseCategory ?? "mid-phase"),
                  opacity: 0.7,
                }}
              />
              {hoverSegment.label}
              <span className="nums opacity-70">{formatTime(hoverSegment.durationMs)}</span>
            </span>
          ) : null}
          {hoverIdx !== null && moveTicks[hoverIdx] && hoverMs !== null && hoverMs <= (moveTicks[moveTicks.length - 1]?.offsetMs ?? 0) + 50 ? (
            <span className="font-mono text-ink-2">
              #{hoverIdx + 1} {moveTicks[hoverIdx].label}
              {moveTicks[hoverIdx].phaseName ? ` · ${moveTicks[hoverIdx].phaseName}` : ""}
              <span className="ml-1.5 text-ink-3">
                {tpsAtMs(hoverMs).toFixed(2)} tps
              </span>
            </span>
          ) : null}
          <span className="nums">{formatTime(totalMs)}</span>
        </div>
      </div>

      {/* Legend — real labels, grouped: phases / pauses / TPS / avg */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.58rem] text-ink-3">
        {timeline.stageSegments.map((seg, i) => (
          <span key={seg.phaseName} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: phaseColorHex(seg.phaseName, i), opacity: 0.7 }}
            />
            {seg.phaseName}
          </span>
        ))}
        {pauseMarks.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm"
              style={{
                background: PAUSE_COLOR_BY_CATEGORY["mid-phase"],
                opacity: 0.7,
              }}
            />
            Pauses ({pauseMarks.length} · {formatTime(totalPauseMs)})
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ink-2" />
          TPS
        </span>
        {meanTps > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-4 border-t border-dashed"
              style={{ borderColor: "var(--ready)", opacity: 0.6 }}
            />
            Avg {meanTps.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Metric rings section ──────────────────────────────────────────────────

function MetricRingsSection({ metrics }: { metrics: SolveMetrics }) {
  const rings: { value: number; max: number; label: string; sub: string; color: RingColor }[] = [
    {
      value: metrics.tps.global,
      max: 8,
      label: metrics.tps.global.toFixed(1),
      sub: "TPS",
      color: "ink",
    },
    {
      value: metrics.tps.peakInstantaneous,
      max: 12,
      label: metrics.tps.peakInstantaneous.toFixed(1),
      sub: "Peak",
      color: "ready",
    },
    {
      value: metrics.pauses.totalCount,
      max: Math.max(metrics.pauses.totalCount, 5),
      label: `${metrics.pauses.totalCount}`,
      sub: "Pauses",
      color: metrics.pauses.totalCount > 3 ? "amber" : "ink",
    },
    {
      value: metrics.pauses.pauseRatio,
      max: 1,
      label: `${Math.round(metrics.pauses.pauseRatio * 100)}%`,
      sub: "Pause%",
      color: metrics.pauses.pauseRatio > 0.15 ? "dnf" : "ink",
    },
  ];

  const efficiency = metrics.efficiency ?? EMPTY_EFFICIENCY;
  if (efficiency.moveEfficiencyRatio > 0) {
    rings.push({
      value: Math.min(efficiency.moveEfficiencyRatio, 2),
      max: 2,
      label: efficiency.moveEfficiencyRatio.toFixed(2),
      sub: "Eff",
      color: efficiency.moveEfficiencyRatio > 1.3 ? "amber" : "ready",
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Key metrics" />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
        {rings.map((r) => (
          <MetricRing
            key={r.sub}
            value={r.value}
            max={r.max}
            label={r.label}
            sub={r.sub}
            size={72}
            strokeWidth={5}
            color={r.color}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Phase breakdown ───────────────────────────────────────────────────────

function PhaseBreakdownSection({
  metrics,
  hoveredPhase,
  onHoverPhase,
}: {
  metrics: SolveMetrics;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Phase breakdown" eyebrow={`${metrics.phases.length} phases`} />
      <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
        {metrics.phases.map((p, i) => {
          const isHighlighted = hoveredPhase === p.phaseName;
          const isDimmed = hoveredPhase !== null && hoveredPhase !== p.phaseName;
          const color = phaseColorHex(p.phaseName, i);
          return (
            <div
              key={p.phaseName}
              className="flex items-center justify-between px-3 py-2 text-sm border-b border-line/40 last:border-0 transition-opacity duration-150"
              style={{
                boxShadow: isHighlighted ? `inset 2px 0 0 ${color}` : undefined,
                opacity: isDimmed ? 0.4 : 1,
              }}
              onMouseEnter={() => onHoverPhase(p.phaseName)}
              onMouseLeave={() => onHoverPhase(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-sm"
                  style={{ background: color }}
                />
                <span className="text-xs font-medium uppercase tracking-wide text-ink-2">
                  {p.phaseName}
                </span>
              </div>
              <div className="flex items-center gap-3 nums text-xs text-ink-3">
                <span>{p.moveCount}m</span>
                <span>{formatTime(p.durationMs)}</span>
                <span className="font-medium text-ink">{p.tps.toFixed(1)} tps</span>
                {p.pauseCount > 0 && (
                  <span className="text-caution/70" title={`${p.pauseCount} pause${p.pauseCount !== 1 ? "s" : ""} in this phase`}>{p.pauseCount}p</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CFOP details ──────────────────────────────────────────────────────────

function CfopDetailsSection({ metrics }: { metrics: SolveMetrics }) {
  const cfop = metrics.cfop!;
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="CFOP details" />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile label="Cross Eff" value={cfop.crossEfficiency.toFixed(2)} />
        <DetailTile label="Cross→F2L" value={formatTime(cfop.crossToF2LTransitionMs)} />
        <DetailTile label="OLL Recog" value={formatTime(cfop.ollRecognitionMs)} />
        <DetailTile label="OLL TPS" value={cfop.ollTPS.toFixed(2)} />
        <DetailTile label="PLL Recog" value={formatTime(cfop.pllRecognitionMs)} />
        <DetailTile label="PLL TPS" value={cfop.pllTPS.toFixed(2)} />
        <DetailTile
          label="Lookahead"
          value={cfop.f2lLookaheadScore.toFixed(2)}
          accent={cfop.f2lLookaheadScore > 0.7 ? "ready" : undefined}
        />
        <DetailTile label="F2L Pairs" value={`${cfop.f2lPairs.length}`} />
      </div>

      {/* F2L pair breakdown */}
      {cfop.f2lPairs.length > 0 && <F2LPairs pairs={cfop.f2lPairs} />}
    </div>
  );
}

// ─── F2L slot color mapping (derived from face letters) ────────────────────

/** Maps face letters (U,R,F,D,L,B) to hex colors (standard Rubik's cube). */
const FACE_HEX: Record<string, string> = {
  U: "#FFFFFF", R: "#EF4444", F: "#22C55E",
  D: "#FACC15", L: "#F97316", B: "#3B82F6",
};

/**
 * Derive two face colors from an edge slotId (e.g. "FR" → ["#22C55E", "#EF4444"]).
 */
function slotFaceColors(slotId: string): [string, string] | null {
  if (slotId.length < 2) return null;
  const a = FACE_HEX[slotId[0]];
  const b = FACE_HEX[slotId[1]];
  if (!a || !b) return null;
  return [a, b];
}

function F2LPairs({ pairs }: { pairs: F2LPairMetrics[] }) {
  const slowest = Math.max(...pairs.map((p) => p.timeMs));
  return (
    <div className="mt-3">
      <span className="text-[0.58rem] uppercase tracking-[0.15em] text-ink-3 font-medium">
        F2L Pair Breakdown
      </span>
      <div className="mt-1.5 space-y-0">
        {pairs.map((pair) => {
          const isSlowest = pair.timeMs === slowest;
          const colors = pair.slotId ? slotFaceColors(pair.slotId) : null;

          return (
            <div
              key={pair.pairNumber}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 text-xs border-t border-line/30 first:border-0",
                isSlowest && "bg-caution/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-ink-2 font-medium">Pair {pair.pairNumber}</span>
                {isSlowest && (
                  <span className="text-[0.5rem] uppercase tracking-wider text-caution font-medium">
                    slowest
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 nums text-ink-3">
                {colors && (
                  <span className="flex items-center gap-0.5" title={pair.slotId ?? undefined}>
                    <span
                      className="inline-block size-2.5 rounded-sm border border-white/20"
                      style={{ background: colors[0] }}
                    />
                    <span
                      className="inline-block size-2.5 rounded-sm border border-white/20"
                      style={{ background: colors[1] }}
                    />
                  </span>
                )}
                <span>{pair.moves}m</span>
                <span>{formatTime(pair.timeMs)}</span>
                <span className="font-medium text-ink">{pair.tps.toFixed(1)} tps</span>
                {pair.pauseBeforeMs > 50 && (
                  <span className="text-caution/70">
                    +{formatTime(pair.pauseBeforeMs)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Roux details ──────────────────────────────────────────────────────────

function RouxDetailsSection({ metrics }: { metrics: SolveMetrics }) {
  const roux = metrics.roux!;
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Roux details" />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile label="FB Eff" value={roux.firstBlockEfficiency.toFixed(2)} />
        <DetailTile label="FB TPS" value={roux.firstBlockTPS.toFixed(2)} />
        <DetailTile label="SB TPS" value={roux.secondBlockTPS.toFixed(2)} />
        <DetailTile label="CMLL Recog" value={formatTime(roux.cmllRecognitionMs)} />
        <DetailTile label="CMLL TPS" value={roux.cmllTPS.toFixed(2)} />
        <DetailTile label="LSE-EO" value={formatTime(roux.lseEOTimeMs)} />
        <DetailTile label="LSE-UL/UR" value={formatTime(roux.lseULURTimeMs)} />
        <DetailTile label="LSE M-slice" value={formatTime(roux.lseMsliceTimeMs)} />
      </div>
    </div>
  );
}

// ─── Rotations & efficiency ────────────────────────────────────────────────

function RotEfficiencySection({ metrics }: { metrics: SolveMetrics }) {
  const rotation = metrics.rotation ?? EMPTY_ROTATION;
  const efficiency = metrics.efficiency ?? EMPTY_EFFICIENCY;
  const hasRot = rotation.totalCount > 0;
  const hasEff = efficiency.moveEfficiencyRatio > 0;

  if (!hasRot && !hasEff) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Rotations & efficiency" />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile
          label="Rotations"
          value={`${rotation.totalCount}`}
          sub={`x:${rotation.byAxis.x} y:${rotation.byAxis.y} z:${rotation.byAxis.z}`}
        />
        <DetailTile
          label="Rot Time"
          value={formatTime(rotation.estimatedRotationTimeMs)}
        />
        <DetailTile
          label="Efficiency"
          value={efficiency.moveEfficiencyRatio.toFixed(2)}
          sub={`opt=${efficiency.optimalMoveCount}m`}
          accent={efficiency.moveEfficiencyRatio > 1.3 ? "amber" : "ready"}
        />
        <DetailTile
          label="Drift"
          value={`${Math.round(efficiency.forwardDrift * 100)}%`}
        />
        {metrics.redundancy && (
          <>
            <DetailTile
              label="Redundancies"
              value={`${metrics.redundancy.totalRedundancies}`}
              sub={`${Math.round(metrics.redundancy.redundancyRate * 100)}% rate`}
              accent={metrics.redundancy.totalRedundancies > 0 ? "amber" : undefined}
            />
            <DetailTile
              label="Cancellations"
              value={`${metrics.redundancy.cancellations}`}
              sub={`${metrics.redundancy.repetitions} reps`}
            />
          </>
        )}
      </div>

      {/* Rotations by phase */}
      {Object.keys(rotation.byPhase).length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
          <div className="px-3 py-2 border-b border-line/50">
            <span className="text-[0.58rem] uppercase tracking-[0.15em] text-ink-3 font-medium">
              Rotations by phase
            </span>
          </div>
          {Object.entries(rotation.byPhase).map(([phase, count]) => (
            <div
              key={phase}
              className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-line/30 last:border-0"
            >
              <span className="font-medium text-ink-2 text-xs uppercase tracking-wide">
                {phase}
              </span>
              <span
                className={cn(
                  "nums font-medium",
                  count > 3 ? "text-amber-400" : count > 0 ? "text-ink" : "text-ink-3/50",
                )}
              >
                {count} rot
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function DetailTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "ready" | "amber" | "dnf";
}) {
  const accentClass =
    accent === "ready"
      ? "text-ready"
      : accent === "amber"
        ? "text-caution"
        : accent === "dnf"
          ? "text-dnf"
          : "text-ink";
  return (
    <div className="flex flex-col gap-1 bg-surface px-3.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className={cn("nums text-lg", accentClass)}>{value}</span>
      {sub && <span className="nums text-[0.65rem] text-ink-3">{sub}</span>}
    </div>
  );
}

function ScrambleBlock({ solve }: { solve: Solve }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText(solve.scramble);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Scramble copied");
  };
  const hasMoves = solve.scramble.trim().length > 0;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface px-5 py-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-3">
          Scramble
        </span>
        {hasMoves ? (
          <AlgorithmNotation notation={solve.scramble} size="sm" />
        ) : (
          <p className="font-mono text-[0.78rem] text-ink break-words">
            {solve.scramble}
          </p>
        )}
      </div>
      <button
        onClick={onCopy}
        className="grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
        aria-label="Copy scramble"
        title="Copy scramble"
      >
        {copied ? <ClipboardCheck className="size-3.5" /> : <Clipboard className="size-3.5" />}
      </button>
    </div>
  );
}

function formatTimestampFull(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
