"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { effectiveTime } from "@/types";
import { formatTime } from "@/utils/formatTime";
import type { Solve } from "@/types";

// ─── Data point ─────────────────────────────────────────────────────────────

interface SolveProgressionPoint {
  solveIndex: number;
  time: number | null; // effective time in ms (becomes ceiling for DNFs after second pass)
  timeClean: number | null; // always null for DNFs (used for the connecting line)
  timeFormatted: string;
  isPb: boolean;
  pbHistory: number | null; // running PB up to this solve
  ao5: number | null;
  ao12: number | null;
  isDnf: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * WCA rolling average: solves are in CHRONOLOGICAL order (oldest first).
 * Returns null if not enough solves in the window or >1 DNF.
 */
function rollingAverage(
  chronoSolves: readonly Solve[],
  index: number,
  windowSize: number,
): number | null {
  if (index + 1 < windowSize) return null;
  const slice = chronoSolves.slice(index - windowSize + 1, index + 1);
  const times = slice.map(effectiveTime);
  const dnfs = times.filter((t) => !Number.isFinite(t)).length;
  if (dnfs > 1) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / (windowSize - 2);
}

/** Round ms up to the next `step` ms boundary. */
function ceilMs(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

/** Generate evenly spaced Y-axis ticks. */
function generateYTicks(maxMs: number, targetTicks = 5): number[] {
  const raw = ceilMs(maxMs, 1000);
  const step = Math.max(1000, Math.ceil(raw / targetTicks / 1000) * 1000);
  const ticks: number[] = [];
  for (let v = 0; v <= raw + step; v += step) {
    ticks.push(v);
  }
  return ticks;
}

// ─── Custom dot renderers ───────────────────────────────────────────────────

/** Scatter shape: normal solve dot (white).
 *  DNFs are rendered as red ✕ marks, PBs as yellow glow dots. */
function SolveDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  if (payload?.isDnf) return <DnfDot cx={cx} cy={cy} />;
  if (payload?.isPb) return <PbDotPure cx={cx} cy={cy} />;
  return <circle cx={cx} cy={cy} r={2.5} fill="var(--ink)" fillOpacity={0.5} />;
}

/** PB solve dot (yellow glow + solid centre). */
function PbDotPure({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Outer glow ring */}
      <circle cx={cx} cy={cy} r={6} fill="none" stroke="#FBBF24" strokeWidth={2} strokeOpacity={0.45} />
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={4} fill="none" stroke="#FBBF24" strokeWidth={1.5} strokeOpacity={0.75} />
      {/* Solid centre */}
      <circle cx={cx} cy={cy} r={2.5} fill="#FBBF24" />
    </g>
  );
}

/** DNF cross mark. */
function DnfDot(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  const s = 4;
  return (
    <g>
      <line
        x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s}
        stroke="var(--dnf)" strokeWidth={1.5} strokeOpacity={0.6}
      />
      <line
        x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s}
        stroke="var(--dnf)" strokeWidth={1.5} strokeOpacity={0.6}
      />
    </g>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface SolveProgressionChartProps {
  solves: Solve[];
  className?: string;
}

/**
 * Professional solve progression scatter chart inspired by Twisty Timer.
 *
 * ── Visual layers (back → front) ──
 *  1. CartesianGrid (horizontal only)
 *  2. PB history step line (yellow/gold)
 *  3. Ao5 rolling average line (red)
 *  4. Ao12 rolling average line (green)
 *  5. DNF scatters (red ✕ marks at the top)
 *  6. Best Ao5 / Ao12 reference lines (dashed)
 *  7. All solves scatter (white dots, PB solves are yellow dots)
 */
