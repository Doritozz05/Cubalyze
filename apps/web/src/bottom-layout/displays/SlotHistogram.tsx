import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { deriveHistogram } from "@cubeforge/analysis-engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Solve } from "@/types";

interface SlotHistogramProps {
  solves: Solve[];
  className?: string;
}

export function SlotHistogram({ solves, className }: SlotHistogramProps) {
  const { t } = useTranslation("timer");
  const statSolves = useMemo(
    () => solves.map((s) => ({ time: s.time ?? 0, penalty: s.penalty })),
    [solves],
  );
  // Auto bin width: roughly 500ms
  const bins = useMemo(() => deriveHistogram(statSolves, 500), [statSolves]);

  if (bins.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-2 text-xs text-ink-3">
        —
      </div>
    );
  }

  // Display at most 12 central bins to fit comfortably
  const displayBins = bins.slice(0, 12);
  const maxCount = Math.max(...displayBins.map((b) => b.count), 1);

  return (
    <div className={`flex size-full flex-col justify-end min-w-0 ${className ?? ""}`}>
      <div className="flex h-12 w-full items-end gap-1 px-1">
        {displayBins.map((bin, i) => {
          const heightPct = (bin.count / maxCount) * 100;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer">
                  <div
                    className="w-full rounded-t-[2px] bg-ink/70 group-hover:bg-ink transition-all"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {bin.label}s: {t("solvesCount", { count: bin.count, defaultValue: `${bin.count} solves` })}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-[0.55rem] text-ink-3 px-1 pt-1 border-t border-line/40">
        <span>{displayBins[0]?.fromMs ? (displayBins[0].fromMs / 1000).toFixed(1) : ""}s</span>
        <span>
          {t("slotDisplayHistogram", { defaultValue: "Distribution" })} ({bins.reduce((a, b) => a + b.count, 0)})
        </span>
        <span>{displayBins[displayBins.length - 1]?.toMs ? (displayBins[displayBins.length - 1].toMs / 1000).toFixed(1) : ""}s</span>
      </div>
    </div>
  );
}
