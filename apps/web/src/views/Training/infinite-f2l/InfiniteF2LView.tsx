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
} from "lucide-react";
import { connectionStore } from "@cubeforge/state";
import { useCube3D } from "@/hooks/useCube3D";
import { CubeConnector } from "@/components/Hardware/CubeConnector";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/hooks/usePracticeSession";
import { TrainingBreadcrumb } from "../components/TrainingBreadcrumb";
import { InfiniteF2LSetupDialog } from "./InfiniteF2LSetupDialog";
import { useInfiniteF2LSession } from "./useInfiniteF2LSession";
import type { InfiniteF2LOptions } from "./infiniteF2lEngine";

export interface InfiniteF2LViewProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

export function InfiniteF2LView({
  phaseName,
  onBack,
}: InfiniteF2LViewProps) {
  const { t } = useTranslation("training");
  const isConnected = useStore(connectionStore, (s) => s.status === "connected");

  // Setup options
  const [options, setOptions] = useState<Required<InfiniteF2LOptions>>({
    crossColor: "white",
    concurrentPairs: 2,
    allowedSlots: ["FR", "FL", "BL", "BR"],
    allowTrapped: true,
    enableSound: false,
  });

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
    maxRecentMoves: 0,
  });

  // Infinite F2L session engine hook
  const {
    solvedCount,
    activePairs,
    elapsedMs,
    tps,
    restart,
  } = useInfiniteF2LSession({
    options,
    engineRef,
    isStarted,
  });

  const handleStartOptions = useCallback((newOptions: Required<InfiniteF2LOptions>) => {
    setOptions(newOptions);
    setIsStarted(true);
    setTimeout(() => {
      restart();
    }, 50);
  }, [restart]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-ink select-none">
      {/* Top Bar Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
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

          {/* Reset / Restart Session Button */}
          {isStarted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={restart}
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
              <span className="nums text-xs font-bold text-ink">{solvedCount}</span>
            </motion.div>

            {/* TPS & Time Pill */}
            <div className="flex items-center gap-3 rounded-full border border-line bg-surface/90 backdrop-blur-md px-4 py-1.5 shadow-sm text-xs text-ink-2 font-medium">
              <span className="nums">{formatTime(elapsedMs)}</span>
              <span className="h-3 w-px bg-line" />
              <span className="nums flex items-center gap-1">
                <Zap className="size-3 text-ink-3" />
                {tps} TPS
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

        {/* 3D Cube Canvas Area */}
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          className="relative size-full flex items-center justify-center touch-none"
        >
          <canvas
            ref={canvasRef as React.RefObject<HTMLCanvasElement>}
            className="size-full outline-none cursor-grab active:cursor-grabbing"
          />

          {/* Prompt to start configuration if modal was closed before starting */}
          {!isStarted && !isSetupOpen && isConnected && (
            <div className="absolute inset-x-4 top-16 sm:top-20 z-30 mx-auto max-w-sm">
              <Button
                type="button"
                onClick={() => setIsSetupOpen(true)}
                className="w-full h-11 gap-2 rounded-xl bg-ink text-surface text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Play className="size-4 fill-current" />
                {t("infiniteF2l.setup.start")}
              </Button>
            </div>
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
    </div>
  );
}
