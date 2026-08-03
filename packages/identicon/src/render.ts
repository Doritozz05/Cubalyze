/**
 * @cubeforge/identicon — SVG rendering
 *
 * Renders a {@link CubeMarkSpec} as inline SVG. Cells use the design-system
 * radius language (rounded squares with a uniform gap); the anchor cell is
 * tinted with a complementary accent (hue + 30°) so the glyph reads as
 * designed. When `tile: 'surface-2'` the tile fill uses the CSS variable
 * `--surface-2`, so inline usage is theme-aware automatically.
 *
 * `shape: 'circle'` renders the avatar variant: a circular tile whose glyph
 * fits fully inside the circle (wider pad, no corner crop). The tile itself
 * is a circle, so the round avatar holds up anywhere — including through
 * `cubeMarkToDataUri`, where an `<img>` can't rely on a CSS overflow clip.
 */

import { GRID_SIZE, ANCHOR_INDEX } from './constants.js';
import { resolveGlyphHsl, toCssHsl } from './color.js';
import { fnv1a32 } from './hash.js';
import type { CubeMarkSpec } from './spec.js';

export interface CubeMarkRenderOptions {
  /** SVG viewBox size in units (default 64). SVG scales to any CSS size. */
  size?: number;
  /** Tile background: theme-aware `--surface-2` or transparent (default). */
  tile?: 'transparent' | 'surface-2';
  /**
   * Tile shape. `'rounded'` (default) keeps the classic rounded-square
   * emblem; `'circle'` is the avatar variant (circular tile + circular clip).
   */
  shape?: 'rounded' | 'circle';
}

/** Round to 2 decimals to keep the SVG markup small. */
function fmt(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build the inner cell rectangles for the spec. */
function renderCells(spec: CubeMarkSpec, size: number, pad: number): string {
  const glyph = resolveGlyphHsl(spec.hue);
  const accent = resolveGlyphHsl((spec.hue + 30) % 360);
  const glyphColor = toCssHsl(glyph);
  const accentColor = toCssHsl(accent);

  const inner = size - pad * 2;
  const cell = inner / GRID_SIZE;
  const gap = cell * 0.16;
  const rx = cell * 0.26;

  const rects: string[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const index = r * GRID_SIZE + c;
      if (!spec.cells[index]) continue;
      const x = pad + c * cell + gap / 2;
      const y = pad + r * cell + gap / 2;
      const w = cell - gap;
      const fill = index === ANCHOR_INDEX ? accentColor : glyphColor;
      rects.push(
        `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(w)}" rx="${fmt(rx)}" fill="${fill}"/>`,
      );
    }
  }
  return rects.join('');
}

/** Interior frame variant (0 none, 1 thin, 2 thick). */
function renderFrame(spec: CubeMarkSpec, size: number, insetRatio: number): string {
  if (spec.frame === 0) return '';
  const accent = toCssHsl(resolveGlyphHsl((spec.hue + 30) % 360));
  const strokeWidth = spec.frame === 1 ? size * 0.02 : size * 0.045;
  const inset = size * insetRatio;
  const radius = size * 0.1;
  return (
    `<rect x="${fmt(inset)}" y="${fmt(inset)}" width="${fmt(size - inset * 2)}" height="${fmt(size - inset * 2)}"` +
    ` rx="${fmt(radius)}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="${fmt(strokeWidth)}"/>`
  );
}

/**
 * Render a spec to an SVG markup string (inline-safe, theme-aware tile).
 * Pure and synchronous — safe to memoize.
 */
export function renderCubeMark(
  spec: CubeMarkSpec,
  options: CubeMarkRenderOptions = {},
): string {
  const size = options.size ?? 64;
  const tile = options.tile ?? 'transparent';
  const shape = options.shape ?? 'rounded';
  const tileFill = tile === 'surface-2' ? 'var(--surface-2)' : 'none';
  const isCircle = shape === 'circle';

  // Circular avatars use a wider pad so every grid cell stays fully inside
  // the inscribed circle (pad ≥ size·(1 − 1/√2) keeps the outer corners in).
  const pad = isCircle ? size * 0.15 : size * 0.055;
  const tileRadius = isCircle ? size / 2 : size * 0.16;

  // Deterministic per-seed id (collision-free in practice, stable across
  // re-renders) so multiple inline CubeMarks never share one clipPath.
  let clip = '';
  let glyph = '';
  if (isCircle) {
    const clipId = `cubemark-${fnv1a32(spec.seed).toString(36)}`;
    clip =
      `<clipPath id="${clipId}">` +
      `<circle cx="${fmt(size / 2)}" cy="${fmt(size / 2)}" r="${fmt(size / 2)}"/>` +
      `</clipPath>`;
    // In circle mode the interior frame insets further so its corners stay
    // inside the circle (it is drawn within the clipPath group).
    glyph =
      `<g clip-path="url(#${clipId})">${renderCells(spec, size, pad)}${renderFrame(spec, size, 0.17)}</g>`;
  } else {
    glyph = renderCells(spec, size, pad) + renderFrame(spec, size, 0.12);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"` +
    ` shape-rendering="geometricPrecision">` +
    `<rect x="0" y="0" width="${size}" height="${size}" rx="${fmt(tileRadius)}" fill="${tileFill}"/>` +
    clip +
    glyph +
    `</svg>`
  );
}

/** Wrap SVG markup as a data URI (usable in `<img src>` / AvatarImage). */
export function cubeMarkToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
