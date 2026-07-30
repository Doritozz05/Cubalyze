"use client";

/**
 * 2D Case Diagram for 2×2×2 cubes (Ortega OLL / PBL).
 *
 * Renders a 2×2 grid for the U face with surrounding side strips,
 * similar to the 3×3 CaseDiagram but adapted for 2×2 corner-only facelets.
 *
 * Layout:
 *         ┌────┬────┐    ← B face (2 corner stickers)
 *    ┌────┼────┼────┼────┐
 *    │ L  │ U0 │ U2 │ R  │
 *    │    ├────┼────┤    │
 *    │ L  │ U6 │ U8 │ R  │
 *    └────┼────┼────┼────┘
 *         │ F0 │ F1 │    ← F face (2 corner stickers)
 *         └────┴────┘
 *
 * Facelet colors are extracted from the 54-element 3×3 format
 * (which contains the correct corner colors for 2×2 algorithms).
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import type { VisualizationStyle } from "@cubeforge/algorithm-db";

// ─── WCA standard color map ────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  W: "#ffffff",
  R: "#dc2626",
  G: "#16a34a",
  Y: "#eab308",
  O: "#f97316",
  B: "#2563eb",
  "#": "#505050",
};

// ─── Geometry ──────────────────────────────────────────────────────────────
// U face: 2×2 grid. Side strips show the top 2 corner stickers.

const S = 28;          // sticker size
const G = 2.5;         // gap
const SH = 8;          // side strip thickness
const PAD = 4;         // outer padding
const BORDER_W = 3;    // U face border

const FACE_W = 2 * S + G;      // width of 2×2 face = 58.5

const UX = PAD + SH + G;       // U face X
const UY = PAD + SH + G;       // U face Y

const TOTAL = PAD * 2 + SH + G + FACE_W + G + SH;  // total SVG size

// ─── Facelet indices in the 54-char 3×3 format for 2×2 corners ─────────────
// These extract ONLY corner facelets from the 3×3 grid layout.

const U_CORNERS = [0, 2, 6, 8];     // ULB, UBR, UFL, URF (2×2 grid)
const B_STRIP = [47, 45];            // B-face top row: ULB, UBR
const L_STRIP = [36, 38];            // L-face left col: ULB, UFL
const R_STRIP = [11, 9];             // R-face right col: UBR, URF
const F_STRIP = [18, 20];            // F-face top row: UFL, URF

// ─── Layout positions ─────────────────────────────────────────────────────

/** Where to place each of the 4 U-face stickers in a 2×2 grid. */
const U_POSITIONS = [
  { x: UX, y: UY },                                     // U0: top-left
  { x: UX + S + G, y: UY },                             // U2: top-right
  { x: UX, y: UY + S + G },                             // U6: bottom-left
  { x: UX + S + G, y: UY + S + G },                     // U8: bottom-right
];

/** Side strip positions: [faceName, isHorizontal, indices, startX, startY] */
const STRIPS: [string, boolean, number[], number, number][] = [
  ['B', true, B_STRIP, UX, PAD],                                          // B: top horizontal
  ['F', true, F_STRIP, UX, UY + FACE_W + G],                              // F: bottom horizontal
  ['L', false, L_STRIP, PAD, UY],                                          // L: left vertical
  ['R', false, R_STRIP, PAD + SH + G + FACE_W + G, UY],                  // R: right vertical
];

// ─── Props ─────────────────────────────────────────────────────────────────

export interface Case2x2DiagramProps {
  /** Pre-computed facelet colors (54 elements). Takes priority over moves. */
  faceletColors?: string[];
  /** Setup scramble — canonical source for diagram generation. */
  setupScramble?: string;
  /** Algorithm moves for dynamic facelet generation (fallback). */
  moves?: string[];
  /** Visualization style (yellow-gray for OLL, full-color for PBL, etc.). */
  style?: VisualizationStyle;
  showGray?: boolean;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Case2x2Diagram({
  faceletColors: faceletColorsProp,
  setupScramble,
  moves,
  style = "full-color",
  showGray = true,
  className,
}: Case2x2DiagramProps) {
  // Generate facelet colors from the canonical pipeline
  const faceletColors = useMemo(() => {
    if (faceletColorsProp) return faceletColorsProp;
    if (setupScramble) {
      try {
        const { diagramColors } =
          CaseStateGenerator.generateFromScrambleVisualization(setupScramble, style);
        return diagramColors;
      } catch {
        // fall through
      }
    }
    if (moves && moves.length > 0) {
      try {
        const { diagramColors } = CaseStateGenerator.generateCaseVisualization(moves, style);
        return diagramColors;
      } catch {
        return [];
      }
    }
    return [];
  }, [faceletColorsProp, setupScramble, moves, style]);

  function stickerColor(idx: number, defaultColor: string): string {
    const c = faceletColors[idx];
    if (!c || c === "#") return showGray ? COLOR_MAP["#"] : "#262626";
    return COLOR_MAP[c] ?? defaultColor;
  }

  return (
    <svg
      viewBox={`0 0 ${TOTAL} ${TOTAL}`}
      className={cn("w-full h-auto max-w-60 select-none", className)}
    >
      <rect width={TOTAL} height={TOTAL} fill="transparent" rx={6} />

      {/* ── U face (2×2 grid) ── */}
      <rect
        x={UX - BORDER_W}
        y={UY - BORDER_W}
        width={FACE_W + BORDER_W * 2}
        height={FACE_W + BORDER_W * 2}
        fill="#111111"
        rx={3}
      />
      {U_POSITIONS.map((pos, i) => {
        const idx = U_CORNERS[i];
        const isGray = faceletColors[idx] === "#";
        return (
          <rect
            key={`u-${idx}`}
            x={pos.x}
            y={pos.y}
            width={S}
            height={S}
            fill={stickerColor(idx, COLOR_MAP.W)}
            rx={2.5}
            opacity={isGray ? 0.75 : 1}
          />
        );
      })}

      {/* ── Side strips ── */}
      {STRIPS.map(([face, isHorizontal, indices, sx, sy]) => {
        const defaultColor =
          face === "L" ? COLOR_MAP.O
          : face === "F" ? COLOR_MAP.G
          : face === "B" ? COLOR_MAP.B
          : COLOR_MAP.R;

        const stripW = isHorizontal ? FACE_W : SH;
        const stripH = isHorizontal ? SH : FACE_W;

        return (
          <g key={`strip-${face}`}>
            {/* Background */}
            <rect
              x={sx - 1.5}
              y={sy - 1.5}
              width={stripW + 3}
              height={stripH + 3}
              fill="#111111"
              rx={2}
            />
            {indices.map((idx, j) => {
              const isGray = faceletColors[idx] === "#";
              if (isHorizontal) {
                return (
                  <rect
                    key={`s-${idx}`}
                    x={sx + j * (S + G)}
                    y={sy}
                    width={S}
                    height={SH}
                    fill={stickerColor(idx, defaultColor)}
                    rx={1.5}
                    opacity={isGray ? 0.75 : 1}
                  />
                );
              }
              return (
                <rect
                  key={`s-${idx}`}
                  x={sx}
                  y={sy + j * (S + G)}
                  width={SH}
                  height={S}
                  fill={stickerColor(idx, defaultColor)}
                  rx={1.5}
                  opacity={isGray ? 0.75 : 1}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
