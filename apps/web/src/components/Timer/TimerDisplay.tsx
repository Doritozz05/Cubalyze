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
  inspection: "text-caution",
  // Post-inspection, scramble verified, waiting for first face move.
  // Neutral ink-2 keeps it visually distinct from `ready` (green) and
  // `holding` (warm) without introducing a brand-new hue.
  ready_for_move: "text-ink-2",
  holding: "text-hold",
  ready: "text-ready",
  running: "text-ink",
  stopped: "text-ink",
};

const STATE_SCALE: Record<TimerState, string> = {
  idle: "scale-100",
  inspection: "scale-100",
  ready_for_move: "scale-100",
  holding: "scale-[0.985]",
  ready: "scale-100",
  running: "scale-100",
  stopped: "scale-100",
};

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

  const isDnf = formattedTime === "DNF";
  const textColor = isDnf ? "text-dnf" : STATE_COLOR[state];

  return (
    <div className="flex select-none flex-col items-center justify-center gap-7">
      <div
        className={cn(
          "nums leading-none tracking-tight transition-[color,transform] duration-150 ease-out",
          "text-[clamp(3.75rem,15vw,9.5rem)]",
          textColor,
          STATE_SCALE[state],
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {formattedTime}
      </div>

      <div className="flex items-center justify-center text-ink-3">
        <span className="nums text-[0.7rem] uppercase tracking-[0.18em]">
          {hint}
        </span>
      </div>
    </div>
  );
}
