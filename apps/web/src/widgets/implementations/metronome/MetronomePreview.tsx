"use client";

/**
 * Clean, minimal preview card for the TPS Metronome in Widget Explorer.
 * Designed to fit cleanly inside preview tiles without text overflow.
 */
export function MetronomePreview() {
  const bars = [35, 60, 95, 70, 40, 85, 50, 90, 45, 65];

  return (
    <div className="flex size-full flex-col justify-between p-2 select-none bg-surface border border-line rounded">
      {/* TPS & BPM Readout */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-ink">4.0 TPS</span>
        <span className="font-mono text-[0.62rem] font-semibold text-ink-3">240 BPM</span>
      </div>

      {/* Rhythmic Waveform */}
      <div className="flex h-5 items-end justify-between gap-0.5 my-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-full rounded-xs"
            style={{
              height: `${h}%`,
              backgroundColor: i === 2 || i === 7 ? "var(--color-ink)" : "var(--color-line)",
              opacity: i === 2 || i === 7 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Pulse Status */}
      <div className="flex items-center justify-end text-[8px] text-ink-3">
        <div className="flex gap-1">
          <div className="size-1 rounded-full bg-ink" />
          <div className="size-1 rounded-full bg-line" />
          <div className="size-1 rounded-full bg-line" />
          <div className="size-1 rounded-full bg-line" />
        </div>
      </div>
    </div>
  );
}
