import { describe, it, expect } from 'vitest';
import { Cube2x2State } from '../Cube2x2State';
import { Cube2x2FaceletConverter, SOLVED_FACELETS_2X2 } from '../Cube2x2FaceletConverter';

describe('Cube2x2FaceletConverter', () => {
  it('converts solved 2×2 state to 24-character solved facelet string', () => {
    const state = new Cube2x2State();
    const facelets = Cube2x2FaceletConverter.toFaceletString(state);
    expect(facelets).toBe('UUUURRRRFFFFDDDDLLLLBBBB');
    expect(SOLVED_FACELETS_2X2.test(facelets)).toBe(true);
  });

  it('round-trips solved state correctly', () => {
    const solved = new Cube2x2State();
    const facelets = Cube2x2FaceletConverter.toFaceletString(solved);
    const reconstructed = Cube2x2FaceletConverter.fromFaceletString(facelets);
    expect(reconstructed.isSolved()).toBe(true);
    expect(reconstructed.cp).toEqual(solved.cp);
    expect(reconstructed.co).toEqual(solved.co);
  });

  it('round-trips complex scrambled states', () => {
    const scrambles = [
      "R U R' U'",
      "F2 R2 U' F U R",
      "U R' F2 U2 R' F U' R2",
      "R U' R2 F R U2 R' F2",
      "F R U' R' U' R U R' F'",
    ];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);

      const facelets = Cube2x2FaceletConverter.toFaceletString(state);
      expect(facelets.length).toBe(24);

      // Verify each color letter occurs exactly 4 times
      const counts: Record<string, number> = {};
      for (const char of facelets) {
        counts[char] = (counts[char] || 0) + 1;
      }
      expect(counts).toEqual({ U: 4, R: 4, F: 4, D: 4, L: 4, B: 4 });

      const reconstructed = Cube2x2FaceletConverter.fromFaceletString(facelets);
      expect(reconstructed.cp).toEqual(state.cp);
      expect(reconstructed.co).toEqual(state.co);
    }
  });

  it('correctly maps corner orientations without twisting colors', () => {
    // Single move R twists corners URF, UBR, DFR, DRB
    const state = new Cube2x2State();
    state.applySequence('R');

    const facelets = Cube2x2FaceletConverter.toFaceletString(state);
    const reconstructed = Cube2x2FaceletConverter.fromFaceletString(facelets);

    expect(reconstructed.cp).toEqual(state.cp);
    expect(reconstructed.co).toEqual(state.co);
  });

  it('handles extended moves (D, L, B, whole-cube rotations, wide moves) seamlessly', () => {
    const extendedScrambles = [
      "D L B D' L2 B2",
      "z2 R U R'",
      "y R U R' U'",
      "r U r' U'",
    ];

    for (const scramble of extendedScrambles) {
      const state = new Cube2x2State();
      expect(() => state.applySequence(scramble)).not.toThrow();

      const facelets = Cube2x2FaceletConverter.toFaceletString(state);
      expect(facelets.length).toBe(24);

      const counts: Record<string, number> = {};
      for (const char of facelets) {
        counts[char] = (counts[char] || 0) + 1;
      }
      expect(counts).toEqual({ U: 4, R: 4, F: 4, D: 4, L: 4, B: 4 });
    }
  });

  it('directly converts scrambles using toFaceletStringFromScramble', () => {
    const facelets = Cube2x2FaceletConverter.toFaceletStringFromScramble("R U R' U'");
    expect(facelets.length).toBe(24);
    expect(SOLVED_FACELETS_2X2.test(facelets)).toBe(false);
  });
});
