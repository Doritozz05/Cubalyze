"use client";

import type { LucideIcon } from "lucide-react";

export interface StatChipProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

/**
 * Compact stat chip used in session stats panels.
 * Used by: AlgorithmDrillView, PhaseTrainerView.
 */
export function StatChip({ icon: Icon, label, value }: StatChipProps) {
  return (
    // Touch: slightly larger chips for readable thumb-sized stat tiles.
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-2 max-lg:p-2.5">
      <span className="flex items-center gap-1 text-[0.55rem] text-ink-3 max-lg:text-[0.58rem]">
        <Icon className="size-2.5 max-lg:size-3" />
        {label}
      </span>
      <span className="nums text-[0.75rem] font-semibold text-ink max-lg:text-[0.85rem]">
        {value}
      </span>
    </div>
  );
}
