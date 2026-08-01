"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface PhaseSkipBadgeProps {
  phaseName: string;
  compact?: boolean;
}

/**
 * Informational skip marker. Radix makes the trigger focusable so the same
 * explanation is available on hover and keyboard focus, not only by color.
 */
export function PhaseSkipBadge({ phaseName, compact = false }: PhaseSkipBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${phaseName} skip. This phase completed without owning any moves.`}
          className={compact
            ? "cursor-help rounded border border-ink-3/25 bg-surface px-1.5 py-0.5 text-[0.55rem] font-semibold text-ink-2 outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50"
            : "cursor-help rounded border border-ink-3/25 bg-surface-2 px-1 py-0.5 text-[0.48rem] font-semibold uppercase tracking-wide text-ink-3 outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50"}
        >
          {compact ? `${phaseName} skip` : "Skip"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <span className="font-medium">{phaseName} skip</span>: this phase completed without owning any execution moves.
        It remains valid in the four-phase breakdown; transition or recognition time, when available, is not silently treated as execution.
      </TooltipContent>
    </Tooltip>
  );
}
