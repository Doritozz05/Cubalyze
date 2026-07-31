"use client";

import { useCallback, useEffect, useMemo } from "react";
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
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      onPress();
    },
    [onPress],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onRelease();
    },
    [onRelease],
  );

  const hasPbActive = pbMilestone != null && pbMilestone.types.length > 0 && (phase === "stopped" || phase === "idle");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Timer. Hold to start, press to stop."
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        if (e.buttons === 0) return;
        onRelease();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative flex min-h-[clamp(280px,42vh,460px)] w-full cursor-pointer active:cursor-grabbing flex-col items-center justify-center rounded-lg transition-all duration-300",
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
