"use client";

/**
 * 2D PLL Diagram — SVG visualization of a PLL case.
 *
 * Layout (cross pattern):
 *   ┌─────────────────────────┐
 *   │       B B B (top)       │  ← SH-tall horizontal strip
 *   ├─────┬───────────┬───────┤
 *   │ L   │           │   R   │
 *   │ L L │  U U U    │ R R R │  ← U face (FACE_W × FACE_W)
 *   │     │  U U U    │       │
 *   │     │  U U U    │       │
 *   ├─────┴───────────┴───────┤
 *   │       F F F (bot)       │  ← SH-tall horizontal strip
 *   └─────────────────────────┘
 */

import { cn } from "@/lib/utils";

// WCA standard color map
const COLOR_MAP: Record<string, string> = {
  W: "#ffffff",
  R: "#dc2626",
  G: "#16a34a",
  Y: "#eab308",
  O: "#f97316",
  B: "#2563eb",
  "#": "#2a2a2a",
};

export interface PLLDiagramProps {
  faceletColors: string[];
  arrows?: { from: [number, number]; to: [number, number]; color?: string }[];
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

// Layout positions — U face centered with thin strips around it
const UX = PAD + SH + G;
const UY = PAD + SH + G;

const layout = {
  B: { x: UX, y: PAD },
  L: { x: PAD, y: UY },
  R: { x: UX + FACE_W + G, y: UY },
  F: { x: UX, y: UY + FACE_W + G },
};

// Total SVG size (square cross)
const TOTAL = PAD * 2 + SH + G + FACE_W + G + SH;

export function PLLDiagram({
  faceletColors,
  arrows = [],
  showGray = true,
  className,
}: PLLDiagramProps) {
  function stickerColor(faceletIdx: number, defaultColor: string): string {
    const c = faceletColors[faceletIdx];
    if (!c || c === "#") return showGray ? COLOR_MAP["#"] : "#1a1a1a";
    return COLOR_MAP[c] ?? defaultColor;
  }

  return (
    <svg
      viewBox={`0 0 ${TOTAL} ${TOTAL}`}
      className={cn("w-full h-auto max-w-[340px] select-none", className)}
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
            opacity={faceletColors[idx] === "#" ? 0.35 : 1}
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

          const faceStart: Record<string, number> = {
            R: 9,
            F: 18,
            L: 36,
            B: 45,
          };
          const startIdx = faceStart[face];

          if (isHorizontal) {
            // F or B: horizontal strip, 3 stickers wide, SH tall
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
                  const idx = startIdx + col;
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
                      opacity={isGray ? 0.3 : 1}
                    />
                  );
                })}
              </g>
            );
          }

          // L or R: vertical strip, SH wide, 3 stickers tall
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
                const idx = startIdx + row;
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
                      opacity={isGray ? 0.3 : 1}
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
            markerEnd="url(#pll-arrowhead)"
          />
        );
      })}

      <defs>
        <marker
          id="pll-arrowhead"
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
