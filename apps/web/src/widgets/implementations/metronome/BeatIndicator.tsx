"use client";

import { cn } from "@/lib/utils";

export interface BeatIndicatorProps {
  beatsPerBar: number;
  currentBeat: number;
  isPlaying: boolean;
  className?: string;
}

/**
 * Visual beat indicator dots with accent highlights.
 */
export function BeatIndicator({
  beatsPerBar,
  currentBeat,
  isPlaying,
  className,
}: BeatIndicatorProps) {
  return (
    <div className={cn("flex justify-center gap-2 py-0.5", className)}>
      {Array.from({ length: beatsPerBar }).map((_, idx) => {
        const isActive = isPlaying && currentBeat === idx;
        const isFirst = idx === 0 && beatsPerBar > 1;

        return (
          <div
            key={idx}
            className={cn(
              "size-3 rounded-full transition-all duration-100 border",
              isActive
                ? isFirst
                  ? "bg-accent border-accent scale-125 shadow-md shadow-accent/40"
                  : "bg-emerald-500 border-emerald-500 scale-110"
                : "bg-surface-3 border-line opacity-40",
            )}
          />
        );
      })}
    </div>
  );
}
