"use client";

import { useMemo } from "react";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetId } from "@/widgets/types";

/* ───────────────────────────────────────────────────────────────────────
 * Widget preview components
 *
 * Each preview is a small, simplified visual representation of a widget.
 * These are shown on the WidgetCard to give users a quick idea of what
 * the widget looks like before enabling it.
 * ─────────────────────────────────────────────────────────────────────── */

function TimesLogPreview() {
  return (
    <div className="flex flex-col gap-[2px] p-1.5">
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-ready" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[18px] rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/15" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[14px] rounded-sm bg-plus2-soft/50" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 w-3/4 rounded-sm bg-ink-3/15" />
      </div>
    </div>
  );
}

function Scramble2DPreview() {
  const S = 4;
  const G = 0.5;
  const FG = 2;
  const FACE = 3 * S + 2 * G;
  const PAD = 2;

  const colors = {
    U: "#ffffff",
    R: "#dc2626",
    F: "#16a34a",
    D: "#eab308",
    L: "#f97316",
    B: "#2563eb",
  };

  const faces: Record<string, [number, number]> = {
    U: [PAD + FACE + FG, PAD],
    L: [PAD, PAD + FACE + FG],
    F: [PAD + FACE + FG, PAD + FACE + FG],
    R: [PAD + 2 * FACE + 2 * FG, PAD + FACE + FG],
    B: [PAD + 3 * FACE + 3 * FG, PAD + FACE + FG],
    D: [PAD + FACE + FG, PAD + 2 * FACE + 2 * FG],
  };

  return (
    <svg viewBox="0 0 56 44" className="size-full">
      <rect width="56" height="44" fill="transparent" rx={2} />
      {Object.entries(faces).map(([face, [fx, fy]]) => {
        const c = colors[face as keyof typeof colors];
        return (
          <g key={face}>
            <rect
              x={fx - 0.5}
              y={fy - 0.5}
              width={FACE + 1}
              height={FACE + 1}
              fill="#111"
              rx={0.4}
            />
            {Array.from({ length: 9 }).map((_, i) => {
              const sr = Math.floor(i / 3);
              const sc = i % 3;
              return (
                <rect
                  key={i}
                  x={fx + sc * (S + G)}
                  y={fy + sr * (S + G)}
                  width={S}
                  height={S}
                  fill={c}
                  rx={0.3}
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
 * Clean isometric 3×3×3 Rubik's cube with simple, rock-solid SVG isometric projection.
 */
function Cube3DPreview() {
  // Simple isometric projection math:
  // Center front vertex: (24, 25)
  // Length of cube edge = 15
  // W-axis (down): (0, 15)
  // U-axis (right-up 30°): (13, -7.5)
  // V-axis (left-up 30°): (-13, -7.5)

  // 3x3 grid points for each face
  // Left face (Green): extends along V and W
  // Right face (Red): extends along U and W
  // Top face (White): extends along U and V (from top vertex)

  const cx = 24;
  const cy = 24;

  const u = [12.5, -7.2] as const;  // right-up
  const v = [-12.5, -7.2] as const; // left-up
  const w = [0, 14.4] as const;     // down

  // Colors
  const U_color = "#f8fafc";
  const F_color = "#16a34a";
  const R_color = "#dc2626";

  const pad = 0.08; // gap between stickers (8%)

  // Helper to calculate 4 vertices for a single sticker (r = 0..2, c = 0..2)
  const getCell = (
    origin: [number, number],
    dir1: readonly [number, number],
    dir2: readonly [number, number],
    r: number,
    c: number
  ) => {
    // Cell start in 0..1 normalized units of the face
    const s1 = c / 3 + pad / 6;
    const e1 = (c + 1) / 3 - pad / 6;
    const s2 = r / 3 + pad / 6;
    const e2 = (r + 1) / 3 - pad / 6;

    const p0 = [origin[0] + s1 * dir1[0] + s2 * dir2[0], origin[1] + s1 * dir1[1] + s2 * dir2[1]];
    const p1 = [origin[0] + e1 * dir1[0] + s2 * dir2[0], origin[1] + e1 * dir1[1] + s2 * dir2[1]];
    const p2 = [origin[0] + e1 * dir1[0] + e2 * dir2[0], origin[1] + e1 * dir1[1] + e2 * dir2[1]];
    const p3 = [origin[0] + s1 * dir1[0] + e2 * dir2[0], origin[1] + s1 * dir1[1] + e2 * dir2[1]];

    return `${p0[0].toFixed(2)},${p0[1].toFixed(2)} ${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} ${p3[0].toFixed(2)},${p3[1].toFixed(2)}`;
  };

  // Outer boundary vertices for the dark background frame
  const topPeak: [number, number] = [cx + u[0] + v[0], cy + u[1] + v[1]];
  const rightCorner: [number, number] = [cx + u[0], cy + u[1]];
  const bottomRight: [number, number] = [cx + u[0] + w[0], cy + u[1] + w[1]];
  const bottomPeak: [number, number] = [cx + w[0], cy + w[1]];
  const bottomLeft: [number, number] = [cx + v[0] + w[0], cy + v[1] + w[1]];
  const leftCorner: [number, number] = [cx + v[0], cy + v[1]];

  const outerFrame = [
    topPeak, rightCorner, bottomRight, bottomPeak, bottomLeft, leftCorner
  ].map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");

  return (
    <div className="grid size-full place-items-center">
      <svg viewBox="0 0 48 44" className="size-full max-h-11">
        {/* Drop shadow */}
        <ellipse cx={24} cy={41} rx={16} ry={3} fill="rgba(0,0,0,0.14)" />

        {/* Outer dark frame behind stickers */}
        <polygon points={outerFrame} fill="#111111" stroke="#111111" strokeWidth={1} strokeLinejoin="round" />

        {/* TOP FACE (White): Origin = cx,cy. dir1 = v, dir2 = u */}
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon
              key={`u-${r}-${c}`}
              points={getCell([cx, cy], v, u, r, c)}
              fill={U_color}
              rx={0.5}
            />
          ))
        )}

        {/* LEFT FACE (Green): Origin = cx,cy. dir1 = v, dir2 = w */}
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon
              key={`l-${r}-${c}`}
              points={getCell([cx, cy], v, w, r, c)}
              fill={F_color}
            />
          ))
        )}

        {/* RIGHT FACE (Red): Origin = cx,cy. dir1 = u, dir2 = w */}
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon
              key={`r-${r}-${c}`}
              points={getCell([cx, cy], u, w, r, c)}
              fill={R_color}
            />
          ))
        )}
      </svg>
    </div>
  );
}

/* ── Preview resolver ──────────────────────────────────────────────────── */

interface WidgetPreviewProps {
  widgetId: WidgetId;
  className?: string;
}

/** Renders a miniature preview of a widget's UI. */
export function WidgetPreview({ widgetId, className }: WidgetPreviewProps) {
  const preview = useMemo(() => {
    switch (widgetId) {
      case "times-log":
        return <TimesLogPreview />;
      case "scramble-2d":
        return <Scramble2DPreview />;
      case "cube-button":
        return <Cube3DPreview />;
      default:
        return (
          <div className="grid size-full place-items-center">
            <Box className="size-6 text-ink-3" />
          </div>
        );
    }
  }, [widgetId]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2/50",
        className,
      )}
    >
      {preview}
    </div>
  );
}
