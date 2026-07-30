/**
 * @cubeforge/math-core — Cube2x2State
 *
 * State representation for the 2×2×2 (Pocket Cube).
 *
 * ## Design
 *
 * The 2×2 has **8 corners only** — no edges, no fixed centers. The state is
 * fully described by:
 *   • Corner permutation (`cp`): which piece is at each of the 8 positions
 *   • Corner orientation (`co`): twist of each piece (0, 1, or 2)
 *
 * Move set (WCA standard for 2×2): **U, R, F** and their inverses/doubles.
 * The other faces (D, L, B) are redundant on a 2×2 because, without fixed
 * centers, they are equivalent to a whole-cube rotation plus a U/R/F move.
 *
 * ## Corner numbering (matches the 3×3 CubeState for consistency)
 *
 *   0: URF  (x=+1, y=+1, z=+1)
 *   1: UFL  (x=-1, y=+1, z=+1)
 *   2: ULB  (x=-1, y=+1, z=-1)
 *   3: UBR  (x=+1, y=+1, z=-1)
 *   4: DFR  (x=+1, y=-1, z=+1)
 *   5: DLF  (x=-1, y=-1, z=+1)
 *   6: DBL  (x=-1, y=-1, z=-1)
 *   7: DRB  (x=+1, y=-1, z=-1)
 *
 * ## State space
 *
 *   8! × 3^7 = 40,320 × 2,187 = 3,674,160 states
 *   God's number: 11 HTM (half-turn metric)
 */

import { CubeState } from './CubeState';

// ── Corner IDs (identical to the 3×3 Corner enum) ───────────────────────

export const CORNER_URF = 0;
export const CORNER_UFL = 1;
export const CORNER_ULB = 2;
export const CORNER_UBR = 3;
export const CORNER_DFR = 4;
export const CORNER_DLF = 5;
export const CORNER_DBL = 6;
export const CORNER_DRB = 7;

// ── 2×2 Move enum ────────────────────────────────────────────────────────
//
// All 6 faces with their powers (18 moves total).
// Layout: [U1,U2,U3, R1,R2,R3, F1,F2,F3, D1,D2,D3, L1,L2,L3, B1,B2,B3]

export enum Move2x2 {
  U1 = 0, U2, U3,
  R1, R2, R3,
  F1, F2, F3,
  D1, D2, D3,
  L1, L2, L3,
  B1, B2, B3,
}

export const NUM_MOVES_2X2 = 18;

/** Notation for each 2×2 move. */
export const MOVE_2X2_NOTATION: string[] = [
  'U', 'U2', "U'",
  'R', 'R2', "R'",
  'F', 'F2', "F'",
  'D', 'D2', "D'",
  'L', 'L2', "L'",
  'B', 'B2', "B'",
];

/** Parse a notation string into a Move2x2 value. */
export const StringToMove2x2: Record<string, Move2x2> = {
  'U': Move2x2.U1, 'U2': Move2x2.U2, "U'": Move2x2.U3, 'U3': Move2x2.U3,
  'R': Move2x2.R1, 'R2': Move2x2.R2, "R'": Move2x2.R3, 'R3': Move2x2.R3,
  'F': Move2x2.F1, 'F2': Move2x2.F2, "F'": Move2x2.F3, 'F3': Move2x2.F3,
  'D': Move2x2.D1, 'D2': Move2x2.D2, "D'": Move2x2.D3, 'D3': Move2x2.D3,
  'L': Move2x2.L1, 'L2': Move2x2.L2, "L'": Move2x2.L3, 'L3': Move2x2.L3,
  'B': Move2x2.B1, 'B2': Move2x2.B2, "B'": Move2x2.B3, 'B3': Move2x2.B3,
};

/** Inverse of each move (U1↔U3, U2↔U2). */
const INVERSE_MOVE_2X2: Move2x2[] = [
  Move2x2.U3, Move2x2.U2, Move2x2.U1,
  Move2x2.R3, Move2x2.R2, Move2x2.R1,
  Move2x2.F3, Move2x2.F2, Move2x2.F1,
  Move2x2.D3, Move2x2.D2, Move2x2.D1,
  Move2x2.L3, Move2x2.L2, Move2x2.L1,
  Move2x2.B3, Move2x2.B2, Move2x2.B1,
];

// ── Base move definitions (Kociemba corner tables, 6 faces) ──────────────
//
// These are EXACTLY the same corner tables from CubeState.ts (baseU/baseR/baseF/baseD/baseL/baseB),
// restricted to corners (cp + co only, no edges).

