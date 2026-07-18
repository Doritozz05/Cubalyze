import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { Move, Corner, Edge } from '../Constants';

/**
 * Move Validation Tests — Safety Net for Binary Refactoring
 *
 * Each of the 18 moves is validated against:
 * 1. Structural invariants (parity, orientation sums)
 * 2. 4× same move = identity (returns to solved)
 * 3. Inverse property (move + inverse = solved)
 * 4. Specific expected cp/co/ep/eo values (derived from current working implementation)
 *
 * These tests MUST pass identically with both array-based and binary implementations.
 *
 * Values cross-referenced with SebLague's known-correct implementation
 * (github.com/SebLague/Rubiks-Cube):
 * - Edge IDs match: UR=0, UF=1, UL=2, UB=3, DR=4, DF=5, DL=6, DB=7, FR=8, FL=9, BL=10, BR=11
 * - Corner IDs match: URF=0, UFL=1, ULB=2, UBR=3, DFR=4, DLF=5, DBL=6, DRB=7
 * - Same Kociemba standard coordinate system
 */

/** All 18 moves */
const ALL_MOVES: Move[] = [
  Move.U1, Move.U2, Move.U3,
  Move.R1, Move.R2, Move.R3,
  Move.F1, Move.F2, Move.F3,
  Move.D1, Move.D2, Move.D3,
  Move.L1, Move.L2, Move.L3,
  Move.B1, Move.B2, Move.B3,
];

/** Maps Move enum to human-readable name */
const MOVE_NAMES: Record<number, string> = {
  [Move.U1]: 'U', [Move.U2]: 'U2', [Move.U3]: "U'",
  [Move.R1]: 'R', [Move.R2]: 'R2', [Move.R3]: "R'",
  [Move.F1]: 'F', [Move.F2]: 'F2', [Move.F3]: "F'",
  [Move.D1]: 'D', [Move.D2]: 'D2', [Move.D3]: "D'",
  [Move.L1]: 'L', [Move.L2]: 'L2', [Move.L3]: "L'",
  [Move.B1]: 'B', [Move.B2]: 'B2', [Move.B3]: "B'",
};

/** Get the inverse of a move (U1 → U3, R1 → R3, etc.) */
function inverseMove(m: Move): Move {
  const face = Math.floor(m / 3);
  const turn = m % 3;
  const invTurn = turn === 0 ? 2 : turn === 2 ? 0 : 1;
  return (face * 3 + invTurn) as Move;
}

/** Count inversions in a permutation array */
function countInversions(arr: ArrayLike<number>): number {
  let inversions = 0;
  for (let j = 0; j < arr.length - 1; j++) {
    for (let k = j + 1; k < arr.length; k++) {
      if (arr[j] > arr[k]) inversions++;
    }
  }
  return inversions;
}

/** Validate that a state satisfies the parity invariant */
function validateParity(state: CubeState): void {
  const cpInversions = countInversions(state.cp);
  const epInversions = countInversions(state.ep);
  expect(cpInversions % 2).toBe(epInversions % 2);
}

