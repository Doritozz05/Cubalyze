import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { derivePhaseDistribution } from "@cubeforge/analysis-engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Solve } from "@/types";

interface SlotPhaseDistributionProps {
  solves: Solve[];
  className?: string;
}

const PHASE_COLORS: Record<string, string> = {
  Cross: "#3b82f6", // Blue
  F2L: "#10b981",   // Green
  OLL: "#f59e0b",   // Amber
  PLL: "#ef4444",   // Red
  FB: "#3b82f6",
  SB: "#10b981",
  CMLL: "#f59e0b",
  LSE: "#ef4444",
};

export function SlotPhaseDistribution({ solves, className }: SlotPhaseDistributionProps) {
  const { t } = useTranslation("timer");
  const shares = useMemo(() => derivePhaseDistribution(solves), [solves]);

  if (shares.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-2 text-xs text-ink-3">
        {t("noPhaseData", { defaultValue: "No CFOP phase data" })}
      </div>
    );
  }

  return (
    <div className={`flex size-full flex-col justify-center min-w-0 ${className ?? ""}`}>
      {/* Stacked bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-md border border-line bg-surface-2/40">
        {shares.map((p) => {
          const pct = (p.share * 100).toFixed(1);
          const color = PHASE_COLORS[p.phaseName] ?? "#64748b";
          return (
            <Tooltip key={p.phaseName}>
              <TooltipTrigger asChild>
                <div
                  style={{ width: `${p.share * 100}%`, backgroundColor: color }}
                  className="h-full transition-all cursor-pointer"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {p.phaseName}: {pct}% ({(p.avgDurationMs / 1000).toFixed(2)}s, {p.avgMoveCount.toFixed(1)}m)
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[0.62rem]">
        {shares.map((p) => {
          const color = PHASE_COLORS[p.phaseName] ?? "#64748b";
          return (
            <div key={p.phaseName} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-medium text-ink">{p.phaseName}</span>
              <span className="text-ink-3 font-mono">{(p.share * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
