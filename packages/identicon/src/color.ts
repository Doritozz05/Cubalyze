/**
 * @cubalyze/identicon — Color with a hard contrast guarantee
 *
 * The glyph hue is identity (never changed), but lightness is auto-tuned so
 * the glyph meets WCAG ≥ 3:1 against BOTH design-system surfaces (light
 * `--surface` #ffffff and dark `--surface` #1b1f23). This makes every
 * CubeMark legible in both themes regardless of hue.
 */

import {
  GLYPH_SATURATION,
  GLYPH_LIGHTNESS,
  MIN_CONTRAST,
  SURFACE_LIGHT,
  SURFACE_DARK,
} from './constants.js';

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

function channelToLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an sRGB color. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio between two relative luminances (1..21). */
export function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Convert HSL (degrees / %) to sRGB 0..255. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = s / 100;
  const ll = l / 100;
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue2rgb = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hh + 1 / 3) * 255),
    Math.round(hue2rgb(hh) * 255),
    Math.round(hue2rgb(hh - 1 / 3) * 255),
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

const SURFACE_LIGHT_LUM = relativeLuminance(hexToRgb(SURFACE_LIGHT));
const SURFACE_DARK_LUM = relativeLuminance(hexToRgb(SURFACE_DARK));

/** Ordered lightness candidates: tuned towards the middle, both directions. */
const LIGHTNESS_CANDIDATES = [
  GLYPH_LIGHTNESS, 58,
  52, 46, 40, 34, 28, 22, 16, 10,
  64, 70, 76, 82, 88,
];

/**
 * Resolve a glyph color for a hue that satisfies `MIN_CONTRAST` against both
 * themes. Deterministic: same hue → same color. The hue itself is untouched.
 */
export function resolveGlyphHsl(hue: number, minContrast: number = MIN_CONTRAST): Hsl {
  const s = GLYPH_SATURATION;
  for (const l of LIGHTNESS_CANDIDATES) {
    const rgb = hslToRgb(hue, s, l);
    const lum = relativeLuminance(rgb);
    if (contrastRatio(lum, SURFACE_LIGHT_LUM) >= minContrast &&
        contrastRatio(lum, SURFACE_DARK_LUM) >= minContrast) {
      return { h: hue, s, l };
    }
  }
  // Unreachable for any real hue at S=72 (both surfaces bound the viable
  // luminance window [0.14, 0.30]); kept as a deterministic safety net.
  return { h: hue, s, l: 32 };
}

/** CSS hsl() string for a resolved glyph color. */
export function toCssHsl({ h, s, l }: Hsl): string {
  return `hsl(${h} ${s}% ${l}%)`;
}
