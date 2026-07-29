import { describe, it, expect } from 'vitest';
import { parseFaceletsToCubies2x2 } from '../core/FaceletParser2x2';
import { Cube2x2State, Cube2x2FaceletConverter } from '@cubeforge/math-core';

describe('parseFaceletsToCubies2x2', () => {
  it('parses solved 2×2 facelets into 8 valid cubies', () => {
    const solvedFacelets = 'UUUURRRRFFFFDDDDLLLLBBBB';
    const cubies = parseFaceletsToCubies2x2(solvedFacelets);

    expect(cubies.length).toBe(8);

    for (const c of cubies) {
      // Every 2x2 cubie is a corner cubie with non-zero coordinates on all 3 axes
      expect(Math.abs(c.currX)).toBe(1);
      expect(Math.abs(c.currY)).toBe(1);
      expect(Math.abs(c.currZ)).toBe(1);

      expect(Math.abs(c.initialX)).toBe(1);
      expect(Math.abs(c.initialY)).toBe(1);
      expect(Math.abs(c.initialZ)).toBe(1);

      // Quaternion components must be valid numbers (not NaN)
      expect(Number.isNaN(c.quaternion.x)).toBe(false);
      expect(Number.isNaN(c.quaternion.y)).toBe(false);
      expect(Number.isNaN(c.quaternion.z)).toBe(false);
      expect(Number.isNaN(c.quaternion.w)).toBe(false);
    }
  });

  it('parses scrambled 2×2 facelets into 8 valid corner cubies with unique initial positions', () => {
    const scrambles = [
      "R U R' U'",
      "F2 R2 U' F U R",
      "U R' F2 U2 R' F U' R2",
      "R U' R2 F R U2 R' F2",
    ];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);
      const facelets = Cube2x2FaceletConverter.toFaceletString(state);

      const cubies = parseFaceletsToCubies2x2(facelets);
      expect(cubies.length).toBe(8);

      const initialPositions = new Set<string>();

      for (const c of cubies) {
        // Must be corner coordinates (no zeros)
        expect(Math.abs(c.currX)).toBe(1);
        expect(Math.abs(c.currY)).toBe(1);
        expect(Math.abs(c.currZ)).toBe(1);

        expect(Math.abs(c.initialX)).toBe(1);
        expect(Math.abs(c.initialY)).toBe(1);
        expect(Math.abs(c.initialZ)).toBe(1);

        const key = `${c.initialX},${c.initialY},${c.initialZ}`;
        initialPositions.add(key);

        expect(Number.isNaN(c.quaternion.x)).toBe(false);
        expect(Number.isNaN(c.quaternion.y)).toBe(false);
        expect(Number.isNaN(c.quaternion.z)).toBe(false);
        expect(Number.isNaN(c.quaternion.w)).toBe(false);
      }

      // Exactly 8 distinct initial corner cubies must be identified
      expect(initialPositions.size).toBe(8);
    }
  });
});
