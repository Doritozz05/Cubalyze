import { describe, it, expect } from 'vitest';
import { generateCubeMarkSpec } from '../spec.js';
import { renderCubeMark, cubeMarkToDataUri } from '../render.js';
import { resolveGlyphHsl, contrastRatio, relativeLuminance, hslToRgb } from '../color.js';
import { HUE_STEPS, HUE_STEP_DEG, MIN_CONTRAST, SURFACE_LIGHT, SURFACE_DARK } from '../constants.js';

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

describe('renderCubeMark — SVG output', () => {
  it('produces a well-formed inline SVG', () => {
    const spec = generateCubeMarkSpec('render');
    const svg = renderCubeMark(spec);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('renders one rect per filled cell plus the tile (pure cells, no frame)', () => {
    const spec = generateCubeMarkSpec('count');
    const filled = spec.cells.filter(Boolean).length;
    const svg = renderCubeMark(spec, { tile: 'surface-2' });
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(filled + 1);
  });

  it('uses the theme-aware surface-2 CSS variable for the tile', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('theme'), { tile: 'surface-2' });
    expect(svg).toContain('var(--surface-2)');
    const transparent = renderCubeMark(generateCubeMarkSpec('theme'), { tile: 'transparent' });
    expect(transparent).not.toContain('var(--surface-2)');
  });

  it('fills the solid (non-glass) tile with --surface-2-solid only on request', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('solid'), { tile: 'surface-2-solid' });
    expect(svg).toContain('var(--surface-2-solid)');
    expect(svg).not.toContain('var(--surface-2)');
    const transparent = renderCubeMark(generateCubeMarkSpec('solid'), { tile: 'transparent' });
    expect(transparent).not.toContain('var(--surface-2-solid)');
  });

  it('is deterministic for a given spec', () => {
    const spec = generateCubeMarkSpec('det-render');
    expect(renderCubeMark(spec)).toBe(renderCubeMark(spec));
  });

  it('paints the accent fill on the true center cell (full-grid anchor)', () => {
    // The spec's center cell (full-grid index 12) must be the one tinted with
    // the accent (hue+30) — a decision-grid/full-grid index mismatch would
    // tint a mirrored cell instead (see spec.ts ANCHOR_DECISION vs render
    // ANCHOR_INDEX).
    //
    // Robust geometry check: find the cell rect whose bounds contain the
    // viewBox center (32,32) — avoids float-rounding drift on `x`.
    const rectRe =
      /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="[\d.]+" fill="(hsl\([^"]+\))"/g;
    for (let i = 0; i < 50; i++) {
      const spec = generateCubeMarkSpec(`anchor-${i}`);
      const svg = renderCubeMark(spec);
      const accent = resolveGlyphHsl((spec.hue + 30) % 360);
      const accentCss = `hsl(${accent.h} ${accent.s}% ${accent.l}%)`;
      let centerFill: string | null = null;
      for (const m of svg.matchAll(rectRe)) {
        const [, x, y, w, h, fill] = m;
        const cx = Number(x) + Number(w) / 2;
        const cy = Number(y) + Number(h) / 2;
        if (Math.abs(cx - 32) < 0.01 && Math.abs(cy - 32) < 0.01) {
          centerFill = fill;
          break;
        }
      }
      expect(centerFill, `seed anchor-${i} center cell fill`).toBe(accentCss);
    }
  });

  it('cubeMarkToDataUri produces an encoded data URI', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('uri'));
    const uri = cubeMarkToDataUri(svg);
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(uri.replace('data:image/svg+xml,', ''))).toBe(svg);
  });
});

describe('resolveGlyphHsl — contrast guarantee', () => {
  it('meets ≥ 3:1 against light and dark surfaces for ALL 24 hues', () => {
    const lightLum = relativeLuminance(hexToRgb(SURFACE_LIGHT));
    const darkLum = relativeLuminance(hexToRgb(SURFACE_DARK));
    for (let i = 0; i < HUE_STEPS; i++) {
      const hue = i * HUE_STEP_DEG;
      const { s, l } = resolveGlyphHsl(hue);
      const lum = relativeLuminance(hslToRgb(hue, s, l));
      expect(contrastRatio(lum, lightLum), `hue ${hue} vs light`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(lum, darkLum), `hue ${hue} vs dark`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('never changes the hue (identity is preserved)', () => {
    for (let i = 0; i < HUE_STEPS; i++) {
      const hue = i * HUE_STEP_DEG;
      expect(resolveGlyphHsl(hue).h).toBe(hue);
    }
  });
});

describe('performance', () => {
  it('generates and renders in well under 1ms on average (1000 iterations)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      renderCubeMark(generateCubeMarkSpec(`perf-${i}`));
    }
    const avgMs = (performance.now() - start) / 1000;
    // Generous bound — typical values are ~0.01ms; guards against pathological regressions.
    expect(avgMs).toBeLessThan(1);
  });
});
