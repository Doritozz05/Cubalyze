"use client";

import { cn } from "@/lib/utils";

/**
 * Green positive-flag chip. Used for OLL/PLL "skipped" phases in both the
 * reconstruction panel and the insights panel. The label is kept lowercase
 * by convention (the chip is uppercase-tracked).
 */
export function SkippedBadge({
  label = "skipped",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded border border-ready/40 bg-ready/10 px-1 py-0.5 text-[0.54rem] font-semibold uppercase tracking-wide text-ready",
        className,
      )}
    >
      {label}
    </span>
  );
}
