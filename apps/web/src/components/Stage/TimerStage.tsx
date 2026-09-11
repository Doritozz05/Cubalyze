"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { preferencesStore } from "@cubeforge/state";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { Scramble2DNet } from "@/components/Scramble/Scramble2DNet";
import { Scramble3DNet } from "@/components/Scramble/Scramble3DNet";
import { ManualTimeInput } from "@/components/Timer/ManualTimeInput";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BottomLayout } from "@/bottom-layout/BottomLayout";
import { getSlotTemplate } from "@/bottom-layout/slot-templates";
import { SIDEBAR_MOTION } from "@/components/Layout/sidebar.constants";
import { shortcutKeyLabel } from "@/utils/keyLabel";
import { useSolveSession } from "@/hooks/useSolveSession";
import { usePerfRenderTiming } from "@/utils/perfDiag";
import type { Penalty, PuzzleCategory, Solve } from "@/types";
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
  puzzleFilter: string;
  /** Active UI puzzle category — drives which puzzle the 3D scramble renders. */
  puzzle: PuzzleCategory;
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
    puzzleFilter,
    puzzle,
    isFocused,
  } = props;

  // perfDiag (opt-in): counts stage re-renders while the timer runs.
  usePerfRenderTiming("TimerStage");

  const { t } = useTranslation("timer");

  // Enlarged scramble dialog (opened by clicking the 2D net in the bottom layout).
  const [scramblePreviewOpen, setScramblePreviewOpen] = useState(false);

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
  const scramblePanel = useStore(preferencesStore, (s) => s.scramblePanel);
  const scrambleLayoutMode = useStore(preferencesStore, (s) => s.scrambleLayoutMode);
  const showBottomLayout = useStore(preferencesStore, (s) => s.showBottomLayout);
  const bottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const startTimerKey = useStore(preferencesStore, (s) => s.shortcuts.startTimer);
  const isManualMode = inputMode === "manual";

  // Right-rail templates render as a desktop aside with a compact bottom
  // fallback on mobile. The text scramble always stays on top; the 2D net
  // is just another display block inside a slot.
  const isRail =
    getSlotTemplate(bottomLayoutTemplate)?.placement === "right";

  const scramble2dElement = (
    <button
      type="button"
      onClick={() => setScramblePreviewOpen(true)}
      aria-label={t("openScramblePreview")}
      className="grid cursor-pointer place-items-center rounded-md outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring"
    >
      <Scramble2DNet scramble={currentScramble} compact />
    </button>
  );

  // 3D scramble display: the actual puzzle (pyraminx / 2×2 / 3×3) with the
  // scramble applied, camera-draggable — just another slot display block.
  const scramble3dElement = (
    <Scramble3DNet scramble={currentScramble} puzzle={puzzle} />
  );

  // Previous PB (excluding the most recent solve) for accurate PB delta.
  const puzzleSolves = solves.filter((s) => (s.puzzleType ?? "333") === puzzleFilter);
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
    // Show the user's configured start key in the hints (not a hardcoded
    // "space"), e.g. "pulsa N para iniciar la inspección".
    startKeyLabel: shortcutKeyLabel(startTimerKey),
  };

  // Manual focus toggle styled exactly like Copy/New (ghost, borderless,
  // icon-only when labels are hidden in compact-right / compact-down / mobile).
  const renderManualFocusAction = (showLabels: boolean) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onManualFocusToggle}
          className={cn(
            "h-7 gap-1.5 px-2 text-xs hover:text-ink",
            manualFocus ? "text-ink" : "text-ink-2",
          )}
          aria-label={manualFocus ? t("disableFocusMode") : t("enableFocusMode")}
          aria-pressed={manualFocus}
        >
          <Eye className="size-3.5" />
          {showLabels && <span className="max-lg:hidden">{t("focus")}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {manualFocus ? t("disableFocusMode") : t("enableFocusMode")}
      </TooltipContent>
    </Tooltip>
  );

  // Manual focus keeps scramble visible (with Copy/New/Focus actions) —
  // only timer-mode focus hides it. Bottom layout still hides via isFocused below.
  const scrambleElement = scrambleDisplay && (!isFocused || isManualMode) ? (
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
      layoutMode={scrambleLayoutMode}
      indexLabel={`#${scrambleIndex + 1}`}
      focusModeAction={
        isManualMode && focusMode ? renderManualFocusAction : undefined
      }
    />
  ) : null;

  const topScrambleBlock = (
    <AnimatePresence mode="wait">
      {scrambleElement ? (
        // No exit animation: in focus mode the scramble must leave the
        // layout instantly so the timer fills the stage immediately. An
        // animated exit keeps its layout slot for ~250ms, which made the
        // timer appear clipped at the top and then suddenly grow.
        <motion.div
          key="scramble-display-container"
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SIDEBAR_MOTION.panel}
          data-glass-panel={scramblePanel ? "true" : undefined}
          className={cn(
            "w-full transition-all duration-200",
            scramblePanel && "rounded-xl border border-line bg-surface p-3 sm:p-3.5 shadow-2xs",
          )}
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
          {renderManualFocusAction(true)}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      {isRail && showBottomLayout && !isFocused ? (
        // Right-rail placement: timer column (with aligned scramble on top)
        // + vertical slot rail on desktop, compact bottom strip on mobile.
        <div className="flex w-full min-h-0 flex-1 gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {topScrambleBlock}
            {isManualMode ? (
              <ManualTimeInput onSubmit={onManualSubmit} className="flex-1" />
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
                className="flex-1"
              />
            )}
            <BottomLayout
              templateId={bottomLayoutTemplate}
              solves={solves}
              puzzleFilter={puzzleFilter}
              scramble2d={scramble2dElement}
              scramble3d={scramble3dElement}
              currentScramble={currentScramble}
              compact
              className="mt-2 lg:hidden"
            />
          </div>
          <aside
            aria-label={t("slotRailLabel")}
            className="hidden w-64 shrink-0 overflow-y-auto lg:flex lg:flex-col"
          >
            <BottomLayout
              templateId={bottomLayoutTemplate}
              solves={solves}
              puzzleFilter={puzzleFilter}
              scramble2d={scramble2dElement}
              scramble3d={scramble3dElement}
              currentScramble={currentScramble}
              vertical
              className="h-full"
            />
          </aside>
        </div>
      ) : (
        <>
          {topScrambleBlock}
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
              puzzleFilter={puzzleFilter}
              scramble2d={scramble2dElement}
              scramble3d={scramble3dElement}
              currentScramble={currentScramble}
            />
          )}
        </>
      )}

      <Dialog open={scramblePreviewOpen} onOpenChange={setScramblePreviewOpen}>
        <DialogContent className="flex flex-col items-center gap-5 sm:max-w-md">
          <DialogTitle className="sr-only">{t("scramblePreview")}</DialogTitle>
          <Scramble2DNet scramble={currentScramble} className="mx-auto w-full" />
          <p className="nums text-center text-xl leading-snug tracking-tight text-ink">
            {currentScramble}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
