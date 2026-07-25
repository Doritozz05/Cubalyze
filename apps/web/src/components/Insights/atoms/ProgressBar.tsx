"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ProgressBarColor = "ready" | "amber" | "ink" | "dnf" | "plus2";

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  color?: ProgressBarColor;
  className?: string;
}

const colorMap: Record<ProgressBarColor, string> = {
  ready: "bg-ready",
  amber: "bg-caution",
  ink: "bg-ink",
  dnf: "bg-dnf",
  plus2: "bg-plus2",
};

const sizeMap: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2",
};

/**
 * Flat progress bar with a spring-animated fill. Label and percentage
 * appear above the bar when requested.
 */
export function ProgressBar({
  value,
  max,
  label,
  showValue,
  size = "md",
  color = "ink",
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between text-[0.62rem] text-ink-3">
          {label ? (
            <span className="uppercase tracking-[0.16em]">{label}</span>
          ) : null}
          {showValue ? (
            <span className="nums text-ink-2">{Math.round(pct)}%</span>
          ) : null}
        </div>
      ) : null}
      <div className={cn("w-full overflow-hidden rounded-full bg-line", sizeMap[size])}>
        <motion.div
          className={cn("h-full rounded-full", colorMap[color])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
}
