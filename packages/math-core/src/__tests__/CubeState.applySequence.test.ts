import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * applySequence Tests — Safety Net for Binary Refactoring
 *
 * Verifies that applySequence correctly parses and applies all notation variants:
 * - Standard notation (U, R, F, D, L, B)
 * - Prime notation (U', R', F', D', L', B')
 * - Half-turn notation (U2, R2, F2, D2, L2, B2)
 * - Mixed notation (U3, R3)
 * - Multiple spaces between moves
 * - Leading/trailing whitespace
 * - Empty string
 * - Known algorithm sequences
 */

describe('CubeState — applySequence', () => {
  // ── Basic Parsing ───────────────────────────────────────────────────────

  it('empty string does nothing (cube stays solved)', () => {
    const cube = new CubeState();
    cube.applySequence('');
    expect(cube.isSolved()).toBe(true);
  });

  it('whitespace-only string does nothing', () => {
    const cube = new CubeState();
    cube.applySequence('   \t  \n  ');
    expect(cube.isSolved()).toBe(true);
  });

  it('single move U', () => {
    const cube = new CubeState();
    cube.applySequence('U');
    expect(cube.isSolved()).toBe(false);
  });

  it("single move with prime notation U'", () => {
    const cube = new CubeState();
    cube.applySequence("U'");
    expect(cube.isSolved()).toBe(false);
    // U' followed by U = solved
    cube.applySequence('U');
    expect(cube.isSolved()).toBe(true);
  });

  it('single half-turn U2', () => {
    const cube = new CubeState();
    cube.applySequence('U2');
    // U2 + U2 = solved
    cube.applySequence('U2');
    expect(cube.isSolved()).toBe(true);
  });

  it("numeric notation U3 (equivalent to U')", () => {
    const viaPrime = new CubeState();
    viaPrime.applySequence("U'");

    const viaNum = new CubeState();
    viaNum.applySequence('U3');

    // Both should produce the same state
    for (let i = 0; i < 8; i++) {
      expect(viaNum.cp[i]).toBe(viaPrime.cp[i]);
      expect(viaNum.co[i]).toBe(viaPrime.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaNum.ep[i]).toBe(viaPrime.ep[i]);
      expect(viaNum.eo[i]).toBe(viaPrime.eo[i]);
    }
  });

  // ── All 18 base moves via applySequence ──────────────────────────────────

  it('all 18 moves work correctly via applySequence', () => {
    const cases: [string, string][] = [
      ['U', "U'"], ["U'", 'U'], ['U2', 'U2'],
      ['R', "R'"], ["R'", 'R'], ['R2', 'R2'],
      ['F', "F'"], ["F'", 'F'], ['F2', 'F2'],
      ['D', "D'"], ["D'", 'D'], ['D2', 'D2'],
      ['L', "L'"], ["L'", 'L'], ['L2', 'L2'],
      ['B', "B'"], ["B'", 'B'], ['B2', 'B2'],
    ];

    for (const [move, inverse] of cases) {
      const cube = new CubeState();
      cube.applySequence(move);
      expect(cube.isSolved()).toBe(false);

      cube.applySequence(inverse);
      expect(cube.isSolved()).toBe(true);
    }
  });

  // ── Spacing and Formatting ───────────────────────────────────────────────

  it('multiple spaces between moves are handled', () => {
    const cube = new CubeState();
    cube.applySequence('R    U   R\'    U\'');
    expect(cube.isSolved()).toBe(false);

    // Inverse sequence
    cube.applySequence('U R U\' R\'');
    expect(cube.isSolved()).toBe(true);
  });

  it('leading and trailing whitespace is trimmed', () => {
    const cube = new CubeState();
    cube.applySequence('  R U R\' U\'  ');
    // Apply inverse
    cube.applySequence('U R U\' R\'');
    expect(cube.isSolved()).toBe(true);
  });

  it('newlines between moves are handled', () => {
    const cube = new CubeState();
    cube.applySequence('R\nU\nR\'\nU\'');
    cube.applySequence('U R U\' R\'');
    expect(cube.isSolved()).toBe(true);
  });

  it('tabs between moves are handled', () => {
    const cube = new CubeState();
    cube.applySequence('R\tU\tR\'\tU\'');
    cube.applySequence('U R U\' R\'');
    expect(cube.isSolved()).toBe(true);
  });

  // ── Known Algorithms ─────────────────────────────────────────────────────

  it('T-Perm is an involution (applied twice = solved)', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const cube = new CubeState();
    cube.applySequence(tPerm);
    expect(cube.isSolved()).toBe(false);
    cube.applySequence(tPerm);
    expect(cube.isSolved()).toBe(true);
  });

  it('Y-Perm works correctly', () => {
    const yPerm = "F R U' R' U' R U R' F' R U R' U' R' F R F'";
    const cube = new CubeState();
    cube.applySequence(yPerm);
    // Y-Perm is also an involution
    cube.applySequence(yPerm);
    expect(cube.isSolved()).toBe(true);
  });

  it('sexy move (R U R\' U\') × 6 = solved', () => {
    const cube = new CubeState();
    for (let i = 0; i < 6; i++) {
      cube.applySequence("R U R' U'");
    }
    expect(cube.isSolved()).toBe(true);
  });

  it('sledgehammer (R\' F R F\') × 6 = solved', () => {
    const cube = new CubeState();
    for (let i = 0; i < 6; i++) {
      cube.applySequence("R' F R F'");
    }
    expect(cube.isSolved()).toBe(true);
  });

  // ── Long Sequence Consistency ────────────────────────────────────────────

  it('20-move scramble + inverse = solved', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const inverse = "F R U' R' U R U R2 F' R U R U' R'";

    const cube = new CubeState();
    cube.applySequence(scramble);
    expect(cube.isSolved()).toBe(false);

    cube.applySequence(inverse);
    expect(cube.isSolved()).toBe(true);
  });

  // ── Error Handling ───────────────────────────────────────────────────────

  it('throws on invalid move token', () => {
    const cube = new CubeState();
    expect(() => cube.applySequence('X')).toThrow();
    expect(() => cube.applySequence('U R X D')).toThrow();
  });

  it('throws on invalid double-letter token', () => {
    const cube = new CubeState();
    expect(() => cube.applySequence('UR')).toThrow();
  });

  // ── Sequence Equivalence ────────────────────────────────────────────────

  it('U D sequence vs D U sequence produce same state (commuting)', () => {
    const viaUD = new CubeState();
    viaUD.applySequence('U D');

    const viaDU = new CubeState();
    viaDU.applySequence('D U');

    // U and D commute on a solved cube
    for (let i = 0; i < 8; i++) {
      expect(viaUD.cp[i]).toBe(viaDU.cp[i]);
      expect(viaUD.co[i]).toBe(viaDU.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaUD.ep[i]).toBe(viaDU.ep[i]);
      expect(viaUD.eo[i]).toBe(viaDU.eo[i]);
    }
  });

  it('R L sequence vs L R sequence produce same state (commuting)', () => {
    const viaRL = new CubeState();
    viaRL.applySequence('R L');

    const viaLR = new CubeState();
    viaLR.applySequence('L R');

    for (let i = 0; i < 8; i++) {
      expect(viaRL.cp[i]).toBe(viaLR.cp[i]);
      expect(viaRL.co[i]).toBe(viaLR.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaRL.ep[i]).toBe(viaLR.ep[i]);
      expect(viaRL.eo[i]).toBe(viaLR.eo[i]);
    }
  });
});
