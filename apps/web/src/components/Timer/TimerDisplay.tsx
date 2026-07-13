"use client";

import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import type { TimerState } from "@/types";

export interface TimerDisplayProps {
  state: TimerState;
  /** Time in ms to render. */
  displayTime: number;
  /** Whether a previous solve exists (affects idle hint copy). */
  hasLast: boolean;
}

const STATE_COLOR: Record<TimerState, string> = {
  idle: "text-ink",
  holding: "text-hold",
  ready: "text-ready",
  running: "text-ink",
  stopped: "text-ink",
};

const STATE_SCALE: Record<TimerState, string> = {
  idle: "scale-100",
  holding: "scale-[0.985]",
  ready: "scale-100",
  running: "scale-100",
  stopped: "scale-100",
};

function hintFor(state: TimerState, hasLast: boolean): string {
  switch (state) {
    case "holding":
      return "keep holding";
    case "ready":
      return "release to start";
    case "running":
      return "press to stop";
    case "stopped":
      return "solve saved";
    case "idle":
    default:
      return hasLast ? "hold to start next" : "press & hold to start";
  }
}

function dotColor(state: TimerState): string {
  switch (state) {
    case "holding":
      return "bg-hold";
    case "ready":
      return "bg-ready";
    case "running":
      return "bg-ink-3";
    case "stopped":
      return "bg-ready";
    case "idle":
    default:
      return "bg-ink-3";
  }
}

/**
 * Pure visual timer. Renders the monospaced time + a compact state hint.
 * No interaction logic lives here — see TimerContainer.
 */
export function TimerDisplay({ state, displayTime, hasLast }: TimerDisplayProps) {
  const hint = hintFor(state, hasLast);

  return (
    <div className="flex select-none flex-col items-center justify-center gap-7">
      <div
        className={cn(
          "nums leading-none tracking-tight transition-[color,transform] duration-150 ease-out",
          "text-[clamp(3.75rem,15vw,9.5rem)]",
          STATE_COLOR[state],
          STATE_SCALE[state],
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {formatTime(displayTime)}
      </div>

      <div className="flex items-center gap-2.5 text-ink-3">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full transition-colors duration-150",
            dotColor(state),
          )}
        />
        <span className="nums text-[0.7rem] uppercase tracking-[0.18em]">
          {hint}
        </span>
      </div>
    </div>
  );
}
