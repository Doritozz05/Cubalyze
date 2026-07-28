"use client";

import { Activity } from "lucide-react";

/**
 * High-tech preview card for the TPS Metronome in Widget Explorer.
 */
export function MetronomePreview() {
  const bars = [30, 65, 100, 75, 45, 85, 50, 90, 40, 70, 35];

  return (
    <div className="flex size-full flex-col justify-between p-3 select-none bg-surface-2/40">
      {/* Top Header: Icon & Big Readout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-accent">
          <Activity className="size-3.5 animate-pulse" />
          <span className="text-[11px] font-bold tracking-tight">TPS METRONOME</span>
        </div>
        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent">
          AUDIO
        </span>
      </div>

      {/* Center Readouts */}
      <div className="flex items-baseline justify-between my-1">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-extrabold tracking-tight text-ink">4.5</span>
          <span className="text-[10px] font-semibold text-accent font-mono">TPS</span>
        </div>
        <div className="text-[11px] font-mono text-ink-3">270 BPM</div>
      </div>

      {/* Visual Rhythmic Waveform */}
      <div className="flex h-5 items-end justify-between gap-[2px] px-0.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-full rounded-xs transition-all"
            style={{
              height: `${h}%`,
              backgroundColor: i === 2 || i === 7 ? "var(--color-accent, #4F8CF7)" : "var(--color-ink-3, #6B7280)",
              opacity: i === 2 || i === 7 ? 0.95 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Beat Dots */}
      <div className="flex justify-center gap-1.5 pt-1">
        <div className="size-1.5 rounded-full bg-accent animate-ping" />
        <div className="size-1.5 rounded-full bg-ink/20" />
        <div className="size-1.5 rounded-full bg-ink/20" />
        <div className="size-1.5 rounded-full bg-ink/20" />
      </div>
    </div>
  );
}