/** Validate orientation sums */
function validateOrientations(state: CubeState): void {
  let coSum = 0;
  for (let i = 0; i < 8; i++) coSum += state.co[i];
  expect(coSum % 3).toBe(0);

  let eoSum = 0;
  for (let i = 0; i < 12; i++) eoSum += state.eo[i];
  expect(eoSum % 2).toBe(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Expected values for each of the 18 moves applied to a SOLVED cube.
//
// These are DERIVED from the current array-based implementation and MUST
// match identically after binary refactoring.
//
// Format: { cp: number[], co: number[], ep: number[], eo: number[] }
//
// Cross-referenced with SebLague's Move.cs bit representations:
// - His CornerReorientCase: 0=U/D faces, 1=R/L faces, 2=F/B faces
// - His EdgeFlipMask: flips edges on F/B moves
// - Our co/eo arrays encode the same physical cube state
// ═══════════════════════════════════════════════════════════════════════════

// Helper: U1 from solved
// baseU = {cp:[3,0,1,2,4,5,6,7], co:[0,0,0,0,0,0,0,0], ep:[3,0,1,2,4,5,6,7,8,9,10,11], eo:all0}
const U1_EXPECTED = {
  cp: [3, 0, 1, 2, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// U2 = U1 * U1
const U2_EXPECTED = {
  cp: [2, 3, 0, 1, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// U3 = U1 * U2 (inverse of U1)
const U3_EXPECTED = {
  cp: [1, 2, 3, 0, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// Edge enum: UR=0,UF=1,UL=2,UB=3,DR=4,DF=5,DL=6,DB=7,FR=8,FL=9,BL=10,BR=11
// baseR = {cp:[DFR(4),UFL(1),ULB(2),URF(0),DRB(7),DLF(5),DBL(6),UBR(3)], co:[2,0,0,1,1,0,0,2]}
// ep = [FR(8),UF(1),UL(2),UB(3),BR(11),DF(5),DL(6),DB(7),DR(4),FL(9),BL(10),UR(0)]
const R1_EXPECTED = {
  cp: [4, 1, 2, 0, 7, 5, 6, 3],
  co: [2, 0, 0, 1, 1, 0, 0, 2],
  ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// baseF = {cp:[1,5,2,3,0,4,6,7], co:[1,2,0,0,2,1,0,0], ep:[0,9,2,3,4,8,6,7,1,5,10,11], eo:[0,1,0,0,0,1,0,0,1,1,0,0]}
// Corner UFL=1, DLF=5, ULB=2, UBR=3, URF=0, DFR=4, DBL=6, DRB=7
// Edge UR=0, FL=9, UL=2, UB=3, DR=4, FR=8, DL=6, DB=7, UF=1, DF=5, BL=10, BR=11
const F1_EXPECTED = {
  cp: [1, 5, 2, 3, 0, 4, 6, 7],
  co: [1, 2, 0, 0, 2, 1, 0, 0],
  ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
  eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
};

// baseD = {cp:[0,1,2,3,5,6,7,4], co:[0,0,0,0,0,0,0,0], ep:[0,1,2,3,5,6,7,4,8,9,10,11], eo:all0}
const D1_EXPECTED = {
  cp: [0, 1, 2, 3, 5, 6, 7, 4],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// baseL = {cp:[0,2,6,3,4,1,5,7], co:[0,1,2,0,0,2,1,0], ep:[0,1,11,3,4,5,9,7,8,2,6,10], eo:[0,0,0,0,0,0,0,0,0,0,0,0]}
// Corner URF=0, ULB=2, DBL=6, UBR=3, DFR=4, UFL=1, DLF=5, DRB=7
// Edge UR=0, UF=1, BL=11, UB=3, DR=4, DF=5, FL=9, DB=7, FR=8, UL=2, DL=6, BR=10
const L1_EXPECTED = {
  cp: [0, 2, 6, 3, 4, 1, 5, 7],
  co: [0, 1, 2, 0, 0, 2, 1, 0],
  ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// baseB = {cp:[URF(0),UFL(1),UBR(3),DRB(7),DFR(4),DLF(5),ULB(2),DBL(6)], co:[0,0,1,2,0,0,2,1]}
// ep = [UR(0),UF(1),UL(2),BR(11),DR(4),DF(5),DL(6),BL(10),FR(8),FL(9),UB(3),DB(7)]
const B1_EXPECTED = {
  cp: [0, 1, 3, 7, 4, 5, 2, 6],
  co: [0, 0, 1, 2, 0, 0, 2, 1],
  ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
  eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
};

/** Map from Move enum to expected state values */
const EXPECTED_BASE_MOVES: Record<number, { cp: number[]; co: number[]; ep: number[]; eo: number[] }> = {
  [Move.U1]: U1_EXPECTED,
  [Move.U2]: U2_EXPECTED,
  [Move.U3]: U3_EXPECTED,
  [Move.R1]: R1_EXPECTED,
  [Move.F1]: F1_EXPECTED,
  [Move.D1]: D1_EXPECTED,
  [Move.L1]: L1_EXPECTED,
  [Move.B1]: B1_EXPECTED,
};

/**
 * Compute expected values for half-turns (R2, F2, etc.) and inverse turns (R3, etc.)
 * using the known base turn. These are derived by applying the base turn
 * the correct number of times.
 */
function computeMultiTurn(baseCp: number[], baseCo: number[], baseEp: number[], baseEo: number[], times: number) {
  // Start with solved
  let cp = [0, 1, 2, 3, 4, 5, 6, 7];
  let co = [0, 0, 0, 0, 0, 0, 0, 0];
  let ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (let t = 0; t < times; t++) {
    const nextCp = new Array(8);
    const nextCo = new Array(8);
    const nextEp = new Array(12);
    const nextEo = new Array(12);

    for (let i = 0; i < 8; i++) {
      nextCp[i] = cp[baseCp[i]];
      nextCo[i] = (co[baseCp[i]] + baseCo[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
      nextEp[i] = ep[baseEp[i]];
      nextEo[i] = (eo[baseEp[i]] + baseEo[i]) % 2;
    }

    cp = nextCp;
    co = nextCo;
    ep = nextEp;
    eo = nextEo;
  }

  return { cp, co, ep, eo };
}

// Compute R2, R3, F2, F3, D2, D3, L2, L3, B2, B3
for (const [baseMove, baseExpected] of [
  [Move.R1, R1_EXPECTED] as const,
  [Move.F1, F1_EXPECTED] as const,
  [Move.D1, D1_EXPECTED] as const,
  [Move.L1, L1_EXPECTED] as const,
  [Move.B1, B1_EXPECTED] as const,
]) {
  const baseM = baseMove;
  const baseE = baseExpected;
  EXPECTED_BASE_MOVES[(baseM + 1) as Move] = computeMultiTurn(baseE.cp, baseE.co, baseE.ep, baseE.eo, 2);
  EXPECTED_BASE_MOVES[(baseM + 2) as Move] = computeMultiTurn(baseE.cp, baseE.co, baseE.ep, baseE.eo, 3);
}

describe('CubeState — Move Validation (18 moves)', () => {
  // ── Structural Invariants ──────────────────────────────────────────────

  it('solved cube satisfies all structural invariants', () => {
    const cube = new CubeState();
    expect(cube.isSolved()).toBe(true);
    validateParity(cube);
    validateOrientations(cube);
  });

  it('each of 18 moves preserves parity and orientation invariants', () => {
    for (const move of ALL_MOVES) {
      const cube = new CubeState();
      cube.applyMove(move);
      validateParity(cube);
      validateOrientations(cube);
    }
  });

  // ── 4× Same Move = Identity ────────────────────────────────────────────

  it('4× same clockwise move returns to solved for all 6 faces', () => {
    const clockwiseMoves = [Move.U1, Move.R1, Move.F1, Move.D1, Move.L1, Move.B1];

    for (const move of clockwiseMoves) {
      const cube = new CubeState();
      cube.applyMove(move);
      cube.applyMove(move);
      cube.applyMove(move);
      cube.applyMove(move);
      expect(cube.isSolved()).toBe(true);
    }
  });

  // ── Inverse Property ───────────────────────────────────────────────────

  it('move + inverse move = solved for all 18 moves', () => {
    for (const move of ALL_MOVES) {
      const cube = new CubeState();
      cube.applyMove(move);
      cube.applyMove(inverseMove(move));
      expect(cube.isSolved()).toBe(true);
    }
  });

  // ── 2× Half Turn = Identity ────────────────────────────────────────────

  it('2× half turn (U2, R2, F2, D2, L2, B2) = solved', () => {
    const halfMoves = [Move.U2, Move.R2, Move.F2, Move.D2, Move.L2, Move.B2];

    for (const move of halfMoves) {
      const cube = new CubeState();
      cube.applyMove(move);
      cube.applyMove(move);
      expect(cube.isSolved()).toBe(true);
    }
  });

  // ── Expected Values — Cross-checked with SebLague ──────────────────────

  it('U1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.U1);
    assertStateEquals(cube, U1_EXPECTED);
  });

  it('U2 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.U2);
    assertStateEquals(cube, U2_EXPECTED);
  });

  it("U' (U3) from solved produces exact expected cp/co/ep/eo", () => {
    const cube = new CubeState();
    cube.applyMove(Move.U3);
    assertStateEquals(cube, U3_EXPECTED);
  });

  it('R1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.R1);
    assertStateEquals(cube, R1_EXPECTED);
  });

  it('F1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.F1);
    assertStateEquals(cube, F1_EXPECTED);
  });

  it('D1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.D1);
    assertStateEquals(cube, D1_EXPECTED);
  });

  it('L1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.L1);
    assertStateEquals(cube, L1_EXPECTED);
  });

  it('B1 from solved produces exact expected cp/co/ep/eo', () => {
    const cube = new CubeState();
    cube.applyMove(Move.B1);
    assertStateEquals(cube, B1_EXPECTED);
  });

  // ── All 18 moves match expected values ──────────────────────────────────

  it('each of 18 moves matches pre-computed expected values', () => {
    for (const move of ALL_MOVES) {
      const cube = new CubeState();
      cube.applyMove(move);

      const expected = EXPECTED_BASE_MOVES[move];
      expect(expected).toBeDefined();

      for (let i = 0; i < 8; i++) {
        expect(cube.cp[i]).toBe(expected!.cp[i]);
        expect(cube.co[i]).toBe(expected!.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(cube.ep[i]).toBe(expected!.ep[i]);
        expect(cube.eo[i]).toBe(expected!.eo[i]);
      }
    }
  });

  // ── Consistency: applyMove matches applySequence ────────────────────────

  it('applyMove(U1) === applySequence("U")', () => {
    const viaMove = new CubeState();
    viaMove.applyMove(Move.U1);

    const viaSeq = new CubeState();
    viaSeq.applySequence('U');

    assertStatesEqual(viaMove, viaSeq);
  });

  it("applyMove(R3) === applySequence(\"R'\")", () => {
    const viaMove = new CubeState();
    viaMove.applyMove(Move.R3);

    const viaSeq = new CubeState();
    viaSeq.applySequence("R'");

    assertStatesEqual(viaMove, viaSeq);
  });

  it('applyMove(F2) === applySequence("F2")', () => {
    const viaMove = new CubeState();
    viaMove.applyMove(Move.F2);

    const viaSeq = new CubeState();
    viaSeq.applySequence('F2');

    assertStatesEqual(viaMove, viaSeq);
  });

  // ── Composed moves ──────────────────────────────────────────────────────

  it('U R U\' R\' returns to solved after 6 repetitions (sexy move)', () => {
    const cube = new CubeState();
    const sexyMoves = [Move.U1, Move.R1, Move.U3, Move.R3];

    for (let rep = 0; rep < 6; rep++) {
      for (const m of sexyMoves) cube.applyMove(m);
    }

    expect(cube.isSolved()).toBe(true);
  });

  // ── Cross-check with SebLague: Superflip state ─────────────────────────

  it('Superflip: all edges flipped, all corners solved (SebLague parity)', () => {
    const cube = new CubeState();
    // Verified Superflip sequence
    cube.applySequence("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");

    // All corners in original positions with original orientation
    for (let i = 0; i < 8; i++) {
      expect(cube.cp[i]).toBe(i);
      expect(cube.co[i]).toBe(0);
    }

    // All edges in original positions but FLIPPED
    for (let i = 0; i < 12; i++) {
      expect(cube.ep[i]).toBe(i);
      expect(cube.eo[i]).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

function assertStateEquals(
  actual: CubeState,
  expected: { cp: number[]; co: number[]; ep: number[]; eo: number[] },
) {
  for (let i = 0; i < 8; i++) {
    expect(actual.cp[i]).toBe(expected.cp[i]);
    expect(actual.co[i]).toBe(expected.co[i]);
  }
  for (let i = 0; i < 12; i++) {
    expect(actual.ep[i]).toBe(expected.ep[i]);
    expect(actual.eo[i]).toBe(expected.eo[i]);
  }
}

function assertStatesEqual(a: CubeState, b: CubeState) {
  for (let i = 0; i < 8; i++) {
    expect(a.cp[i]).toBe(b.cp[i]);
    expect(a.co[i]).toBe(b.co[i]);
  }
  for (let i = 0; i < 12; i++) {
    expect(a.ep[i]).toBe(b.ep[i]);
    expect(a.eo[i]).toBe(b.eo[i]);
  }
}