export function SolveProgressionChart({ solves, className }: SolveProgressionChartProps) {
  const { data, bestAo5, bestAo12, hasEnoughForAo5, hasEnoughForAo12, hasPbHistory, maxY, yTicks, hasDnfs } =
    useMemo(() => {
      const chrono = [...solves].reverse(); // oldest → newest
      let runningPb = Infinity;
      const pts: SolveProgressionPoint[] = [];

      // First pass: compute all points with tentative time values.
      // We need valid times first to compute the Y ceiling.
      for (let i = 0; i < chrono.length; i++) {
        const solve = chrono[i];
        const t = effectiveTime(solve);
        const isDnf = !Number.isFinite(t);

        // Track running PB
        if (!isDnf && t < runningPb) runningPb = t;

        pts.push({
          solveIndex: i + 1,
          time: isDnf ? null : t,
          timeClean: isDnf ? null : t,
          timeFormatted: isDnf ? "DNF" : formatTime(t),
          isPb: false, // will set after ceiling computed
          pbHistory: Number.isFinite(runningPb) ? runningPb : null,
          ao5: rollingAverage(chrono, i, 5),
          ao12: rollingAverage(chrono, i, 12),
          isDnf,
        });
      }

      // Y-axis domain: from valid (non-DNF) times only
      const validTimes = pts
        .map((p) => p.time)
        .filter((t): t is number => t != null);
      const maxMs = validTimes.length > 0 ? Math.max(...validTimes) : 10000;
      const ceiling = ceilMs(maxMs, 1000) + 2000; // 2s headroom

      // Second pass: assign DNFs to ceiling, set isPb correctly
      let pbCheck = Infinity;
      for (const p of pts) {
        if (!p.isDnf && p.time != null && p.time < pbCheck) pbCheck = p.time;
        p.isPb = !p.isDnf && p.time != null && p.time <= pbCheck && p.time > 0;
        if (p.isDnf) p.time = ceiling;
      }

      // Collect all Ao5/Ao12 values for reference lines
      const allAo5 = pts
        .map((p) => p.ao5)
        .filter((v): v is number => v != null);
      const allAo12 = pts
        .map((p) => p.ao12)
        .filter((v): v is number => v != null);

      const pbValues = pts.filter((p) => p.pbHistory != null);
      return {
        data: pts,
        bestAo5: allAo5.length > 0 ? Math.min(...allAo5) : null,
        bestAo12: allAo12.length > 0 ? Math.min(...allAo12) : null,
        hasEnoughForAo5: chrono.length >= 5,
        hasEnoughForAo12: chrono.length >= 12,
        hasPbHistory: pbValues.length > 0,
        maxY: ceiling,
        yTicks: generateYTicks(ceiling),
        hasDnfs: pts.some((p) => p.isDnf),
      };
    }, [solves]);

  if (data.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-line bg-surface px-5 py-4", className)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-3">
            Solve progression
          </span>
        </div>
        <div className="flex items-center gap-3 text-[0.6rem] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-[#FBBF24]" />
            PB
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-[#EF4444]" />
            Ao5
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-[#22C55E]" />
            Ao12
          </span>
          {hasDnfs && (
            <span className="flex items-center gap-1">
              <span className="text-[0.5rem] text-dnf">✕</span>
              DNF
            </span>
          )}
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--line)"
              strokeOpacity={0.2}
              vertical={false}
            />

            <XAxis
              dataKey="solveIndex"
              tick={{ fontSize: 10, fill: "var(--ink-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--line)", strokeOpacity: 0.25 }}
              minTickGap={20}
            />

            <YAxis
              tickFormatter={(v: number) => formatTime(v)}
              tick={{ fontSize: 10, fill: "var(--ink-3)" }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxY]}
              ticks={yTicks}
              width={40}
            />

            <Tooltip
              cursor={{
                stroke: "var(--line-2)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={<ScatterTooltip />}
            />

            {/* ── Best Ao5 reference line ── */}
            {hasEnoughForAo5 && bestAo5 != null && (
              <ReferenceLine
                y={bestAo5}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            )}

            {/* ── Best Ao12 reference line ── */}
            {hasEnoughForAo12 && bestAo12 != null && (
              <ReferenceLine
                y={bestAo12}
                stroke="#22C55E"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            )}

            {/* ── Connecting line between solves (gaps at DNFs) ── */}
            <Line
              type="linear"
              dataKey="timeClean"
              stroke="var(--ink-3)"
              strokeWidth={1.5}
              strokeOpacity={0.3}
              dot={false}
              activeDot={false}
              connectNulls={false}
              name="connector"
              isAnimationActive={false}
            />

            {/* ── PB history step line (only when data exists) ── */}
            {hasPbHistory && (
              <Line
                type="stepAfter"
                dataKey="pbHistory"
                stroke="#FBBF24"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls={false}
                name="pbHistory"
                isAnimationActive={false}
              />
            )}

            {/* ── Ao5 rolling average line ── */}
            {hasEnoughForAo5 && (
              <Line
                type="monotone"
                dataKey="ao5"
                stroke="#EF4444"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls
                name="ao5"
                isAnimationActive={false}
              />
            )}

            {/* ── Ao12 rolling average line ── */}
            {hasEnoughForAo12 && (
              <Line
                type="monotone"
                dataKey="ao12"
                stroke="#22C55E"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls
                name="ao12"
                isAnimationActive={false}
              />
            )}

            {/* ── All solves scatter (white dots + PB yellow dots) ── */}
            <Scatter
              dataKey="time"
              fill="var(--ink-3)"
              fillOpacity={0.5}
              shape={<SolveDot />}
              activeDot={false}
              name="time"
              isAnimationActive={false}
            />


          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload as SolveProgressionPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="flex items-baseline gap-2 text-[0.6rem] text-ink-3">
        Solve #{point.solveIndex}
        {point.isDnf && (
          <span className="rounded bg-dnf-soft px-1 py-0.5 text-[0.5rem] font-medium uppercase text-dnf">
            DNF
          </span>
        )}
        {point.isPb && !point.isDnf && (
          <span className="rounded bg-[#FBBF24]/15 px-1 py-0.5 text-[0.5rem] font-medium uppercase text-[#FBBF24]">
            PB
          </span>
        )}
      </div>

      {!point.isDnf && point.time != null && (
        <div className="mt-1 text-sm font-medium text-ink">
          {point.timeFormatted}
        </div>
      )}

      <div className="mt-1.5 flex flex-col gap-0.5 text-[0.6rem] text-ink-3">
        {point.pbHistory != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-[#FBBF24]" />
            PB {formatTime(point.pbHistory)}
          </span>
        )}
        {point.ao5 != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-2 bg-[#EF4444]" />
            Ao5 {formatTime(point.ao5)}
          </span>
        )}
        {point.ao12 != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-2 bg-[#22C55E]" />
            Ao12 {formatTime(point.ao12)}
          </span>
        )}
      </div>
    </div>
  );
}
