"use client";

import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTimerUI } from "@/hooks/useTimerUI";
import { TimerDisplay } from "./TimerDisplay";

export interface TimerContainerProps {
  /** Called with the raw solve time (ms) the instant the timer stops. */
  onComplete: (time: number, penalty: "none" | "+2" | "DNF") => void;
  /** Ref populated with the timer's current state (for shortcut gating). */
  stateRef?: React.MutableRefObject<string>;
  /** Ref populated with a cancel function (used by the Esc shortcut). */
  cancelRef?: React.MutableRefObject<(() => void) | null>;
  /** Whether the cube is correctly scrambled and ready for solving. */
  isScrambled?: boolean;
  className?: string;
}

/**
 * Interaction surface for the timer. Wires the `useTimerUI` state machine
 * to both keyboard (Space, handled in the hook) and pointer/touch events.
 * Also exposes its `cancel` + live `state` via refs so a parent can gate
 * global shortcuts (e.g. don't fire "new scramble" while the timer runs).
 */
export function TimerContainer({
  onComplete,
  stateRef,
  cancelRef,
  isScrambled,
  className,
}: TimerContainerProps) {
  const { state, time, lastTime, press, release, cancel } = useTimerUI(onComplete, isScrambled);

  // Expose the timer state + cancel to the parent (for shortcut gating) via
  // refs so the parent doesn't re-render on every animation frame.
  useEffect(() => {
    if (stateRef) stateRef.current = state;
  }, [state, stateRef]);
  useEffect(() => {
    if (cancelRef) cancelRef.current = cancel;
    return () => {
      if (cancelRef) cancelRef.current = null;
    };
  }, [cancel, cancelRef]);

  const displayTime =
    state === "idle"
      ? lastTime ?? 0
      : state === "holding" || state === "ready"
        ? 0
        : time;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only react to primary button / touch.
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      press();
    },
    [press],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      release();
    },
    [release],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Timer. Hold to start, press to stop."
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        // If the pointer leaves while holding, treat as release.
        if (e.buttons === 0) return;
        release();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative flex min-h-[clamp(280px,42vh,460px)] w-full cursor-pointer flex-col items-center justify-center rounded-lg",
        "outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {/* Subtle arming halo — only when ready/holding, keeps the look flat. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg transition-colors duration-200",
          state === "ready" && "bg-ready-soft/60",
          state === "holding" && "bg-hold-soft/40",
        )}
      />
      <TimerDisplay
        state={state}
        displayTime={displayTime}
        hasLast={lastTime !== null}
      />
    </div>
  );
}
