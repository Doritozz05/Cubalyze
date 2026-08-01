"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw, Shuffle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCube3D } from "@/hooks/useCube3D";

export interface Cube3DPanelProps {
  className?: string;
  onClose?: () => void;
  /** Cube order: 2 (2×2×2) or 3 (3×3×3). Default 3. */
  order?: number;
  /** Active scramble sequence to apply to 3D cube. */
  scramble?: string;
}

export function Cube3DPanel({ className, onClose, order = 3, scramble }: Cube3DPanelProps) {
  const {
    canvasRef,
    containerRef,
    isReady,
    recentMoves,
    calibrate,
    reset,
    applyScramble,
    rotateCamera,
  } = useCube3D({ maxRecentMoves: 15, order, scramble });

  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    rotateCamera(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className={cn("flex flex-1 h-full min-h-0 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-1 pb-2.5 min-w-0 overflow-hidden whitespace-nowrap select-none">
        <div className="flex items-baseline gap-2 shrink-0">
          <h3 className="text-sm font-medium text-ink">Cube</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyScramble(scramble)}
                disabled={!isReady}
                // Touch: bigger thumb targets inside the full-screen sheet.
                className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <Shuffle className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden sm:inline">Scramble</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Apply scramble to 3D cube</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!isReady}
                // Touch: bigger thumb targets inside the full-screen sheet.
                className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <RotateCcw className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset cube pieces to solved state</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={calibrate}
                disabled={!isReady}
                // Touch: bigger thumb targets inside the full-screen sheet.
                className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <RefreshCw className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden sm:inline">Calibrate</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Calibrate gyroscope orientation</TooltipContent>
          </Tooltip>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  // Touch: bigger close target inside the full-screen sheet.
                  className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
                  aria-label="Close 3D view"
                >
                  <X className="size-3 shrink-0 max-lg:size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close 3D view</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={cn(
            "absolute inset-0 h-full w-full outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Loading state overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="text-xs text-ink-3/50 animate-pulse">
              Initializing 3D Cube...
            </span>
          </div>
        )}

        {/* Moves overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/60 backdrop-blur-sm px-3 py-2">
          {recentMoves.length === 0 ? (
            <p className="text-center text-[0.7rem] text-ink-3 italic">Waiting for cube...</p>
          ) : (
            <div className="flex justify-center gap-2 font-mono text-[0.8rem] font-semibold text-ink">
              {recentMoves.map((m, i) => (
                <span key={i} className="animate-in fade-in slide-in-from-right-2">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
