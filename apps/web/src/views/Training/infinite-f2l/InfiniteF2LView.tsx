"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { motion } from "framer-motion";
import {
  Compass,
  Settings2,
  RotateCcw,
  Sparkles,
  Zap,
  Play,
  Flag,
} from "lucide-react";
import { connectionStore } from "@cubeforge/state";
import { useCube3D } from "@/hooks/useCube3D";
import { CubeConnector } from "@/components/Hardware/CubeConnector";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb } from "../components/TrainingBreadcrumb";
import { InfiniteF2LSetupDialog } from "./InfiniteF2LSetupDialog";
import { InfiniteF2LSummaryDialog } from "./InfiniteF2LSummaryDialog";
import { useInfiniteF2LSession } from "./useInfiniteF2LSession";
import type { InfiniteF2LOptions } from "./infiniteF2lEngine";

export interface InfiniteF2LViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

const STORAGE_KEY = "cubeforge:infinite-f2l:options";

const DEFAULT_OPTIONS: Required<InfiniteF2LOptions> = {
  crossColor: "white",
  concurrentPairs: 2,
  targetPairs: 0,
  allowedSlots: ["FR", "FL", "BL", "BR"],
  allowTrapped: true,
  enableSound: false,
  spawnMode: "normal",
  aufEnabled: true,
};

function loadStoredOptions(): Required<InfiniteF2LOptions> {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function saveStoredOptions(opts: Required<InfiniteF2LOptions>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    // Ignore quota errors
  }
}

