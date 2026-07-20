"use client";

import { formatTime } from "@/utils/formatTime";

/**
 * Single phase row in the analysis phase breakdown list. Compact
 * label / move count / time / tps with optional pause annotation.
 */
export function PhaseRow({
  name,
  time,
  moves,
  tps,
  pauseBeforeMs,
}: {
  name: string;
  time: number;
  moves: number;
  tps: number;
  pauseBeforeMs?: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-sm border-b border-line/50 last:border-0">
      <span className="font-medium text-ink-2 text-xs uppercase tracking-wide">
        {name}
      </span>
      <div className="flex items-center gap-3 nums text-xs text-ink-3">
        <span>{moves}m</span>
        {time > 0 ? (
          <>
            <span>{formatTime(time)}</span>
            <span className="text-ink font-medium">{tps.toFixed(1)} tps</span>
          </>
        ) : (
          <span className="text-ink-3/50">—</span>
        )}
        {pauseBeforeMs != null && pauseBeforeMs > 50 ? (
          <span className="text-amber-400/70">+{formatTime(pauseBeforeMs)}</span>
        ) : null}
      </div>
    </div>
  );
}
