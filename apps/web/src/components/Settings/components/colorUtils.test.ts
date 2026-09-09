import { describe, expect, it } from 'vitest';
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  isValidHex,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
} from './colorUtils';

describe('normalizeHex', () => {
  it('accepts 6-digit hex with or without hash', () => {
    expect(normalizeHex('#1abe57')).toBe('#1abe57');
    expect(normalizeHex('1abe57')).toBe('#1abe57');
  });

  it('expands 3-digit shorthand and lowercases', () => {
    expect(normalizeHex('#F00')).toBe('#ff0000');
    expect(normalizeHex('ABC')).toBe('#aabbcc');
  });

  it('rejects alpha, named colors and garbage', () => {
    expect(normalizeHex('#ff000080')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#gggggg')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeHex('  #22c55e  ')).toBe('#22c55e');
  });
});

describe('isValidHex', () => {
  it('mirrors normalizeHex nullability', () => {
    expect(isValidHex('#22c55e')).toBe(true);
    expect(isValidHex('#fff')).toBe(true);
    expect(isValidHex('not-a-color')).toBe(false);
  });
});

describe('hex/rgb roundtrip', () => {
  const samples = ['#000000', '#ffffff', '#1abe57', '#3b82f6', '#ef4444', '#f97316'];
  for (const hex of samples) {
    it(`roundtrips ${hex}`, () => {
      const { r, g, b } = hexToRgb(hex);
      expect(rgbToHex(r, g, b)).toBe(hex);
    });
  }

  it('clamps out-of-range channels', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });
});

describe('hsv conversions', () => {
  it('maps primaries to known hues', () => {
    expect(hsvToHex(0, 100, 100)).toBe('#ff0000');
    expect(hsvToHex(120, 100, 100)).toBe('#00ff00');
    expect(hsvToHex(240, 100, 100)).toBe('#0000ff');
    expect(hsvToHex(0, 0, 100)).toBe('#ffffff');
    expect(hsvToHex(0, 0, 0)).toBe('#000000');
  });

  it('wraps hue outside 0-360', () => {
    expect(hsvToHex(360, 100, 100)).toBe('#ff0000');
    expect(hsvToHex(-120, 100, 100)).toBe(hsvToHex(240, 100, 100));
  });

  it('inverts rgbToHsv within 1 unit per channel', () => {
    const cases: Array<[number, number, number]> = [
      [26, 190, 87],
      [59, 124, 246],
      [239, 68, 68],
      [128, 128, 128],
    ];
    for (const [r, g, b] of cases) {
      const { h, s, v } = rgbToHsv(r, g, b);
      const back = hsvToRgb(h, s, v);
      expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
    }
  });

  it('roundtrips hex through hsv', () => {
    for (const hex of ['#1abe57', '#3b82f6', '#ef4444', '#a855f7']) {
      const { h, s, v } = hexToHsv(hex);
      const { r, g, b } = hexToRgb(hex);
      const back = hsvToRgb(h, s, v);
      expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
    }
  });
});
