"use client";

import { cn } from "@/lib/utils";

export type RingColor = "ready" | "amber" | "ink" | "dnf" | "plus2";

export interface MetricRingProps {
  /** Current value (will be clamped to [0, max]). */
  value: number;
  /** Value that represents 100% of the ring. */
  max: number;
  /** Label rendered inside the ring (usually the value itself). */
  label: string;
  /** Sub-label rendered below the main label, smaller. */
  sub?: string;
  size?: number;
  strokeWidth?: number;
  color?: RingColor;
  /**
   * Arbitrary hex/CSS color for the arc stroke. When provided, overrides
   * `color`. Useful for phase-distribution rings where each phase has its
   * own semantic color (see `phaseColorHex`).
   */
  strokeColor?: string;
  className?: string;
}

const colorVar: Record<RingColor, string> = {
  ready: "var(--ready)",
  amber: "var(--caution)",
  ink: "var(--ink-2)",
  dnf: "var(--dnf)",
  plus2: "var(--plus2)",
};

/**
 * Circular SVG progress ring. Flat — no glow, no gradient. The arc fills
 * clockwise from 12 o'clock. Used for TPS / Pauses / Rotations / Efficiency
 * summary metrics in the analysis view.
 */
export function MetricRing({
  value,
  max,
  label,
  sub,
  size = 72,
  strokeWidth = 5,
  color = "ink",
  strokeColor,
  className,
}: MetricRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  // Arc starts at 12 o'clock: rotate -90deg via the group transform.
  const dashOffset = circumference * (1 - pct);
  const stroke = strokeColor ?? colorVar[color];
  const trackStroke = "var(--line)";

  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      style={{ width: size }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackStroke}
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="nums text-sm font-medium text-ink">{label}</span>
          {sub ? (
            <span className="text-[0.55rem] uppercase tracking-wide text-ink-3">
              {sub}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
