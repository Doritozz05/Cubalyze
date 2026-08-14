"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { preferencesStore } from "@cubeforge/state";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { Scramble2DNet } from "@/components/Scramble/Scramble2DNet";
import { ManualTimeInput } from "@/components/Timer/ManualTimeInput";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BottomLayout } from "@/bottom-layout/BottomLayout";
import {
  DEFAULT_BOTTOM_LAYOUT_TEMPLATE,
  getBottomLayoutTemplate,
  templateHasCell,
} from "@/bottom-layout/registry";
import { SIDEBAR_MOTION } from "@/components/Layout/sidebar.constants";
import { useSolveSession } from "@/hooks/useSolveSession";
import type { Penalty, Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import type { PbMilestoneResult } from "@/utils/pbDetection";

type HintCtx = React.ComponentProps<typeof TimerContainer>["hintCtx"];

export interface TimerStageProps {
  /** The full solve-session result (phase, time, validation, hardware…). */
  session$: ReturnType<typeof useSolveSession>;
  currentScramble: string;
  displayScramble: string;
  scrambleIndex: number;
  onRegenerate: () => void;
  onCopy: () => void;
  manualFocus: boolean;
  onManualFocusToggle: () => void;
  activePbMilestone: PbMilestoneResult | null;
  onDismissPbBanner: () => void;
  timerStateRef: React.MutableRefObject<import("@/types").TimerState>;
  cancelRef: React.MutableRefObject<(() => void) | null>;
  solves: Solve[];
  onUpdatePenalty: (id: string, penalty: Penalty) => void;
  onUpdateSolve?: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  onDeleteSolve: (id: string) => void;
  onManualSubmit: (time: number, penalty: Penalty, note?: string | null) => void;
  onExpand: () => void;
  puzzleFilter: string;
  isFocused: boolean;
}

/**
 * The live timer stage (extracted from App.tsx): scramble display with
 * per-move validation states, the timer face (or manual time input), and the
 * bottom layout strip. Display preferences are read from the store; the
 * previous-PB baseline for the delta is derived from the current solves.
 */
export function TimerStage(props: TimerStageProps) {
  const {
    session$,
    currentScramble,
    displayScramble,
    scrambleIndex,
    onRegenerate,
    onCopy,
    manualFocus,
    onManualFocusToggle,
    activePbMilestone,
    onDismissPbBanner,
    timerStateRef,
    cancelRef,
    solves,
    onUpdatePenalty,
    onUpdateSolve,
    onDeleteSolve,
    onManualSubmit,
    onExpand,
    puzzleFilter,
    isFocused,
  } = props;

  const { t } = useTranslation("timer");

  const {
    phase: timerPhase,
    time: timerTime,
    lastTime: timerLastTime,
    press: timerPress,
    release: timerRelease,
    cancel: timerCancel,
    validation,
    smartCubeConnected,
    inspection,
    scrambleVerification,
  } = session$;

  // Display preferences (the stage owns how it looks, not the caller).
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const inputMode = useStore(preferencesStore, (s) => s.inputMode);
  const clickToStart = useStore(preferencesStore, (s) => s.clickToStart);
  const holdDelay = useStore(preferencesStore, (s) => s.spacebarHoldDelay);
  const showPbDelta = useStore(preferencesStore, (s) => s.showPbDelta);
  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const showBottomLayout = useStore(preferencesStore, (s) => s.showBottomLayout);
  const bottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const isManualMode = inputMode === "manual";

  // Resolve the selected template so the stage knows whether it should render
  // the scramble at the top or hand it to the bottom layout.
  const bottomTemplate =
    getBottomLayoutTemplate(bottomLayoutTemplate) ?? DEFAULT_BOTTOM_LAYOUT_TEMPLATE;
  const embedsScramble = templateHasCell(bottomTemplate, "scramble");
  // A template with a `scramble` cell renders it inside the bottom layout
  // (e.g. three-column). Manual mode keeps the scramble at the top because its
  // focus toggle lives there.
  const embedScramble = embedsScramble && scrambleDisplay && !isFocused && !isManualMode;
  // A `scramble-2d` cell shows the 2D net but leaves the top scramble in place.
  const embedsScramble2d = templateHasCell(bottomTemplate, "scramble-2d");

  // Previous PB (excluding the most recent solve) for accurate PB delta.
  const puzzleSolves = solves.filter((s) => (s.puzzleType ?? "3x3x3") === puzzleFilter);
  const previousSolves = puzzleSolves.slice(1).filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const previousPB =
    previousSolves.length > 0 ? Math.min(...previousSolves.map((s) => effectiveTime(s))) : null;

  const hintCtx: HintCtx = {
    smartCube: smartCubeConnected,
    scrambleVerif: scrambleDisplay && scrambleVerification,
    inspection,
    isScrambled: validation.isScrambled,
    isLastSolveDnf: timerLastTime !== null && solves[0]?.penalty === "DNF",
    lastSolvePenalty: timerLastTime !== null ? solves[0]?.penalty : "none",
  };

  const scrambleElement = scrambleDisplay && !isFocused ? (
    <ScrambleDisplay
      scramble={currentScramble}
      displayScramble={displayScramble}
      smartCubeConnected={smartCubeConnected}
      states={isManualMode || !smartCubeConnected ? undefined : validation.states}
      currentIndex={isManualMode || !smartCubeConnected ? 0 : validation.currentIndex}
      errorMoves={isManualMode || !smartCubeConnected ? [] : validation.displayErrorMoves}
      pendingHalfDouble={isManualMode || !smartCubeConnected ? false : validation.pendingHalfDouble}
      isScrambled={isManualMode || !smartCubeConnected ? false : validation.isScrambled}
      needsReset={isManualMode || !smartCubeConnected ? false : validation.needsReset}
      awaitingSolve={isManualMode || !smartCubeConnected ? false : validation.awaitingSolve}
      onRegenerate={onRegenerate}
      onCopy={onCopy}
      indexLabel={`#${scrambleIndex + 1}`}
      focusModeAction={
        isManualMode && focusMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onManualFocusToggle}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 outline-none cursor-pointer",
                  manualFocus
                    ? "border border-ink/20 bg-surface-2 text-ink font-semibold shadow-xs"
                    : "border border-line bg-surface text-ink-2 hover:border-ink/20 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Eye className="size-3.5" />
                {t("focus")}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {manualFocus ? t("disableFocusMode") : t("enableFocusMode")}
            </TooltipContent>
          </Tooltip>
        ) : undefined
      }
    />
  ) : null;

  return (
    <>
      <AnimatePresence mode="wait">
        {scrambleElement && !embedScramble ? (
          <motion.div
            key="scramble-display-container"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={SIDEBAR_MOTION.panel}
            className="w-full"
          >
            {scrambleElement}
          </motion.div>
        ) : isManualMode && focusMode ? (
          <motion.div
            key="manual-focus-button"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SIDEBAR_MOTION.panel}
            className="flex w-full justify-end mb-2"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onManualFocusToggle}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 outline-none cursor-pointer",
                    manualFocus
                      ? "border border-ink/20 bg-surface-2 text-ink font-semibold shadow-xs"
                      : "border border-line bg-surface text-ink-2 hover:border-ink/20 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Eye className="size-3.5" />
                  {t("focus")}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {manualFocus ? t("disableFocusMode") : t("enableFocusMode")}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isManualMode ? (
        <ManualTimeInput
          onSubmit={onManualSubmit}
          className="mt-1 flex-1"
        />
      ) : (
        <TimerContainer
          phase={timerPhase}
          time={timerTime}
          lastTime={timerLastTime}
          pb={previousPB}
          showPbDelta={showPbDelta}
          pbMilestone={activePbMilestone}
          onDismissPbBanner={onDismissPbBanner}
          hintCtx={hintCtx}
          onPress={timerPress}
          onRelease={timerRelease}
          onCancel={timerCancel}
          stateRef={timerStateRef}
          cancelRef={cancelRef}
          clickToStart={clickToStart}
          holdDelay={holdDelay}
          lastSolve={solves[0] ?? null}
          onUpdatePenalty={onUpdatePenalty}
          onUpdateSolve={onUpdateSolve}
          onDeleteSolve={onDeleteSolve}
          className="mt-1 flex-1"
        />
      )}

      {showBottomLayout && !isFocused && (
        <BottomLayout
          templateId={bottomLayoutTemplate}
          solves={solves}
          onExpand={onExpand}
          puzzleFilter={puzzleFilter}
          scramble={embedScramble ? scrambleElement : undefined}
          scramble2d={embedsScramble2d ? <Scramble2DNet scramble={currentScramble} compact /> : undefined}
        />
      )}
    </>
  );
}
