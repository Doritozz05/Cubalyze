"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box } from "lucide-react";
import { useDraggable, type Position } from "@/hooks/useDraggable";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { CUBE_BUTTON_SENTINEL } from "./definition";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function getDefaultPos(): Position {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: window.innerWidth - 72,
    y: Math.round((window.innerHeight - 48) / 2),
  };
}

/** True if the position is the sentinel value (meaning "use dynamic default"). */
function isSentinel(pos: Position): boolean {
  return pos.x === CUBE_BUTTON_SENTINEL.x && pos.y === CUBE_BUTTON_SENTINEL.y;
}

/** True if the position is finite (rejects NaN / Infinity / corrupt values). */
function isFinitePosition(pos: Position | undefined): pos is Position {
  return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y);
}

/** True if the button (48×48) would be at least partially inside the viewport. */
function isOnScreen(pos: Position): boolean {
  if (typeof window === "undefined") return true;
  const W = 48;
  const H = 48;
  return (
    pos.x < window.innerWidth &&
    pos.x + W > 0 &&
    pos.y < window.innerHeight &&
    pos.y + H > 0
  );
}

export interface FloatingCubeButtonProps {
  /** Fired on click (pointer-up without drag). */
  onClick: () => void;
  /** Whether a Smart Cube is connected. */
  smartCubeConnected?: boolean;
  /** Whether the 3D cube panel is currently open. */
  cubePanelOpen?: boolean;
}

/**
 * Circular floating button to open the 3D cube panel.
 *
 * Special widget — rendered directly in App.tsx, NOT through WidgetHost.
 * Does NOT participate in the dock system. Can be toggled on/off in the
 * Widget Explorer. Disappears when the cube panel is open, reappears when
 * it closes. Position is persisted via widgetStore.
 */
export function FloatingCubeButton({
  onClick,
  smartCubeConnected: _smartCubeConnected = true,
  cubePanelOpen = false,
}: FloatingCubeButtonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Read position from widgetStore. Sentinel (-99999, -99999) = compute dynamically.
  const instance = useWidgetStore(
    useCallback((s) => s.instances["cube-button"], []),
  );
  const rawPosition = instance?.position;

  // Self-heal: if the persisted position is corrupt (NaN, Infinity), missing,
  // or left over from a different window size (off-screen), reset it to the
  // dynamic default so a future toggle can never resurrect the invisible state.
  useEffect(() => {
    const p = widgetStore.getState().instances["cube-button"]?.position;
    if (!p) {
      widgetStore.getState().setPosition("cube-button", getDefaultPos());
    } else if (!isSentinel(p) && (!isFinitePosition(p) || !isOnScreen(p))) {
      widgetStore.getState().setPosition("cube-button", getDefaultPos());
    }
  }, []);

  // `storePosition` is always truthy: corrupt / sentinel values fall back to
  // the dynamic default, so it's safe to pass directly to useDraggable.
  const storePosition =
    rawPosition && !isSentinel(rawPosition) && isFinitePosition(rawPosition)
      ? rawPosition
      : getDefaultPos();

  const handlePositionChange = useCallback(
    (pos: Position) => {
      widgetStore.getState().setPosition("cube-button", pos);
    },
    [],
  );

  const drag = useDraggable<HTMLButtonElement>(storePosition, {
    clickThreshold: 5,
    onPositionChange: handlePositionChange,
  });

  if (!mounted || cubePanelOpen) return null;

  const handlePointerUp = (e: React.PointerEvent) => {
    const dragged = drag.wasDrag();
    drag.onPointerUp(e);
    if (!dragged) onClick();
  };

  return createPortal(
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={drag.elementRef}
          data-widget-id="cube-button"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={drag.onPointerCancel}
          style={{
            // CRITICAL: `position:fixed` with ONLY transform and no left/top
            // renders the element at its static-flow position (potentially
            // off-screen when portaled to document.body). Anchoring at (0,0)
            // makes translate3d offset from the viewport origin — same
            // semantics as left/top. Mirrors FloatingWidgetWrapper.
            position: "fixed",
            left: 0,
            top: 0,
            transform: `translate3d(${drag.position.x}px, ${drag.position.y}px, 0)`,
            transformOrigin: "0 0",
            willChange: drag.isDragging ? "transform" : undefined,
            animation: "widgetMount 0.2s ease-out",
          }}
          className={
            "fixed z-[45] grid size-12 touch-none select-none place-items-center " +
            "rounded-full border border-line bg-surface shadow-lg " +
            "transition-colors hover:border-ink-2/40 " +
            (drag.isDragging ? "cursor-grabbing" : "cursor-pointer")
          }
          aria-label="Open 3D cube view"
        >
          <Box className="size-5 text-ink-2" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Open 3D cube</TooltipContent>
    </Tooltip>,
    document.body,
  );
}
