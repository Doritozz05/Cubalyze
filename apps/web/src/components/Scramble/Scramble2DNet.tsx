"use client";

import { useMemo } from "react";
import {
  CubeState,
  FaceletStringConverter,
  Cube2x2State,
  Cube2x2FaceletConverter,
} from "@cubalyze/math-core";

// csTimer classic speedcube colors — WCA standard scheme
const CSTIMER_COLOR_MAP: Record<string, string> = {
  U: "#ffffff",
  R: "#dc2626",
  F: "#16a34a",
  D: "#eab308",
  L: "#f97316",
  B: "#2563eb",
};

/** Return true when the scramble sequence represents a 2×2 scramble. */
function isTwoByTwoScramble(scramble: string): boolean {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  // Pure U, R, F scramble (WCA standard for 2×2)
  if (tokens.every((t) => /^[URF]'?2?$/i.test(t))) return true;

  // Short scramble (<= 14 moves) without 3×3 slice moves (M, E, S)
  if (tokens.length <= 14 && !tokens.some((t) => /^[MES]'?2?$/i.test(t))) {
    return true;
  }

  return false;
}

/** Parse a facelet string into per-face stickers. Handles 24-char (2×2) and 54-char (3×3). */
function parseFacelets(faceletsStr: string | null, size: number) {
  if (!faceletsStr) return null;
  const expected = size * size * 6;
  if (faceletsStr.length !== expected) return null;

  const faces: Record<string, string[]> = {};
  const faceOrder = ["U", "R", "F", "D", "L", "B"] as const;
  const perFace = size * size;

  for (let i = 0; i < 6; i++) {
    faces[faceOrder[i]] = faceletsStr.slice(i * perFace, (i + 1) * perFace).split("");
  }
  return faces;
}

/**
 * csTimer-style 2D Rubik's cube flat net SVG.
 * Supports both 2×2 (size=2) and 3×3 (size=3).
 */
function Cube2DSVG({
  parsedFacelets,
  size,
  compact = false,
}: {
  parsedFacelets: Record<string, string[]> | null;
  size: number;
  compact?: boolean;
}) {
  // Scale sticker size based on cube order
  const S = size === 2 ? 30 : 22;
  const G = 1.8;
  const FG = size === 2 ? 6 : 10;
  const BORDER = 1.8;
  const PAD = BORDER + 8;
  const FACE = size * S + (size - 1) * G;

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
      className={`w-full h-auto select-none ${compact ? "max-w-28 max-lg:max-w-20" : "max-w-85"}`}
    >
      {Object.entries(FACE_POS).map(([face, [fx, fy]]) => {
        const stickers = parsedFacelets?.[face];
        const defaultColor = CSTIMER_COLOR_MAP[face];

        return (
          <g key={face}>
            <rect
              x={fx - BORDER}
              y={fy - BORDER}
              width={FACE + BORDER * 2}
              height={FACE + BORDER * 2}
              fill="#111111"
              rx={2}
            />
            {Array.from({ length: size * size }).map((_, i) => {
              const sr = Math.floor(i / size);
              const sc = i % size;
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
                  rx={size === 2 ? 2.5 : 1.5}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** Apply a scramble and return the facelet string + cube size for the 2D net. */
function compute2DFacelets(
  scramble: string | undefined,
): { facelets: string; size: number } | null {
  if (scramble && scramble.trim()) {
    try {
      if (isTwoByTwoScramble(scramble)) {
        const state = new Cube2x2State();
        state.applySequence(scramble.trim());
        return {
          facelets: Cube2x2FaceletConverter.toFaceletString(state),
          size: 2,
        };
      }
      const state = new CubeState();
      state.applySequence(scramble.trim());
      return {
        facelets: FaceletStringConverter.toFaceletString(state),
        size: 3,
      };
    } catch (e) {
      console.warn("[Scramble2DNet] Error applying scramble:", e);
    }
  }
  return null;
}

export interface Scramble2DNetProps {
  scramble?: string;
  className?: string;
  /** Render a small net (for tight layout cells) instead of the full-size one. */
  compact?: boolean;
}

/**
 * Lightweight 2D cube net for the current scramble (no floating chrome).
 * Shared by the floating scramble-2d widget and the bottom layout, where the
 * top scramble display stays in place and this renders inside a cell.
 */
export function Scramble2DNet({ scramble, className, compact = false }: Scramble2DNetProps) {
  const displayFacelets = useMemo(() => compute2DFacelets(scramble), [scramble]);
  const parsed = displayFacelets
    ? parseFacelets(displayFacelets.facelets, displayFacelets.size)
    : null;
  const size = displayFacelets?.size ?? 3;

  return (
    <div className={className}>
      <Cube2DSVG parsedFacelets={parsed} size={size} compact={compact} />
    </div>
  );
}
