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

  it('renders one rect per filled cell plus the tile (plus optional frame)', () => {
    const spec = generateCubeMarkSpec('count');
    const filled = spec.cells.filter(Boolean).length;
    const svg = renderCubeMark(spec, { tile: 'surface-2' });
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    const frameBonus = spec.frame === 0 ? 0 : 1;
    expect(rectCount).toBe(filled + 1 + frameBonus);
  });

  it('uses the theme-aware surface-2 CSS variable for the tile', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('theme'), { tile: 'surface-2' });
    expect(svg).toContain('var(--surface-2)');
    const transparent = renderCubeMark(generateCubeMarkSpec('theme'), { tile: 'transparent' });
    expect(transparent).not.toContain('var(--surface-2)');
  });

  it('is deterministic for a given spec', () => {
    const spec = generateCubeMarkSpec('det-render');
    expect(renderCubeMark(spec)).toBe(renderCubeMark(spec));
  });

  it('paints the accent fill on the true center cell (full-grid anchor)', () => {
    // The spec's center cell (full-grid index 12) must be the one tinted with
    // the accent (hue+30) — a decision-grid/full-grid index mismatch would
    // tint a mirrored cell instead (see spec.ts ANCHOR_DECISION vs render
    // ANCHOR_INDEX). The accent ALSO appears on interior frames, so we must
    // assert the center rect's own fill attribute, not just `toContain`.
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

describe('renderCubeMark — circle shape (avatar variant)', () => {
  it('renders a circular tile (rx = half the size) when shape is circle', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('circle'), {
      tile: 'surface-2',
      shape: 'circle',
    });
    expect(svg).toContain('rx="32"');
  });

  it('keeps the rounded-square default when shape is omitted', () => {
    const svg = renderCubeMark(generateCubeMarkSpec('rounded-default'));
    // Default tile radius = size * 0.16 = 10.24 at size 64.
    expect(svg).toContain('rx="10.24"');
    expect(svg).not.toContain('<clipPath');
  });

  it('clips the glyph with a deterministic per-seed clipPath', () => {
    const a = renderCubeMark(generateCubeMarkSpec('seed-a'), { shape: 'circle' });
    const b = renderCubeMark(generateCubeMarkSpec('seed-b'), { shape: 'circle' });
    const a2 = renderCubeMark(generateCubeMarkSpec('seed-a'), { shape: 'circle' });

    // Same seed → same clip id (deterministic, stable across re-renders).
    expect(a).toBe(a2);
    // Different seeds → different clip ids (no shared clipPath collisions).
    expect(a).not.toBe(b);
    expect(a).toContain('<clipPath');
    expect(a).toContain('clip-path="url(#');
    expect(a).toContain('<circle cx="32" cy="32" r="32"/>');
  });

  it('keeps every cell fully inside the circular bounds', () => {
    // With the wider circle pad (12% of size) the grid's outer corner stays
    // within the inscribed area, so nothing is cropped for the round avatars.
    const cellRe =
      /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="[\d.]+" fill="(hsl\([^"]+\))"/g;
    for (let i = 0; i < 50; i++) {
      const svg = renderCubeMark(generateCubeMarkSpec(`circle-fit-${i}`), {
        shape: 'circle',
      });
      let cells = 0;
      for (const m of svg.matchAll(cellRe)) {
        const [, x, y, w, h] = m;
        cells += 1;
        const corners: Array<[number, number]> = [
          [Number(x), Number(y)],
          [Number(x) + Number(w), Number(y)],
          [Number(x), Number(y) + Number(h)],
          [Number(x) + Number(w), Number(y) + Number(h)],
        ];
        for (const [px, py] of corners) {
          const dist = Math.hypot(px - 32, py - 32);
          expect(dist, `seed circle-fit-${i} cell corner ${px},${py}`).toBeLessThanOrEqual(32.001);
        }
      }
      expect(cells).toBeGreaterThan(0);
    }
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
