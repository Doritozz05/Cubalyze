"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Clipboard, ClipboardCheck, Trash2, MessageSquare, Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline, type TimelineData, type TimelineSegment } from "@/utils/insights";
import { phaseColorHex, pauseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics, RotationMetrics, EfficiencyMetrics, F2LPairMetrics } from "@cubeforge/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  SectionHeader,
  EmptyState,
  MetricRing,
  AlgorithmNotation,
} from "./atoms";
import { ReplaySection } from "./ReplaySection";

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

  // ── Replay state ──────────────────────────────────────────────────────────
  const [replayPosMs, setReplayPosMs] = useState<number | null>(null);
  const [replayMoveIdx, setReplayMoveIdx] = useState<number | null>(null);
  const [, setReplaying] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(solve.note ?? "");

  // Stable solve object for the ReplaySection (avoids unnecessary re-creates).
  const replaySolve = useMemo(
    () => (solve.analysis ? solve : { ...solve, analysis: m ?? undefined }),
    [solve, m],
  );

  return (
    <div className={cn("flex flex-col gap-4 px-1 pb-4 bg-canvas", className)}>
      {/* Back to overview — desktop only; the touch overlay provides its
          own sticky header with a back button. */}
      <button
        onClick={onBackToOverview}
        className="flex items-center gap-1.5 self-start text-[0.72rem] text-ink-3 transition-colors hover:text-ink max-lg:hidden"
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={cyclePenalty}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide transition-colors hover:opacity-80 cursor-pointer",
                    solve.penalty === "DNF"
                      ? "border-dnf/30 bg-dnf-soft text-dnf"
                      : solve.penalty === "+2"
                        ? "border-plus2/30 bg-plus2-soft text-plus2"
                        : "border-ready/30 bg-ready-soft text-ready",
                  )}
                >
                  {solve.penalty === "none" ? "Clean" : solve.penalty}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Click to cycle penalty</TooltipContent>
            </Tooltip>
            {solve.method ? (
              <span className="rounded border border-phase-indigo/30 bg-phase-indigo/10 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-phase-indigo">
                {solve.method}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide",
                solve.source === "smart"
                  ? "border-phase-emerald/30 bg-phase-emerald/10 text-phase-emerald"
                  : "border-line bg-surface-2 text-ink-2",
              )}
            >
              {solve.source === "smart" ? "Smart cube" : "Manual"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeleteSolve}
          className="h-7 max-lg:h-10 gap-1 px-2 text-xs text-ink-3 hover:text-dnf"
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

      {/* ── Note section ── */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-phase-indigo" />
            <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-3">
              Note
            </span>
          </div>
          {!isEditingNote && (
            <button
              onClick={() => {
                setNoteText(solve.note ?? "");
                setIsEditingNote(true);
              }}
              className="flex items-center gap-1 text-[0.68rem] text-ink-3 transition-colors hover:text-ink cursor-pointer"
            >
              <Pencil className="size-3" />
              {solve.note ? "Edit" : "Add note"}
            </button>
          )}
        </div>

        {isEditingNote ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = noteText.trim();
              onUpdateSolve({ note: trimmed || null });
              setIsEditingNote(false);
            }}
            className="flex items-center gap-2 mt-1"
          >
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note for this solve..."
              autoFocus
              className="flex-1 rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-[0.78rem] text-ink placeholder:text-ink-3/60 outline-none focus:border-ink/40"
            />
            <Button type="submit" size="sm" className="h-8 px-3 text-xs bg-ink text-surface hover:bg-ink/90 cursor-pointer">
              <Check className="size-3.5 mr-1" />
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingNote(false)}
              className="h-8 px-2 text-xs text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="size-3.5" />
            </Button>
          </form>
        ) : solve.note ? (
          <p className="text-[0.78rem] text-ink leading-relaxed whitespace-pre-wrap">
            {solve.note}
          </p>
        ) : (
          <p className="text-[0.7rem] text-ink-3/60 italic">No notes added to this solve.</p>
        )}
      </div>

      {/* ── Replay (always visible, even without analysis, as long as there are moves) ── */}
      <ReplaySection
        solve={replaySolve}
        onReplayPosition={(ms, moveIndex) => {
          setReplayPosMs(ms);
          setReplayMoveIdx(moveIndex);
          setReplaying(true);
        }}
        onReplayComplete={() => {
          setReplayPosMs(null);
          setReplayMoveIdx(null);
          setReplaying(false);
        }}
      />

      {/* Analysis sections or empty banner */}
      {!m ? (
        <EmptyState
          title="No analysis for this solve"
          description={
            solve.source === "smart"
              ? "The analysis pipeline didn't run. Re-solve this scramble to generate analysis."
              : "Manual entry. Connect a smart cube and solve this scramble to get per-move analysis."
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
            replayPositionMs={replayPosMs}
            replayMoveIdx={replayMoveIdx}
          />

          {/* ── Key metric rings ────────────────────────────────────────── */}
          <MetricRingsSection metrics={m} />

          {/* ── Phase breakdown ─────────────────────────────────────────── */}
          <PhaseBreakdownSection
            metrics={m}
            solveTimeMs={solve.time}
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
  replayPositionMs,
  replayMoveIdx,
}: {
  timeline: TimelineData;
  meanTps: number;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
  /** Animated replay playhead position (ms), null when not replaying. */
  replayPositionMs?: number | null;
  /** Replay move index (aligned with moveTicks) for the playhead. */
  replayMoveIdx?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const { totalMs, moveTicks, moveVisualMs, tpsSamples, segments, pauseMarks } = timeline;
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

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || totalMs <= 0) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ms = Math.max(0, Math.min(totalMs, ratio * totalMs));
      setHoverMs(ms);
    },
    [totalMs],
  );

  const handleLeave = useCallback(() => {
    setHoverMs(null);
  }, []);

  // Replay playhead x-position. The replay clock is MOVE-DRIVEN (its ms are
  // virtual, independent of solve.time), so anchor the playhead to the
  // CURRENT MOVE's visual tick instead — that keeps it perfectly aligned
  // with the phase/pause segments while every move plays back.
  const replayX = useMemo(() => {
    if (replayPositionMs == null) return null;
    // Only anchor to move ticks when the timeline actually has segments
    // (phaseRuns existed) — otherwise moveVisualMs is all zeros and the
    // playhead would be pinned to x=0.
    if (
      segments.length > 0 &&
      replayMoveIdx != null &&
      replayMoveIdx >= 0 &&
      replayMoveIdx < moveVisualMs.length
    ) {
      return xForMs(moveVisualMs[replayMoveIdx]);
    }
    return xForMs(replayPositionMs);
  }, [replayPositionMs, replayMoveIdx, moveVisualMs, segments, xForMs]);

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
        eyebrow={`${moveTicks.length} moves · ${formatTime(totalMs)} total${
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
                  className="absolute right-0 nums text-[0.6rem] leading-none text-ink-3"
                  style={{ top: y, transform: "translateY(-50%)" }}
                >
                  {t.toFixed(0)}
                </span>
              );
            })}
            <span className="absolute left-0 text-[0.6rem] uppercase tracking-wider text-ink-3/50 leading-none"
              style={{ top: 0, lineHeight: 1 }}
            >
              tps
            </span>
            {meanTps > 0 && (
              <span
                className="absolute left-0 nums text-[0.6rem] leading-none text-ready/70"
                style={{ top: meanTpsY, transform: "translateY(-50%)" }}
              >
                avg&nbsp;{meanTps.toFixed(1)}
              </span>
            )}
          </div>

          {/* SVG + pause popover overlays */}
          <div
            ref={containerRef}
            className="relative flex-1"
            style={{ height: TIMELINE_HEIGHT }}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
          >
            <svg
              width="100%"
              height={TIMELINE_HEIGHT}
              viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`}
              preserveAspectRatio="none"
              className="overflow-visible pointer-events-none"
              role="img"
              aria-label={`Solve timeline: ${segments.length} segments over ${formatTime(totalMs)}`}
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

              {/* Unified segment blocks — sharp rectangles, no rounded corners,
                  no colored borders, clean cross-highlight via opacity only. */}
              {segments.map((seg, i) => {
                const x = xForMs(seg.startMs);
                const w = Math.max(0.5, xForMs(seg.endMs) - x);
                const isPause = seg.kind === "pause";
                const color = isPause
                  ? pauseColorHex(seg.pauseCategory ?? "mid-phase")
                  : phaseColorHex(seg.phaseName ?? "", i);
                const hl = segHighlight(seg);
                const fillOpacity = isPause
                  ? hl === "dim" ? 0.18 : hl === "active" ? 0.65 : 0.40
                  : hl === "dim" ? 0.12 : hl === "active" ? 0.55 : 0.30;
                return (
                  <rect
                    key={`${seg.kind}-${i}`}
                    x={x}
                    y={SEG_TOP}
                    width={w}
                    height={SEG_BOTTOM - SEG_TOP}
                    fill={color}
                    fillOpacity={fillOpacity}
                  />
                );
              })}

              {/* Move ticks — positioned using visual coords (aligned with segments) */}
              {moveVisualMs.map((visMs, i) => (
                <line
                  key={moveTicks[i].index}
                  x1={xForMs(visMs)}
                  y1={TPS_AREA_BOTTOM + 1}
                  x2={xForMs(visMs)}
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

              {/* Replay playhead — centered on segment blocks (does not extend into TPS area) */}
              {replayX !== null && (
                <>
                  {/* Tail: subtle fill behind the playhead */}
                  <rect
                    x={0}
                    y={SEG_TOP}
                    width={replayX}
                    height={SEG_BOTTOM - SEG_TOP}
                    fill="#4F8CF7"
                    fillOpacity={0.08}
                  />
                  <line
                    x1={replayX}
                    y1={SEG_TOP}
                    x2={replayX}
                    y2={SEG_BOTTOM}
                    stroke="#4F8CF7"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>



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
                            <span className="text-[0.6rem] uppercase tracking-wide text-ink-3">
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
            {/* Phase hover popover triggers: invisible divs over each phase block */}
            {totalMs > 0 &&
              segments
                .filter((s) => s.kind === "phase")
                .map((seg, i) => {
                  const leftPct = (seg.startMs / totalMs) * 100;
                  const widthPct = (seg.durationMs / totalMs) * 100;
                  const topPct = (SEG_TOP / TIMELINE_HEIGHT) * 100;
                  const heightPct = ((SEG_BOTTOM - SEG_TOP) / TIMELINE_HEIGHT) * 100;
                  const color = phaseColorHex(seg.phaseName ?? "", i);
                  // Compute TPS and move count for this phase segment
                  const moveCount = moveTicks.filter(
                    (t) => t.phaseName === seg.phaseName &&
                      t.offsetMs >= seg.startMs &&
                      t.offsetMs <= seg.endMs
                  ).length;
                  const phaseTps = moveCount > 0 && seg.durationMs > 0
                    ? (moveCount / seg.durationMs) * 1000
                    : 0;

                  return (
                    <HoverCard key={`phase-${i}`} openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div
                          className="absolute cursor-pointer"
                          style={{
                            left: `${leftPct}%`,
                            width: `max(${widthPct}%, 4px)`,
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
                        className="w-56 p-3 text-xs"
                      >
                        {/* Phase name */}
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-sm"
                            style={{ background: color }}
                          />
                          <span className="font-medium text-ink">{seg.phaseName}</span>
                        </div>
                        {/* Stats */}
                        <div className="mt-2 flex items-baseline gap-3">
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              Time
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {formatTime(seg.durationMs)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              Moves
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {moveCount}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              TPS
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {phaseTps.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Duration fraction */}
                        <div className="mt-1.5 text-[0.6rem] text-ink-3">
                          {Math.round((seg.durationMs / totalMs) * 100)}% of solve
                        </div>
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
              className="absolute nums text-[0.6rem] leading-none text-ink-3/70"
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

/**
 * Quality score: 0 (worst) → 1 (best).
 *
 * For **lower-is-better** metrics we scale from the optimal value to the max
 * so that optimal = 1.0, max = 0:
 *   quality = (max − value) / (max − optimal)
 *
 * For eff the optimal is 1.0 (moves = optimal); for pauses/pause% it is 0.
 *
 * For **higher-is-better** metrics quality is simply value / max.
 */
function quality(
  value: number,
  max: number,
  lowerIsBetter: boolean,
  optimal = 0,
): number {
  if (max <= 0) return 0;
  const clamped = Math.max(optimal, Math.min(value, max));
  if (lowerIsBetter && max !== optimal) {
    return (max - clamped) / (max - optimal);
  }
  return clamped / max;
}

/**
 * Colour gradient: gray → amber → green.
 * Bad values (q≈0) render as neutral gray so they don't demotivate.
 * Good values (q≈1) render as green.
 *
 *   q=0.00  ◻ gray       hsl(0, 0%, 48%)
 *   q=0.25  ◇ muted amber hsl(40, 27%, 45%)
 *   q=0.50  ◈ amber       hsl(40, 55%, 42%)
 *   q=0.75  ◆ yellow-green hsl(90, 55%, 38%)
 *   q=1.00  ◆ green       hsl(140, 55%, 35%)
 */
function qualityColorHex(q: number): string {
  const clamped = Math.max(0, Math.min(1, q));
  // Saturation ramps up quickly: 0 at q=0 → 55 at q=0.5, stays at 55.
  const sat = Math.round(Math.min(clamped / 0.5, 1) * 55);
  // Lightness: 48% at q=0 → 35% at q=1.0 (denser = more vivid).
  const light = Math.round(48 - clamped * 13);
  // Hue: gray at q=0 (sat=0, hue irrelevant), amber at q≤0.5, green at q=1.
  const hue = clamped <= 0.5
    ? 40   // amber
    : Math.round(40 + (clamped - 0.5) * 2 * 100); // 40 (amber) → 140 (green)
  if (sat === 0) return `hsl(0, 0%, ${light}%)`;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/**
 * Benchmark caps — real-world data from competitive speedcubing.
 *
 *   TPS:       /12 —  12+ = world-class (sub-6)     6+ = good (sub-15)
 *                     3+ = learning                   1–2 = just started
 *   Pauses:    /8  —  0   = world-class (seamless)   1–2 = sub-10 (near seamless)
 *                     3–4 = advanced (brief pauses)  5–6 = intermediate (stop-and-go)
 *                     7+  = beginner (many pauses)
 *   Efficiency /1  —  1.0 = optimal (theoretical shortest solve ~42–52 moves)
 *                     0.8 = very efficient (15 % over optimal)
 *                     0.5 = average efficient (2× optimal, typical intermediate)
 *
 * Efficiency is shown as a 0–1 score just like in engineering (1 = perfect).
 * Internally we store actual÷optimal (always ≥1); we convert to 1÷(actual÷optimal)
 * so the ring and colour behave intuitively.
 */
interface MetricDef {
  /** Value to feed into quality(). */
  value: number;
  max: number;
  label: string;
  sub: string;
  lowerIsBetter: boolean;
  optimal?: number;
}

function MetricRingsSection({ metrics }: { metrics: SolveMetrics }) {
  const rings: MetricDef[] = [
    {
      value: metrics.tps.global,
      max: 12,
      label: metrics.tps.global.toFixed(1),
      sub: "TPS",
      lowerIsBetter: false,
    },
    {
      value: metrics.pauses.totalCount,
      max: 8,
      label: `${metrics.pauses.totalCount}`,
      sub: "Pauses",
      lowerIsBetter: true,
    },
  ];

  // Efficiency on a 0-1 scale where 1 = optimal (moveEfficiencyRatio = 1.0).
  // The ring fills to the efficiency value directly, higher = better.
  const efficiency = metrics.efficiency ?? EMPTY_EFFICIENCY;
  if (efficiency.moveEfficiencyRatio > 0) {
    const effScore = Math.min(1, 1 / efficiency.moveEfficiencyRatio);
    rings.push({
      value: effScore,
      max: 1,
      label: `${Math.round(effScore * 100)}%`,
      sub: "Efficiency",
      lowerIsBetter: false,
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Key metrics" />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
        {rings.map((r) => {
          const q = quality(r.value, r.max, r.lowerIsBetter, r.optimal);
          return (
            <MetricRing
              key={r.sub}
              value={q * r.max}
              max={r.max}
              label={r.label}
              sub={r.sub}
              size={80}
              strokeWidth={4}
              strokeColor={qualityColorHex(q)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Phase breakdown ───────────────────────────────────────────────────────

function PhaseBreakdownSection({
  metrics,
  solveTimeMs,
  hoveredPhase,
  onHoverPhase,
}: {
  metrics: SolveMetrics;
  solveTimeMs: number;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
}) {
  // Sum of all phase durations (should equal metrics.totalTimeMs minus transition gaps).
  const phaseSumMs = metrics.phases.reduce((s, p) => s + p.durationMs, 0);
  // Transition gaps: time between the last move of one phase and first move of the next.
  const totalGapMs = Math.max(0, solveTimeMs - phaseSumMs);
  const showGap = totalGapMs > 200;

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader
        title="Phase breakdown"
        eyebrow={`${metrics.phases.length} phases · ${formatTime(phaseSumMs)} active${showGap ? ` (+${formatTime(totalGapMs)} idle/transition)` : ""}`}
      />
      <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
        {metrics.phases.map((p, i) => {
          const isHighlighted = hoveredPhase === p.phaseName;
          const isDimmed = hoveredPhase !== null && hoveredPhase !== p.phaseName;
          const color = phaseColorHex(p.phaseName, i);
          const phasePct = phaseSumMs > 0 ? Math.round((p.durationMs / phaseSumMs) * 100) : 0;
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
                {p.phaseName === "Cross" &&
                  metrics.detectionReport?.crossType &&
                  metrics.detectionReport.crossType !== "plain" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide cursor-help",
                            metrics.detectionReport.crossType === "xxcross"
                              ? "border border-caution/40 bg-caution/10 text-caution"
                              : "border border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
                          )}
                        >
                          {metrics.detectionReport.crossType === "xxcross"
                            ? "XXCross"
                            : "XCross"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {metrics.detectionReport.xcrossPairs
                          ?.map((pair) => pair.slot)
                          .join(", ") || "An F2L pair was already solved"}{" "}
                        at cross completion
                      </TooltipContent>
                    </Tooltip>
                  )}
              </div>
              <div className="flex items-center gap-3 nums text-xs text-ink-3">
                <span>{p.moveCount}m</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{formatTime(p.durationMs)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{phasePct}% of phase total</TooltipContent>
                </Tooltip>
                <span className="font-medium text-ink">{p.tps.toFixed(1)} tps</span>
                {p.pauseCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-caution/70">{p.pauseCount}p</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{p.pauseCount} pause{p.pauseCount !== 1 ? "s" : ""} in this phase</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Gap explanation: phases only measure within-phase execution time. */}
      {showGap && (
        <p className="mt-2 text-[0.6rem] text-ink-3/60">
          Solve time {formatTime(solveTimeMs)} = {formatTime(phaseSumMs)} active + {formatTime(totalGapMs)} idle/transition
        </p>
      )}
    </div>
  );
}

// ─── CFOP details ──────────────────────────────────────────────────────────

function CfopDetailsSection({ metrics }: { metrics: SolveMetrics }) {
  const cfop = metrics.cfop!;
  const crossType = metrics.detectionReport?.crossType;
  const crossColor = metrics.detectionReport?.crossColor;
  const crossFace = metrics.detectionReport?.crossFace;
  const crossValue =
    crossType === "xcross"
      ? "XCross"
      : crossType === "xxcross"
        ? "XXCross"
        : crossType === "plain"
          ? "Plain"
          : "—";
  const crossSub =
    crossColor && crossFace
      ? `${colorName(crossColor)} on ${crossFace}`
      : undefined;
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="CFOP details" />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile
          label="Cross"
          value={crossValue}
          sub={crossSub}
          accent={
            crossType === "xxcross"
              ? "amber"
              : crossType === "xcross"
                ? "ready"
                : undefined
          }
        />
        <DetailTile label="Cross eff" value={cfop.crossEfficiency.toFixed(2)} />
        <DetailTile label="Cross→F2L" value={formatTime(cfop.crossToF2LTransitionMs)} />
        <DetailTile label="OLL recog" value={formatTime(cfop.ollRecognitionMs)} />
        <DetailTile label="OLL TPS" value={cfop.ollTPS.toFixed(2)} />
        <DetailTile label="PLL recog" value={formatTime(cfop.pllRecognitionMs)} />
        <DetailTile label="PLL TPS" value={cfop.pllTPS.toFixed(2)} />
        <DetailTile
          label="Lookahead"
          value={cfop.f2lLookaheadScore.toFixed(2)}
          accent={cfop.f2lLookaheadScore > 0.7 ? "ready" : undefined}
        />
        <DetailTile label="F2L pairs" value={`${cfop.f2lPairs.length}`} />
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

/** Maps face letters to color names (U=White, R=Red, F=Green, D=Yellow, …). */
const FACE_NAME: Record<string, string> = {
  U: "White",
  R: "Red",
  F: "Green",
  D: "Yellow",
  L: "Orange",
  B: "Blue",
};

function colorName(face: string): string {
  return FACE_NAME[face] ?? face;
}

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
        F2L pair breakdown
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
                  <span className="text-[0.6rem] uppercase tracking-wider text-caution font-medium">
                    slowest
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 nums text-ink-3">
                {colors && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5">
                        <span
                          className="inline-block size-2.5 rounded-sm border border-white/20"
                          style={{ background: colors[0] }}
                        />
                        <span
                          className="inline-block size-2.5 rounded-sm border border-white/20"
                          style={{ background: colors[1] }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{pair.slotId}</TooltipContent>
                  </Tooltip>
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
        <DetailTile label="FB eff" value={roux.firstBlockEfficiency.toFixed(2)} />
        <DetailTile label="FB TPS" value={roux.firstBlockTPS.toFixed(2)} />
        <DetailTile label="SB TPS" value={roux.secondBlockTPS.toFixed(2)} />
        <DetailTile label="CMLL recog" value={formatTime(roux.cmllRecognitionMs)} />
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
          label="Rot time"
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
                  count > 3 ? "text-caution" : count > 0 ? "text-ink" : "text-ink-3/50",
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
          <p className="font-mono text-[0.78rem] text-ink wrap-break-word">
            {solve.scramble}
          </p>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCopy}
            className="grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Copy scramble"
          >
            {copied ? <ClipboardCheck className="size-3.5" /> : <Clipboard className="size-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Copy scramble</TooltipContent>
      </Tooltip>
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
