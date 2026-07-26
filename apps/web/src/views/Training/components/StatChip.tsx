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
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-surface-2">
      <span className="flex items-center gap-1 text-[0.55rem] text-ink-3">
        <Icon className="size-2.5" />
        {label}
      </span>
      <span className="nums text-[0.75rem] font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}
