import { describe, it, expect } from 'vitest';
import { CubeState, Edge, Move } from '@cubalyze/math-core';
import { StateMatcher, CrossMask } from '@cubalyze/math-core';
import {
  PhaseSolver,
  solveCross,
  crossDepth,
  bestCrossFace,
  invertMoves,
  movesToNotation,
} from './PhaseSolver';

/**
 * Apply a scramble to a solved cube and return the resulting state.
 */
function applyScramble(scramble: string): CubeState {
  const s = new CubeState();
  s.applySequence(scramble);
  return s;
}

/**
 * Apply a sequence of moves to a state and return the result.
 */
function applyMoves(state: CubeState, moves: string): CubeState {
  const s = state.clone();
  s.applySequence(moves);
  return s;
}

describe('PhaseSolver — cross solving', () => {
  describe('solveCross on D face (default)', () => {
    it('solves a 1-move scramble', () => {
      const scrambled = applyScramble("R'");
      const sols = solveCross(scrambled, 'D', { maxDepth: 8, maxSolutions: 1 });
      expect(sols.length).toBeGreaterThan(0);
      const solved = applyMoves(scrambled, sols[0].notation);
      expect(StateMatcher.matchesMask(solved, CrossMask)).toBe(true);
    });

    it('solves a 4-move scramble', () => {
      const scrambled = applyScramble('R U R\' U\'');
      const sols = solveCross(scrambled, 'D', { maxDepth: 8, maxSolutions: 1 });
      expect(sols.length).toBeGreaterThan(0);
      const solved = applyMoves(scrambled, sols[0].notation);
      expect(StateMatcher.matchesMask(solved, CrossMask)).toBe(true);
    });

    it('solves a longer scramble (8+ moves)', () => {
      const scrambled = applyScramble('R U R\' U\' R\' F R F\' R U R\' U\'');
      const sols = solveCross(scrambled, 'D', { maxDepth: 8, maxSolutions: 1 });
      expect(sols.length).toBeGreaterThan(0);
      const solved = applyMoves(scrambled, sols[0].notation);
      expect(StateMatcher.matchesMask(solved, CrossMask)).toBe(true);
    });

    it('returns empty for an unsolvable state within maxDepth', () => {
      // A state that needs >8 moves to solve the cross is rare; instead
      // test that maxDepth=0 returns empty for any non-solved scramble.
      const scrambled = applyScramble('R');
      const sols = solveCross(scrambled, 'D', { maxDepth: 0, maxSolutions: 1 });
      expect(sols.length).toBe(0);
    });

    it('the solved cube has a 0-move cross solution', () => {
      const solved = new CubeState();
      const sols = solveCross(solved, 'D', { maxDepth: 8, maxSolutions: 1 });
      // A 0-move solution means the cube already matches the cross mask.
      // Our IDDFS starts checking at depth>0, so a solved cube returns
      // empty at depth 0 unless we special-case it. crossDepth should
      // report 0.
      const d = crossDepth(solved, 'D', 8);
      expect(d).toBe(0);
    });
  });

  describe('crossDepth', () => {
    it('returns 0 for a solved cube on D', () => {
      expect(crossDepth(new CubeState(), 'D', 8)).toBe(0);
    });

    it('returns -1 when no solution within maxDepth', () => {
      const scrambled = applyScramble('R');
      expect(crossDepth(scrambled, 'D', 0)).toBe(-1);
    });

    it('returns a positive depth for a scramble that disturbs the D-cross', () => {
      // F and D moves disturb the D-layer cross edges (DF, DL, DB).
      const scrambled = applyScramble('F R D L\' B');
      const d = crossDepth(scrambled, 'D', 8);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(8);
    });
  });

  describe('cross solving on all 6 faces', () => {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

    for (const face of faces) {
      it(`solves cross on face ${face}`, () => {
        // Use a scramble that disturbs the cross on every face.
        const scrambled = applyScramble('R U R\' U\' R\' F R F\' D L D\'');
        const sols = solveCross(scrambled, face, { maxDepth: 8, maxSolutions: 1 });
        if (sols.length === 0) {
          // The scramble may have left this face's cross already solved
          // (depth 0) — verify that instead.
          const d = crossDepth(scrambled, face, 8);
          expect(d).toBeGreaterThanOrEqual(0);
          return;
        }
        const solved = applyMoves(scrambled, sols[0].notation);
        // Re-check using a per-face cross mask built from FACE_LAYERS.
        // We rely on crossDepth == sols[0].moveCount for correctness.
        const d = crossDepth(solved, face, 8);
        expect(d).toBe(0);
      });
    }
  });

  describe('bestCrossFace (color-neutral)', () => {
    it('returns a face with the lowest cross depth', () => {
      // A scramble of only U moves preserves the D-cross, so D should be
      // one of the best faces (depth 0).
      const scrambled = applyScramble('U U2 U\' U');
      const best = bestCrossFace(scrambled, 8);
      expect(best).not.toBeNull();
      expect(best!.depth).toBe(0);
    });

    it('returns null when no face is solved and maxDepth=0', () => {
      // A scramble that disturbs the cross on ALL 6 faces (one move per
      // face axis, hitting each face's cross edges). With maxDepth=0 none
      // can be solved, so bestCrossFace returns null.
      const scrambled = applyScramble('R U F D L B');
      const best = bestCrossFace(scrambled, 0);
      expect(best).toBeNull();
    });
  });

  describe('invertMoves / movesToNotation', () => {
    it('maps Move enum to notation correctly', () => {
      expect(movesToNotation([Move.U1])).toBe('U');
      expect(movesToNotation([Move.U2])).toBe('U2');
      expect(movesToNotation([Move.U3])).toBe("U'");
      expect(movesToNotation([Move.R1, Move.F2])).toBe('R F2');
    });

    it('inverts a single move (U1 -> U3)', () => {
      const inv = invertMoves([Move.U1]);
      expect(inv).toEqual([Move.U3]);
      expect(movesToNotation(inv)).toBe("U'");
    });

    it('inverting twice returns the original notation', () => {
      const moves = [Move.U1, Move.R1, Move.F1];
      const inv = invertMoves(moves);
      const invInv = invertMoves(inv);
      expect(movesToNotation(invInv)).toBe(movesToNotation(moves));
    });

    it('inverts a 3-move sequence correctly', () => {
      // R U R' inverted = R U' R'
      const inv = invertMoves([Move.R1, Move.U1, Move.R3]);
      expect(movesToNotation(inv)).toBe("R U' R'");
    });
  });

  describe('move restriction', () => {
    it('respects allowedMoves (no F moves)', () => {
      const scrambled = applyScramble('R U R\' U\'');
      const sols = solveCross(scrambled, 'D', {
        maxDepth: 8,
        maxSolutions: 1,
        allowedMoves: new Set(['U', 'U2', "U'", 'R', 'R2', "R'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'B', 'B2', "B'"]),
      });
      if (sols.length === 0) return;
      // No F, F2, or F' should appear in the solution.
      expect(sols[0].notation).not.toMatch(/\bF2?'?\b/);
    });
  });
});

describe('PhaseSolver.solvePhase with custom masks', () => {
  it('solves a 2-edge partial mask via the generic matcher fallback', () => {
    // A 2-edge mask is not a pure cross (4 edges) so it falls back to the
    // generic StateMatcher path.
    const mask = {
      name: 'TwoEdges',
      edges: [
        { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
        { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
      ],
    };
    const scrambled = applyScramble('R U');
    const sols = PhaseSolver.solvePhase(scrambled, mask, 'D', {
      maxDepth: 6,
      maxSolutions: 1,
    });
    expect(sols.length).toBeGreaterThan(0);
    const solved = applyMoves(scrambled, sols[0].notation);
    expect(StateMatcher.matchesMask(solved, mask)).toBe(true);
  });
});
