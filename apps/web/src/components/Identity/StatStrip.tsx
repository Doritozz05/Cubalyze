"use client";

import { MetricTile, type MetricTileAccent } from "@/components/Stats/atoms/MetricTile";
import { statLabel } from "@/utils/formatTime";
import type { ProfileStats } from "@/hooks/useProfileStats";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatStripProps {
  stats: ProfileStats | null;
  loading?: boolean;
  /** Puzzle key to show KPIs for (defaults to the largest by count). */
  puzzle?: string;
  className?: string;
}

function fmt(value: number | null): string {
  return statLabel(value);
}

/**
 * B2 — Stat strip (docs/plan_profile): 5 KPIs from REAL data for the given
 * puzzle (defaults to the user's most-used puzzle). Values use the `nums`
 * tabular class; DNF/missing renders as "—" (never 0.00).
 */
export function StatStrip({ stats, loading, puzzle, className }: StatStripProps) {
  if (loading || !stats) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5",
          className,
        )}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface px-3.5 py-3">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const target =
    stats.byPuzzle.find((p) => p.puzzle === puzzle) ??
    stats.byPuzzle[0] ??
    null;

  const tiles: Array<{ label: string; value: string; sub?: string; accent?: MetricTileAccent }> =
    target
      ? [
          {
            label: "PB single",
            value: fmt(target.stats.best),
            sub: target.count > 0 ? `best in ${target.puzzle}` : undefined,
            accent: "ready",
          },
          { label: "Ao5", value: fmt(target.stats.ao5) },
          { label: "Ao12", value: fmt(target.stats.ao12) },
          {
            label: "Solves",
            value: `${target.count}`,
            sub: target.stats.total > 0 ? `${target.stats.total} total` : undefined,
          },
          {
            label: "Streak",
            value: `${stats.streakDays}d`,
            sub: stats.streakDays === 1 ? "day" : "days",
            accent: stats.streakDays > 0 ? "ready" : "ink",
          },
        ]
      : [
          { label: "PB single", value: "—" },
          { label: "Ao5", value: "—" },
          { label: "Ao12", value: "—" },
          { label: "Solves", value: "—" },
          { label: "Streak", value: "0d" },
        ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5",
        className,
      )}
    >
      {tiles.map((tile) => (
        <MetricTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          sub={tile.sub}
          accent={tile.accent}
        />
      ))}
    </div>
  );
}
