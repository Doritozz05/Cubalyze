"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
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

  // Read position from widgetStore. Sentinel (-1, -1) = compute dynamically.
  const instance = useWidgetStore(
    useCallback((s) => s.instances["cube-button"], []),
  );
  const rawPosition = instance?.position;
  const storePosition =
    rawPosition && !isSentinel(rawPosition) ? rawPosition : getDefaultPos();
  const [defaultPos] = useState(getDefaultPos);

  const handlePositionChange = useCallback(
    (pos: Position) => {
      widgetStore.getState().setPosition("cube-button", pos);
    },
    [],
  );

  const drag = useDraggable<HTMLButtonElement>(
    storePosition || defaultPos,
    {
      clickThreshold: 5,
      onPositionChange: handlePositionChange,
    },
  );

  if (!mounted || cubePanelOpen) return null;

  const handlePointerUp = (e: React.PointerEvent) => {
    const dragged = drag.wasDrag();
    drag.onPointerUp(e);
    if (!dragged) onClick();
  };

  return createPortal(
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          ref={drag.elementRef}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={drag.onPointerCancel}
          style={{
            transform: `translate3d(${drag.position.x}px, ${drag.position.y}px, 0)`,
            transformOrigin: "0 0",
          }}
          className={
            "fixed z-45 grid size-12 touch-none select-none place-items-center " +
            "rounded-full border border-line bg-surface shadow-lg " +
            "transition-colors hover:border-ink-2/40 " +
            (drag.isDragging ? "cursor-grabbing" : "cursor-pointer")
          }
          aria-label="Open 3D cube view"
        >
          <Box className="size-5 text-ink-2" />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="left">Open 3D cube</TooltipContent>
    </Tooltip>,
    document.body,
  );
}
