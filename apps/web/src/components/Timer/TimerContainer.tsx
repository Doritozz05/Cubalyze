"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, MessageSquare, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import { TimerDisplay } from "./TimerDisplay";
import { PbCelebrationBanner } from "./PbCelebrationBanner";
import type { PbMilestoneResult } from "@/utils/pbDetection";
import type { TimerState, Solve, Penalty } from "@/types";
import type { HintContext } from "./hintFor";

import { useIsTouch } from "@/hooks/use-mobile";

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
  /** Last recorded solve object for quick penalty modification. */
  lastSolve?: Solve | null;
  /** Callback to update penalty of a solve. */
  onUpdatePenalty?: (id: string, penalty: Penalty) => void;
  /** Callback to update solve penalty or note. */
  onUpdateSolve?: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  /** Optional direct note update callback. */
  onUpdateNote?: (id: string, note: string | null) => void;
  /** Callback to delete a solve by id. */
  onDeleteSolve?: (id: string) => void;
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
  lastSolve,
  onUpdatePenalty,
  onUpdateSolve,
  onUpdateNote,
  onDeleteSolve,
  className,
}: TimerContainerProps) {
  const { t } = useTranslation("timer");
  const isTouch = useIsTouch();
  // Touch devices always enable click/tap to start & stop because there is no keyboard.
  const activeClickToStart = clickToStart || isTouch;

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    setIsEditingNote(false);
    setNoteInput(lastSolve?.note ?? "");
  }, [lastSolve?.id, lastSolve?.note]);

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
      const isTouchPointer = e.pointerType === "touch";
      if (!activeClickToStart && !isTouchPointer) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      onPress();
    },
    [onPress, activeClickToStart],
  );

  // Shared release path for both `pointerup` and `pointercancel`. The latter
  // is a CRITICAL mobile fix: browsers fire `pointercancel` instead of
  // `pointerup` when they take over a held touch (scroll detection,
  // long-press, system gesture). Without it, a held-and-released touch can
  // leave the engine stuck in READY (green) forever — handleUp() never runs,
  // so the timer never starts. Treat both events exactly like a release.
  const handleReleaseEvent = useCallback(
    (e: React.PointerEvent) => {
      const isTouchPointer = e.pointerType === "touch";
      if (!activeClickToStart && !isTouchPointer) return;
      e.preventDefault();
      onRelease();
    },
    [onRelease, activeClickToStart],
  );
  const onPointerUp = handleReleaseEvent;
  const onPointerCancel = handleReleaseEvent;

  // Click-to-start: a single click toggles the timer (start/stop like spacebar)
  const onClick = useCallback(() => {
    if (!activeClickToStart) return;
    if (phase === "idle" || phase === "stopped") {
      // Simulate a full press-hold-release cycle
      onPress();
      // Wait for the hold delay to pass so engine transitions to READY, then release
      const effectiveDelay = holdDelay > 0 ? holdDelay + 50 : 50;
      setTimeout(() => onRelease(), effectiveDelay);
    } else if (phase === "running") {
      onPress(); // stops the timer
    }
  }, [activeClickToStart, phase, onPress, onRelease, holdDelay]);

  // Ref to read latest phase in event handlers (avoids stale closure at render time)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const hasPbActive = pbMilestone != null && pbMilestone.types.length > 0 && (phase === "stopped" || phase === "idle");

  return (
    <div
      role="button"
      tabIndex={activeClickToStart ? 0 : -1}
      aria-label={activeClickToStart ? t("timerAriaClick") : t("timerAriaSpace")}
      onPointerDown={activeClickToStart ? onPointerDown : undefined}
      onPointerUp={activeClickToStart ? onPointerUp : undefined}
      onPointerCancel={activeClickToStart ? onPointerCancel : undefined}
      onClick={activeClickToStart ? onClick : undefined}
      onPointerLeave={
        activeClickToStart
          ? (e: React.PointerEvent) => {
              if (e.buttons === 0) return;
              if (phaseRef.current === "idle" || phaseRef.current === "stopped") return;
              onRelease();
            }
          : undefined
      }
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative flex w-full flex-col items-center justify-center rounded-lg transition-all duration-300 select-none",
        // Touch (<1024px): taller timer so the numbers dominate the stage and
        // stay thumb-friendly. Desktop formula unchanged.
        "min-h-[clamp(280px,42vh,460px)] max-lg:min-h-[clamp(340px,48vh,520px)]",
        // Kill double-tap zoom delay on touch; no effect on mouse.
        "touch-manipulation",
        !activeClickToStart && "cursor-default",
        activeClickToStart && "cursor-pointer",
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
        <div
          className="absolute top-4 z-20 w-full max-w-sm px-4 max-lg:max-w-[92vw]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
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

      {/* Quick Penalty Action Bar for Last Solve (Only for solves completed in the current session) */}
      {lastTime !== null && lastSolve && onUpdatePenalty && (phase === "stopped" || phase === "idle") && (
        <div
          className="mt-3 flex items-center gap-1 rounded-full border border-line/30 bg-surface-2/60 px-1.5 py-1 backdrop-blur-md shadow-2xs transition-all duration-200 z-10 max-lg:px-2.5 max-lg:py-1.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              hapticTap();
              const next: Penalty = lastSolve.penalty === "none" ? "+2" : lastSolve.penalty === "+2" ? "none" : "+2";
              onUpdatePenalty(lastSolve.id, next);
            }}
            className={cn(
              // Touch: bigger, thumb-friendly penalty pills.
              "h-6 px-2.5 rounded-full text-[0.72rem] font-medium tracking-wide transition-all duration-150 cursor-pointer outline-none select-none max-lg:h-10 max-lg:px-4 max-lg:text-sm",
              lastSolve.penalty === "+2"
                ? "bg-plus2-soft text-plus2 font-bold ring-1 ring-plus2/30"
                : "text-ink-3 hover:bg-surface-3 hover:text-ink",
            )}
            title={t("togglePlus2")}
          >
            +2
          </button>
          <div className="h-3 w-px bg-line/40" />
          <button
            type="button"
            onClick={() => {
              hapticTap();
              const next: Penalty = lastSolve.penalty === "DNF" ? "none" : "DNF";
              onUpdatePenalty(lastSolve.id, next);
            }}
            className={cn(
              // Touch: bigger, thumb-friendly penalty pills.
              "h-6 px-2.5 rounded-full text-[0.72rem] font-medium tracking-wide transition-all duration-150 cursor-pointer outline-none select-none max-lg:h-10 max-lg:px-4 max-lg:text-sm",
              lastSolve.penalty === "DNF"
                ? "bg-dnf-soft text-dnf font-bold ring-1 ring-dnf/30"
                : "text-ink-3 hover:bg-surface-3 hover:text-ink",
            )}
            title={t("toggleDnf")}
          >
            DNF
          </button>
          {onDeleteSolve && (
            <>
              <div className="h-3 w-px bg-line/40" />
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onDeleteSolve(lastSolve.id);
                }}
                className={cn(
                  "h-6 px-2 rounded-full text-ink-3 hover:bg-dnf-soft hover:text-dnf transition-all duration-150 cursor-pointer outline-none select-none grid place-items-center max-lg:h-10 max-lg:px-3",
                )}
                title={t("deleteSolve")}
              >
                <Trash2 className="size-3.5 max-lg:size-4" />
              </button>
            </>
          )}
          {(onUpdateSolve || onUpdateNote) && (
            <>
              <div className="h-3 w-px bg-line/40" />
              {isEditingNote ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!lastSolve) return;
                    const trimmed = noteInput.trim();
                    const finalNote = trimmed || null;
                    if (onUpdateSolve) {
                      onUpdateSolve(lastSolve.id, { note: finalNote });
                    } else if (onUpdateNote) {
                      onUpdateNote(lastSolve.id, finalNote);
                    }
                    setIsEditingNote(false);
                  }}
                  className="flex items-center gap-1 pl-0.5"
                >
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsEditingNote(false);
                      }
                    }}
                    placeholder={t("notePlaceholder")}
                    autoFocus
                    className="h-6 w-28 max-lg:w-36 max-lg:h-9 rounded-full bg-surface-2 border border-line px-2.5 text-xs text-ink placeholder:text-ink-3 outline-none focus:border-ink/40"
                  />
                  <button
                    type="submit"
                    className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ready hover:bg-ready-soft transition-colors cursor-pointer"
                    title={t("saveNote")}
                  >
                    <Check className="size-3.5 max-lg:size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(false)}
                    className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                    title={t("cancel")}
                  >
                    <X className="size-3.5 max-lg:size-4" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setNoteInput(lastSolve.note ?? "");
                    setIsEditingNote(true);
                  }}
                  className={cn(
                    "h-6 px-2 rounded-full transition-all duration-150 cursor-pointer outline-none select-none flex items-center gap-1.5 max-lg:h-10 max-lg:px-3 text-[0.72rem] max-lg:text-sm font-medium",
                    lastSolve.note
                      ? "text-phase-indigo bg-phase-indigo/10 hover:bg-phase-indigo/20 font-semibold ring-1 ring-phase-indigo/30"
                      : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                  )}
                  title={
                    lastSolve.note
                      ? t("noteWithValue", { note: lastSolve.note })
                      : t("addNote")
                  }
                >
                  <MessageSquare className="size-3.5 max-lg:size-4" />
                  {lastSolve.note ? (
                    <span className="max-w-24 truncate text-[0.72rem] max-lg:text-xs">{lastSolve.note}</span>
                  ) : null}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
