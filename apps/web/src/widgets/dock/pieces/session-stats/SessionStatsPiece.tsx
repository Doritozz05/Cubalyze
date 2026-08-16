"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computeStats, statLabel } from "@/utils/formatTime";
import type { Solve } from "@/types";

/** Dock piece — the live session numbers (Ao5, Ao12, best, mean) as a single
 *  flat pill, macOS-menu-bar style: tiny uppercase labels + tabular numerals.
 *  Always visible from any view; the full set repeats in the tooltip. */
export function SessionStatsPiece({ solves }: { solves: Solve[] }) {
  const { t } = useTranslation("stats");
  const stats = useMemo(() => computeStats(solves), [solves]);

  const cells = useMemo(
    () => [
      { label: "Ao5", value: statLabel(stats.ao5) },
      { label: "Ao12", value: statLabel(stats.ao12) },
      { label: t("best"), value: statLabel(stats.best) },
      { label: t("mean"), value: statLabel(stats.mean) },
    ],
    [stats.ao5, stats.ao12, stats.best, stats.mean, t],
  );

  // No data → a single muted dash keeps the pill quiet instead of a row of "—".
  const empty = stats.total === 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-8 cursor-default select-none items-center gap-2 rounded-full px-2.5 py-0 text-xs leading-none text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
          <Activity className="size-3.5 shrink-0 text-ink-3" />
          {empty ? (
            <span className="nums tabular-nums font-medium text-ink-3">—</span>
          ) : (
            cells.map((c, i) => (
              <span key={c.label} className="flex items-baseline gap-1 whitespace-nowrap">
                {i > 0 && <span aria-hidden className="text-ink-3/40">·</span>}
                <span className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {c.label}
                </span>
                <span className="nums tabular-nums font-medium text-ink">{c.value}</span>
              </span>
            ))
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {cells.map((c) => `${c.label} ${c.value}`).join(" · ")}
      </TooltipContent>
    </Tooltip>
  );
}
