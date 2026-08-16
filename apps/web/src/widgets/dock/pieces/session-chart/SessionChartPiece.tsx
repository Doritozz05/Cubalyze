"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computeStats, formatTime } from "@/utils/formatTime";
import { effectiveTime } from "@/types";
import type { Solve } from "@/types";

/** How many recent solves feed the sparkline (chronological, oldest→newest). */
const MAX_POINTS = 24;
const W = 64;
const H = 20;
const PAD = 2;

/** Dock piece — a tiny inline sparkline of the session's recent times.
 *  Minimalist: a single SVG polyline with a faint area fill; no axes, no
 *  labels. Falls back to a muted trend icon when there are fewer than 2
 *  valid solves. */
export function SessionChartPiece({ solves }: { solves: Solve[] }) {
  const { t } = useTranslation("stats");

  const chart = useMemo(() => {
    // `solves` is newest-first; take the last N and reverse to chronological.
    const recent = solves.slice(0, MAX_POINTS).reverse();
    const times = recent
      .map((s) => effectiveTime(s))
      .filter((t) => Number.isFinite(t));

    if (times.length < 2) return { hasData: false as const };

    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = max - min || 1;

    const pts = times.map((tm, i) => {
      const x = PAD + (i / (times.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((tm - min) / span) * (H - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const line = pts.join(" ");
    const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;
    return { hasData: true as const, line, area };
  }, [solves]);

  const stats = useMemo(() => computeStats(solves), [solves]);

  const tooltip =
    stats.total === 0
      ? t("noSolvesYet")
      : `${t("best")} ${stats.best !== null ? formatTime(stats.best) : "—"} · ${t("mean")} ${
          stats.mean !== null ? formatTime(stats.mean) : "—"
        }`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-8 shrink-0 cursor-default select-none items-center gap-1.5 rounded-full px-2.5 py-0 transition-colors hover:bg-surface-2">
          {chart.hasData ? (
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              aria-hidden
              className="shrink-0 overflow-visible"
            >
              <polygon
                points={chart.area}
                fill="var(--color-chart-1)"
                fillOpacity="0.12"
              />
              <polyline
                points={chart.line}
                fill="none"
                stroke="var(--color-chart-1)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <TrendingUp className="size-3.5 shrink-0 text-ink-3" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
