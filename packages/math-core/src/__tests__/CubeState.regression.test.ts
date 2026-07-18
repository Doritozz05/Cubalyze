import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { FaceletStringConverter } from '../FaceletStringConverter';

/**
 * Regression Test — 5000 Random Sequences
 *
 * This is the ULTIMATE safety net. It generates thousands of random
 * move sequences and validates every aspect of the state.
 *
 * When we implement the binary representation, this test will run
 * the SAME sequences against both implementations and verify
 * bit-for-bit identical results.
 *
 * Properties validated per sequence:
 * 1. Parity invariant (cp inversions % 2 === ep inversions % 2)
 * 2. Corner orientation sum % 3 === 0
 * 3. Edge orientation sum % 2 === 0
 * 4. isSolved() is consistent
 * 5. Facelet string is valid (exactly 54 chars)
 * 6. Clone produces identical state
 * 7. fromFaceletString(toFaceletString(state)) is identity
 */

const MOVE_TOKENS = [
  'U', "U'", 'U2',
  'R', "R'", 'R2',
  'F', "F'", 'F2',
  'D', "D'", 'D2',
  'L', "L'", 'L2',
  'B', "B'", 'B2',
];

function randomSequence(minLen: number, maxLen: number): string {
  const len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  const moves: string[] = [];
  for (let i = 0; i < len; i++) {
    moves.push(MOVE_TOKENS[Math.floor(Math.random() * MOVE_TOKENS.length)]);
  }
  return moves.join(' ');
}

function validateInvariants(state: CubeState): void {
  // Parity
  let cpInv = 0;
  for (let j = 0; j < 7; j++)
    for (let k = j + 1; k < 8; k++)
      if (state.cp[j] > state.cp[k]) cpInv++;
  let epInv = 0;
  for (let j = 0; j < 11; j++)
    for (let k = j + 1; k < 12; k++)
      if (state.ep[j] > state.ep[k]) epInv++;
  expect(cpInv % 2).toBe(epInv % 2);

  // Corner orientation
  let coSum = 0;
  for (let i = 0; i < 8; i++) coSum += state.co[i];
  expect(coSum % 3).toBe(0);

  // Edge orientation
  let eoSum = 0;
  for (let i = 0; i < 12; i++) eoSum += state.eo[i];
  expect(eoSum % 2).toBe(0);

  // cp values in [0, 7], co values in [0, 1, 2]
  for (let i = 0; i < 8; i++) {
    expect(state.cp[i]).toBeGreaterThanOrEqual(0);
    expect(state.cp[i]).toBeLessThanOrEqual(7);
    expect(state.co[i]).toBeGreaterThanOrEqual(0);
    expect(state.co[i]).toBeLessThanOrEqual(2);
  }

  // ep values in [0, 11], eo values in [0, 1]
  for (let i = 0; i < 12; i++) {
    expect(state.ep[i]).toBeGreaterThanOrEqual(0);
    expect(state.ep[i]).toBeLessThanOrEqual(11);
    expect(state.eo[i]).toBeGreaterThanOrEqual(0);
    expect(state.eo[i]).toBeLessThanOrEqual(1);
  }

  // No duplicate pieces in permutation arrays
  const cpSet = new Set(Array.from(state.cp));
  expect(cpSet.size).toBe(8);
  const epSet = new Set(Array.from(state.ep));
  expect(epSet.size).toBe(12);
}

