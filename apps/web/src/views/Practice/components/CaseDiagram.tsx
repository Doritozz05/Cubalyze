"use client";

/**
 * 2D Case Diagram — SVG visualization of any algorithm case (PLL, OLL, etc.).
 *
 * Replacement for PLLDiagram with added support for:
 *   - Dynamic facelet generation from algorithm moves (via CaseStateGenerator)
 *   - Visualization styles: 'full-color' (PLL) and 'yellow-gray' (OLL)
 *   - Backward-compatible with hardcoded faceletColors
 *
 * Layout (cross pattern):
 *   ┌─────────────────────────┐
 *   │       B B B (top)       │
 *   ├─────┬───────────┬───────┤
 *   │ L   │           │   R   │
 *   │ L L │  U U U    │ R R R │
 *   ├─────┴───────────┴───────┤
 *   │       F F F (bot)       │
 *   └─────────────────────────┘
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import type { VisualizationStyle, ArrowDef } from "@cubeforge/algorithm-db";

// WCA standard color map
const COLOR_MAP: Record<string, string> = {
  W: "#ffffff",
  R: "#dc2626",
  G: "#16a34a",
  Y: "#eab308",
  O: "#f97316",
  B: "#2563eb",
  "#": "#505050",
};

export interface CaseDiagramProps {
  /** Pre-computed facelet colors (54 elements). Takes priority over moves. */
  faceletColors?: string[];
  /** Algorithm moves for dynamic facelet generation (alternative to faceletColors). */
  moves?: string[];
  /** Visualization style for dynamic generation (default: 'full-color'). */
  style?: VisualizationStyle;
  arrows?: ArrowDef[];
  showGray?: boolean;
  className?: string;
}

const STICKER = 26;
const GAP = 2.5;
const STRIP_H = 7;
const PAD = 4;
const BORDER_W = 3;

const S = STICKER;
const G = GAP;
const SH = STRIP_H;
const FACE_W = 3 * S + 2 * G;

const UX = PAD + SH + G;
const UY = PAD + SH + G;

const layout: Record<string, { x: number; y: number }> = {
  B: { x: UX, y: PAD },
  L: { x: PAD, y: UY },
  R: { x: UX + FACE_W + G, y: UY },
  F: { x: UX, y: UY + FACE_W + G },
};

const TOTAL = PAD * 2 + SH + G + FACE_W + G + SH;

const faceIndices: Record<string, number[]> = {
  B: [47, 46, 45], // top horizontal (left to right: ULB, UB, UBR)
  L: [36, 37, 38], // left vertical (top to bottom: ULB, UL, UFL)
  R: [11, 10, 9],  // right vertical (top to bottom: UBR, UR, URF)
  F: [18, 19, 20], // bottom horizontal (left to right: UFL, UF, URF)
};

/**
 * Render a 2D algorithm case diagram.
 *
 * Two ways to provide facelets:
 *   1. `faceletColors` (backward compat) — pre-computed 54-element array
 *   2. `moves` + `style` — dynamic generation via CaseStateGenerator
 */
export function CaseDiagram({
  faceletColors: faceletColorsProp,
  moves,
  style = "full-color",
  arrows = [],
  showGray = true,
  className,
}: CaseDiagramProps) {
  // Dynamic facelet generation when moves are provided without faceletColors
  const faceletColors = useMemo(() => {
    if (faceletColorsProp) return faceletColorsProp;
    if (moves && moves.length > 0) {
      try {
        const { diagramColors } = CaseStateGenerator.generateCaseVisualization(
          moves,
          style,
        );
        return diagramColors;
      } catch {
        // Fallback: return empty array if generation fails
        return [];
      }
    }
    return [];
  }, [faceletColorsProp, moves, style]);

  function stickerColor(faceletIdx: number, defaultColor: string): string {
    const c = faceletColors[faceletIdx];
    if (!c || c === "#") return showGray ? COLOR_MAP["#"] : "#262626";
    return COLOR_MAP[c] ?? defaultColor;
  }

  return (
    <svg
      viewBox={`0 0 ${TOTAL} ${TOTAL}`}
      className={cn("w-full h-auto max-w-85 select-none", className)}
    >
      <rect width={TOTAL} height={TOTAL} fill="transparent" rx={6} />

      {/* ── U face (9 full stickers) ── */}
      <rect
        x={UX - BORDER_W}
        y={UY - BORDER_W}
        width={FACE_W + BORDER_W * 2}
        height={FACE_W + BORDER_W * 2}
        fill="#111111"
        rx={3}
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const idx = r * 3 + c;
        return (
          <rect
            key={`u-${idx}`}
            x={UX + c * (S + G)}
            y={UY + r * (S + G)}
            width={S}
            height={S}
            fill={stickerColor(idx, COLOR_MAP.W)}
            rx={2.5}
            opacity={faceletColors[idx] === "#" ? 0.75 : 1}
          />
        );
      })}

      {/* ── Side strips ── */}
      {(Object.entries(layout) as [string, { x: number; y: number }][]).map(
        ([face, pos]) => {
          const isHorizontal = face === "F" || face === "B";
          const defaultColor =
            face === "L" ? COLOR_MAP.O
            : face === "F" ? COLOR_MAP.G
            : face === "B" ? COLOR_MAP.B
            : COLOR_MAP.R;

          const indices = faceIndices[face];

          if (isHorizontal) {
            return (
              <g key={`side-${face}`}>
                <rect
                  x={pos.x - 1.5}
                  y={pos.y - 1.5}
                  width={FACE_W + 3}
                  height={SH + 3}
                  fill="#111111"
                  rx={2}
                />
                {[0, 1, 2].map((col) => {
                  const idx = indices[col];
                  const isGray = faceletColors[idx] === "#";
                  return (
                    <rect
                      key={`side-${idx}`}
                      x={pos.x + col * (S + G)}
                      y={pos.y}
                      width={S}
                      height={SH}
                      fill={stickerColor(idx, defaultColor)}
                      rx={1.5}
                      opacity={isGray ? 0.75 : 1}
                    />
                  );
                })}
              </g>
            );
          }

          return (
            <g key={`side-${face}`}>
              <rect
                x={pos.x - 1.5}
                y={pos.y - 1.5}
                width={SH + 3}
                height={FACE_W + 3}
                fill="#111111"
                rx={2}
              />
              {[0, 1, 2].map((row) => {
                const idx = indices[row];
                const isGray = faceletColors[idx] === "#";
                return (
                  <rect
                    key={`side-${idx}`}
                    x={pos.x}
                    y={pos.y + row * (S + G)}
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
        },
      )}

      {/* ── Arrows (on U face) ── */}
      {arrows.map((arrow, i) => {
        if (!arrow.from || !arrow.to) return null;
        const fx = UX + arrow.from[0] * (S + G) + S / 2;
        const fy = UY + arrow.from[1] * (S + G) + S / 2;
        const tx = UX + arrow.to[0] * (S + G) + S / 2;
        const ty = UY + arrow.to[1] * (S + G) + S / 2;

        return (
          <line
            key={`arrow-${i}`}
            x1={fx}
            y1={fy}
            x2={tx}
            y2={ty}
            stroke={arrow.color ?? "#ffffff"}
            strokeWidth={2}
            opacity={0.6}
            markerEnd="url(#case-arrowhead)"
          />
        );
      })}

      <defs>
        <marker
          id="case-arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#ffffff" opacity={0.6} />
        </marker>
      </defs>
    </svg>
  );
}
