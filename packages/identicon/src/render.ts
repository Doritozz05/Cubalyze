/**
 * @cubalyze/identicon — SVG rendering
 *
 * Renders a {@link CubeMarkSpec} as inline SVG. Cells use the design-system
 * radius language (rounded squares with a uniform gap); the anchor cell is
 * tinted with a complementary accent (hue + 30°) so the glyph reads as
 * designed. When `tile: 'surface-2'` the tile fill uses the CSS variable
 * `--surface-2`, so inline usage is theme-aware automatically. The
 * `'surface-2-solid'` variant fills with `--surface-2-solid` — the same
 * color, but a token the liquid-glass engine NEVER remaps, for identity
 * tiles that must stay dry.
 *
 * The glyph is pure cells — no interior frames or overlays — so every
 * CubeMark renders as squares only.
 */

import { GRID_SIZE, ANCHOR_INDEX } from './constants.js';
import { resolveGlyphHsl, toCssHsl } from './color.js';
import type { CubeMarkSpec } from './spec.js';

export interface CubeMarkRenderOptions {
  /** SVG viewBox size in units (default 64). SVG scales to any CSS size. */
  size?: number;
  /** Tile background: theme-aware `--surface-2`, its solid (non-glass)
   *  counterpart `--surface-2-solid`, or transparent (default). */
  tile?: 'transparent' | 'surface-2' | 'surface-2-solid';
  /**
   * Corner radius of the tile, in viewBox units. Defaults to `size * 0.16`,
   * which is right for a STANDALONE mark (a data URI, a bare inline SVG) that
   * owns its own corners.
   *
   * Pass 0 when the mark is drawn inside a frame that already has a radius and
   * clips it (`overflow-hidden`): two radii can only ever disagree, and the
   * visible symptom is a tile whose corners do not reach the frame's — the
   * frame's corner shows the page behind it.
   */
  tileRadius?: number;
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
  const tileFill =
    tile === 'surface-2'
      ? 'var(--surface-2)'
      : tile === 'surface-2-solid'
        ? 'var(--surface-2-solid)'
        : 'none';
  const pad = size * 0.055;
  const tileRadius = options.tileRadius ?? size * 0.16;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"` +
    ` shape-rendering="geometricPrecision">` +
    `<rect x="0" y="0" width="${size}" height="${size}" rx="${fmt(tileRadius)}" fill="${tileFill}"/>` +
    renderCells(spec, size, pad) +
    `</svg>`
  );
}

/** Wrap SVG markup as a data URI (usable in `<img src>` / AvatarImage). */
export function cubeMarkToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
