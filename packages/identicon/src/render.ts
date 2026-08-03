/**
 * @cubeforge/identicon — SVG rendering
 *
 * Renders a {@link CubeMarkSpec} as inline SVG. Cells use the design-system
 * radius language (rounded squares with a uniform gap); the anchor cell is
 * tinted with a complementary accent (hue + 30°) so the glyph reads as
 * designed. When `tile: 'surface-2'` the tile fill uses the CSS variable
 * `--surface-2`, so inline usage is theme-aware automatically.
 */

import { GRID_SIZE, ANCHOR_INDEX } from './constants.js';
import { resolveGlyphHsl, toCssHsl } from './color.js';
import type { CubeMarkSpec } from './spec.js';

export interface CubeMarkRenderOptions {
  /** SVG viewBox size in units (default 64). SVG scales to any CSS size. */
  size?: number;
  /** Tile background: theme-aware `--surface-2` or transparent (default). */
  tile?: 'transparent' | 'surface-2';
}

/** Round to 2 decimals to keep the SVG markup small. */
function fmt(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build the inner cell rectangles for the spec. */
function renderCells(spec: CubeMarkSpec, size: number): string {
  const glyph = resolveGlyphHsl(spec.hue);
  const accent = resolveGlyphHsl((spec.hue + 30) % 360);
  const glyphColor = toCssHsl(glyph);
  const accentColor = toCssHsl(accent);

  const pad = size * 0.055;
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
function renderFrame(spec: CubeMarkSpec, size: number): string {
  if (spec.frame === 0) return '';
  const accent = toCssHsl(resolveGlyphHsl((spec.hue + 30) % 360));
  const strokeWidth = spec.frame === 1 ? size * 0.02 : size * 0.045;
  const inset = size * 0.12;
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
  const tileFill = tile === 'surface-2' ? 'var(--surface-2)' : 'none';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"` +
    ` shape-rendering="geometricPrecision">` +
    `<rect x="0" y="0" width="${size}" height="${size}" rx="${fmt(size * 0.16)}" fill="${tileFill}"/>` +
    renderCells(spec, size) +
    renderFrame(spec, size) +
    `</svg>`
  );
}

/** Wrap SVG markup as a data URI (usable in `<img src>` / AvatarImage). */
export function cubeMarkToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
