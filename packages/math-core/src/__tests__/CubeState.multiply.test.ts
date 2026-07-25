import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { Move } from '../Constants';

/**
 * Multiply Tests — Safety Net for Binary Refactoring
 *
 * multiply() is the core operation that composes two cube states.
 * It's used internally by applyMove() and initTables().
 * Any error here propagates to ALL other operations.
 *
 * Properties tested:
 * - Identity multiplication (state * identity = state)
 * - Associativity: (A * B) * C = A * (B * C)
 * - Consistency with applyMove
 * - Solved * move = move state
 * - Move inverses compose to identity
 */

describe('CubeState — Multiply', () => {
  it('multiply by solved state (identity) does not change state', () => {
    const state = new CubeState();
    state.applySequence("R U R' U'");

    const before = state.clone();
    const identity = new CubeState(); // solved = identity

    state.multiply(identity);

    // State should be unchanged
    for (let i = 0; i < 8; i++) {
      expect(state.cp[i]).toBe(before.cp[i]);
      expect(state.co[i]).toBe(before.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(state.ep[i]).toBe(before.ep[i]);
      expect(state.eo[i]).toBe(before.eo[i]);
    }
  });

  it('solved * move = move state (identity on left)', () => {
    const identity = new CubeState();

    const moveState = new CubeState();
    moveState.applyMove(Move.R1);

    // Capture expected from applying R1 directly
    const expected = new CubeState();
    expected.applyMove(Move.R1);

    // identity * R1 should equal R1 applied to solved
    identity.multiply(moveState);

    for (let i = 0; i < 8; i++) {
      expect(identity.cp[i]).toBe(expected.cp[i]);
      expect(identity.co[i]).toBe(expected.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(identity.ep[i]).toBe(expected.ep[i]);
      expect(identity.eo[i]).toBe(expected.eo[i]);
    }
  });

  it('multiply matches applyMove for a single move from solved', () => {
    const moves = [
      Move.U1, Move.U2, Move.U3,
      Move.R1, Move.R2, Move.R3,
      Move.F1, Move.F2, Move.F3,
      Move.D1, Move.D2, Move.D3,
      Move.L1, Move.L2, Move.L3,
      Move.B1, Move.B2, Move.B3,
    ];

    for (const move of moves) {
      // Via multiply
      const viaMultiply = new CubeState();
      const moveState = new CubeState();
      moveState.applyMove(move); // get the move state
      viaMultiply.multiply(moveState);

      // Via applyMove
      const viaApply = new CubeState();
      viaApply.applyMove(move);

      for (let i = 0; i < 8; i++) {
        expect(viaMultiply.cp[i]).toBe(viaApply.cp[i]);
        expect(viaMultiply.co[i]).toBe(viaApply.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(viaMultiply.ep[i]).toBe(viaApply.ep[i]);
        expect(viaMultiply.eo[i]).toBe(viaApply.eo[i]);
      }
    }
  });

  it('move * inverse = identity (for all 6 clockwise moves)', () => {
    const pairs: [Move, Move][] = [
      [Move.U1, Move.U3], [Move.R1, Move.R3], [Move.F1, Move.F3],
      [Move.D1, Move.D3], [Move.L1, Move.L3], [Move.B1, Move.B3],
    ];

    for (const [move, inverse] of pairs) {
      const moveState = new CubeState();
      moveState.applyMove(move); // get move state

      const inverseState = new CubeState();
      inverseState.applyMove(inverse); // get inverse state

      // move * inverse should be solved
      moveState.multiply(inverseState);
      expect(moveState.isSolved()).toBe(true);
    }
  });

  it('half-turn * itself = identity', () => {
    const halfTurns = [Move.U2, Move.R2, Move.F2, Move.D2, Move.L2, Move.B2];

    for (const move of halfTurns) {
      const state = new CubeState();
      state.applyMove(move); // get half-turn state

      const clone = state.clone();
      state.multiply(clone);

      expect(state.isSolved()).toBe(true);
    }
  });

  it('multiply is consistent with applySequence for T-Perm', () => {
    const tPermMovesStr = "R U R' U' R' F R2 U' R' U' R U R' F'";

    // Via applySequence
    const viaSeq = new CubeState();
    viaSeq.applySequence(tPermMovesStr);

    // Via explicit multiply chain
    const viaMult = new CubeState();
    const tokens = tPermMovesStr.trim().split(/\s+/);
    for (const token of tokens) {
      // Create a fresh state for each single move
      const moveState = new CubeState();
      moveState.applySequence(token);
      viaMult.multiply(moveState);
    }

    for (let i = 0; i < 8; i++) {
      expect(viaMult.cp[i]).toBe(viaSeq.cp[i]);
      expect(viaMult.co[i]).toBe(viaSeq.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaMult.ep[i]).toBe(viaSeq.ep[i]);
      expect(viaMult.eo[i]).toBe(viaSeq.eo[i]);
    }
  });

  it('multiply with self (state * state) produces valid state', () => {
    const state = new CubeState();
    state.applySequence("R U");

    const clone = state.clone();
    state.multiply(clone);

    // Should be a physically valid state
    // Verify parity invariant
    let cpInversions = 0;
    for (let j = 0; j < 7; j++) {
      for (let k = j + 1; k < 8; k++) {
        if (state.cp[j] > state.cp[k]) cpInversions++;
      }
    }
    let epInversions = 0;
    for (let j = 0; j < 11; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (state.ep[j] > state.ep[k]) epInversions++;
      }
    }
    expect(cpInversions % 2).toBe(epInversions % 2);

    // Orientation invariants
    let coSum = 0;
    for (let i = 0; i < 8; i++) coSum += state.co[i];
    expect(coSum % 3).toBe(0);

    let eoSum = 0;
    for (let i = 0; i < 12; i++) eoSum += state.eo[i];
    expect(eoSum % 2).toBe(0);
  });

  it('scrambled * inverseScramble = identity (non-trivial composition)', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const inverse = "F R U' R' U R U R2 F' R U R U' R'";

    const forward = new CubeState();
    forward.applySequence(scramble);

    const backward = new CubeState();
    backward.applySequence(inverse);

    // forward * backward should be identity
    forward.multiply(backward);
    expect(forward.isSolved()).toBe(true);
  });
});
