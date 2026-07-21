"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Box, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable, type Position } from "@/hooks/useDraggable";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";

const STORAGE_KEY = "cubeforge:cube2dPanelPos";

function getDefaultPos(): Position {
  if (typeof window === "undefined") return { x: 72, y: 520 };
  return {
    x: 72,
    y: Math.min(520, window.innerHeight - 260),
  };
}

// Clean Rubik's color palette (sharp flat colors)
const FACE_COLOR_MAP: Record<string, string> = {
  U: "#ffffff", // White (Arriba)
  L: "#ff5800", // Orange (Izquierda)
  F: "#009b48", // Green (Front / Medio)
  R: "#b71234", // Red (Derecha)
  B: "#0046ad", // Blue (Back)
  D: "#ffd500", // Yellow (Abajo)
};

interface FaceGridProps {
  faceKey: string;
  stickers?: string[]; // 9 stickers for this face
  defaultColor: string;
}

function FaceGrid({ stickers, defaultColor }: FaceGridProps) {
  return (
    <div className="grid grid-cols-3 gap-px bg-neutral-900 p-px shadow-sm rounded-sm">
      {Array.from({ length: 9 }).map((_, i) => {
        const colorKey = stickers?.[i];
        const bg = colorKey && FACE_COLOR_MAP[colorKey] ? FACE_COLOR_MAP[colorKey] : defaultColor;
        return (
          <div
            key={i}
            className="size-3.5 sm:size-4 transition-colors rounded-[1px]"
            style={{ backgroundColor: bg }}
          />
        );
      })}
    </div>
  );
}

/**
 * Empty 3x3 slot helper to maintain 4-column symmetrical alignment
 */
function EmptySlot() {
  return <div className="size-11 sm:size-12.5" />;
}

/**
 * Parses 54-char Kociemba facelet string (UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB)
 * order: U (0-8), R (9-17), F (18-26), D (27-35), L (36-44), B (45-53)
 */
function parseFacelets(faceletsStr: string | null) {
  if (!faceletsStr || faceletsStr.length !== 54) return null;
  return {
    U: faceletsStr.slice(0, 9).split(""),
    R: faceletsStr.slice(9, 18).split(""),
    F: faceletsStr.slice(18, 27).split(""),
    D: faceletsStr.slice(27, 36).split(""),
    L: faceletsStr.slice(36, 45).split(""),
    B: faceletsStr.slice(45, 54).split(""),
  };
}

export interface FloatingCube2DPanelProps {
  scramble?: string;
  className?: string;
}

export function FloatingCube2DPanel({ scramble, className }: FloatingCube2DPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [liveFacelets, setLiveFacelets] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Subscribe to live facelets updates from smart cube if connected
    const sub = globalCubeAdapter.facelets$?.subscribe((f) => {
      setLiveFacelets(f);
    });

    return () => {
      sub?.unsubscribe();
    };
  }, []);

  // Compute effective facelets string:
  // 1. Live facelets if connected
  // 2. Scrambled facelets if scramble present
  // 3. Fallback: Solved cube default
  const displayFacelets = useMemo(() => {
    if (globalCubeAdapter.isConnected && liveFacelets) {
      return liveFacelets;
    }

    if (scramble && scramble.trim()) {
      try {
        const state = new CubeState();
        state.applySequence(scramble.trim());
        return FaceletStringConverter.toFaceletString(state);
      } catch (e) {
        console.warn("[FloatingCube2DPanel] Error applying scramble:", e);
      }
    }

    return null;
  }, [liveFacelets, scramble]);

  const [defaultPos] = useState(getDefaultPos);
  const drag = useDraggable<HTMLDivElement>(defaultPos, {
    storageKey: STORAGE_KEY,
    clickThreshold: 4,
  });

  if (!mounted) return null;

  const parsed = parseFacelets(displayFacelets);

  // ── Minimized: Exact same pill structure & styling as FloatingTimesPanel ──
  if (minimized) {
    return createPortal(
      <motion.div
        ref={drag.elementRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{ left: drag.position.x, top: drag.position.y }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "fixed z-45 flex touch-none select-none items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-3 pr-2 shadow-lg",
          drag.isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
          "transition-colors hover:border-ink-2/40",
          className
        )}
      >
        <Box className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">Scramble</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Expand"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  // ── Expanded: Exact container style as FloatingTimesPanel with symmetrical net ──
  return createPortal(
    <motion.div
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{
        left: drag.position.x,
        top: drag.position.y,
      }}
      className={cn(
        "fixed z-45 flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
        drag.isDragging && "shadow-2xl",
        className
      )}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "flex items-center justify-between border-b border-line px-3 py-2",
          drag.isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="flex items-center gap-2">
          <Box className="size-3.5 text-ink-3" />
          <span className="text-xs font-medium text-ink">Scramble</span>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(true);
          }}
          className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Minimize"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {/* Symmetrical Net Grid Body */}
      <div className="p-3">
        <div className="grid grid-cols-4 gap-1.5 justify-items-center">
          {/* Row 1: U aligned over F */}
          <EmptySlot />
          <FaceGrid faceKey="U" stickers={parsed?.U} defaultColor={FACE_COLOR_MAP.U} />
          <EmptySlot />
          <EmptySlot />

          {/* Row 2: L, F, R, B */}
          <FaceGrid faceKey="L" stickers={parsed?.L} defaultColor={FACE_COLOR_MAP.L} />
          <FaceGrid faceKey="F" stickers={parsed?.F} defaultColor={FACE_COLOR_MAP.F} />
          <FaceGrid faceKey="R" stickers={parsed?.R} defaultColor={FACE_COLOR_MAP.R} />
          <FaceGrid faceKey="B" stickers={parsed?.B} defaultColor={FACE_COLOR_MAP.B} />

          {/* Row 3: D aligned under F */}
          <EmptySlot />
          <FaceGrid faceKey="D" stickers={parsed?.D} defaultColor={FACE_COLOR_MAP.D} />
          <EmptySlot />
          <EmptySlot />
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
