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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { useIsCoarsePointer, useIsTouch } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const isCoarsePointer = useIsCoarsePointer();
  const hasBackgroundImage = !!useStore(preferencesStore, (s) => s.timerBackgroundImage);
  // Touch devices always enable click/tap to start & stop because there is no
  // keyboard. The coarse-pointer check extends that to large tablets (iPads
  // >=768px) that render the desktop layout — they have no hover either, so
  // click-to-stop stays reachable. Fine-pointer desktops keep the setting.
  const activeClickToStart = clickToStart || isTouch || isCoarsePointer;

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  /**
   * Timestamp of the last pointerup/pointercancel that released a held touch.
   * Browsers fire a synthetic `click` right after `pointerup`, and on some
   * devices (old iPads) that echo can arrive ~200ms later. When the release
   * just STARTED the timer (READY → RUNNING via hold-and-release), that
   * stray click would hit the "running" branch of `onClick` and instantly
   * stop the solve — the classic "timer always stops at 0.20 on my old
   * iPad" bug. Genuine tap-to-stop is already handled by pointerdown (press
   * → handleDown), so suppressing the echo window is safe.
   */
  const lastPointerUpAtRef = useRef(0);
  // Covers the slowest click-echo delay seen on old iOS devices (~300ms)
  // with margin; a real second tap is always >500ms after the first release.
  const CLICK_ECHO_WINDOW_MS = 500;

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
      lastPointerUpAtRef.current = Date.now();
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
      // Ignore the synthetic click that browsers fire right after the
      // pointerup which STARTED the timer (hold-and-release). On old iPads
      // this echo lands ~200ms later and would stop a just-started solve at
      // 0.20s. Real tap-to-stop never reaches here: pointerdown already
      // pressed (handleDown) and moved the engine to COOLDOWN before the
      // click event is dispatched.
      if (Date.now() - lastPointerUpAtRef.current < CLICK_ECHO_WINDOW_MS) return;
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
        // Touch (<768px): the timer stays thumb-friendly but compact enough
        // that scramble + timer + bottom layout strip fit between the header
        // and the bottom tab bar on small phones (the stage also scrolls as a
        // fallback — see MainLayout). Desktop formula unchanged.
        "min-h-[clamp(280px,42vh,460px)] max-lg:min-h-[clamp(280px,38vh,440px)]",
        // Touch tablets (coarse pointer, >=768px, desktop layout): the whole
        // stage (scramble + timer + bottom layout) must fit between the
        // header and the gesture bar WITHOUT scrolling, so the timer's
        // minimum height is smaller than on real desktops. It still grows
        // via flex-1 to fill any leftover space.
        isCoarsePointer && "lg:min-h-[clamp(220px,30vh,360px)]",
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
          !hasBackgroundImage && phase === "ready" && "bg-ready-soft/60",
          !hasBackgroundImage && phase === "holding" && "bg-hold-soft/40",
          !hasBackgroundImage && phase === "ready_for_move" && "bg-ready-soft/40",
          !hasBackgroundImage && phase === "inspection" && "bg-caution-soft/30",
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
        // Coarse-pointer devices (phones + large tablets) have no physical
        // keyboard, so the hints drop the "press space"/"hold" wording and
        // use the generic "press/tap" copy (see hintFor.ts).
        hintCtx={{ ...hintCtx, coarsePointer: isTouch || isCoarsePointer }}
        className={timerClassName}
      />

      {/* Quick Penalty Action Bar for Last Solve (Only for solves completed in the current session) */}
      {lastTime !== null && lastSolve && onUpdatePenalty && (phase === "stopped" || phase === "idle") && (
        <div
          className="mt-3 flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-1 shadow-2xs transition-all duration-200 z-10 max-lg:px-2.5 max-lg:py-1.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
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
              >
                +2
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("togglePlus2")}</TooltipContent>
          </Tooltip>
          <div className="h-3 w-px bg-line/40" />
          <Tooltip>
            <TooltipTrigger asChild>
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
              >
                DNF
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("toggleDnf")}</TooltipContent>
          </Tooltip>
          {onDeleteSolve && (
            <>
              <div className="h-3 w-px bg-line/40" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setConfirmDeleteOpen(true);
                    }}
                    className={cn(
                      "h-6 px-2 rounded-full text-ink-3 hover:bg-dnf-soft hover:text-dnf transition-all duration-150 cursor-pointer outline-none select-none grid place-items-center max-lg:h-10 max-lg:px-3",
                    )}
                  >
                    <Trash2 className="size-3.5 max-lg:size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("deleteSolve")}</TooltipContent>
              </Tooltip>
              <ConfirmDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title={t("confirmDeleteTitle")}
                description={t("confirmDeleteDescription")}
                confirmLabel={t("deleteSolve")}
                onConfirm={() => onDeleteSolve(lastSolve.id)}
              />
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ready hover:bg-ready-soft transition-colors cursor-pointer"
                      >
                        <Check className="size-3.5 max-lg:size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("saveNote")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setIsEditingNote(false)}
                        className="h-6 w-6 max-lg:h-9 max-lg:w-9 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5 max-lg:size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("cancel")}</TooltipContent>
                  </Tooltip>
                </form>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
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
                    >
                      <MessageSquare className="size-3.5 max-lg:size-4" />
                      {lastSolve.note ? (
                        <span className="max-w-24 truncate text-[0.72rem] max-lg:text-xs">{lastSolve.note}</span>
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {lastSolve.note
                      ? t("noteWithValue", { note: lastSolve.note })
                      : t("addNote")}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
