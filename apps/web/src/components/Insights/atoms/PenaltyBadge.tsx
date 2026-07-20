"use client";

import { cn } from "@/lib/utils";
import type { Penalty } from "@/types";

export interface PenaltyBadgeProps {
  penalty: Penalty;
  className?: string;
}

/**
 * Unified penalty chip. Renders nothing for `none` (no chip = no penalty,
 * replacing the old confusing "OK" label). `+2` → ochre, `DNF` → red.
 *
 * Replaces the duplicated `PenaltyBadge` helpers that existed in both
 * `TimesList.tsx` and `SolveSidebar.tsx`.
 */
export function PenaltyBadge({ penalty, className }: PenaltyBadgeProps) {
  if (penalty === "none") return null;
  const cls =
    penalty === "DNF" ? "bg-dnf-soft text-dnf" : "bg-plus2-soft text-plus2";
  return (
    <span
      className={cn(
        "nums rounded px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide",
        cls,
        className,
      )}
    >
      {penalty}
    </span>
  );
}
