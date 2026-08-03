import { describe, it, expect } from 'vitest';
import { generateCubeMarkSpec } from '../spec.js';
import { GRID_SIZE, CELL_COUNT, ANCHOR_INDEX, FILL_ON_MIN, FILL_ON_MAX, HUE_STEPS, HUE_STEP_DEG } from '../constants.js';

function fingerprint(spec: ReturnType<typeof generateCubeMarkSpec>): string {
  return JSON.stringify({ cells: spec.cells, hue: spec.hue });
}

function countFilled(cells: boolean[]): number {
  let n = 0;
  for (const on of cells) if (on) n++;
  return n;
}

describe('generateCubeMarkSpec — determinism', () => {
  it('produces the identical spec for the same seed, 1000 times', () => {
    const seeds = Array.from({ length: 100 }, (_, i) => `user-${i}-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
    for (const seed of seeds) {
      const first = fingerprint(generateCubeMarkSpec(seed));
      for (let i = 0; i < 10; i++) {
        expect(fingerprint(generateCubeMarkSpec(seed))).toBe(first);
      }
    }
  });

  it('a one-character seed change produces a different spec (avalanche)', () => {
    for (let i = 0; i < 100; i++) {
      const base = `seed-${i}`;
      const mutated = `${base}x`;
      expect(fingerprint(generateCubeMarkSpec(base))).not.toBe(fingerprint(generateCubeMarkSpec(mutated)));
    }
  });
});

describe('generateCubeMarkSpec — symmetry & anchor', () => {
  it('is vertically mirrored (c === 4-c)', () => {
    for (let i = 0; i < 200; i++) {
      const { cells } = generateCubeMarkSpec(`sym-${i}`);
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          expect(cells[r * GRID_SIZE + c]).toBe(cells[r * GRID_SIZE + (GRID_SIZE - 1 - c)]);
        }
      }
    }
  });

  it('always fills the anchor (center) cell', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCubeMarkSpec(`anchor-${i}`).cells[ANCHOR_INDEX]).toBe(true);
    }
  });

  it('outputs exactly 25 cells', () => {
    expect(generateCubeMarkSpec('cells').cells).toHaveLength(CELL_COUNT);
  });
});

describe('generateCubeMarkSpec — legibility guarantees', () => {
  it('keeps the filled ratio inside [FILL_ON_MIN, FILL_ON_MAX] of 25 (36–64%)', () => {
    for (let i = 0; i < 500; i++) {
      const filled = countFilled(generateCubeMarkSpec(`ratio-${i}`).cells);
      expect(filled).toBeGreaterThanOrEqual(FILL_ON_MIN);
      expect(filled).toBeLessThanOrEqual(FILL_ON_MAX);
    }
  });

  it('quantizes hue in 15° steps', () => {
    for (let i = 0; i < 200; i++) {
      const { hue } = generateCubeMarkSpec(`meta-${i}`);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(hue % HUE_STEP_DEG).toBe(0);
    }
  });
});

describe('generateCubeMarkSpec — differentiation', () => {
  it('500 distinct seeds produce almost entirely distinct glyphs (collision budget)', () => {
    // Fingerprint space: thousands of mirror-symmetric cell patterns × 24
    // hues (the glyph is pure cells — no frame overlay to multiply space).
    // By birthday parity a handful of collisions per 500 random seeds is
    // EXPECTED — the guard is against systematic collapse (a broken
    // generator collapses to ~400/500, as a debug run demonstrated).
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const spec = generateCubeMarkSpec(`unique-${i}-${crypto.randomUUID?.() ?? i}`);
      seen.add(fingerprint(spec));
    }
    expect(seen.size).toBeGreaterThanOrEqual(496);
  });

  it('covers the full hue space across many seeds', () => {
    const hues = new Set<number>();
    for (let i = 0; i < 2000; i++) hues.add(generateCubeMarkSpec(`hue-${i}`).hue);
    expect(hues.size).toBeGreaterThanOrEqual(HUE_STEPS - 2);
  });
});