export function InfiniteF2LView({
  phaseName,
  onBack,
}: InfiniteF2LViewProps) {
  const { t } = useTranslation("training");
  const isConnected = useStore(connectionStore, (s) => s.status === "connected");

  // Setup options initialized from persistent localStorage
  const [options, setOptions] = useState<Required<InfiniteF2LOptions>>(loadStoredOptions);

  const [isStarted, setIsStarted] = useState(false);

  // Dialog state — open connector if disconnected, else open setup dialog immediately on entry
  const [isSetupOpen, setIsSetupOpen] = useState(isConnected);
  const [isConnectorOpen, setIsConnectorOpen] = useState(!isConnected);

  // When connection status transitions to connected, open setup dialog if not started yet
  useEffect(() => {
    if (isConnected && !isStarted) {
      setIsConnectorOpen(false);
      setIsSetupOpen(true);
    }
  }, [isConnected, isStarted]);

  // 3D Cube Canvas hook
  const {
    canvasRef,
    containerRef,
    calibrate,
    engineRef,
  } = useCube3D({
    order: 3,
    connectSmartCube: true,
    syncFacelets: false,
    maxRecentMoves: 0,
  });

  // Infinite F2L session engine hook
  const {
    solvedCount,
    activePairs,
    elapsedMs,
    liveTps,
    avgTps,
    isFinished,
    finalStats,
    finishSession,
    dismissSession,
    restart,
  } = useInfiniteF2LSession({
    options,
    engineRef,
    isStarted,
  });

  const handleStartOptions = useCallback((newOptions: Required<InfiniteF2LOptions>) => {
    setOptions(newOptions);
    saveStoredOptions(newOptions);
    if (!isConnected) {
      // No cube connected: don't start the session, send the user to the
      // connection dialog first. Once connected, the setup dialog reopens.
      setIsSetupOpen(false);
      setIsConnectorOpen(true);
      return;
    }
    if (!isStarted) {
      // Fresh start: useInfiniteF2LSession auto-starts when isStarted flips
      // to true (with the just-updated options) — calling restart() here too
      // would initialize the session twice.
      setIsStarted(true);
      return;
    }
    // Already running: apply the new options immediately.
    restart(newOptions);
  }, [restart, isConnected, isStarted]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full text-ink select-none">
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* Top Bar Header */}
        <header className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <div className="flex items-center gap-3">
          <TrainingBreadcrumb
            onBack={onBack}
            segments={[
              { label: "CFOP" },
              { label: phaseName },
              { label: t("infiniteF2l.title"), isCurrent: true },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Bluetooth connector trigger (standard app-wide dialog) */}
          <CubeConnector
            open={isConnectorOpen}
            onOpenChange={setIsConnectorOpen}
            variant="header"
          />

          {/* Gyro Calibration Button */}
          {isConnected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={calibrate}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-2/60 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                  aria-label={t("infiniteF2l.calibrateGyro")}
                >
                  <Compass className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("infiniteF2l.calibrateGyro")}</TooltipContent>
            </Tooltip>
          )}

          {/* Setup / Settings Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsSetupOpen(true)}
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-2/60 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label={t("infiniteF2l.settings")}
              >
                <Settings2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("infiniteF2l.settings")}</TooltipContent>
          </Tooltip>

          {/* Finish Session Button */}
          {isStarted && !isFinished && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={finishSession}
                  className="flex h-9 items-center gap-1.5 px-3 cursor-pointer rounded-lg border border-line bg-surface-2/60 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                  aria-label={t("infiniteF2l.finish")}
                >
                  <Flag className="size-3.5 text-amber-500" />
                  <span className="hidden sm:inline">{t("infiniteF2l.finish")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("infiniteF2l.finish")}</TooltipContent>
            </Tooltip>
          )}

          {/* Reset / Restart Session Button */}
          {isStarted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => restart()}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-2/60 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                  aria-label={t("infiniteF2l.restart")}
                >
                  <RotateCcw className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("infiniteF2l.restart")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-4">
        {/* Floating HUD: Stats & Active Pairs (visible once started) */}
        {isStarted && (
          <div className="absolute top-4 z-20 flex flex-wrap items-center justify-center gap-2 pointer-events-none">
            {/* Solved Pairs Counter Pill */}
            <motion.div
              key={solvedCount}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 rounded-full border border-line bg-surface/90 backdrop-blur-md px-4 py-1.5 shadow-sm"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-ink">
                {t("infiniteF2l.solvedPairs")}:
              </span>
              <span className="nums text-xs font-bold text-ink">
                {options.targetPairs && options.targetPairs > 0
                  ? `${solvedCount} / ${options.targetPairs}`
                  : solvedCount}
              </span>
            </motion.div>

            {/* TPS & Time Pill */}
            <div className="flex items-center gap-3 rounded-full border border-line bg-surface/90 backdrop-blur-md px-4 py-1.5 shadow-sm text-xs text-ink-2 font-medium">
              <span className="nums">{formatTime(elapsedMs)}</span>
              <span className="h-3 w-px bg-line" />
              <span className="nums flex items-center gap-1.5">
                <Zap className={`size-3 transition-colors ${liveTps > 0 ? "text-amber-500 animate-pulse" : "text-ink-3"}`} />
                <span className="font-semibold text-ink">{liveTps.toFixed(1)}</span>
                <span className="text-[0.68rem] text-ink-3">TPS</span>
                {avgTps > 0 && (
                  <span className="text-[0.62rem] text-ink-3/80 font-normal">
                    (avg {avgTps.toFixed(1)})
                  </span>
                )}
              </span>
            </div>

            {/* Active Target Slots Pills */}
            <div className="flex items-center gap-1.5">
              {activePairs.map((pair) => (
                <div
                  key={pair.slotId}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface/90 backdrop-blur-md px-3 py-1 text-[0.68rem] font-semibold text-ink shadow-sm"
                >
                  <span
                    className="size-2 rounded-full shadow-xs"
                    style={{ backgroundColor: pair.def.colorName }}
                  />
                  <span>{pair.slotId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3D Cube Canvas Area — balanced, compact sizing; the Start prompt
            floats BELOW the cube so it never covers the 3D view. */}
        <div className="relative flex w-full max-w-95 sm:max-w-105 flex-col items-center justify-center">
          <div
            ref={containerRef as React.RefObject<HTMLDivElement>}
            className="relative w-full aspect-square max-h-[55vh] flex items-center justify-center touch-none"
          >
            <canvas
              ref={canvasRef as React.RefObject<HTMLCanvasElement>}
              className="size-full outline-none cursor-grab active:cursor-grabbing"
            />
          </div>

          {/* Prompt to start configuration if modal was closed before starting */}
          {!isStarted && !isSetupOpen && isConnected && (
            <Button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="z-30 mt-5 w-full h-11 sm:w-auto sm:min-w-64 gap-2 rounded-xl bg-ink text-surface text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Play className="size-4 fill-current" />
              {t("infiniteF2l.setup.start")}
            </Button>
          )}
        </div>
      </div>

      {/* Floating Setup Modal */}
      <InfiniteF2LSetupDialog
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
        initialOptions={options}
        onStart={handleStartOptions}
      />

      {/* Session Summary Modal */}
      <InfiniteF2LSummaryDialog
        open={isFinished}
        stats={finalStats}
        targetPairs={options.targetPairs}
        onRestart={() => restart()}
        onOpenSettings={() => {
          setIsSetupOpen(true);
        }}
        onClose={() => {
          dismissSession();
          setIsStarted(false);
        }}
      />
      </div>
    </div>
  );
}
