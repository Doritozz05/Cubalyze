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
} from "recharts";
import { cn } from "@/lib/utils";
import { effectiveTime } from "@/types";
import { formatTime, averageOf } from "@/utils/formatTime";
import { useTranslation } from "react-i18next";
import type { Solve } from "@/types";

// ─── Data point ─────────────────────────────────────────────────────────────

interface SolveProgressionPoint {
  solveIndex: number;
  time: number; // effective time in ms
  timeFormatted: string;
  isPb: boolean;
  pbTime: number | null; // solve time (only for PB solves, null otherwise) — for scatter
  bestAo5Time: number | null; // best Ao5 value (only at its solve position, null otherwise) — for marker dot
  bestAo12Time: number | null; // best Ao12 value (only at its solve position, null otherwise) — for marker dot
  pbHistory: number | null; // running PB up to this solve
  ao5: number | null;
  ao12: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Rolling average: solves are in CHRONOLOGICAL order (oldest first) and are
 * guaranteed DNF-free (DNFs are filtered out upstream). Delegates to the
 * shared `averageOf` engine (5% percentile trim, csTimer convention).
 * Returns null if not enough solves in the window.
 */
function rollingAverage(
  chronoSolves: readonly Solve[],
  index: number,
  windowSize: number,
): number | null {
  if (index + 1 < windowSize) return null;
  const win = chronoSolves.slice(index - windowSize + 1, index + 1).reverse();
  const ao = averageOf(win, windowSize);
  return ao != null && Number.isFinite(ao) ? ao : null;
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

/** PB solve dot (yellow glow + solid centre) — receives cx/cy from Recharts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PbDotShape(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="none" stroke="var(--color-chart-pb)" strokeWidth={2} strokeOpacity={0.45} />
      <circle cx={cx} cy={cy} r={4} fill="none" stroke="var(--color-chart-pb)" strokeWidth={1.5} strokeOpacity={0.75} />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--color-chart-pb)" />
    </g>
  );
}

/** Single marker dot for best Ao5 or Ao12 — receives cx/cy from Recharts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MarkerDotShape(props: any) {
  const { cx, cy, color } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
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
 * DNF solves are excluded entirely: they don't count as points, don't create
 * gaps, and don't affect the PB or rolling-average lines.
 *
 * ── Visual layers (back → front) ──
 *  1. Solve time connector line (grey)
 *  2. PB history connecting line (yellow/gold, dashed)
 *  3. Ao5 rolling average line (red)
 *  4. Ao12 rolling average line (green)
 *  5. PB dots, plus best Ao5 / Ao12 marker dots
 */
export function SolveProgressionChart({ solves, className }: SolveProgressionChartProps) {
  const { t } = useTranslation("insights");
  const { data, hasEnoughForAo5, hasEnoughForAo12, hasPbHistory, maxY, yTicks } =
    useMemo(() => {
      // DNF solves are excluded entirely: they don't count as points for the
      // time progression, don't create gaps, and don't affect PB/rolling lines.
      const chrono = [...solves]
        .reverse() // oldest → newest
        .filter((s) => Number.isFinite(effectiveTime(s)));
      let runningPb = Infinity;
      const pts: SolveProgressionPoint[] = [];

      // First pass: compute all points with tentative time values.
      // We need valid times first to compute the Y ceiling.
      for (let i = 0; i < chrono.length; i++) {
        const t = effectiveTime(chrono[i]);

        // Track running PB
        if (t < runningPb) runningPb = t;

        pts.push({
          solveIndex: i + 1,
          time: t,
          timeFormatted: formatTime(t),
          isPb: false, // will set after ceiling computed
          pbTime: null, // will set in second pass
          bestAo5Time: null, // will set in second pass
          bestAo12Time: null, // will set in second pass
          pbHistory: runningPb,
          ao5: rollingAverage(chrono, i, 5),
          ao12: rollingAverage(chrono, i, 12),
        });
      }

      // Y-axis domain from the plotted (valid) times
      const maxMs = pts.length > 0 ? Math.max(...pts.map((p) => p.time)) : 10000;
      const ceiling = ceilMs(maxMs, 1000) + 2000; // 2s headroom

      // Second pass: set isPb / pbTime
      let pbCheck = Infinity;
      for (const p of pts) {
        if (p.time < pbCheck) pbCheck = p.time;
        p.isPb = p.time <= pbCheck && p.time > 0;
        // Set pbTime for scatter dots (only PB solves)
        p.pbTime = p.isPb && p.time > 0 ? p.time : null;
      }

      // Collect all Ao5/Ao12 values for reference lines
      const allAo5 = pts
        .map((p) => p.ao5)
        .filter((v): v is number => v != null);
      const allAo12 = pts
        .map((p) => p.ao12)
        .filter((v): v is number => v != null);

      // Best Ao5 / Ao12 — mark the best value's position
      const bestAo5Val = allAo5.length > 0 ? Math.min(...allAo5) : null;
      const bestAo12Val = allAo12.length > 0 ? Math.min(...allAo12) : null;
      for (const p of pts) {
        if (bestAo5Val != null && p.ao5 != null && p.ao5 === bestAo5Val) p.bestAo5Time = bestAo5Val;
        if (bestAo12Val != null && p.ao12 != null && p.ao12 === bestAo12Val) p.bestAo12Time = bestAo12Val;
      }

      const pbValues = pts.filter((p) => p.pbHistory != null);
      return {
        data: pts,
        bestAo5: bestAo5Val,
        bestAo12: bestAo12Val,
        hasEnoughForAo5: chrono.length >= 5,
        hasEnoughForAo12: chrono.length >= 12,
        hasPbHistory: pbValues.length > 0,
        maxY: ceiling,
        yTicks: generateYTicks(ceiling),
      };
    }, [solves]);

  if (data.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-line bg-surface px-5 py-4 max-lg:px-4 max-lg:py-3", className)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-3">
            {t("overview.solveProgression")}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[0.6rem] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-chart-pb" />
            PB
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-chart-ao5" />
            Ao5
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-chart-ao12" />
            Ao12
          </span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div className="h-48 w-full sm:h-52 lg:h-65">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          >

            <XAxis
              dataKey="solveIndex"
              tick={{ fontSize: 10, fill: "var(--ink-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--line)", strokeOpacity: 0.25 }}
              interval="preserveStartEnd"
              minTickGap={10}
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


            {/* ── Connecting line between solves (DNFs excluded from data) ── */}
            <Line
              type="linear"
              dataKey="time"
              stroke="var(--ink-3)"
              strokeWidth={1.5}
              strokeOpacity={0.3}
              dot={false}
              activeDot={false}
              connectNulls={false}
              name="connector"
              isAnimationActive={false}
            />

            {/* ── PB history connecting line (dashed, straight between PB points) ── */}
            {hasPbHistory && (
              <Line
                type="linear"
                dataKey="pbHistory"
                stroke="var(--color-chart-pb)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={false}
                connectNulls
                name="pbHistory"
                isAnimationActive={false}
              />
            )}

            {/* ── Ao5 rolling average line ── */}
            {hasEnoughForAo5 && (
              <Line
                type="monotone"
                dataKey="ao5"
                stroke="var(--color-chart-ao5)"
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
                stroke="var(--color-chart-ao12)"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls
                name="ao12"
                isAnimationActive={false}
              />
            )}

            {/* ── PB yellow dots (from chart data, only at PB positions) ── */}
            <Scatter
              dataKey="pbTime"
              fill="var(--color-chart-pb)"
              shape={<PbDotShape />}
              name="pbDots"
              isAnimationActive={false}
            />

            {/* ── Best Ao5 marker dot (red, single point) ── */}
            {hasEnoughForAo5 && (
              <Scatter
                dataKey="bestAo5Time"
                fill="var(--color-chart-ao5)"
                shape={<MarkerDotShape color="var(--color-chart-ao5)" />}
                name="bestAo5"
                isAnimationActive={false}
              />
            )}

            {/* ── Best Ao12 marker dot (green, single point) ── */}
            {hasEnoughForAo12 && (
              <Scatter
                dataKey="bestAo12Time"
                fill="var(--color-chart-ao12)"
                shape={<MarkerDotShape color="var(--color-chart-ao12)" />}
                name="bestAo12"
                isAnimationActive={false}
              />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScatterTooltip({ active, payload }: any) {
  const { t } = useTranslation("insights");
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload as SolveProgressionPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="flex items-baseline gap-2 text-[0.6rem] text-ink-3">
        {t("overview.solveNumber", { number: point.solveIndex })}
        {point.isPb && (
          <span className="rounded bg-chart-pb/15 px-1 py-0.5 text-[0.6rem] font-medium uppercase text-chart-pb">
            PB
          </span>
        )}
      </div>

      <div className="mt-1 text-sm font-medium text-ink">
        {point.timeFormatted}
      </div>

      <div className="mt-1.5 flex flex-col gap-0.5 text-[0.6rem] text-ink-3">
        {point.pbHistory != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-chart-pb" />
            PB {formatTime(point.pbHistory)}
          </span>
        )}
        {point.ao5 != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-2 bg-chart-ao5" />
            Ao5 {formatTime(point.ao5)}
          </span>
        )}
        {point.ao12 != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-2 bg-chart-ao12" />
            Ao12 {formatTime(point.ao12)}
          </span>
        )}
      </div>
    </div>
  );
}
