"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { TimerDisplay } from "./TimerDisplay";
import { PbCelebrationBanner } from "./PbCelebrationBanner";
import type { PbMilestoneResult } from "@/utils/pbDetection";
import type { TimerState } from "@/types";
import type { HintContext } from "./hintFor";

export interface TimerContainerProps {
  /** Current phase from the engine. */
  phase: TimerState;
  /** Live elapsed time in ms (0 when idle). */
  time: number;
  /** Last finalized time. null until first solve. */
  lastTime: number | null;
  /** Personal best time in ms. null if no solves yet. */
  pb?: number | null;
  /** Show PB delta indicator next to timer. */
  showPbDelta?: boolean;
  /** Active PB milestone result to celebrate (if any). */
  pbMilestone?: PbMilestoneResult | null;
  /** Callback to clear PB milestone state on dismissal. */
  onDismissPbBanner?: () => void;
  /** Hint context required by `TimerDisplay`. */
  hintCtx: HintContext;
  /** Trigger the smart press logic. */
  onPress: () => void;
  /** Trigger the smart release logic. */
  onRelease: () => void;
  /** Ref populated with the timer's current state (for shortcut gating). */
  stateRef?: React.MutableRefObject<TimerState>;
  /** Ref populated with a cancel function (used by the Esc shortcut). */
  cancelRef?: React.MutableRefObject<(() => void) | null>;
  /** Optional explicit cancel handler. */
  onCancel?: () => void;
  /** Optional className override for the time display text size. */
  timerClassName?: string;
  /** When true, clicking the timer area toggles start/stop like spacebar. */
  clickToStart?: boolean;
  /** Hold delay in ms (used to time the auto-release after click in clickToStart mode). */
  holdDelay?: number;
  className?: string;
}

/**
 * Interaction surface for the timer. Presentational — all state comes
 * from `useSolveSession`. Wires pointer/touch events and keyboard
 * fallback via the parent-provided press/release.
 */
export function TimerContainer({
  phase,
  time,
  lastTime,
  pb,
  showPbDelta,
  pbMilestone,
  onDismissPbBanner,
  hintCtx,
  onPress,
  onRelease,
  stateRef,
  cancelRef,
  onCancel,
  timerClassName,
  clickToStart = false,
  holdDelay = 300,
  className,
}: TimerContainerProps) {
  // Expose the timer phase + cancel to the parent (for shortcut gating) via
  // refs so the parent doesn't re-render on every animation frame.
  useEffect(() => {
    if (stateRef) stateRef.current = phase;
  }, [phase, stateRef]);
  useEffect(() => {
    if (!cancelRef) return;
    cancelRef.current = () => {
      onCancel?.();
    };
    return () => {
      if (cancelRef) cancelRef.current = null;
    };
  }, [onCancel, cancelRef]);

  const displayTime = useMemo(() => {
    if (phase === "idle") return lastTime ?? 0;
    if (phase === "holding" || phase === "ready" || phase === "ready_for_move") {
      return 0;
    }
    return time;
  }, [phase, time, lastTime]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!clickToStart) return; // Only respond to pointer when clickToStart is ON
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      onPress();
    },
    [onPress, clickToStart],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!clickToStart) return; // Only respond to pointer when clickToStart is ON
      e.preventDefault();
      onRelease();
    },
    [onRelease, clickToStart],
  );

  // Click-to-start: a single click toggles the timer (start/stop like spacebar)
  const onClick = useCallback(() => {
    if (!clickToStart) return;
    if (phase === "idle" || phase === "stopped") {
      // Simulate a full press-hold-release cycle
      onPress();
      // Wait for the hold delay to pass so engine transitions to READY, then release
      const effectiveDelay = holdDelay > 0 ? holdDelay + 50 : 50;
      setTimeout(() => onRelease(), effectiveDelay);
    } else if (phase === "running") {
      onPress(); // stops the timer
    }
  }, [clickToStart, phase, onPress, onRelease, holdDelay]);

  // Ref to read latest phase in event handlers (avoids stale closure at render time)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const hasPbActive = pbMilestone != null && pbMilestone.types.length > 0 && (phase === "stopped" || phase === "idle");

  return (
    <div
      role="button"
      tabIndex={clickToStart ? 0 : -1}
      aria-label={clickToStart ? "Timer. Click to start/stop." : "Timer. Use spacebar to start/stop."}
      onPointerDown={clickToStart ? onPointerDown : undefined}
      onPointerUp={clickToStart ? onPointerUp : undefined}
      onClick={clickToStart ? onClick : undefined}
      onPointerLeave={
        clickToStart
          ? (e: React.PointerEvent) => {
              if (e.buttons === 0) return;
              if (phaseRef.current === "idle" || phaseRef.current === "stopped") return;
              onRelease();
            }
          : undefined
      }
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative flex min-h-[clamp(280px,42vh,460px)] w-full flex-col items-center justify-center rounded-lg transition-all duration-300",
        !clickToStart && "cursor-default",
        clickToStart && "cursor-pointer",
        "outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {/* Subtle arming halo or PB celebration halo. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg transition-all duration-300",
          phase === "ready" && "bg-ready-soft/60",
          phase === "holding" && "bg-hold-soft/40",
          phase === "ready_for_move" && "bg-ready-soft/40",
          phase === "inspection" && "bg-caution-soft/30",
        )}
      />

      {/* Floating PB Victory Banner */}
      {hasPbActive && (
        <div className="absolute top-4 z-20 w-full max-w-sm px-4">
          <PbCelebrationBanner
            types={pbMilestone.types}
            singleTime={pbMilestone.singleTime}
            ao5Time={pbMilestone.ao5Time}
            ao12Time={pbMilestone.ao12Time}
            prevSingleTime={pbMilestone.prevSingleTime}
            prevAo5Time={pbMilestone.prevAo5Time}
            prevAo12Time={pbMilestone.prevAo12Time}
            onClose={onDismissPbBanner}
          />
        </div>
      )}

      <TimerDisplay
        state={phase}
        displayTime={displayTime}
        hasLast={lastTime !== null}
        pb={pb}
        showPbDelta={showPbDelta}
        hintCtx={hintCtx}
        className={timerClassName}
      />
    </div>
  );
}
