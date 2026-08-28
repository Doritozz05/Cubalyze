"use client";

import { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

export const Cube3DPanel = memo(function Cube3DPanel({ className, onClose, order = 3, scramble }: Cube3DPanelProps) {
  const { t } = useTranslation("timer");
  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    recentMoves,
    calibrate,
    reset,
    applyScramble,
    rotateCamera,
    setIsometricView,
    zoomCamera,
    engineRef,
  } = useCube3D({ maxRecentMoves: 15, order, scramble, connectSmartCube: true });

  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // Active pointers (for two-finger pinch zoom on trackpads / touch).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef(0);

  const currentPinchDistance = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handleDoubleClick = () => {
    setIsometricView(true);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      setIsDragging(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
      // Arm the engine inertia: stop any leftover glide from a previous drag.
      engineRef.current?.setCameraDragActive(true);
    } else if (pointers.current.size === 2) {
      // Second finger lands → capture the starting span for pinch zoom, and
      // re-arm so no stale single-finger velocity glides after the pinch.
      pinchDistRef.current = currentPinchDistance();
      engineRef.current?.setCameraDragActive(true);
    }
    try {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } catch (_err) {
      void _err;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers → pinch zoom (spread = zoom in, pinch = zoom out).
    if (pointers.current.size >= 2) {
      const dist = currentPinchDistance();
      if (pinchDistRef.current > 0 && dist > 0) {
        const ratio = dist / pinchDistRef.current;
        // Convert the span delta to wheel-delta units for zoomCamera.
        zoomCamera((1 - ratio) * 600);
        pinchDistRef.current = dist;
      }
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    // Feeds engine camera momentum → inertia glide on release.
    rotateCamera(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setIsDragging(false);
      // Release: let the engine glide the camera with inertia.
      engineRef.current?.setCameraDragActive(false);
    } else if (pointers.current.size === 1) {
      // Back to one finger → reset baseline so the next move doesn't jump.
      const remaining = [...pointers.current.values()][0];
      if (remaining) {
        lastPos.current = { x: remaining.x, y: remaining.y };
      }
    }
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch (_err) {
      void _err;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    zoomCamera(e.deltaY);
  };

  return (
    <div className={cn("@container flex flex-1 h-full min-h-0 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2 min-w-0 select-none">
        <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
          <h3 className="text-sm font-medium text-ink truncate">Cube</h3>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyScramble(scramble)}
                disabled={!isReady}
                className="h-7 gap-1 px-1.5 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <Shuffle className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden @sm:inline">Scramble</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("applyScramble3d")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!isReady}
                className="h-7 gap-1 px-1.5 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <RotateCcw className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden @sm:inline">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("reset3d")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={calibrate}
                disabled={!isReady}
                className="h-7 gap-1 px-1.5 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
              >
                <RefreshCw className="size-3 shrink-0 max-lg:size-4" />
                <span className="hidden @sm:inline">{t("calibrate")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("calibrateGyro")}</TooltipContent>
          </Tooltip>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-7 px-1.5 text-xs text-ink-3 hover:text-ink max-lg:h-10 max-lg:px-3.5 max-lg:text-sm"
                  aria-label={t("close3d")}
                >
                  <X className="size-3 shrink-0 max-lg:size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("close3d")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={cn(
            "absolute inset-0 h-full w-full outline-none touch-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
        />

        {/* Loading state overlay — pointer-events-none so the canvas can still
            receive pointer events during the initializing phase */}
        {initFailed || contextEvicted ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 px-4">
            <span className="text-xs text-ink-3/70 text-center select-none">
              {t("viewUnavailable")}
            </span>
          </div>
        ) : !isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="text-xs text-ink-3/50 animate-pulse select-none">
              {t("init3d")}
            </span>
          </div>
        ) : null}

        {/* Moves overlay at bottom — pointer-events-none so drags on the label
            pass through to the canvas; hidden when the panel is too narrow */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-background/60 backdrop-blur-sm px-3 py-2 hidden @xs:block">
          {recentMoves.length === 0 ? (
            <p className="text-center text-[0.7rem] text-ink-3 italic select-none">{t("waitingForCube")}</p>
          ) : (
            <div className="flex justify-center gap-2 font-mono text-[0.8rem] font-semibold text-ink select-none">
              {recentMoves.map((m, i) => (
                <span key={`${m}-${i}`} className="animate-in fade-in slide-in-from-right-2">
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
