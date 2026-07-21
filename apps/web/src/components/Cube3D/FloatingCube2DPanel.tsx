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

// csTimer classic speedcube colors — WCA standard scheme
const CSTIMER_COLOR_MAP: Record<string, string> = {
  U: "#ffffff", // White
  R: "#dc2626", // Red
  F: "#16a34a", // Green
  D: "#eab308", // Yellow
  L: "#f97316", // Orange
  B: "#2563eb", // Blue
};

/**
 * csTimer-style 2D Rubik's cube flat net SVG.
 *
 * Layout (cross-shaped net):
 *         ┌───┐
 *         │ U │
 *   ┌───┬─┴───┴─┬───┬───┐
 *   │ L │   F   │ R │ B │
 *   └───┬─┬───┬─┴───┴───┘
 *         │ D │
 *         └───┘
 */
function Cube2DSVG({
  parsedFacelets,
}: {
  parsedFacelets: Record<string, string[]> | null;
}) {
  const S = 22;      // sticker size
  const G = 1.8;     // gap between stickers within a face
  const FG = 10;     // gap between faces
  const BORDER = 1.8; // dark frame thickness around each face
  const PAD = BORDER + 8; // generous padding around full net so borders have plenty of space

  // Face dimensions
  const FACE = 3 * S + 2 * G;

  // Face top-left positions (col, row) offset by PAD
  const FACE_POS: Record<string, [number, number]> = {
    U: [PAD + FACE + FG, PAD + 0],
    L: [PAD + 0, PAD + FACE + FG],
    F: [PAD + FACE + FG, PAD + FACE + FG],
    R: [PAD + 2 * FACE + 2 * FG, PAD + FACE + FG],
    B: [PAD + 3 * FACE + 3 * FG, PAD + FACE + FG],
    D: [PAD + FACE + FG, PAD + 2 * FACE + 2 * FG],
  };

  const W = 4 * FACE + 3 * FG + PAD * 2;
  const H = 3 * FACE + 2 * FG + PAD * 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto max-w-[340px] select-none"
    >
      {Object.entries(FACE_POS).map(([face, [fx, fy]]) => {
        const stickers = parsedFacelets?.[face];
        const defaultColor = CSTIMER_COLOR_MAP[face];

        return (
          <g key={face}>
            {/* Subtle dark frame behind the face */}
            <rect
              x={fx - BORDER}
              y={fy - BORDER}
              width={FACE + BORDER * 2}
              height={FACE + BORDER * 2}
              fill="#111111"
              rx={2}
            />
            {/* 3×3 stickers */}
            {Array.from({ length: 9 }).map((_, i) => {
              const sr = Math.floor(i / 3);
              const sc = i % 3;
              const x = fx + sc * (S + G);
              const y = fy + sr * (S + G);

              const colorKey = stickers?.[i];
              const fill =
                colorKey && CSTIMER_COLOR_MAP[colorKey]
                  ? CSTIMER_COLOR_MAP[colorKey]
                  : defaultColor;

              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={S}
                  height={S}
                  fill={fill}
                  rx={1.5}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
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
        <span className="text-xs font-medium text-ink">Scramble 2D</span>
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
        "fixed z-45 flex flex-col touch-none select-none rounded-lg border border-line bg-surface shadow-xl",
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
          <span className="text-xs font-medium text-ink">Scramble 2D</span>
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

      {/* csTimer Style SVG Net Body */}
      <div className="p-2.5 flex justify-center items-center overflow-visible">
        <Cube2DSVG parsedFacelets={parsed} />
      </div>
    </motion.div>,
    document.body,
  );
}
