import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { deriveActivityHeatmap } from "@cubalyze/analysis-engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Solve } from "@/types";

interface SlotActivityHeatmapProps {
  solves: Solve[];
  className?: string;
}

export function SlotActivityHeatmap({ solves, className }: SlotActivityHeatmapProps) {
  const { t } = useTranslation("timer");
  const distribSolves = useMemo(
    () =>
      solves.map((s) => ({
        time: s.time ?? 0,
        penalty: s.penalty,
        timestamp: s.timestamp ?? Date.now(),
      })),
    [solves],
  );

  // 12 weeks of activity (84 days)
  const days = useMemo(() => deriveActivityHeatmap(distribSolves, 12), [distribSolves]);
  const maxSolves = Math.max(...days, 1);

  return (
    <div className={`flex size-full flex-col justify-center min-w-0 ${className ?? ""}`}>
      <div className="flex items-center justify-between text-[0.6rem] text-ink-3 pb-1">
        <span>{t("activity12Weeks", { defaultValue: "Activity (12 weeks)" })}</span>
        <span>{t("solvesCountShort", { count: solves.length, defaultValue: `${solves.length} solves` })}</span>
      </div>
      {/* 12 columns x 7 rows grid */}
      <div className="grid grid-flow-col grid-rows-7 gap-0.5 h-11 w-full overflow-hidden">
        {days.map((count, i) => {
          const intensity = count === 0 ? 0 : Math.min(1, 0.25 + (count / maxSolves) * 0.75);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="rounded-[1.5px] bg-ink/10 transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      intensity > 0
                        ? `color-mix(in srgb, var(--color-ink, currentColor) ${intensity * 100}%, transparent)`
                        : undefined,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t("solvesCountShort", { count, defaultValue: `${count} solves` })}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
