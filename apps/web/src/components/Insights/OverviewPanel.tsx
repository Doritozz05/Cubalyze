"use client";

import { useMemo } from "react";
import { BarChart3, Layers } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computeStats, formatTime, formatDuration, statLabel } from "@/utils/formatTime";
import {
  deriveTpsSeries,
  deriveHistogram,
  deriveActivityHeatmap,
  derivePhaseDistribution,
} from "@/utils/insights";
import type { Solve } from "@/types";
import { MetricTile } from "../Stats/atoms/MetricTile";
import { TrendChart } from "../Stats/TrendChart";
import { SolveProgressionChart } from "../Stats/SolveProgressionChart";
import {
  SectionHeader,
  AnimatedNumber,
  ActivityHeatmap,
  EmptyState,
} from "./atoms";
import { phaseColorHex } from "@/utils/phaseColors";

export interface OverviewPanelProps {
  solves: Solve[];
  pb?: number;
  className?: string;
}

// NOTE: phase ring colors are now derived semantically via phaseColorHex()
// (one source of truth shared with SolveListPanel and SolveAnalysisPanel).

export function OverviewPanel({ solves, pb, className }: OverviewPanelProps) {
  const stats = useMemo(() => computeStats(solves), [solves]);

  const bestSingle = Number.isFinite(stats.best) ? stats.best : null;
  const isPb = pb != null && bestSingle !== null && bestSingle <= pb;
  const pbDelta =
    bestSingle !== null && pb != null && bestSingle > pb ? bestSingle - pb : null;

  // ── Derived visualization data ────────────────────────────────────────
  const tpsSeries = useMemo(
    () => deriveTpsSeries(solves).map((p) => ({
      idx: p.solveIdx,
      tps: Number.isNaN(p.tps) ? null : p.tps,
      time: formatTime(p.timeMs),
    })),
    [solves],
  );

  const histogram = useMemo(() => deriveHistogram(solves, 500), [solves]);
  // Pre-compute: which bins are the modal (highest count), and which bin
  // label contains the session mean (for the reference line).
  const { isModal } = useMemo(() => {
    if (histogram.length === 0) return { isModal: [] as boolean[], meanBinLabel: null as string | null };
    const maxCount = Math.max(...histogram.map((b) => b.count));
    const modal = histogram.map((b) => b.count === maxCount && maxCount > 0);
    let meanLabel: string | null = null;
    if (stats.mean != null && Number.isFinite(stats.mean)) {
      const meanBin = histogram.find((b) => stats.mean! >= b.fromMs && stats.mean! < b.toMs);
      meanLabel = meanBin?.label ?? null;
    }
    return { isModal: modal, meanBinLabel: meanLabel };
  }, [histogram, stats.mean]);
  const activity = useMemo(() => deriveActivityHeatmap(solves, 12), [solves]);
  const phaseDist = useMemo(() => derivePhaseDistribution(solves), [solves]);

  const analysedCount = useMemo(
    () => solves.filter((s) => s.analysis && s.analysis.phases.length > 0).length,
    [solves],
  );

  // ── Guards ────────────────────────────────────────────────────────────
  if (solves.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-7" />}
        title="No solves yet"
        description="Complete a few solves to see your session overview, trends, and analysis."
        className={cn("flex-1", className)}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-5 px-1 pb-4", className)}>
      {/* ── Hero: PB ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-3.5 text-ink-3" />
            <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-3">
              Best single
            </span>
          </div>
          {isPb ? (
            <span className="rounded bg-ready-soft px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-ready">
              PB
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-4">
          <AnimatedNumber
            value={bestSingle ?? 0}
            format={(n) => (bestSingle !== null ? formatTime(n) : "—")}
            className="text-4xl text-ink"
          />
          {pbDelta != null ? (
            <span className="nums text-[0.7rem] text-ink-3">
              +{formatTime(pbDelta)} off PB
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Stat tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <MetricTile label="Best" value={statLabel(stats.best)} />
        <MetricTile label="Worst" value={statLabel(stats.worst)} />
        <MetricTile label="Mean" value={statLabel(stats.mean)} />
        <MetricTile label="Ao5" value={statLabel(stats.ao5)} />
        <MetricTile label="Ao12" value={statLabel(stats.ao12)} />
        <MetricTile label="Ao100" value={statLabel(stats.ao100)} />
        <MetricTile
          label="Solves"
          value={`${stats.count}`}
          sub={stats.total !== stats.count ? `${stats.total} total` : undefined}
        />
        <MetricTile
          label="Solve time"
          value={formatDuration(stats.sessionTime)}
          sub={`${stats.count} solves`}
        />
      </div>

      {/* ── Solve Progression (scatter) ─────────────────────────────── */}
      <SolveProgressionChart solves={solves} />

      {/* ── Trend (Ao-N rolling) ───────────────────────────────────────── */}
      <div className="rounded-lg border border-line bg-surface px-5 py-4">
        <SectionHeader title="Trend" eyebrow="Ao-N rolling average" className="mb-3" />
        <TrendChart solves={solves} defaultWindow={5} />
      </div>

      {/* ── TPS over time ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-line bg-surface px-5 py-4">
        <SectionHeader
          title="TPS over time"
          eyebrow={`${analysedCount} analysed`}
          className="mb-3"
        />
        {analysedCount < 2 ? (
          <div className="flex h-25 items-center justify-center text-[0.7rem] text-ink-3">
            Need at least 2 Smart Cube solves with analysis
          </div>
        ) : (
          <div className="h-25 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={tpsSeries}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <defs>
                  <linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ink-2)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--ink-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="idx" hide />
                <YAxis
                  domain={[0, "dataMax + 1"]}
                  hide
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
                  contentStyle={{
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "0.7rem",
                    padding: "4px 8px",
                    boxShadow: "none",
                  }}
                  labelFormatter={(l) => `Solve ${Number(l) + 1}`}
                  formatter={(v) => [`${Number(v).toFixed(2)} tps`, "TPS"]}
                />
                <Area
                  type="monotone"
                  dataKey="tps"
                  stroke="var(--ink-2)"
                  strokeWidth={1.5}
                  fill="url(#tps-fill)"
                  dot={false}
                  activeDot={{ r: 2.5, fill: "var(--ink-2)" }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Time distribution histogram ────────────────────────────────── */}
      <div className="rounded-lg border border-line bg-surface px-5 py-4">
        <SectionHeader title="Time distribution" eyebrow="0.5s bins" className="mb-3" />
        {histogram.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-[0.7rem] text-ink-3">
            No valid times to display
          </div>
        ) : (
          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogram}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis dataKey="label" hide />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                  contentStyle={{
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "0.7rem",
                    padding: "4px 8px",
                    boxShadow: "none",
                  }}
                  formatter={(_, __, entry) => {
                    const bin = entry?.payload as { count?: number; label?: string } | undefined;
                    return [`${bin?.count ?? 0} solves`, `${bin?.label ?? ""}s`];
                  }}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {histogram.map((_, i) => (
                    <Cell
                      key={i}
                      fill={isModal[i] ? "var(--ink-2)" : "var(--ink-3)"}
                      fillOpacity={isModal[i] ? 0.7 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Activity heatmap + phase distribution (two-column on desktop) ─ */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Activity heatmap */}
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
          <SectionHeader
            title="Activity"
            eyebrow="last 12 weeks"
            className="mb-3"
          />
          <ActivityHeatmap counts={activity} weeks={12} />
        </div>

        {/* Phase distribution donut */}
        <div className="rounded-lg border border-line bg-surface px-5 py-4">
          <SectionHeader
            title="Phase split"
            eyebrow={
              analysedCount > 0
                ? `avg of ${analysedCount}`
                : "no analysis"
            }
            className="mb-3"
          />
          {phaseDist.length === 0 ? (
            <div className="flex h-22 items-center justify-center text-center text-[0.7rem] text-ink-3">
              <span className="flex flex-col items-center gap-1.5">
                <Layers className="size-4 text-ink-3/50" />
                Complete solves with a Smart Cube
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
              <div className="h-32 w-32 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={phaseDist}
                      dataKey="share"
                      nameKey="phaseName"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={58}
                      stroke="none"
                      paddingAngle={3}
                    >
                      {phaseDist.map((p, i) => (
                        <Cell key={p.phaseName} fill={phaseColorHex(p.phaseName, i)} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                      contentStyle={{
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        background: "var(--surface)",
                        color: "var(--ink)",
                        fontSize: "0.7rem",
                        padding: "4px 8px",
                        boxShadow: "none",
                      }}
                      formatter={(v: any, name: any) => [
                        `${Math.round(Number(v ?? 0) * 100)}%`,
                        String(name ?? ""),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for the donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[0.6rem] font-medium uppercase tracking-wider text-ink-3/70">Total</span>
                </div>
              </div>
              
              <div className="flex flex-1 flex-col justify-center gap-2.5 w-full">
                {phaseDist.map((p, i) => (
                  <div key={p.phaseName} className="flex items-center justify-between text-[0.75rem]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: phaseColorHex(p.phaseName, i) }}
                      />
                      <span className="font-medium text-ink-2">{p.phaseName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="nums text-[0.65rem] text-ink-3">{formatTime(p.avgDurationMs)}</span>
                      <span className="nums w-8 text-right font-medium text-ink">{Math.round(p.share * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Penalty mix ────────────────────────────────────────────────── */}
      <PenaltyMix solves={solves} />
    </div>
  );
}

// ─── Penalty mix sub-component ────────────────────────────────────────────

function PenaltyMix({ solves }: { solves: Solve[] }) {
  const total = solves.length;
  if (total === 0) return null;
  const dnf = solves.filter((s) => s.penalty === "DNF").length;
  const plus2 = solves.filter((s) => s.penalty === "+2").length;
  const ok = total - dnf - plus2;
  
  const pctNum = (n: number) => (n / total) * 100;
  const pctStr = (n: number) => `${Math.round(pctNum(n))}%`;

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title="Penalty mix" eyebrow={`${total} solves`} />
      
      {/* Stacked Bar */}
      <div className="mt-4 mb-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
        {ok > 0 && (
          <UiTooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full bg-ready transition-all" 
                style={{ width: `${pctNum(ok)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">Clean: {ok} solves</TooltipContent>
          </UiTooltip>
        )}
        {plus2 > 0 && (
          <UiTooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full bg-plus2 transition-all" 
                style={{ width: `${pctNum(plus2)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">+2: {plus2} solves</TooltipContent>
          </UiTooltip>
        )}
        {dnf > 0 && (
          <UiTooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full bg-dnf transition-all" 
                style={{ width: `${pctNum(dnf)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">DNF: {dnf} solves</TooltipContent>
          </UiTooltip>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[0.7rem]">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-ready" />
          <span className="text-ink-3">Clean</span>
          <span className="nums font-medium text-ink">{pctStr(ok)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-plus2" />
          <span className="text-ink-3">+2</span>
          <span className="nums font-medium text-plus2">{pctStr(plus2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-dnf" />
          <span className="text-ink-3">DNF</span>
          <span className="nums font-medium text-dnf">{pctStr(dnf)}</span>
        </div>
      </div>
    </div>
  );
}
