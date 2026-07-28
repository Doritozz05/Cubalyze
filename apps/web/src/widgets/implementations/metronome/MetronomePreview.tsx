"use client";

import { Activity } from "lucide-react";

/**
 * Clean, minimal preview card for the TPS Metronome in Widget Explorer.
 * Designed to fit inside the size-16 / size-18 preview thumbnail.
 */
export function MetronomePreview() {
  const bars = [35, 60, 95, 70, 40, 85, 50, 90, 45, 65];

  return (
    <div className="flex size-full flex-col justify-between p-1.5 select-none bg-surface">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-ink">
          <Activity className="size-2.5 text-ink-3" />
          <span className="text-[8px] font-semibold tracking-tight uppercase">BPM</span>
        </div>
        <span className="rounded bg-surface-2 border border-line px-0.5 font-mono text-[7px] font-medium text-ink-3">
          TPS
        </span>
      </div>

      {/* Center Readouts */}
      <div className="flex items-baseline justify-between my-0.5">
        <div className="flex items-baseline gap-0.5">
          <span className="font-mono text-xs font-bold tracking-tight text-ink">4.0</span>
          <span className="text-[7px] font-semibold text-ink-3 font-mono">TPS</span>
        </div>
        <div className="text-[8px] font-mono text-ink-3">240</div>
      </div>

      {/* Visual Rhythmic Waveform */}
      <div className="flex h-3 items-end justify-between gap-px">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-full rounded-xs"
            style={{
              height: `${h}%`,
              backgroundColor: i === 2 || i === 7 ? "var(--color-ink, #000)" : "var(--color-line, #e5e7eb)",
              opacity: i === 2 || i === 7 ? 0.9 : 0.6,
            }}
          />
        ))}
      </div>

      {/* Beat Dots */}
      <div className="flex justify-center gap-0.5 pt-0.5">
        <div className="size-0.5 rounded-full bg-ink" />
        <div className="size-0.5 rounded-full bg-line" />
        <div className="size-0.5 rounded-full bg-line" />
        <div className="size-0.5 rounded-full bg-line" />
      </div>
    </div>
  );
}


