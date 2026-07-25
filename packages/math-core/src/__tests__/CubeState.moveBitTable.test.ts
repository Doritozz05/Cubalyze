import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { Move, StringToMove } from '../Constants';

/**
 * PASO 3 Tests — MoveBitTable correctness AND equivalence with multiply() path.
 *
 * The MoveBitTable pre-computes each face move as a triple of Uint8Array slots:
 *   cornersSrc[i], cornersTwist[i], edgesSrc[i], edgesFlip[i]
 *
 * applyMove now uses these directly (without multiply()).
 *
 * The CRITICAL assertion of these tests is the **cross-check** section:
 * for every Move enum value, we apply it via the public applyMove() (bit-table
 * path) AND via an explicit multiply() call on a manually-built base CubeState.
 * If these diverge, the bit-table path is wrong.
 */

type MoveSet = { move: Move; name: string };

const ALL_BASIC_MOVES: MoveSet[] = [
  { move: Move.U1, name: 'U' },
  { move: Move.U2, name: 'U2' },
  { move: Move.U3, name: "U'" },
  { move: Move.R1, name: 'R' },
  { move: Move.R2, name: 'R2' },
  { move: Move.R3, name: "R'" },
  { move: Move.F1, name: 'F' },
  { move: Move.F2, name: 'F2' },
  { move: Move.F3, name: "F'" },
  { move: Move.D1, name: 'D' },
  { move: Move.D2, name: 'D2' },
  { move: Move.D3, name: "D'" },
  { move: Move.L1, name: 'L' },
  { move: Move.L2, name: 'L2' },
  { move: Move.L3, name: "L'" },
  { move: Move.B1, name: 'B' },
  { move: Move.B2, name: 'B2' },
  { move: Move.B3, name: "B'" },
];

const FACE_NAMES: Record<string, string> = {
  [Move.U1]: 'U', [Move.U2]: 'U2', [Move.U3]: "U'",
  [Move.R1]: 'R', [Move.R2]: 'R2', [Move.R3]: "R'",
  [Move.F1]: 'F', [Move.F2]: 'F2', [Move.F3]: "F'",
  [Move.D1]: 'D', [Move.D2]: 'D2', [Move.D3]: "D'",
  [Move.L1]: 'L', [Move.L2]: 'L2', [Move.L3]: "L'",
  [Move.B1]: 'B', [Move.B2]: 'B2', [Move.B3]: "B'",
};

/**
 * Reconstruct the base move CubeState corresponding to a Move enum value,
 * using the same multiply() composition that initTables() does for R2/R'.
 *
 * NOTE: This is INDEPENDENT of moveBitTables — it builds the move CubeState
 * by hand from the kociemba base arrays. Any divergence from applyMove() is
 * a real bug.
 */
function buildBaseMoveState(move: Move): CubeState {
  // Import the base arrays dynamically so we don't tightly couple this
  // test to internal CubeState symbols.
  const baseU = { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const baseR = { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const baseF = { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] };
  const baseD = { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const baseL = { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const baseB = { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] };
  const bases = [baseU, baseR, baseF, baseD, baseL, baseB];

  const face = Math.floor(move / 3);
  const turn = move % 3;

  const moveCube = new CubeState(bases[face].cp, bases[face].co, bases[face].ep, bases[face].eo);
  if (turn === 0) return moveCube;

  // Derive turn 2/3 by multiplying
  const move1 = moveCube.clone();
  moveCube.multiply(move1);
  if (turn === 1) return moveCube; // R²

  // Turn 3: moveCube = move1 × move1 × move1
  moveCube.multiply(move1);
  return moveCube; // R³ = R'
}

function randomScramble(seed: number, length: number): string {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  const moves = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'B', 'B2', "B'"];
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    result.push(moves[next() % moves.length]);
  }
  return result.join(' ');
}

function arraysEqual(lhs: ArrayLike<number>, rhs: ArrayLike<number>): boolean {
  if (lhs.length !== rhs.length) return false;
  for (let i = 0; i < lhs.length; i++) if (lhs[i] !== rhs[i]) return false;
  return true;
}

