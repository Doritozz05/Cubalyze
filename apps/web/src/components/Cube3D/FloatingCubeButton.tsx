"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Box } from "lucide-react";
import { useDraggable, type Position } from "@/hooks/useDraggable";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";

function getDefaultPos(): Position {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: window.innerWidth - 72,
    y: Math.round((window.innerHeight - 48) / 2),
  };
}

export interface FloatingCubeButtonProps {
  /** Fired on click (pointer-up without drag). */
  onClick: () => void;
}

/**
 * Circular floating button shown when a Smart Cube is connected and the 3D
 * panel is closed. Draggable; click (vs. drag) opens the panel.
 *
 * Position is synced to widgetStore instead of per-widget localStorage.
 */
export function FloatingCubeButton({ onClick }: FloatingCubeButtonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Read position from widgetStore
  const instance = useWidgetStore(
    useCallback((s) => s.instances["cube-button"], []),
  );
  const storePosition = instance?.position ?? getDefaultPos();

  // Lazy-init default position (used as fallback)
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

  if (!mounted) return null;

  const handlePointerUp = (e: React.PointerEvent) => {
    const dragged = drag.wasDrag();
    drag.onPointerUp(e);
    if (!dragged) onClick();
  };

  return createPortal(
    <motion.button
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: drag.position.x, top: drag.position.y }}
      className={
        "fixed z-[45] grid size-12 touch-none select-none place-items-center " +
        "rounded-full border border-line bg-surface shadow-lg " +
        "transition-colors hover:border-ink-2/40 " +
        (drag.isDragging ? "cursor-grabbing" : "cursor-pointer")
      }
      aria-label="Open 3D cube view"
      title="Open 3D cube"
    >
      <Box className="size-5 text-ink-2" />
    </motion.button>,
    document.body,
  );
}
