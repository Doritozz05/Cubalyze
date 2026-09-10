"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import type { PuzzleCategory } from "@/types";

export interface Scramble3DNetProps {
  /** The current scramble to apply (empty/undefined → solved puzzle). */
  scramble?: string;
  /** Active puzzle: Pyraminx renders the Pyraminx engine; 2x2 → order 2; anything else → order 3. */
  puzzle: PuzzleCategory;
  className?: string;
}

/**
 * 3D scramble display — the same idea as Scramble2DNet, but rendering the
 * ACTUAL puzzle with the scramble applied: pyraminx shows a Pyraminx, 2x2 a
 * 2×2, 3x3 a 3×3 (each via its own engine from the puzzle registry / order).
 *
 * Pure display surface: no move input, no buttons, no overlays — the camera
 * orbits with drag (with inertia, like the 3D cube panel), double-click
 * recenters the isometric view, and wheel/pinch zooms. Every new scramble
 * is applied instantly (duration 0) from the solved state and the camera
 * recenters, so the display always presents the scramble face-on.
 *
 * It owns an isolated WebGL engine via useCube3D (connectSmartCube: false) —
 * fully disposed on unmount, like every other 3D panel.
 */
export const Scramble3DNet = memo(function Scramble3DNet({
  scramble,
  puzzle,
  className,
}: Scramble3DNetProps) {
  const { t } = useTranslation("timer");

  const isPyraminx = puzzle === "Pyraminx";
  const order = puzzle === "2x2" ? 2 : 3;

  const { canvasRef, containerRef, isReady, initFailed, contextEvicted, applyScramble, rotateCamera, setIsometricView, zoomCamera, engineRef } =
    useCube3D({
      order,
      puzzle: isPyraminx ? { kind: "pyraminx" } : undefined,
      connectSmartCube: false,
    });

  // Apply every new scramble the moment the engine is ready: instantly
  // (duration 0) from solved — a display, not an animation show. The camera
  // recenters afterwards so the user always starts from the standard view.
  useEffect(() => {
    if (!isReady || !scramble?.trim()) return;
    void applyScramble(scramble, 0).then(() => {
      void setIsometricView(true);
    });
  }, [isReady, scramble, applyScramble, setIsometricView]);

  // Camera drag — orbit only, no piece interaction (single pointer). Feeds
  // the engine's inertia so release glides, exactly like Cube3DPanel.
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    lastPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    engineRef.current?.setCameraDragActive(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best-effort (may fail on some browsers).
    }
  }, [engineRef]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;
      rotateCamera(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y);
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    [isDragging, rotateCamera],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    // Release: let the engine glide the camera with inertia.
    engineRef.current?.setCameraDragActive(false);
  }, [engineRef]);

  // Wheel zoom must attach natively with { passive: false }: React registers
  // onWheel as a passive root listener, so preventDefault() would be ignored
  // and the page would scroll while the puzzle zooms.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomCamera(e.deltaY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, zoomCamera]);

  const unavailable = initFailed || contextEvicted;

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        className={cn(
          "absolute inset-0 h-full w-full touch-none outline-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setIsometricView(true)}
      />

      {unavailable ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/90 px-2">
          <span className="select-none text-center text-[0.58rem] text-ink-3/70">
            {t("viewUnavailableShort")}
          </span>
        </div>
      ) : !isReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/90">
          <span className="animate-pulse select-none text-[0.6rem] text-ink-3/50">
            {t("init3dShort")}
          </span>
        </div>
      ) : null}
    </div>
  );
});
