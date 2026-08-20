import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
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
  /** Personal best time in ms. null if no solves yet. */
  pb?: number | null;
  /** Show PB delta indicator next to timer. */
  showPbDelta?: boolean;
  /** Context required to compute the hint. */
  hintCtx: HintContext;
  /** Optional className override for the time display text size. */
  className?: string;
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
  pb,
  showPbDelta = false,
  hintCtx,
  className,
}: TimerDisplayProps) {
  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const showHints = useStore(preferencesStore, (s) => s.showHints);
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
  } else if ((state === "idle" || state === "stopped") && hasLast && displayTime > 0) {
    if (hintCtx?.isLastSolveDnf) {
      formattedTime = "DNF";
    } else if (hintCtx?.lastSolvePenalty === "+2") {
      formattedTime = `${formatTime(displayTime, timePrecision)}+`;
    } else {
      formattedTime = formatTime(displayTime, timePrecision);
    }
  } else {
    formattedTime = formatTime(displayTime, timePrecision);
  }

  const isDnf = formattedTime === "DNF";
  const textColor = isDnf ? "text-dnf" : STATE_COLOR[state];

  // Compute PB delta when stopped (brief) or idle (shows last solve time)
  // and there's a PB. In "idle" the timer displays `lastTime` via TimerContainer,
  // so the delta should remain visible until the next solve begins.
  const canShowDelta = state === "stopped" || (state === "idle" && hasLast);
  const deltaMs =
    showPbDelta && canShowDelta && pb != null && displayTime > 0 && Number.isFinite(pb)
      ? displayTime - pb
      : null;

  return (
    <div className="flex select-none flex-col items-center justify-center gap-7">
      <div className="flex items-baseline justify-center gap-3">
        <div
          className={cn(
            "nums leading-none tracking-tight transition-[color,transform] duration-150 ease-out",
            // Cap the time by viewport HEIGHT too (not just width): on wide
            // but short landscape tablets the old 15vw-only clamp produced a
            // ~152px digit that, together with the min-height floor, pushed
            // the session layout out of the clipped section.
            // `/none` keeps line-height 1 (tailwind-merge would otherwise
            // drop a separate `leading-none` next to a `text-*` size), so the
            // digit box is exactly the glyph height and never inflates the
            // stage on short viewports.
            className ?? "text-[clamp(3rem,min(15vw,18vh),9.5rem)]/none",
            textColor,
            STATE_SCALE[state],
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {formattedTime}
        </div>
        {deltaMs != null && (
          <span
            className={cn(
              "nums text-[clamp(1rem,3vw,1.8rem)] font-medium leading-none",
              deltaMs <= 0 ? "text-ready" : "text-dnf",
            )}
          >
            {deltaMs <= 0 ? "\u2212" : "+"}{formatTime(Math.abs(deltaMs))}
          </span>
        )}
      </div>

      {showHints && hint && (
        <div className="flex items-center justify-center text-ink-3">
          <span className="nums text-[0.7rem] uppercase tracking-[0.18em]">
            {hint}
          </span>
        </div>
      )}
    </div>
  );
}
