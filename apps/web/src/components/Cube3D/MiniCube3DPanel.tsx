"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw, Shuffle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCube3D } from "@/hooks/useCube3D";

export interface MiniCube3DPanelProps {
  className?: string;
  scramble?: string;
}

/**
 * Compact 3D cube preview panel for the drill view.
 *
 * Shows a small 3D cube canvas with Calibrate and Reset buttons.
 * Uses its own isolated Cube3DEngine instance via useCube3D. The cube's
 * PHYSICAL orientation is tracked headlessly by services/orientationTracking
 * (started in CubeConnector) — it feeds the Zustand orientationStore for
 * dynamic scramble remapping / display-notation moves with no panel mounted.
 *
 * Calibrate sets the current orientation as reference (white on top,
 * green front — standard WCA orientation) for both the visual and the
 * headless tracker.
 */
export const MiniCube3DPanel = memo(function MiniCube3DPanel({ className, scramble }: MiniCube3DPanelProps) {
  const { canvasRef, containerRef, isReady, initFailed, contextEvicted, recentMoves, calibrate, reset, applyScramble } =
    useCube3D({ maxRecentMoves: 8, scramble, connectSmartCube: true });

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">
          Cube
        </h4>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyScramble(scramble)}
                disabled={!isReady}
                className="h-6 gap-1 px-1.5 text-[0.6rem] text-ink-3 hover:text-ink"
              >
                <Shuffle className="size-3" />
                Scramble
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Apply scramble to 3D cube
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!isReady}
                className="h-6 gap-1 px-1.5 text-[0.6rem] text-ink-3 hover:text-ink"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Reset cube pieces to solved state
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={calibrate}
                disabled={!isReady}
                className="h-6 gap-1 px-1.5 text-[0.6rem] text-ink-3 hover:text-ink"
              >
                <RefreshCw className="size-3" />
                Calibrate
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Calibrate gyroscope (white top, green front)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative w-full"
        style={{ aspectRatio: "1 / 1" }}
      >
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className="absolute inset-0 h-full w-full outline-none"
        />

        {/* Loading / fallback state */}
        {initFailed || contextEvicted ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 px-2">
            <span className="text-[0.58rem] text-ink-3/70 text-center">
              3D unavailable — too many 3D views open
            </span>
          </div>
        ) : !isReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="text-[0.6rem] text-ink-3/50 animate-pulse">
              Initializing...
            </span>
          </div>
        ) : null}

        {/* Recent moves overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/60 backdrop-blur-sm px-2 py-1.5">
          {recentMoves.length === 0 ? (
            <p className="text-center text-[0.55rem] text-ink-3/50 italic">
              Waiting...
            </p>
          ) : (
            <div className="flex justify-center gap-1.5 font-mono text-[0.65rem] font-semibold text-ink">
              {recentMoves.map((m, i) => (
                <span
                  key={`${m}-${i}`}
                  className="animate-in fade-in slide-in-from-right-2"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
