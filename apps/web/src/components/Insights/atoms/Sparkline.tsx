"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Color of the line. Defaults to ink-2; pass "ready" for positive trends. */
  color?: "ink" | "ready" | "dnf" | "plus2" | "amber";
  /** Show a filled area under the line (subtle, flat). */
  fill?: boolean;
  /** Show a dot at the last data point. */
  dot?: boolean;
  /** Optional horizontal reference line (e.g. average / PB) at this y-value. */
  reference?: number;
  className?: string;
}

const colorVar: Record<NonNullable<SparklineProps["color"]>, string> = {
  ink: "var(--ink-2)",
  ready: "var(--ready)",
  dnf: "var(--dnf)",
  plus2: "var(--plus2)",
  amber: "var(--caution)",
};

/**
 * Compact inline SVG sparkline. No axes, no grid — just the trend line,
 * an optional area fill, an optional reference line, and a terminal dot.
 * Used in stat tiles and solve-list headers for at-a-glance trends.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "ink",
  fill = false,
  dot = true,
  reference,
  className,
}: SparklineProps) {
  const { points, areaPath, refY, lastX, lastY } = useMemo(() => {
    if (data.length < 2) {
      return {
        points: "",
        areaPath: "",
        refY: null as number | null,
        lastX: 0,
        lastY: 0,
      };
    }
    // For solve times, lower is better → invert so improvement trends upward.
    // We keep it simple: just map min..max to height..0.
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const coords = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return [x, y] as const;
    });

    const pts = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${coords
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ")} L${width},${height} L0,${height} Z`;

    let rY: number | null = null;
    if (reference != null) {
      rY = height - ((reference - min) / range) * height;
      rY = Math.max(0, Math.min(height, rY));
    }

    const [lx, ly] = coords[coords.length - 1];

    return { points: pts, areaPath: area, refY: rY, lastX: lx, lastY: ly };
  }, [data, width, height, reference]);

  const stroke = colorVar[color];

  if (data.length < 2) {
    return (
      <span
        className={cn("inline-block", className)}
        style={{ width, height }}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block overflow-visible", className)}
      preserveAspectRatio="none"
    >
      {fill ? (
        <path d={areaPath} fill={`url(#sf-${color})`} />
      ) : null}
      <defs>
        <linearGradient id={`sf-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.15} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {refY != null ? (
        <line
          x1={0}
          y1={refY}
          x2={width}
          y2={refY}
          stroke="var(--line-2)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dot ? (
        <circle
          cx={lastX}
          cy={lastY}
          r={2}
          fill={stroke}
        />
      ) : null}
    </svg>
  );
}
