"use client";

import { cn } from "@/lib/utils";

export type MetricTileAccent = "ready" | "amber" | "plus2" | "dnf" | "ink";

/**
 * Single metric tile used inside a 2-col / 4-col tile grid (declared as
 * `grid-cols-N gap-px border border-line bg-line`).
 */
export function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: MetricTileAccent;
}) {
  const accentClass =
    accent === "ready"
      ? "text-ready"
      : accent === "amber"
        ? "text-amber-400"
        : accent === "plus2"
          ? "text-plus2"
          : accent === "dnf"
            ? "text-dnf"
            : "text-ink";
  const useDefaultInk = !accent;
  return (
    <div className="flex flex-col gap-1 bg-surface px-3.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className={cn("nums text-lg", useDefaultInk ? "text-ink" : accentClass)}>
        {value}
      </span>
      {sub ? (
        <span className="nums text-[0.65rem] text-ink-3">{sub}</span>
      ) : null}
    </div>
  );
}
