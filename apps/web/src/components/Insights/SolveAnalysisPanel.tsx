"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Clipboard, ClipboardCheck, Trash2, Pause as PauseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline, type TimelineData } from "@/utils/insights";
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

const TIMELINE_HEIGHT = 80;
const TIMELINE_TPS_AREA_H = 40; // TPS overlay occupies the top portion

const PHASE_COLORS_CSS = [
  "var(--ink-3)",
  "var(--ink-2)",
  "var(--caution)",
  "var(--ready)",
];

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
          <TimelineSection timeline={timeline} />

          {/* ── Key metric rings ────────────────────────────────────────── */}
          <MetricRingsSection metrics={m} />

          {/* ── Phase breakdown ─────────────────────────────────────────── */}
          <PhaseBreakdownSection metrics={m} />

          {/* ── Pauses with probable causes ─────────────────────────────── */}
          {timeline.pauseMarks.length > 0 && (
            <PausesSection timeline={timeline} metrics={m} />
          )}

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
}: {
  timeline: TimelineData;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { totalMs, moveTicks, tpsSamples, stageSegments, pauseMarks } = timeline;
  const width = 600; // viewBox width; scales to container via preserveAspectRatio
  const tpsAreaTop = 2;
  const tpsAreaBottom = TIMELINE_TPS_AREA_H;
  const phaseTop = tpsAreaBottom + 8;
  const phaseBottom = TIMELINE_HEIGHT - 2;

  // TPS scale: 0 to max tps + 1
  const maxTps = useMemo(() => {
    const max = Math.max(...tpsSamples.map((s) => s.tps), 0);
    return Math.max(max + 1, 5);
  }, [tpsSamples]);

  const xForMs = useCallback(
    (ms: number) => (totalMs > 0 ? (ms / totalMs) * width : 0),
    [totalMs, width],
  );

  const handleMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || totalMs <= 0) return;
      const rect = svg.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ms = Math.max(0, Math.min(totalMs, ratio * totalMs));
      setHoverMs(ms);
      // Find nearest move tick
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

  // TPS area path
  const tpsPath = useMemo(() => {
    if (tpsSamples.length < 2) return "";
    return tpsSamples
      .map((s, i) => {
        const x = xForMs(s.offsetMs);
        const y = tpsAreaBottom - (s.tps / maxTps) * (tpsAreaBottom - tpsAreaTop);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [tpsSamples, xForMs, maxTps]);

  const tpsAreaPath = useMemo(() => {
    if (tpsPath === "") return "";
    const lastX = xForMs(tpsSamples[tpsSamples.length - 1]?.offsetMs ?? 0);
    return `${tpsPath} L${lastX.toFixed(1)},${tpsAreaBottom} L0,${tpsAreaBottom} Z`;
  }, [tpsPath, tpsSamples, xForMs]);

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Timeline" eyebrow={`${moveTicks.length} moves · ${formatTime(totalMs)}`} />

      <div className="mt-3">
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`}
          preserveAspectRatio="none"
          className="overflow-visible"
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
        >
          <defs>
            <linearGradient id="timeline-tps-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink-2)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--ink-2)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* TPS area fill */}
          {tpsAreaPath && (
            <path d={tpsAreaPath} fill="url(#timeline-tps-fill)" />
          )}
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

          {/* Phase segments */}
          {stageSegments.map((seg, i) => {
            const x = xForMs(seg.startMs);
            const w = Math.max(1, xForMs(seg.endMs) - x);
            return (
              <g key={seg.phaseName}>
                <rect
                  x={x}
                  y={phaseTop}
                  width={w}
                  height={phaseBottom - phaseTop}
                  fill={PHASE_COLORS_CSS[i % PHASE_COLORS_CSS.length]}
                  fillOpacity={0.25}
                  rx={2}
                />
                {w > 30 && (
                  <text
                    x={x + w / 2}
                    y={phaseTop + (phaseBottom - phaseTop) / 2 + 3}
                    textAnchor="middle"
                    className="fill-ink-2"
                    style={{ fontSize: "8px", fontWeight: 500 }}
                  >
                    {seg.phaseName.slice(0, 6)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Move ticks */}
          {moveTicks.map((tick) => {
            const x = xForMs(tick.offsetMs);
            return (                <line
                  key={tick.index}
                  x1={x}
                  y1={phaseTop - 2}
                  x2={x}
                  y2={phaseTop}
                  stroke="var(--ink-3)"
                  strokeWidth={0.5}
                  strokeOpacity={0.4}
                  vectorEffect="non-scaling-stroke"
                />
            );
          })}

          {/* Pause markers */}
          {pauseMarks.map((pause, i) => {
            const x = xForMs(pause.startMs);
            const w = Math.max(2, xForMs(pause.endMs) - x);
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={tpsAreaTop}
                  width={w}
                  height={phaseBottom - tpsAreaTop}
                  fill="var(--caution)"
                  fillOpacity={0.08}
                />
                <line
                  x1={x}
                  y1={tpsAreaTop}
                  x2={x}
                  y2={phaseBottom}
                  stroke="var(--caution)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                <title>
                  {pause.probableCause} ({formatTime(pause.durationMs)})
                </title>
              </g>
            );
          })}

          {/* Hover playhead */}
          {hoverMs !== null && (
            <line
              x1={xForMs(hoverMs)}
              y1={tpsAreaTop}
              x2={xForMs(hoverMs)}
              y2={phaseBottom}
              stroke="var(--ink)"
              strokeWidth={1}
              strokeOpacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Hover readout */}
        <div className="mt-2 flex h-5 items-center justify-between text-[0.62rem] text-ink-3">
          <span className="nums">
            {hoverMs !== null ? formatTime(hoverMs) : formatTime(0)}
          </span>
          {hoverIdx !== null && moveTicks[hoverIdx] && (
            <span className="font-mono text-ink-2">
              #{hoverIdx + 1} {moveTicks[hoverIdx].label}
              {moveTicks[hoverIdx].phaseName ? ` · ${moveTicks[hoverIdx].phaseName}` : ""}
            </span>
          )}
          <span className="nums">{formatTime(totalMs)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.58rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-ink-2/20" />
          Phases
        </span>
        <span className="flex items-center gap-1.5">
          <PauseIcon className="size-3 text-caution" />
          Pauses ({pauseMarks.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ink-2" />
          TPS
        </span>
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

function PhaseBreakdownSection({ metrics }: { metrics: SolveMetrics }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Phase breakdown" eyebrow={`${metrics.phases.length} phases`} />
      <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
        {metrics.phases.map((p, i) => (
          <div
            key={p.phaseName}
            className="flex items-center justify-between px-3 py-2 text-sm border-b border-line/40 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-sm"
                style={{ background: PHASE_COLORS_CSS[i % PHASE_COLORS_CSS.length] }}
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
                <span className="text-caution/70">{p.pauseCount}p</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pauses section ────────────────────────────────────────────────────────

function PausesSection({
  timeline,
  metrics,
}: {
  timeline: TimelineData;
  metrics: SolveMetrics;
}) {
  const { pauseMarks } = timeline;
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader
        title="Pauses"
        eyebrow={`${pauseMarks.length} · ${formatTime(metrics.pauses.totalPauseTimeMs)}`}
      />
      <div className="mt-3 space-y-1.5">
        {pauseMarks.map((pause, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded border border-line/40 bg-surface-2/50 px-3 py-2"
          >
            <PauseIcon className="size-3.5 shrink-0 text-caution" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium text-ink">{pause.probableCause}</span>
              <span className="text-[0.58rem] uppercase tracking-wide text-ink-3">
                {pause.phase} · {pause.category}
              </span>
            </div>
            <span className="nums text-xs font-medium text-caution">
              {formatTime(pause.durationMs)}
            </span>
          </div>
        ))}
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
          return (
            <div
              key={pair.pairNumber}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 text-xs border-t border-line/30 first:border-0",
                isSlowest && "bg-caution/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded text-[0.6rem] font-bold",
                    isSlowest ? "bg-caution/15 text-caution" : "bg-surface-2 text-ink-3",
                  )}
                >
                  {pair.pairNumber}
                </span>
                <span className="text-ink-2">Pair {pair.pairNumber}</span>
                {isSlowest && (
                  <span className="text-[0.5rem] uppercase tracking-wider text-caution font-medium">
                    slowest
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 nums text-ink-3">
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
