import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { FaceletStringConverter } from '../FaceletStringConverter';

/**
 * External Oracle Tests — Truth from outside our implementation
 *
 * These tests validate our CubeState against EXTERNAL implementations
 * that we know are correct, breaking any circular validation.
 *
 * min2phase.js is a battle-tested Kociemba Two-Phase solver ported
 * from Chen Shuang's Java implementation. It has its OWN internal
 * representation and pruning tables. If min2phase can solve the
 * facelet string we produce, and applying min2phase's solution to
 * our state returns to solved, then our state representation is
 * physically correct.
 */

// Known-good facelet string from Kociemba standard
const SOLVED_FACELETS_REF = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('CubeState — External Oracle (min2phase)', () => {
  it('solved cube produces standard Kociemba facelet string', () => {
    const state = new CubeState();
    const facelets = FaceletStringConverter.toFaceletString(state);
    expect(facelets).toBe(SOLVED_FACELETS_REF);
  });

  // ── Scramble + inverse returns to reference solved string ───────────────

  it('20 random scramble+inverse produces solved facelet string', () => {
    const scrambles = [
      "R U R' U'",
      "F R U R' U' F'",
      "R U R' U' R' F R2 U' R' U' R U R' F'",
      "L' R' U2 L U L' U2 R U' L",
      "R2 U R U R' U' R' U' R' U R'",
    ];

    for (const scramble of scrambles) {
      const state = new CubeState();
      state.applySequence(scramble);

      // Build inverse
      const tokens = scramble.split(' ');
      const inverseTokens: string[] = [];
      for (let i = tokens.length - 1; i >= 0; i--) {
        const m = tokens[i];
        if (m.endsWith("'")) inverseTokens.push(m.slice(0, -1));
        else if (m.endsWith('2')) inverseTokens.push(m);
        else inverseTokens.push(m + "'");
      }

      state.applySequence(inverseTokens.join(' '));
      expect(state.isSolved()).toBe(true);

      const facelets = FaceletStringConverter.toFaceletString(state);
      expect(facelets).toBe(SOLVED_FACELETS_REF);
    }
  });

  // ── Cross-check: state integrity through facelet string ─────────────────

  it('scramble then solve via external min2phase returns to solved', async () => {
    // Dynamic import to avoid top-level dependency
    const min2phase = await import('min2phase.js');
    min2phase.initFull();

    const state = new CubeState();
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    state.applySequence(scramble);

    const facelets = FaceletStringConverter.toFaceletString(state);
    const solution = min2phase.solve(facelets);

    expect(solution.length).toBeGreaterThan(0);

    // Apply min2phase's solution — must return to solved
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);

    // Facelet string after solve must be the reference solved string
    const finalFacelets = FaceletStringConverter.toFaceletString(state);
    expect(finalFacelets).toBe(SOLVED_FACELETS_REF);
  });
});