describe('CubeState — Regression (5000 sequences)', () => {
  // ── Invariant Validation ────────────────────────────────────────────────

  it('5000 random sequences: parity invariant always holds', () => {
    for (let seq = 0; seq < 5000; seq++) {
      const cube = new CubeState();
      const moves = randomSequence(1, 30);
      cube.applySequence(moves);

      let cpInv = 0;
      for (let j = 0; j < 7; j++)
        for (let k = j + 1; k < 8; k++)
          if (cube.cp[j] > cube.cp[k]) cpInv++;
      let epInv = 0;
      for (let j = 0; j < 11; j++)
        for (let k = j + 1; k < 12; k++)
          if (cube.ep[j] > cube.ep[k]) epInv++;

      expect(cpInv % 2).toBe(epInv % 2);
    }
  });

  it('5000 random sequences: orientation invariants always hold', () => {
    for (let seq = 0; seq < 5000; seq++) {
      const cube = new CubeState();
      cube.applySequence(randomSequence(1, 30));

      let coSum = 0;
      for (let i = 0; i < 8; i++) coSum += cube.co[i];
      expect(coSum % 3).toBe(0);

      let eoSum = 0;
      for (let i = 0; i < 12; i++) eoSum += cube.eo[i];
      expect(eoSum % 2).toBe(0);
    }
  });

  // ── Permutation Validity ────────────────────────────────────────────────

  it('5000 random sequences: no duplicate pieces in permutation', () => {
    for (let seq = 0; seq < 5000; seq++) {
      const cube = new CubeState();
      cube.applySequence(randomSequence(1, 30));

      const cpSet = new Set(Array.from(cube.cp));
      expect(cpSet.size).toBe(8);

      const epSet = new Set(Array.from(cube.ep));
      expect(epSet.size).toBe(12);
    }
  });

  // ── Facelet String Consistency ──────────────────────────────────────────

  it('3000 random sequences: toFaceletString produces valid 54-char string', () => {
    for (let seq = 0; seq < 3000; seq++) {
      const cube = new CubeState();
      cube.applySequence(randomSequence(1, 25));

      const facelets = FaceletStringConverter.toFaceletString(cube);
      expect(facelets.length).toBe(54);
      expect(facelets).toMatch(/^[URFDLB]{54}$/);
    }
  });

  it('2000 random sequences: fromFaceletString(toFaceletString(state)) round-trips exactly', () => {
    for (let seq = 0; seq < 2000; seq++) {
      const original = new CubeState();
      original.applySequence(randomSequence(1, 20));

      const facelets = FaceletStringConverter.toFaceletString(original);
      const reconstructed = FaceletStringConverter.fromFaceletString(facelets);

      // Reconstructed must match original in all fields
      for (let i = 0; i < 8; i++) {
        expect(reconstructed.cp[i]).toBe(original.cp[i]);
        expect(reconstructed.co[i]).toBe(original.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(reconstructed.ep[i]).toBe(original.ep[i]);
        expect(reconstructed.eo[i]).toBe(original.eo[i]);
      }
    }
  });

  // ── Clone Consistency ───────────────────────────────────────────────────

  it('1000 random sequences: clone produces identical state', () => {
    for (let seq = 0; seq < 1000; seq++) {
      const original = new CubeState();
      original.applySequence(randomSequence(1, 20));

      const cloned = original.clone();

      for (let i = 0; i < 8; i++) {
        expect(cloned.cp[i]).toBe(original.cp[i]);
        expect(cloned.co[i]).toBe(original.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(cloned.ep[i]).toBe(original.ep[i]);
        expect(cloned.eo[i]).toBe(original.eo[i]);
      }

      expect(cloned.isSolved()).toBe(original.isSolved());
    }
  });

  // ── Inverse Consistency ─────────────────────────────────────────────────

  it('1000 random sequences: sequence + inverse = solved', () => {
    // Simple sequences with known inverses
    for (let seq = 0; seq < 1000; seq++) {
      const moves: string[] = [];
      const len = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < len; i++) {
        moves.push(MOVE_TOKENS[Math.floor(Math.random() * MOVE_TOKENS.length)]);
      }
      const forward = moves.join(' ');

      // Build inverse
      const inverseTokens: string[] = [];
      for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i];
        if (m.endsWith("'")) inverseTokens.push(m.slice(0, -1)); // prime → clockwise
        else if (m.endsWith('2')) inverseTokens.push(m);          // half → half
        else inverseTokens.push(m + "'");                          // clockwise → prime
      }

      const cube = new CubeState();
      cube.applySequence(forward);
      cube.applySequence(inverseTokens.join(' '));
      expect(cube.isSolved()).toBe(true);
    }
  });

  // ── Stress: Deep sequences ──────────────────────────────────────────────

  it('100 deep sequences (1000 moves each): invariants hold after each', () => {
    for (let seq = 0; seq < 100; seq++) {
      const cube = new CubeState();
      for (let i = 0; i < 1000; i++) {
        const token = MOVE_TOKENS[Math.floor(Math.random() * MOVE_TOKENS.length)];
        cube.applySequence(token);
      }
      validateInvariants(cube);
    }
  });
});
