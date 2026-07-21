"use client";

import { useMemo } from "react";
import { Grid3x3 } from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";

// csTimer classic speedcube colors — WCA standard scheme
const CSTIMER_COLOR_MAP: Record<string, string> = {
  U: "#ffffff",
  R: "#dc2626",
  F: "#16a34a",
  D: "#eab308",
  L: "#f97316",
  B: "#2563eb",
};

/**
 * csTimer-style 2D Rubik's cube flat net SVG.
 */
function Cube2DSVG({
  parsedFacelets,
}: {
  parsedFacelets: Record<string, string[]> | null;
}) {
  const S = 22;
  const G = 1.8;
  const FG = 10;
  const BORDER = 1.8;
  const PAD = BORDER + 8;

  const FACE = 3 * S + 2 * G;

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
            <rect
              x={fx - BORDER}
              y={fy - BORDER}
              width={FACE + BORDER * 2}
              height={FACE + BORDER * 2}
              fill="#111111"
              rx={2}
            />
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

/**
 * Floating 2D cube net panel showing the current scramble state.
 * Uses FloatingWidgetWrapper for all portal/drag/minimize behavior.
 */
export function FloatingCube2DPanel({ scramble, className }: FloatingCube2DPanelProps) {
  const displayFacelets = useMemo(() => {
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
  }, [scramble]);

  const parsed = parseFacelets(displayFacelets);

  return (
    <FloatingWidgetWrapper
      widgetId="scramble-2d"
      icon={Grid3x3}
      label="Scramble"
      defaultPosition={{ x: 72, y: 520 }}
      className={className}
    >
      <div className="p-2.5 flex justify-center items-center overflow-visible">
        <Cube2DSVG parsedFacelets={parsed} />
      </div>
    </FloatingWidgetWrapper>
  );
}