interface BaseMove {
  cp: number[]; // piece at each position after the move
  co: number[]; // orientation at each position after the move
}

const baseU: BaseMove = {
  // U: corners URF←UBR, UFL←URF, ULB←UFL, UBR←ULB (cycle on U layer)
  cp: [CORNER_UBR, CORNER_URF, CORNER_UFL, CORNER_ULB, CORNER_DFR, CORNER_DLF, CORNER_DBL, CORNER_DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
};

const baseR: BaseMove = {
  // R: corners URF←DFR, DFR←DRB, DRB←UBR, UBR←URF (cycle on R layer)
  cp: [CORNER_DFR, CORNER_UFL, CORNER_ULB, CORNER_URF, CORNER_DRB, CORNER_DLF, CORNER_DBL, CORNER_UBR],
  co: [2, 0, 0, 1, 1, 0, 0, 2],
};

const baseF: BaseMove = {
  // F: corners URF←UFL, UFL←DLF, DLF←DFR, DFR←URF (cycle on F layer)
  cp: [CORNER_UFL, CORNER_DLF, CORNER_ULB, CORNER_UBR, CORNER_URF, CORNER_DFR, CORNER_DBL, CORNER_DRB],
  co: [1, 2, 0, 0, 2, 1, 0, 0],
};

const baseD: BaseMove = {
  // D: corner cycle on D layer (bottom view CW)
  cp: [CORNER_URF, CORNER_UFL, CORNER_ULB, CORNER_UBR, CORNER_DLF, CORNER_DBL, CORNER_DRB, CORNER_DFR],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
};

const baseL: BaseMove = {
  // L: corner cycle on L layer (CW looking at left face)
  cp: [CORNER_URF, CORNER_ULB, CORNER_DBL, CORNER_UBR, CORNER_DFR, CORNER_UFL, CORNER_DLF, CORNER_DRB],
  co: [0, 1, 2, 0, 0, 2, 1, 0],
};

const baseB: BaseMove = {
  // B: corner cycle on B layer (CW looking at back face)
  cp: [CORNER_URF, CORNER_UFL, CORNER_UBR, CORNER_DRB, CORNER_DFR, CORNER_DLF, CORNER_ULB, CORNER_DBL],
  co: [0, 0, 1, 2, 0, 0, 2, 1],
};

// ── Precomputed move tables ──────────────────────────────────────────────
//
// For each of the 18 moves, we precompute:
//   • src[i]  — source position for the corner now at destination i
//   • twist[i] — orientation delta added at destination i
//
// Derived by composing base moves (U2 = U∘U, U' = U∘U∘U, etc.)

export interface Move2x2Table {
  src: Uint8Array;   // length 8
  twist: Int8Array;  // length 8
}

function composeMoves(a: BaseMove, b: BaseMove): BaseMove {
  // Compose two moves: result = apply a first, then b (i.e., b ∘ a).
  //   after a: pos i has piece a.cp[i]
  //   after b: pos i has piece a.cp[b.cp[i]]
  // So (b∘a).cp[i] = a.cp[b.cp[i]]
  // And (b∘a).co[i] = (a.co[b.cp[i]] + b.co[i]) % 3
  const cp = new Array(8);
  const co = new Array(8);
  for (let i = 0; i < 8; i++) {
    cp[i] = a.cp[b.cp[i]];
    co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
  }
  return { cp, co };
}

function baseToTable(move: BaseMove): Move2x2Table {
  // The move table format: src[i] = piece at position i after the move.
  // Since the piece at position i has ID = move.cp[i], and in the solved
  // state the piece at position src has ID = src, we get src[i] = move.cp[i].
  // The twist at position i is move.co[i].
  const src = new Uint8Array(8);
  const twist = new Int8Array(8);
  for (let i = 0; i < 8; i++) {
    src[i] = move.cp[i];
    twist[i] = move.co[i];
  }
  return { src, twist };
}

function buildMoveTables(): Move2x2Table[] {
  const tables: Move2x2Table[] = new Array(NUM_MOVES_2X2);

  // Helper: build 3 powers for a base move
  function buildPowers(base: BaseMove, enumOffset: number): void {
    const move1 = base;
    const move2 = composeMoves(base, base);
    const move3 = composeMoves(move2, base);
    tables[enumOffset + 0] = baseToTable(move1);
    tables[enumOffset + 1] = baseToTable(move2);
    tables[enumOffset + 2] = baseToTable(move3);
  }

  buildPowers(baseU, Move2x2.U1); // U moves
  buildPowers(baseR, Move2x2.R1); // R moves
  buildPowers(baseF, Move2x2.F1); // F moves
  buildPowers(baseD, Move2x2.D1); // D moves
  buildPowers(baseL, Move2x2.L1); // L moves
  buildPowers(baseB, Move2x2.B1); // B moves

  return tables;
}

const MOVE_TABLES_2X2 = buildMoveTables();

// ── Solved state constants ───────────────────────────────────────────────

function buildSolvedCp(): Uint8Array {
  const cp = new Uint8Array(8);
  for (let i = 0; i < 8; i++) cp[i] = i;
  return cp;
}

const SOLVED_CP = buildSolvedCp();
const SOLVED_CO = new Uint8Array(8); // all zeros

// ── Cube2x2State class ───────────────────────────────────────────────────

export class Cube2x2State {
  /** Corner permutation: cp[position] = piece ID at that position. */
  public cp: Uint8Array;
  /** Corner orientation: co[position] = twist (0, 1, or 2). */
  public co: Uint8Array;

  constructor();
  constructor(cp: ArrayLike<number>, co: ArrayLike<number>);
  constructor(cp?: ArrayLike<number>, co?: ArrayLike<number>) {
    this.cp = new Uint8Array(8);
    this.co = new Uint8Array(8);
    if (cp) this.cp.set(cp);
    else this.cp.set(SOLVED_CP);
    if (co) this.co.set(co);
  }

  /** Deep copy. */
  public clone(): Cube2x2State {
    const c = new Cube2x2State();
    c.cp.set(this.cp);
    c.co.set(this.co);
    return c;
  }

  /** True when all corners are in their home position and oriented. */
  public isSolved(): boolean {
    for (let i = 0; i < 8; i++) {
      if (this.cp[i] !== i) return false;
      if (this.co[i] !== 0) return false;
    }
    return true;
  }

  /**
   * Apply a single 2×2 move using the precomputed move table.
   *
   * For each destination position i:
   *   new_cp[i] = old_cp[src[i]]
   *   new_co[i] = (old_co[src[i]] + twist[i]) % 3
   */
  public applyMove(move: Move2x2): void {
    const tbl = MOVE_TABLES_2X2[move];
    const oldCp = this.cp.slice();
    const oldCo = this.co.slice();
    for (let i = 0; i < 8; i++) {
      const s = tbl.src[i];
      this.cp[i] = oldCp[s];
      this.co[i] = (oldCo[s] + tbl.twist[i] + 3) % 3;
    }
  }

  /**
   * Apply a space-separated sequence of 2×2 moves (e.g. "U R' F2").
   * Supports native U, R, F moves and delegates extended moves (D, L, B, x, y, z, etc.)
   * to full 8-corner 3D transformations for universal scramble support.
   */
  public applySequence(notation: string): void {
    const tokens = notation.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;

    let hasExtendedMoves = false;
    for (const token of tokens) {
      if (StringToMove2x2[token] === undefined) {
        hasExtendedMoves = true;
        break;
      }
    }

    if (!hasExtendedMoves) {
      for (const token of tokens) {
        this.applyMove(StringToMove2x2[token]);
      }
    } else {
      const state3x3 = new CubeState(this.cp, this.co, null, null);
      state3x3.applySequence(notation);
      this.cp.set(state3x3.cp);
      this.co.set(state3x3.co);
    }
  }

  /** Reset to the solved state. */
  public reset(): void {
    this.cp.set(SOLVED_CP);
    this.co.set(SOLVED_CO);
  }

  /** Get the move tables (used by the solver for coordinate-space operations). */
  public static getMoveTables(): Readonly<Move2x2Table>[] {
    return MOVE_TABLES_2X2;
  }

  /** Get the inverse of a move. */
  public static inverseMove(move: Move2x2): Move2x2 {
    return INVERSE_MOVE_2X2[move];
  }

  /** Convert a Move2x2 to its notation string. */
  public static moveToNotation(move: Move2x2): string {
    return MOVE_2X2_NOTATION[move];
  }

  /** Invert a space-separated move sequence (used for scramble generation). */
  public static invertNotation(notation: string): string {
    const tokens = notation.trim().split(/\s+/).filter(Boolean);
    const inverted: string[] = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
      const m = StringToMove2x2[tokens[i]];
      if (m === undefined) throw new Error(`Invalid 2×2 move: "${tokens[i]}"`);
      inverted.push(MOVE_2X2_NOTATION[INVERSE_MOVE_2X2[m]]);
    }
    return inverted.join(' ');
  }
}
