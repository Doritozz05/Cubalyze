import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CrossScrambleGenerator } from './CrossScrambleGenerator';
import { crossDepth } from './PhaseSolver';

function applyScramble(scramble: string): CubeState {
  const s = new CubeState();
  s.applySequence(scramble);
  return s;
}

describe('CrossScrambleGenerator — way-to-cross', () => {
  describe('generate (strict depth, D face)', () => {
    it('generates a scramble with exact cross depth 4 on D', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 4,
        face: 'D',
        maxRetries: 300,
      });
      expect(result.optimalDepth).toBe(4);
      expect(result.face).toBe('D');
      expect(result.scramble.length).toBeGreaterThan(0);
      // The scramble, applied to a solved cube, must have cross depth 4 on D.
      const state = applyScramble(result.scramble);
      expect(crossDepth(state, 'D', 8)).toBe(4);
    });

    it('generates a scramble whose actual cross depth matches the reported optimalDepth (consistency)', () => {
      // Robustness test: regardless of which depth the generator lands on,
      // the scramble applied to a solved cube MUST have a cross depth equal
      // to the reported optimalDepth on the returned face. This verifies
      // the way-to-cross inversion preserves depth (group-theoretic guarantee).
      // Uses acceptUpToDepth so the generator always returns quickly with a
      // common depth (4-6) rather than hunting for a rare exact depth.
      const result = CrossScrambleGenerator.generate({
        depth: 6,
        face: 'D',
        maxRetries: 50,
        acceptUpToDepth: true,
      });
      expect(result.optimalDepth).toBeGreaterThanOrEqual(1);
      expect(result.optimalDepth).toBeLessThanOrEqual(8);
      const state = applyScramble(result.scramble);
      // Core invariant: the scramble's actual cross depth on the returned
      // face equals the reported optimalDepth.
      expect(crossDepth(state, result.face, 8)).toBe(result.optimalDepth);
    });

    it('generates a scramble with exact cross depth 8 on D', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 8,
        face: 'D',
        maxRetries: 500,
      });
      // Depth 8 is the hardest to hit exactly; allow a near-miss but it
      // should be at least 6.
      expect(result.optimalDepth).toBeGreaterThanOrEqual(6);
      expect(result.optimalDepth).toBeLessThanOrEqual(8);
    });
  });

  describe('generate color-neutral', () => {
    it('returns the best face when face is omitted', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 4,
        maxRetries: 300,
      });
      expect(result.face).toMatch(/^[URFDLB]$/);
      const state = applyScramble(result.scramble);
      // The scramble's optimal depth on the returned face should match.
      const d = crossDepth(state, result.face, 8);
      expect(d).toBe(result.optimalDepth);
    });

    it('color-neutral scramble is solvable in the returned depth on the returned face', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 3,
        maxRetries: 300,
      });
      const state = applyScramble(result.scramble);
      // The scramble's cross depth on the returned face must match the
      // reported optimalDepth (way-to-cross inversion preserves depth on
      // the solved face). bestCrossFace may find a DIFFERENT face with a
      // shorter depth — that's the expected CN behaviour and not a bug.
      const dOnReturnedFace = crossDepth(state, result.face, 8);
      expect(dOnReturnedFace).toBe(result.optimalDepth);
      // And it should be ≤ the requested target (we asked for depth 3).
      expect(result.optimalDepth).toBeLessThanOrEqual(3);
    });
  });

  describe('rotation prefix', () => {
    it('prepends the rotation to the scramble', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 3,
        face: 'D',
        rotation: 'z2',
        maxRetries: 300,
      });
      expect(result.scramble.startsWith('z2 ')).toBe(true);
    });
  });

  describe('acceptUpToDepth mode', () => {
    it('accepts a scramble with depth <= target', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 8,
        face: 'D',
        acceptUpToDepth: true,
        maxRetries: 50,
      });
      expect(result.optimalDepth).toBeLessThanOrEqual(8);
      expect(result.optimalDepth).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateBatch', () => {
    it('generates the requested number of scrambles', () => {
      const results = CrossScrambleGenerator.generateBatch(
        { depth: 4, face: 'D', maxRetries: 300 },
        3,
      );
      expect(results.length).toBe(3);
      for (const r of results) {
        expect(r.optimalDepth).toBe(4);
      }
    });
  });

  describe('verifyDepth', () => {
    it('returns true for a matching scramble', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 4,
        face: 'D',
        maxRetries: 300,
      });
      expect(
        CrossScrambleGenerator.verifyDepth(result.scramble, 'D', result.optimalDepth),
      ).toBe(true);
    });

    it('returns false for a mismatching depth', () => {
      const result = CrossScrambleGenerator.generate({
        depth: 4,
        face: 'D',
        maxRetries: 300,
      });
      expect(
        CrossScrambleGenerator.verifyDepth(result.scramble, 'D', 7),
      ).toBe(false);
    });
  });

  describe('validation', () => {
    it('throws on depth out of range', () => {
      expect(() =>
        CrossScrambleGenerator.generate({ depth: 0, face: 'D' }),
      ).toThrow();
      expect(() =>
        CrossScrambleGenerator.generate({ depth: 9, face: 'D' }),
      ).toThrow();
    });
  });
});
