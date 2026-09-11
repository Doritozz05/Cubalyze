"use client";

/**
 * GearGlyph.tsx — procedural product render for a collection item.
 *
 * There is no photo pipeline, so every item is drawn: an isometric cube built
 * from its own sticker palette. That is deliberate — the palette is data the
 * model already carries, so the render is meaningful (this is *your* cube, in
 * *its* colours) rather than a placeholder icon.
 *
 * Geometry (side 1, height h, 30° isometric):
 *
 *     A = ( cos30,  sin30)   top edge going right-down
 *     B = (-cos30,  sin30)   top edge going left-down
 *     C = (     0,      h)   straight down
 *     T = ( cos30,      0)   topmost vertex
 *
 * Every face is the unit square mapped by one matrix, so a face's 3×3 stickers
 * are plain rects in local [0,1]² coordinates that inherit the projection.
 *
 * Gear (non-cube categories) renders as a flat "plate" using the same
 * three-face language (height ≈ 0.22, solid faces) so the grid stays even.
 */

import { useId, useMemo } from "react";
import { stickerStateFor, type GearItem } from "./collectionModel";

/** cos(30°) — the isometric horizontal unit. */
const COS30 = 0.8660254;
const SIN30 = 0.5;

/** Face indices into the palette, in U D F B R L order. */
const FACE = { U: 0, D: 1, F: 2, B: 3, R: 4, L: 5 } as const;

/** Degrade a #rrggbb colour by `factor` (0 = black, 1 = unchanged). */
function shade(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = Math.round(((value >> 16) & 0xff) * factor);
  const g = Math.round(((value >> 8) & 0xff) * factor);
  const b = Math.round((value & 0xff) * factor);
  return `rgb(${r} ${g} ${b})`;
}

/** Which palette face each visible side of the render shows. */
const VISIBLE = { top: FACE.U, left: FACE.F, right: FACE.R } as const;

const FACE_SHADE = { top: 1, left: 0.87, right: 0.64 } as const;

/** Sticker gap and corner radius, in face-local units. */
const GAP = 0.042;
const STICKER_RADIUS = 0.05;
const FRAME_RADIUS = 0.075;

/** One visible face: the plastic frame + (for cubes) its 3×3 stickers. */
function Face({
  transform,
  colour,
  stickers,
  shadeFactor,
  plate,
}: {
  transform: string;
  colour: string;
  stickers: readonly string[] | null;
  shadeFactor: number;
  plate: boolean;
}) {
  return (
    <g transform={transform}>
      {/* Plastic body behind the stickers. */}
      <rect x="0" y="0" width="1" height="1" rx={FRAME_RADIUS} fill="#101418" opacity="0.92" />
      {plate ? (
        <rect
          x={GAP}
          y={GAP}
          width={1 - GAP * 2}
          height={1 - GAP * 2}
          rx={FRAME_RADIUS * 0.8}
          fill={shade(colour, shadeFactor)}
        />
      ) : (
        (stickers ?? []).map((sticker, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const cell = 1 / 3;
          return (
            <rect
              key={index}
              x={col * cell + GAP}
              y={row * cell + GAP}
              width={cell - GAP * 2}
              height={cell - GAP * 2}
              rx={STICKER_RADIUS}
              fill={shade(sticker, shadeFactor)}
            />
          );
        })
      )}
    </g>
  );
}

export interface GearGlyphProps {
  item: GearItem;
  /** Cube-kind categories get the full 3×3 render; gear gets the flat plate. */
  isCube: boolean;
  /** Rendered width in px; height follows the isometric aspect. */
  size?: number;
  className?: string;
}

export function GearGlyph({ item, isCube, size = 200, className }: GearGlyphProps) {
  const uid = useId();
  const height = isCube ? 1 : 0.22;

  const stickers = useMemo(() => (isCube ? stickerStateFor(item) : null), [isCube, item]);

  // Faces in U D F B R L order, reduced to the three the render shows.
  const topStickers = stickers ? stickers[VISIBLE.top] : null;
  const leftStickers = stickers ? stickers[VISIBLE.left] : null;
  const rightStickers = stickers ? stickers[VISIBLE.right] : null;

  const totalWidth = 2 * COS30;
  const totalHeight = 1 + height;

  return (
    <svg
      className={className}
      width={size}
      height={(size * (totalHeight + 0.2)) / (totalWidth + 0.24)}
      viewBox={`${-0.12} ${-0.08} ${totalWidth + 0.24} ${totalHeight + 0.2}`}
      role="img"
      aria-label={item.name}
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Contact shadow. */}
      <ellipse
        cx={COS30}
        cy={totalHeight + 0.02}
        rx={0.8}
        ry={0.11}
        fill={`url(#${uid}-shadow)`}
      />

      {/* Left (F) and right (R) faces first so the top face overlaps them. */}
      <Face
        transform={`matrix(${COS30} ${SIN30} 0 ${height} 0 ${SIN30})`}
        colour={item.palette[VISIBLE.left]}
        stickers={leftStickers}
        shadeFactor={FACE_SHADE.left}
        plate={!isCube}
      />
      <Face
        transform={`matrix(${COS30} ${-SIN30} 0 ${height} ${COS30} 1)`}
        colour={item.palette[VISIBLE.right]}
        stickers={rightStickers}
        shadeFactor={FACE_SHADE.right}
        plate={!isCube}
      />
      <Face
        transform={`matrix(${COS30} ${SIN30} ${-COS30} ${SIN30} ${COS30} 0)`}
        colour={item.palette[VISIBLE.top]}
        stickers={topStickers}
        shadeFactor={FACE_SHADE.top}
        plate={!isCube}
      />

      {/* Gentle sheen across the top face (same projection, so it follows). */}
      <g transform={`matrix(${COS30} ${SIN30} ${-COS30} ${SIN30} ${COS30} 0)`}>
        <rect x="0" y="0" width="1" height="1" rx={FRAME_RADIUS} fill={`url(#${uid}-sheen)`} />
      </g>
    </svg>
  );
}
