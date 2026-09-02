"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatTime, averageOf } from "@/utils/formatTime";
import { useTranslation } from "react-i18next";
import type { Solve } from "@/types";

export interface TrendChartProps {
  solves: Solve[];
  /** Initial window size for the rolling average (default 5). */
  defaultWindow?: 5 | 12 | 100;
  className?: string;
}

interface Point {
  i: number;
  label: string;
  ao: number | null;
}

const WINDOWS: Array<5 | 12 | 100> = [5, 12, 100];

/**
 * Ao-N trend chart (recharts AreaChart) with a window switcher.
 * Renders the rolling average oldest→newest so progress is visible at a
 * glance. Vertical gradient area fill + horizontal gradient line stroke.
 * DNFs produce gaps. No grid chrome, no axis labels.
 */
export function TrendChart({
  solves,
  defaultWindow = 5,
  className,
}: TrendChartProps) {
  const { t } = useTranslation("insights");
  const [window, setWindow] = useState<5 | 12 | 100>(defaultWindow);

  const { data, bestAo, worstAo } = useMemo(() => {
    const chrono = [...solves].reverse();
    const pts: Point[] = chrono.map((_, idx) => {
      if (idx + 1 < window) {
        return { i: idx, label: String(idx + 1), ao: null };
      }
      // Shared engine: 5% percentile trim (csTimer convention) — an Ao100
      // tolerates up to 5 DNFs, matching the stat tiles from computeStats.
      const win = chrono.slice(idx - window + 1, idx + 1).reverse();
      const ao = averageOf(win, window);
      return {
        i: idx,
        label: String(idx + 1),
        ao: ao != null && Number.isFinite(ao) ? ao : null,
      };
    });

    const finite = pts
      .map((p) => p.ao)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return {
      data: pts,
      bestAo: finite.length ? Math.min(...finite) : null,
      worstAo: finite.length ? Math.max(...finite) : null,
    };
  }, [solves, window]);

  const hasData = bestAo !== null;
  const gradId = `ao-stroke-${window}`;

  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center overflow-hidden rounded-md border border-line">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={cn(
                "nums px-2 py-0.5 text-[0.62rem] transition-colors",
                w !== WINDOWS[0] && "border-l border-line",
                w === window
                  ? "bg-ink text-surface"
                  : "bg-surface text-ink-3 hover:text-ink-2",
              )}
              aria-pressed={w === window}
            >
              Ao{w}
            </button>
          ))}
        </div>
        {hasData ? (
          <span className="nums text-[0.65rem] text-ink-3">
            {formatTime(bestAo as number)} – {formatTime(worstAo as number)}
          </span>
        ) : null}
      </div>

      {hasData ? (
        <div className="h-18 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            >
              <defs>

                <linearGradient id={`${gradId}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ready)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--ready)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide domain={["dataMin", "dataMax"]} />
              <YAxis domain={["dataMin - 200", "dataMax + 200"]} hide />

              <Tooltip
                cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
                contentStyle={{
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  background: "var(--glass-bg-dense)",
                  color: "var(--ink)",
                  fontSize: "0.7rem",
                  padding: "4px 8px",
                  boxShadow: "none",
                }}
                itemStyle={{ color: "var(--ink)" }}
                labelFormatter={(l) => t("overview.solveNumber", { number: l })}
                formatter={(v) => [formatTime(Number(v)), `Ao${window}`]}
              />
              <Area
                type="monotone"
                dataKey="ao"
                stroke="var(--ready)"
                fill={`url(#${gradId}-fill)`}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 2.5, fill: "var(--ready)" }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-18 items-center justify-center text-[0.7rem] text-ink-3">
          {t("overview.trendNeedData", { count: window })}
        </div>
      )}
    </div>
  );
}