function expectStatesEqual(actual: CubeState, expected: CubeState) {
  expect(arraysEqual(actual.cp, expected.cp) && arraysEqual(actual.co, expected.co)
      && arraysEqual(actual.ep, expected.ep) && arraysEqual(actual.eo, expected.eo)).toBe(true);
}

// ── Extraction correctness ──────────────────────────────────────────────

describe('PASO 3 — MoveBitTable extraction', () => {
  it('U1 cornersSrc/Twist and edgesSrc/Flip match baseU', () => {
    const tbl = CubeState.__getMoveBitTable(Move.U1);
    expect([...tbl.cornersSrc]).toEqual([3, 0, 1, 2, 4, 5, 6, 7]);
    expect([...tbl.cornersTwist]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...tbl.edgesSrc]).toEqual([3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect([...tbl.edgesFlip]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('R1 cornersSrc matches baseR with correct twists', () => {
    const tbl = CubeState.__getMoveBitTable(Move.R1);
    expect([...tbl.cornersSrc]).toEqual([4, 1, 2, 0, 7, 5, 6, 3]);
    expect([...tbl.cornersTwist]).toEqual([2, 0, 0, 1, 1, 0, 0, 2]);
    expect([...tbl.edgesSrc]).toEqual([8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0]);
    expect([...tbl.edgesFlip]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('F1 has expected edge flips at positions UF/DF/FR/FL', () => {
    const tbl = CubeState.__getMoveBitTable(Move.F1);
    // baseF.eo = [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]
    expect([...tbl.edgesFlip]).toEqual([0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]);
    expect([...tbl.cornersTwist]).toEqual([1, 2, 0, 0, 2, 1, 0, 0]);
  });

  it('L2 and B2 have zero twist/flip (half-turns preserve orientation)', () => {
    for (const m of [Move.U2, Move.R2, Move.F2, Move.D2, Move.L2, Move.B2]) {
      const tbl = CubeState.__getMoveBitTable(m);
      for (let i = 0; i < 8; i++) expect(tbl.cornersTwist[i]).toBe(0);
      for (let i = 0; i < 12; i++) expect(tbl.edgesFlip[i]).toBe(0);
    }
  });
});

// ── Cross-check: bit-table path == multiply() path ─────────────────────

describe('PASO 3 — applyMove bit-table path == multiply() path', () => {
  for (const { move, name } of ALL_BASIC_MOVES) {
    it(`applyMove(${name}) via bit-table == multiply() on built base`, () => {
      // Path A: public applyMove (bit-table)
      const pathA = new CubeState();
      pathA.applyMove(move);

      // Path B: explicit multiply on manually-built base state
      const pathB = new CubeState();
      const baseCube = buildBaseMoveState(move);
      pathB.multiply(baseCube);

      expectStatesEqual(pathA, pathB);
    });
  }

  it('bit-table path == multiply() path on 30 random scramble-move sequences', () => {
    for (let trial = 0; trial < 30; trial++) {
      const seed = trial + 4000;
      const seq = randomScramble(seed, 25);

      // Path A: applyMove via bit-table
      const pathA = new CubeState();
      pathA.applySequence(seq);

      // Path B: applyMove via explicit multiply chain (rebuild each moveCube independently)
      // Must use StringToMove since Move is a numeric enum (Move["U"] is undefined).
      const pathB = new CubeState();
      const tokens = seq.trim().split(/\s+/);
      for (const token of tokens) {
        const mv = StringToMove[token];
        if (mv === undefined) continue;
        const baseCube = buildBaseMoveState(mv);
        pathB.multiply(baseCube);
      }

      expectStatesEqual(pathA, pathB);
    }
  });
});

// ── Group-theoretic invariants ────────────────────────────────────────

describe('PASO 3 — group invariants', () => {
  it('half-turn involution: U1 × U1 == U2', () => {
    for (const set of [
      [Move.U1, Move.U2], [Move.R1, Move.R2], [Move.F1, Move.F2],
      [Move.D1, Move.D2], [Move.L1, Move.L2], [Move.B1, Move.B2],
    ] as Array<[Move, Move]>) {
      const twice = new CubeState();
      twice.applyMove(set[0]);
      twice.applyMove(set[0]);

      const half = new CubeState();
      half.applyMove(set[1]);

      expectStatesEqual(twice, half);
    }
  });

  it('inverse composition: fwd × inv == identity (returns to start)', () => {
    for (const set of [
      [Move.U1, Move.U3], [Move.R1, Move.R3], [Move.F1, Move.F3],
      [Move.D1, Move.D3], [Move.L1, Move.L3], [Move.B1, Move.B3],
    ] as Array<[Move, Move]>) {
      for (let trial = 0; trial < 10; trial++) {
        const seq = randomScramble(trial + 5000, 10);
        const before = new CubeState();
        before.applySequence(seq);

        const after = new CubeState();
        after.applySequence(seq);
        after.applyMove(set[0]);
        after.applyMove(set[1]);

        // fwd × inv returns us to scramble, NOT to identity
        expectStatesEqual(after, before);
      }
    }
  });

  it('four-times composition: U × U × U × U == identity (from solved)', () => {
    for (const m of [Move.U1, Move.R1, Move.F1, Move.D1, Move.L1, Move.B1]) {
      const cube = new CubeState();
      cube.applyMove(m);
      cube.applyMove(m);
      cube.applyMove(m);
      cube.applyMove(m);
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('commutative composition: U × R != R × U (sanity check)', () => {
    const cubeUR = new CubeState();
    cubeUR.applyMove(Move.U1);
    cubeUR.applyMove(Move.R1);

    const cubeRU = new CubeState();
    cubeRU.applyMove(Move.R1);
    cubeRU.applyMove(Move.U1);

    // They should NOT be equal (cube moves don't commute in general)
    expect(arraysEqual(cubeUR.cp, cubeRU.cp)).toBe(false);
  });
});

// ── Stress test ──────────────────────────────────────────────────────

describe('PASO 3 — stress tests', () => {
  it('10000 alternating moves preserve valid state', () => {
    const cube = new CubeState();
    const moves = [
      Move.U1, Move.U2, Move.U3, Move.R1, Move.R2, Move.R3,
      Move.F1, Move.F2, Move.F3, Move.D1, Move.D2, Move.D3,
      Move.L1, Move.L2, Move.L3, Move.B1, Move.B2, Move.B3,
    ];
    for (let i = 0; i < 10000; i++) {
      cube.applyMove(moves[i % 18]);
    }

    // Invariants: unique cp[0..7], unique ep[0..11], parity, orient sums
    const cpSet = new Set<number>();
    for (let i = 0; i < 8; i++) cpSet.add(cube.cp[i]);
    expect(cpSet.size).toBe(8);

    const epSet = new Set<number>();
    for (let i = 0; i < 12; i++) epSet.add(cube.ep[i]);
    expect(epSet.size).toBe(12);

    let cpInv = 0;
    for (let j = 0; j < 7; j++)
      for (let k = j + 1; k < 8; k++)
        if (cube.cp[j] > cube.cp[k]) cpInv++;
    let epInv = 0;
    for (let j = 0; j < 11; j++)
      for (let k = j + 1; k < 12; k++)
        if (cube.ep[j] > cube.ep[k]) epInv++;
    expect(cpInv % 2).toBe(epInv % 2);

    let coSum = 0;
    for (let i = 0; i < 8; i++) coSum += cube.co[i];
    expect(coSum % 3).toBe(0);

    let eoSum = 0;
    for (let i = 0; i < 12; i++) eoSum += cube.eo[i];
    expect(eoSum % 2).toBe(0);
  });

  it('100 random scrambles × their inverse returns to solved', () => {
    // Starting from SOLVED, applying scramble then inverse must return to solved.
    for (let trial = 0; trial < 100; trial++) {
      const seq = randomScramble(trial + 6000, 20);

      const restored = new CubeState();
      restored.applySequence(seq);

      // Compute inverse: reverse token order and flip each move.
      // ' → drop '; X2 stays X2; X → X'
      const tokens = seq.trim().split(/\s+/);
      const reversed = [...tokens].reverse().map(t => {
        if (t.endsWith("'")) return t.slice(0, -1);
        if (t.endsWith('2')) return t;
        return t + "'";
      }).join(' ');

      restored.applySequence(reversed);
      expect(restored.isSolved()).toBe(true);
    }
  });
});

// ── Suppress unused warning ────────────────────────────────────────
void FACE_NAMES;
