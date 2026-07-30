import { describe, it, expect } from 'vitest';
import { invertMove, invertAlgorithm, invertMoveArray } from '../caseGenerator';
import { CubeState } from '@cubeforge/math-core';

describe('invertMove — Edge Cases', () => {
  // ── Normal operation (already tested in caseGenerator.test.ts) ────

  it('inverts CW to CCW', () => {
    expect(invertMove('R')).toBe("R'");
    expect(invertMove('U')).toBe("U'");
  });

  it('inverts CCW to CW', () => {
    expect(invertMove("R'")).toBe('R');
  });

  it('180° is self-inverse', () => {
    expect(invertMove('R2')).toBe('R2');
    expect(invertMove('U2')).toBe('U2');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('invertMove with empty string returns trailing prime: should not throw but returns invalid notation', () => {
    const result = invertMove('');
    // Current behavior: if no suffix, appends "'" → returns "'"
    expect(result).toBe("'");
  });

  it('invertMove with single quote only returns empty string', () => {
    const result = invertMove("'");
    // endsWith("'") → true → slice(0, -1) → ""
    expect(result).toBe('');
  });

  it('invertMove with "2" only returns "2"', () => {
    const result = invertMove('2');
    // not endsWith("'"), endsWith('2') → true → return token
    expect(result).toBe('2');
  });

  it('invertMove with lowercase letters (non-standard) works mechanically', () => {
    // Lowercase moves like 'r', 'u' — the function doesn't validate
    expect(invertMove('r')).toBe("r'");
    expect(invertMove("r'")).toBe('r');
    expect(invertMove('r2')).toBe('r2');
  });

  it('invertMove with wide-move notation works', () => {
    expect(invertMove('Rw')).toBe("Rw'");
    expect(invertMove("Rw'")).toBe('Rw');
    expect(invertMove('Rw2')).toBe('Rw2');
  });

  // ── invertAlgorithm edge cases ────────────────────────────────────

  it('invertAlgorithm with empty string returns empty string', () => {
    expect(invertAlgorithm('')).toBe('');
  });

  it('invertAlgorithm with whitespace only returns empty string', () => {
    expect(invertAlgorithm('   ')).toBe('');
  });

  it('invertAlgorithm with single move returns its inverse', () => {
    expect(invertAlgorithm('R')).toBe("R'");
    expect(invertAlgorithm("R'")).toBe('R');
    expect(invertAlgorithm('R2')).toBe('R2');
  });

  it('invertAlgorithm with mixed notation inverts correctly', () => {
    expect(invertAlgorithm("R U R' U'")).toBe("U R U' R'");
    expect(invertAlgorithm('R2 F B2')).toBe("B2 F' R2");
  });

  it('invertAlgorithm + applySequence returns to solved', () => {
    const forward = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const inverse = invertAlgorithm(forward);
    const cube = new CubeState();
    cube.applySequence(forward);
    expect(cube.isSolved()).toBe(false);
    cube.applySequence(inverse);
    expect(cube.isSolved()).toBe(true);
  });

  it('invertAlgorithm with non-standard tokens (Rw, M, x) works', () => {
    expect(invertAlgorithm('Rw U Rw\'')).toBe("Rw U' Rw'");
    expect(invertAlgorithm('M2 U M2')).toBe("M2 U' M2");
    expect(invertAlgorithm('x y z')).toBe("z' y' x'");
  });

  // ── invertMoveArray edge cases ────────────────────────────────────

  it('invertMoveArray with empty array returns empty array', () => {
    expect(invertMoveArray([])).toEqual([]);
  });

  it('invertMoveArray reverses and inverts each move', () => {
    expect(invertMoveArray(['R', 'U', "R'", "U'"])).toEqual(['U', 'R', "U'", "R'"]);
  });

  it('invertMoveArray produces symmetric result (double inverse = original)', () => {
    const original = ['R', 'U', "R'", "U'", 'F', 'R2'];
    const once = invertMoveArray(original);
    const twice = invertMoveArray(once);
    expect(twice).toEqual(original);
  });

  it('invertMoveArray with all 180° moves stays same (reversed)', () => {
    // 180° moves are self-inverse, but the array is still reversed
    expect(invertMoveArray(['R2', 'U2', 'F2'])).toEqual(['F2', 'U2', 'R2']);
    // Double inverse restores order
    expect(invertMoveArray(invertMoveArray(['R2', 'U2', 'F2']))).toEqual(['R2', 'U2', 'F2']);
  });

  // ── Real-world verification ───────────────────────────────────────

  it('invertAlgorithm on a real scramble produces the correct inverse', () => {
    const scrambles = [
      "R U R' U'",
      "F R U' R' U' R U R' F'",
      "R2 U R U R' U' R' U' R' U R'",
      "M2 U M2 U2 M2 U M2",
    ];
    for (const scramble of scrambles) {
      const cube = new CubeState();
      cube.applySequence(scramble);
      expect(cube.isSolved()).toBe(false);
      cube.applySequence(invertAlgorithm(scramble));
      expect(cube.isSolved()).toBe(true);
    }
  });
});
