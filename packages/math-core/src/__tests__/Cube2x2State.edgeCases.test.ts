/**
 * Level 2 — Edge cases for Cube2x2State
 *
 * Boundary cases:
 * • applySequence with empty, null, malformed strings
 * • D, L, B moves delegated to the 3x3 CubeState
 * • clone() and reset() on scrambled states
 * • invertNotation with invalid inputs
 * • isSolved with corrupted states
 * • applyMove with all 18 moves
 */
import { describe, it, expect } from 'vitest';
import { Cube2x2State, Move2x2, StringToMove2x2 } from '../Cube2x2State';

describe('Cube2x2State — Level 2 Edge Cases', () => {
  // ── Constructor ────────────────────────────────────────────────────

  it('constructor without args creates a solved state', () => {
    const s = new Cube2x2State();
    expect(s.isSolved()).toBe(true);
    expect(s.cp).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(s.co).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('constructor with custom cp/co', () => {
    const cp = [3, 0, 1, 2, 4, 5, 6, 7];
    const co = [0, 0, 0, 0, 0, 0, 0, 0];
    const s = new Cube2x2State(cp, co);
    expect(Array.from(s.cp)).toEqual(cp);
    expect(Array.from(s.co)).toEqual(co);
  });

  it('constructor with undefined cp and co', () => {
    const s = new Cube2x2State(undefined, undefined);
    expect(s.isSolved()).toBe(true);
  });

  // ── applySequence: empty and malformed strings ─────────────────────

  it('applySequence with an empty string does not change the state', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.U1); // scrambled
    const before = s.clone();
    s.applySequence('');
    expect(Array.from(s.cp)).toEqual(Array.from(before.cp));
    expect(Array.from(s.co)).toEqual(Array.from(before.co));
  });

  it('applySequence with spaces does not change the state', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.R1);
    const before = s.clone();
    s.applySequence('   ');
    expect(Array.from(s.cp)).toEqual(Array.from(before.cp));
  });

  it('applySequence with only spaces and tabs', () => {
    const s = new Cube2x2State();
    s.applySequence('\t \n  ');
    expect(s.isSolved()).toBe(true);
  });

  it('applySequence with a single well-formed move', () => {
    const s = new Cube2x2State();
    s.applySequence("U");
    expect(s.isSolved()).toBe(false);
    s.applySequence("U'");
    expect(s.isSolved()).toBe(true);
  });

  // ── applySequence: moves that do NOT exist ─────────────────────────

  it('applySequence with a token missing from StringToMove2x2 throws', () => {
    const s = new Cube2x2State();
    expect(() => s.applySequence('X')).toThrow();
  });

  it('applySequence with a numeric token throws', () => {
    const s = new Cube2x2State();
    expect(() => s.applySequence('123')).toThrow();
  });

  // ── D, L, B moves delegated to the 3x3 CubeState ───────────────────

  it('applySequence with a D move (delegated to 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("D");
    expect(s.isSolved()).toBe(false);
    // D moves the bottom layer: all 4 D corners change position
    expect(s.cp[6]).not.toBe(6); // DBL moves
  });

  it('applySequence with an L move', () => {
    const s = new Cube2x2State();
    s.applySequence("L");
    expect(s.isSolved()).toBe(false);
  });

  it('applySequence with a B move', () => {
    const s = new Cube2x2State();
    s.applySequence("B");
    expect(s.isSolved()).toBe(false);
  });

  it('D + D + D + D = solved (4 D return to start)', () => {
    const s = new Cube2x2State();
    s.applySequence("D D D D");
    expect(s.isSolved()).toBe(true);
  });

  // ── Compound URF moves (native) ────────────────────────────────────

  it('U R F applied in sequence keeps cp[6] = 6 (DBL fixed)', () => {
    const s = new Cube2x2State();
    s.applySequence("U R F U2 R' F'");
    expect(s.cp[6]).toBe(6); // DBL does not move with URF
  });

  it('U + U + U + U = 4U returns to start', () => {
    const s = new Cube2x2State();
    s.applySequence("U U U U");
    // 4 x U = full 360° cycle
    expect(s.isSolved()).toBe(true);
  });

  it('R + R\' = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("R R'");
    expect(s.isSolved()).toBe(true);
  });

  it('F4 (F F F F) = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("F F F F");
    expect(s.isSolved()).toBe(true);
  });

  // ── Extended moves (x, y, z, M, E, S) delegated to 3×3 ────────────

  it('sequence with a y rotation (delegated to 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("y");
    // y rotation moves the whole cube, DBL changes position
    expect(s.cp[6]).not.toBe(6);
  });

  it('applySequence with a y rotation (delegated to CubeState 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("y");
    expect(s.cp[6]).not.toBe(6); // DBL moves with the global rotation
    // y + y + y + y = 4 rotations return to the original
    s.applySequence("y y y");
    expect(s.isSolved()).toBe(true);
  });

  it('x rotation changes the corners', () => {
    const s = new Cube2x2State();
    s.applySequence("x");
    expect(s.isSolved()).toBe(false);
  });

  it('x + x + x + x = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("x x x x");
    expect(s.isSolved()).toBe(true);
  });

  it('z rotation', () => {
    const s = new Cube2x2State();
    s.applySequence("z");
    expect(s.isSolved()).toBe(false);
  });

  // ── clone() ────────────────────────────────────────────────────────

  it('clone() produce un estado independiente', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.R1);
    const c = s.clone();
    c.applyMove(Move2x2.U1);
    expect(Array.from(s.cp)).not.toEqual(Array.from(c.cp));
  });

  it('clone() de estado resuelto es resuelto', () => {
    const s = new Cube2x2State();
    expect(s.clone().isSolved()).toBe(true);
  });

  it('clone() after a long sequence', () => {
    const s = new Cube2x2State();
    s.applySequence("R U R' U' R' F R F'");
    const c = s.clone();
    expect(Array.from(s.cp)).toEqual(Array.from(c.cp));
    expect(Array.from(s.co)).toEqual(Array.from(c.co));
  });

  // ── reset() ────────────────────────────────────────────────────────

  it('reset() returns to the solved state', () => {
    const s = new Cube2x2State();
    s.applySequence("R U R' F2 U2 R' F'");
    expect(s.isSolved()).toBe(false);
    s.reset();
    expect(s.isSolved()).toBe(true);
  });

  it('reset() twice in a row is safe', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.F1);
    s.reset();
    s.reset();
    expect(s.isSolved()).toBe(true);
  });

  // ── isSolved() ─────────────────────────────────────────────────────

  it('isSolved detects a twisted corner (co[3] = 1)', () => {
    const s = new Cube2x2State();
    s.co[3] = 1; // Manually twist one corner
    expect(s.isSolved()).toBe(false);
  });

  it('isSolved detects a swapped corner (cp[0]=1, cp[1]=0)', () => {
    const s = new Cube2x2State();
    s.cp[0] = 1;
    s.cp[1] = 0;
    expect(s.isSolved()).toBe(false);
  });

  // ── invertNotation ─────────────────────────────────────────────────

  it('invertNotation inverts a sequence correctly', () => {
    const result = Cube2x2State.invertNotation("R U R'");
    expect(result).toBe("R U' R'");
  });

  it('invertNotation with an empty sequence returns empty', () => {
    expect(Cube2x2State.invertNotation("")).toBe("");
  });

  it('invertNotation with spaces returns empty', () => {
    expect(Cube2x2State.invertNotation("  ")).toBe("");
  });

  it('invertNotation with an invalid token throws', () => {
    expect(() => Cube2x2State.invertNotation("X")).toThrow();
  });

  it('invertNotation round-trip: apply(invert(s)) = solved', () => {
    const scramble = "R U R' F2 U2 R' F'";
    const inv = Cube2x2State.invertNotation(scramble);
    const s = new Cube2x2State();
    s.applySequence(scramble);
    s.applySequence(inv);
    expect(s.isSolved()).toBe(true);
  });

  it('invertNotation keeps U2 as U2', () => {
    expect(Cube2x2State.invertNotation("U2")).toBe("U2");
  });

  // ── applyMove: all 18 moves ────────────────────────────────────────

  it('applyMove with each of the 18 moves does not throw', () => {
    for (let m = 0; m < 18; m++) {
      const s = new Cube2x2State();
      expect(() => s.applyMove(m as Move2x2)).not.toThrow();
      // After applying and undoing, it must return to solved
      const inv = Cube2x2State.inverseMove(m as Move2x2);
      s.applyMove(inv);
      expect(s.isSolved()).toBe(true);
    }
  });

  // ── inverseMove + moveToNotation ───────────────────────────────────

  it('inverseMove: U1 ↔ U3', () => {
    expect(Cube2x2State.inverseMove(Move2x2.U1)).toBe(Move2x2.U3);
    expect(Cube2x2State.inverseMove(Move2x2.U3)).toBe(Move2x2.U1);
  });

  it('inverseMove: U2 ↔ U2 (self-inverse)', () => {
    expect(Cube2x2State.inverseMove(Move2x2.U2)).toBe(Move2x2.U2);
  });

  it('moveToNotation: 0→U, 1→U2, 2→U\'', () => {
    expect(Cube2x2State.moveToNotation(Move2x2.U1)).toBe('U');
    expect(Cube2x2State.moveToNotation(Move2x2.U2)).toBe('U2');
    expect(Cube2x2State.moveToNotation(Move2x2.U3)).toBe("U'");
  });

  // ── StringToMove2x2: exhaustive validation ─────────────────────────

  it('StringToMove2x2 has 18 entries + 6 aliases (U3, R3, F3, D3, L3, B3)', () => {
    const expected = [
      'U', 'U2', "U'", 'U3',
      'R', 'R2', "R'", 'R3',
      'F', 'F2', "F'", 'F3',
      'D', 'D2', "D'", 'D3',
      'L', 'L2', "L'", 'L3',
      'B', 'B2', "B'", 'B3',
    ];
    for (const key of expected) {
      expect(StringToMove2x2[key]).toBeDefined();
    }
  });

  // ── Extreme states ────────────────────────────────────────────────

  it('superflip 2×2 (6 moves) is not solved', () => {
    // Superflip-like state on 2×2: R U2 R' U' R U2 R' F R' F'
    const s = new Cube2x2State();
    s.applySequence("R U2 R' U' R U2 R' F R' F'");
    expect(s.isSolved()).toBe(false);
  });

  it('18 URF moves each applied once returns to solved', () => {
    // Apply each of the 9 URF moves once, then their inverses
    const moves = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
    const inverse = ["U'", 'U2', 'U', "R'", 'R2', 'R', "F'", 'F2', 'F'];
    const s = new Cube2x2State();
    for (const m of moves) s.applySequence(m);
    for (const m of inverse.reverse()) s.applySequence(m);
    expect(s.isSolved()).toBe(true);
  });
});
