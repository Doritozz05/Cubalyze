"use client";

import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import type { TimerState } from "@/types";
import { hintFor, type HintContext } from "./hintFor";

export interface TimerDisplayProps {
  state: TimerState;
  /** Time in ms to render. */
  displayTime: number;
  /** Whether a previous solve exists (affects idle hint copy). */
  hasLast: boolean;
  /** Context required to compute the hint. */
  hintCtx: HintContext;
}

const STATE_COLOR: Record<TimerState, string> = {
  idle: "text-ink",
  inspection: "text-red-500",
  armed: "text-blue-500",
  holding: "text-hold",
  ready: "text-ready",
  running: "text-ink",
  stopped: "text-ink",
};

const STATE_SCALE: Record<TimerState, string> = {
  idle: "scale-100",
  inspection: "scale-100",
  armed: "scale-100",
  holding: "scale-[0.985]",
  ready: "scale-100",
  running: "scale-100",
  stopped: "scale-100",
};

function dotColor(state: TimerState): string {
  switch (state) {
    case "inspection":
      return "bg-red-500";
    case "armed":
      return "bg-blue-500";
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
 * Pure visual timer. Renders the monospaced time + a context-aware hint.
 * No interaction logic lives here — see TimerContainer.
 */
export function TimerDisplay({
  state,
  displayTime,
  hasLast,
  hintCtx,
}: TimerDisplayProps) {
  const hint = hintFor(state, hasLast, hintCtx);

  let formattedTime = "";
  if (state === "inspection") {
    const elapsedSecs = Math.floor(displayTime / 1000);
    const remaining = 15 - elapsedSecs;
    if (remaining > 0) {
      formattedTime = String(remaining);
    } else if (remaining > -2) {
      formattedTime = "+2";
    } else {
      formattedTime = "DNF";
    }
  } else {
    formattedTime = formatTime(displayTime);
  }

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
        {formattedTime}
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
