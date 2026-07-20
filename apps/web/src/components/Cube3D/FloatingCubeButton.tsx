"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Box } from "lucide-react";
import { useDraggable, type Position } from "@/hooks/useDraggable";

const STORAGE_KEY = "cubeforge:cubeBtnPos";

function getDefaultPos(): Position {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: window.innerWidth - 76,
    y: window.innerHeight - 140,
  };
}

export interface FloatingCubeButtonProps {
  /** Fired on click (pointer-up without drag). */
  onClick: () => void;
}

/**
 * Circular floating button shown when a Smart Cube is connected and the 3D
 * panel is closed. Draggable; click (vs. drag) opens the panel. Position is
 * persisted to localStorage.
 *
 * Portaled to `document.body` so it floats above the layout.
 */
export function FloatingCubeButton({ onClick }: FloatingCubeButtonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lazy-init the default position once (window is available post-mount).
  const [defaultPos] = useState(getDefaultPos);
  const drag = useDraggable(defaultPos, {
    storageKey: STORAGE_KEY,
    clickThreshold: 5,
  });

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
        "fixed z-40 grid size-12 touch-none select-none place-items-center " +
        "rounded-full border border-line bg-surface shadow-lg " +
        "transition-colors hover:border-ink-2/40 " +
        (drag.isDragging ? "cursor-grabbing" : "cursor-pointer")
      }
      aria-label="Open 3D cube view"
      title="Open 3D cube"
    >
      <Box className="size-5 text-ink-2" />
      {/* Connected indicator dot */}
      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-blue-500 ring-2 ring-surface" />
    </motion.button>,
    document.body,
  );
}
