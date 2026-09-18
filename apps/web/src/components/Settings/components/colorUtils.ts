"use client";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

const HEX_6 = /^#[0-9a-f]{6}$/;

/** Normalize any user input to lowercase #rrggbb, or null when invalid. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().toLowerCase();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  const short = /^#([0-9a-f]{3})$/i.exec(withHash);
  if (short) {
    const [a, b, c] = short[1];
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  if (HEX_6.test(withHash)) return withHash;
  return null;
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

export function hexToRgb(hex: string): RGB {
  const n = normalizeHex(hex) ?? "#000000";
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  return { h, s, v: max * 100 };
}

export function hexToHsv(hex: string): HSV {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) {
    r = c;
    g = x;
  } else if (hn < 120) {
    r = x;
    g = c;
  } else if (hn < 180) {
    g = c;
    b = x;
  } else if (hn < 240) {
    g = x;
    b = c;
  } else if (hn < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/**
 * WCAG 2.x relative luminance of an sRGB color (0 = black, 1 = white).
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * WCAG contrast ratio between two hex colors (1 = identical, 21 = black/white).
 * Returns null when either input is not a valid hex color.
 */
export function contrastRatio(a: string, b: string): number | null {
  if (!isValidHex(a) || !isValidHex(b)) return null;
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const l1 = relativeLuminance(ca.r, ca.g, ca.b);
  const l2 = relativeLuminance(cb.r, cb.g, cb.b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text (4.5:1). Custom user themes are never blocked — a
 * low ratio only raises a warning in the editor, because the theme is the
 * user's own choice. */
export const AA_NORMAL_TEXT_RATIO = 4.5;

export function meetsAaNormalText(a: string, b: string): boolean {
  const ratio = contrastRatio(a, b);
  return ratio !== null && ratio >= AA_NORMAL_TEXT_RATIO;
}
