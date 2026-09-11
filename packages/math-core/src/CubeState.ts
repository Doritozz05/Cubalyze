import { Corner, Edge, Move, StringToMove } from './Constants';
import { expandWideMoves } from './MoveExpander';
import {
  createCornerPermAdapter,
  createCornerOrientAdapter,
  createEdgePermAdapter,
  createEdgeOrientAdapter,
  type CubeStateInternal,
  type CubeAdapter,
} from './adapters/CubeStateAdapters';

// Base moves defined manually (Kociemba standard) — kept as arrays for initTables()
const baseU = {
  cp: [Corner.UBR, Corner.URF, Corner.UFL, Corner.ULB, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UB, Edge.UR, Edge.UF, Edge.UL, Edge.DR, Edge.DF, Edge.DL, Edge.DB, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseR = {
  cp: [Corner.DFR, Corner.UFL, Corner.ULB, Corner.URF, Corner.DRB, Corner.DLF, Corner.DBL, Corner.UBR],
  co: [2, 0, 0, 1, 1, 0, 0, 2],
  ep: [Edge.FR, Edge.UF, Edge.UL, Edge.UB, Edge.BR, Edge.DF, Edge.DL, Edge.DB, Edge.DR, Edge.FL, Edge.BL, Edge.UR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseF = {
  cp: [Corner.UFL, Corner.DLF, Corner.ULB, Corner.UBR, Corner.URF, Corner.DFR, Corner.DBL, Corner.DRB],
  co: [1, 2, 0, 0, 2, 1, 0, 0],
  ep: [Edge.UR, Edge.FL, Edge.UL, Edge.UB, Edge.DR, Edge.FR, Edge.DL, Edge.DB, Edge.UF, Edge.DF, Edge.BL, Edge.BR],
  eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]
};
const baseD = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DLF, Corner.DBL, Corner.DRB, Corner.DFR],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UR, Edge.UF, Edge.UL, Edge.UB, Edge.DF, Edge.DL, Edge.DB, Edge.DR, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseL = {
  cp: [Corner.URF, Corner.ULB, Corner.DBL, Corner.UBR, Corner.DFR, Corner.UFL, Corner.DLF, Corner.DRB],
  co: [0, 1, 2, 0, 0, 2, 1, 0],
  ep: [Edge.UR, Edge.UF, Edge.BL, Edge.UB, Edge.DR, Edge.DF, Edge.FL, Edge.DB, Edge.FR, Edge.UL, Edge.DL, Edge.BR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseB = {
  cp: [Corner.URF, Corner.UFL, Corner.UBR, Corner.DRB, Corner.DFR, Corner.DLF, Corner.ULB, Corner.DBL],
  co: [0, 0, 1, 2, 0, 0, 2, 1],
  ep: [Edge.UR, Edge.UF, Edge.UL, Edge.BR, Edge.DR, Edge.DF, Edge.DL, Edge.BL, Edge.FR, Edge.FL, Edge.UB, Edge.DB],
  eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]
};

// ── Slice move base definitions ────────────────────────────────────────────
//
// M = middle slice (x=0), turned like L (CW from -X).
//   Cycles edges: UF→DF→DB→UB→UF. No corners affected.
//   Flips the 4 cycled edges (UF, UB, DF, DB): each piece's U/D color rotates
//   onto the F/B face, which under Kociemba's eo convention is a flip.
// E = equatorial slice (y=0), turned like D (CW from -Y).
//   Cycles edges: FR→BR→BL→FL→FR. No corners affected.
//   Flips the 4 cycled edges (FR, FL, BL, BR): each piece's F/B color rotates
//   onto the U/D face, which under Kociemba's eo convention is a flip.
// S = standing slice (z=0), turned like F (CW from +Z).
//   Cycles edges: UR→DR→DL→UL→UR. No corners affected. Flips all 4 edges.
//
// Verified empirically against the existing L/D/F base move conventions:
//   L cycles UL→FL→DL→BL, M cycles UF→DF→DB→UB (same rotation direction)
//   D cycles DR→DB→DL→DF, E cycles FR→BR→BL→FL (same rotation direction)
//   F cycles UF→FR→DF→FL (flips all), S cycles UR→DR→DL→UL (flips all)
//
// NOTE (2026-07): M and E previously had `eo = [0,…,0]` which silently dropped
// the orientation flip, corrupting visualisations for any algorithm containing
// r/l/u/d wide moves (e.g. all 57 OLL cases). Fixed by adding flip masks at the
// 4 destinations they affect. baseS already had this convention. Empirically
// validated against SpeedCubeDB jcube data via `oll-speedcubedb-comparison.test.ts`.

const baseM = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UR, Edge.UB, Edge.UL, Edge.DB, Edge.DR, Edge.UF, Edge.DL, Edge.DF, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  // M slice FLIPS the 4 cycled edges (UF, UB, DF, DB): each edge's U/D color
  // rotates onto the F/B face, which under Kociemba's eo convention is a flip.
  eo: [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0]
};
const baseE = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UR, Edge.UF, Edge.UL, Edge.UB, Edge.DR, Edge.DF, Edge.DL, Edge.DB, Edge.FL, Edge.BL, Edge.BR, Edge.FR],
  // E slice FLIPS the 4 cycled edges (FR, FL, BL, BR): each edge's F/B color
  // rotates onto the U/D face, which under Kociemba's eo convention is a flip.
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
};
const baseS = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UL, Edge.UF, Edge.DL, Edge.UB, Edge.UR, Edge.DF, Edge.DR, Edge.DB, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  eo: [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0]
};

// ── Pure-rotation helpers (solid-face re-derivation) ───────────────────────
// A whole-cube rotation of the solved cube must leave every face
// monochromatic. The face colors of each cubie (Kociemba order) are used to
// re-derive co/eo from a known-correct piece permutation. These tables mirror
// FaceletStringConverter.cornerColor/edgeColor (kept here to avoid an import
// cycle).

const ROT_FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

const ROT_CORNER_COLORS: string[][] = [
  ['U', 'R', 'F'], // URF
  ['U', 'F', 'L'], // UFL
  ['U', 'L', 'B'], // ULB
  ['U', 'B', 'R'], // UBR
  ['D', 'F', 'R'], // DFR
  ['D', 'L', 'F'], // DLF
  ['D', 'B', 'L'], // DBL
  ['D', 'R', 'B'], // DRB
];

const ROT_EDGE_COLORS: string[][] = [
  ['U', 'R'], // UR
  ['U', 'F'], // UF
  ['U', 'L'], // UL
  ['U', 'B'], // UB
  ['D', 'R'], // DR
  ['D', 'F'], // DF
  ['D', 'L'], // DL
  ['D', 'B'], // DB
  ['F', 'R'], // FR
  ['F', 'L'], // FL
  ['B', 'L'], // BL
  ['B', 'R'], // BR
];

// ── Bit-level constants ────────────────────────────────────────────────────

const BITS = 5n;
const FULL = 0b11111n;
const CORNER_PIECE_MASK = 0b111n;
const CORNER_ORIENT_MASK = 0b11n;
const CORNER_ORIENT_SHIFT = 3n;
const EDGE_PIECE_MASK = 0b1111n;
const EDGE_ORIENT_MASK = 0b1n;
const EDGE_ORIENT_SHIFT = 4n;

/** Build solved edges bigint: OEEEE packed × 12 (orient in bit 4, piece in bits 0–3) */
function buildSolvedEdges(): bigint {
  let r = 0n;
  for (let i = 0; i < 12; i++) {
    r |= BigInt(i) << (BigInt(i) * BITS);
  }
  return r;
}

/** Build solved corners bigint: OOCCC packed × 8 (orient in bits 3–4, piece in bits 0–2) */
function buildSolvedCorners(): bigint {
  let r = 0n;
  for (let i = 0; i < 8; i++) {
    r |= BigInt(i) << (BigInt(i) * BITS);
  }
  return r;
}

const SOLVED_EDGES = buildSolvedEdges();
const SOLVED_CORNERS = buildSolvedCorners();

// ── MoveBitTable: pre-computed per-move bit tables (PASO 3) ────────────────

/**
 * Pre-computed bit-level representation of a single face move.
 *
 * Each move (U, U', U2, R, R', R2, ...) is pre-decomposed into:
 *   • cornersSrc[i]   – source position for the corner now at destination i
 *   • cornersTwist[i] – orientation delta added to that corner at position i (mod 3)
 *   • edgesSrc[i]     – source position for the edge now at destination i
 *   • edgesFlip[i]    – orientation delta (XOR) added to that edge at position i
 *
 * Why this is faster than the previous `applyMove → multiply(moveTable[move])`:
 *   1. MoveBitTable slots are typed Uint8Array/Int8Array — cache-friendly, no Proxy.
 *   2. applyMove no longer delegates to multiply(), avoiding one extra
 *      `resultEntry & CORNER_PIECE_MASK` lookup per position.
 *   3. The move tables are computed once at module load, never per call.
 *   4. Hot path operates ONLY on `this._edges` and `this._corners` bigints.
 */
export interface MoveBitTable {
  cornersSrc: Uint8Array;     // length 8
  cornersTwist: Int8Array;    // length 8, values in [-2..2] — normalized to [0..2] at apply time
  edgesSrc: Uint8Array;       // length 12
  edgesFlip: Int8Array;       // length 12, values in [-1..1] — XOR'd directly
}

/**
 * Extract a MoveBitTable from a pre-computed cube state.
 *
 * The passed move state was generated by applying a face turn to the SOLVED state,
 * so:
 *   • move.cp[i] is the piece ID now at position i.
 *   • In the solved state, the piece at position src had ID = src.
 *   • Therefore: src for destination i = move.cp[i] (a direct identity mapping).
 *
 * Similarly: move.co[i] is the orientation delta applied at destination position i.
 */
function extractBitTable(move: CubeState): MoveBitTable {
  const cornersSrc = new Uint8Array(8);
  const cornersTwist = new Int8Array(8);
  const edgesSrc = new Uint8Array(12);
  const edgesFlip = new Int8Array(12);

  for (let i = 0; i < 8; i++) {
    cornersSrc[i] = move.cp[i];
    cornersTwist[i] = move.co[i];
  }
  for (let i = 0; i < 12; i++) {
    edgesSrc[i] = move.ep[i];
    edgesFlip[i] = move.eo[i];
  }

  return { cornersSrc, cornersTwist, edgesSrc, edgesFlip };
}

// ── CubeState ─────────────────────────────────────────────────────────────

export class CubeState implements CubeStateInternal {
  /** Internal binary state — PUBLIC so adapters can access. Do NOT mutate directly. */
  public _edges: bigint;
  public _corners: bigint;

  /** Public array-like adapters (backward-compatible with Int8Array access) */
  public readonly cp: CubeAdapter;
  public readonly co: CubeAdapter;
  public readonly ep: CubeAdapter;
  public readonly eo: CubeAdapter;

  // Static pre-computed bit tables for all 18 moves (PASO 3)
  private static moveBitTables: MoveBitTable[] = [];
  private static isInitialized = false;
  /** The 24 whole-cube rotation states (rotation group), lazily built once. */
  private static rotationGroup: CubeState[] | null = null;

  constructor();
  constructor(
    cp?: ArrayLike<number> | null,
    co?: ArrayLike<number> | null,
    ep?: ArrayLike<number> | null,
    eo?: ArrayLike<number> | null,
  );
  constructor(
    cp?: ArrayLike<number> | null,
    co?: ArrayLike<number> | null,
    ep?: ArrayLike<number> | null,
    eo?: ArrayLike<number> | null,
  ) {
    // Initialize to solved
    this._edges = SOLVED_EDGES;
    this._corners = SOLVED_CORNERS;

    // Create adapter proxies (cached — single Proxy per field per instance)
    this.cp = createCornerPermAdapter(this);
    this.co = createCornerOrientAdapter(this);
    this.ep = createEdgePermAdapter(this);
    this.eo = createEdgeOrientAdapter(this);

    // Apply constructor args if provided
    if (cp) this.cp.set(cp);
    if (co) this.co.set(co);
    if (ep) this.ep.set(ep);
    if (eo) this.eo.set(eo);
  }

  public clone(): CubeState {
    const c = new CubeState();
    c._edges = this._edges;
    c._corners = this._corners;
    return c;
  }

  /**
   * Safe serialization hook for `JSON.stringify`.
   *
   * Why this exists: internally we store `_edges` and `_corners` as `bigint`
   * for performance. Calling `JSON.stringify(cube)` on a struct that contains
   * public bigint properties will throw `TypeError: Do not know how to
   * serialize a BigInt`. By providing `toJSON()`, the standard ECMAScript
   * serialization algorithm uses its return value — never touching the
   * bigints directly.
   *
   * The returned shape mirrors the pre-refactor `Int8Array` snapshot:
   * users who persisted cube states under the old shape keep working.
   */
  public toJSON(): {
    cp: number[];
    co: number[];
    ep: number[];
    eo: number[];
    isSolved: boolean;
  } {
    return {
      cp: Array.from(this.cp),
      co: Array.from(this.co),
      ep: Array.from(this.ep),
      eo: Array.from(this.eo),
      isSolved: this.isSolved(),
    };
  }

  public isSolved(): boolean {
    return this._edges === SOLVED_EDGES && this._corners === SOLVED_CORNERS;
  }

  /**
   * True when all 8 corners are home and oriented, ignoring edges entirely.
   * Used by the "3×3 as 2×2" smart-cube mode: the user solves 2×2 scrambles
   * with a 3×3 cube, so the timer must stop when corners are done even though
   * edges stay scrambled.
   */
  public isCornersSolved(): boolean {
    for (let i = 0; i < 8; i++) {
      if (this.cp[i] !== i) return false;
      if (this.co[i] !== 0) return false;
    }
    return true;
  }

  /**
   * True when the cube is solved up to a whole-cube rotation — i.e. every
   * face is monochromatic (each face shows a single color), which is
   * equivalent to "a rotation of the solved cube".
   *
   * Text reconstructions (recon.nz / CubeRoot) routinely finish in a
   * rotated frame — the solver's inspection rotation vs the stored scramble
   * frame can differ by one whole-cube rotation even when the solve is
   * perfect — so a verdict that requires the exact canonical orientation
   * reports false negatives. This check accepts any rotated solved cube.
   *
   * Implementation: a state is a pure rotation of solved iff its piece
   * permutation (cp/ep) admits a valid face map (rotationFaceMap throws
   * otherwise) AND its stored orientations (co/eo) match the canonical
   * orientations of that rotation (pureRotationState). A twisted corner or
   * flipped edge in place therefore fails the check.
   *
   * NOTE: rotationFaceMap constrains only sticker COLORS, so a mirror
   * (reflection) of the solved cube would also satisfy it in principle — but
   * such a state is unreachable by legal moves, and the orientation compare
   * plus the permutation legality of real states make this a non-issue in
   * practice.
   */
  public isSolvedUpToRotation(): boolean {
    if (this.isSolved()) return true;
    try {
      const canonical = CubeState.pureRotationState(this.cp, this.ep);
      for (let i = 0; i < 8; i++) {
        if (canonical.co[i] !== this.co[i]) return false;
      }
      for (let i = 0; i < 12; i++) {
        if (canonical.eo[i] !== this.eo[i]) return false;
      }
      return true;
    } catch {
      return false; // not even a valid whole-cube rotation permutation
    }
  }

  /**
   * Multiply this state with another state 'b' → this = this * b
   *
   * Operates DIRECTLY on internal bigints. NEVER touches the Proxy adapters.
   * Used by initTables() to derive R2/R' (multiplied from R) and exposed
   * publicly for users who want to compose arbitrary states.
   *
   * applyMove() no longer calls this — it uses the pre-computed MoveBitTable
   * instead. The two paths are mathematically equivalent (same permutation
   * composition formula); MoveBitTable is just optimized for known moves.
   */
  public multiply(b: CubeState): void {
    let newEdges = 0n;
    let newCorners = 0n;

    // ── Corners ──────────────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const bShift = BigInt(i) * BITS;
      const bEntry = (b._corners >> bShift) & FULL;
      const bPieceId = Number(bEntry & CORNER_PIECE_MASK);
      const bOrient = Number((bEntry >> CORNER_ORIENT_SHIFT) & CORNER_ORIENT_MASK);

      const thisShift = BigInt(bPieceId) * BITS;
      const thisEntry = (this._corners >> thisShift) & FULL;
      const thisNewPieceId = Number(thisEntry & CORNER_PIECE_MASK);
      const thisOrient = Number((thisEntry >> CORNER_ORIENT_SHIFT) & CORNER_ORIENT_MASK);

      const newOrient = (thisOrient + bOrient) % 3;
      const newEntry = (BigInt(newOrient) << CORNER_ORIENT_SHIFT) | BigInt(thisNewPieceId);
      newCorners |= newEntry << (BigInt(i) * BITS);
    }

    // ── Edges ────────────────────────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const bShift = BigInt(i) * BITS;
      const bEntry = (b._edges >> bShift) & FULL;
      const bPieceId = Number(bEntry & EDGE_PIECE_MASK);
      const bOrient = Number((bEntry >> EDGE_ORIENT_SHIFT) & EDGE_ORIENT_MASK);

      const thisShift = BigInt(bPieceId) * BITS;
      const thisEntry = (this._edges >> thisShift) & FULL;
      const thisNewPieceId = Number(thisEntry & EDGE_PIECE_MASK);
      const thisOrient = Number((thisEntry >> EDGE_ORIENT_SHIFT) & EDGE_ORIENT_MASK);

      const newOrient = thisOrient ^ bOrient;
      const newEntry = (BigInt(newOrient) << EDGE_ORIENT_SHIFT) | BigInt(thisNewPieceId);
      newEdges |= newEntry << (BigInt(i) * BITS);
    }

    this._edges = newEdges;
    this._corners = newCorners;
  }

  /**
   * Apply a single face move using the pre-computed MoveBitTable.
   * Hot path — pure bit operations on internal bigints.
   */
  public applyMove(move: Move): void {
    CubeState.initTables();
    const tbl = CubeState.moveBitTables[move];
    this._applyBitTable(tbl);
  }

  public applySequence(moves: string): void {
    const tokens = expandWideMoves(moves);
    for (const token of tokens) {
      if (!token) continue;
      const m = StringToMove[token];
      if (m !== undefined) {
        this.applyMove(m);
      } else {
        throw new Error(`Invalid move: ${token}`);
      }
    }
  }

  /**
   * Apply a MoveBitTable directly.
   *
   * For each destination position i:
   *   • Read the source entry from `this._corners` (or `this._edges`).
   *   • Extract the piece ID and current orientation.
   *   • Add the pre-computed twist/flip.
   *   • Write the new entry at position i.
   *
   * NOTE: This MUST produce results bit-identical to multiply(prev moveTable[move]
   * form) — the test suite verifies this equivalence.
   */
  private _applyBitTable(tbl: MoveBitTable): void {
    // ── Corners ──────────────────────────────────────────────────────
    const oldCorners = this._corners;
    let newCorners = 0n;
    for (let i = 0; i < 8; i++) {
      const srcShift = BigInt(tbl.cornersSrc[i]) * BITS;
      const entry = (oldCorners >> srcShift) & FULL;
      const piece = Number(entry & CORNER_PIECE_MASK);
      const oldOrient = Number((entry >> CORNER_ORIENT_SHIFT) & CORNER_ORIENT_MASK);

      // Normalize twist into [0..2] regardless of sign
      const rawTwist = tbl.cornersTwist[i];
      const safeTwist = ((rawTwist % 3) + 3) % 3;
      const newOrient = (oldOrient + safeTwist) % 3;
      const newEntry = (BigInt(newOrient) << CORNER_ORIENT_SHIFT) | BigInt(piece);
      newCorners |= newEntry << (BigInt(i) * BITS);
    }

    // ── Edges ────────────────────────────────────────────────────────
    const oldEdges = this._edges;
    let newEdges = 0n;
    for (let i = 0; i < 12; i++) {
      const srcShift = BigInt(tbl.edgesSrc[i]) * BITS;
      const entry = (oldEdges >> srcShift) & FULL;
      const piece = Number(entry & EDGE_PIECE_MASK);
      const oldOrient = Number((entry >> EDGE_ORIENT_SHIFT) & EDGE_ORIENT_MASK);
      const newOrient = (oldOrient ^ tbl.edgesFlip[i]) & 1;
      const newEntry = (BigInt(newOrient) << EDGE_ORIENT_SHIFT) | BigInt(piece);
      newEdges |= newEntry << (BigInt(i) * BITS);
    }

    this._corners = newCorners;
    this._edges = newEdges;
  }

  /**
   * Build all 18 face moves (U, U', U2, R, R', R2, ...) and cache their
   * MoveBitTable representations.
   *
   * Construction order:
   *   1. Build the 6 base CubeStates from the Kociemba cp/co/ep/eo arrays.
   *   2. For each base face, derive turn 2 and turn 3 by multiplying.
   *   3. Extract MoveBitTable from each of the 18 derived CubeStates.
   */
  public static initTables(): void {
    if (CubeState.isInitialized) return;

    // ── Build base states for all 9 elementary moves (6 faces + 3 slices) ──
    const U = new CubeState(baseU.cp, baseU.co, baseU.ep, baseU.eo);
    const R = new CubeState(baseR.cp, baseR.co, baseR.ep, baseR.eo);
    const F = new CubeState(baseF.cp, baseF.co, baseF.ep, baseF.eo);
    const D = new CubeState(baseD.cp, baseD.co, baseD.ep, baseD.eo);
    const L = new CubeState(baseL.cp, baseL.co, baseL.ep, baseL.eo);
    const B = new CubeState(baseB.cp, baseB.co, baseB.ep, baseB.eo);
    const M = new CubeState(baseM.cp, baseM.co, baseM.ep, baseM.eo);
    const E = new CubeState(baseE.cp, baseE.co, baseE.ep, baseE.eo);
    const S = new CubeState(baseS.cp, baseS.co, baseS.ep, baseS.eo);

    const elementaryBases = [U, R, F, D, L, B, M, E, S];

    // ── Build turns 1, 2, 3 for each elementary move ──────────────────────
    // Enum layout: [U1-3][R1-3][F1-3][D1-3][L1-3][B1-3][M1-3][E1-3][S1-3]
    // = 9 groups × 3 turns = 27 MoveBitTables (indices 0–26)
    const inverses: CubeState[] = []; // turn-3 states, reused for rotation composites
    for (let i = 0; i < 9; i++) {
      const move1 = elementaryBases[i].clone();
      const move2 = move1.clone();
      move2.multiply(move1);
      const move3 = move2.clone();
      move3.multiply(move1);

      CubeState.moveBitTables[i * 3 + 0] = extractBitTable(move1);
      CubeState.moveBitTables[i * 3 + 1] = extractBitTable(move2);
      CubeState.moveBitTables[i * 3 + 2] = extractBitTable(move3);
      inverses.push(move3);
    }
    // inverses indices: [0]=U' [1]=R' [2]=F' [3]=D' [4]=L' [5]=B' [6]=M' [7]=E' [8]=S'

    // ── Build whole-cube rotations as PURE rotations ─────────────────────
    // The piece permutation of each composite (x = R·L'·M', y = U·D'·E',
    // z = F·B'·S') is correct, but the composition inherits the slice
    // moves' edge-flips/twists, so the naive composite is NOT a pure
    // rotation: applying it to a solved cube scrambles the faces instead
    // of reorienting them. (Verified empirically: <x,y,z> generated 192
    // states instead of the 24 of the rotation group, z ∉ <x,y>, and only
    // 1 of the 24 generated states kept every face monochromatic.)
    //
    // Fix: keep the permutation (cp/ep) and re-derive the orientation
    // (co/eo) from the "solid faces" constraint — a rotation of the solved
    // cube must leave every face monochromatic.
    //
    // Enum layout: [X1-3][Y1-3][Z1-3] = indices 27–35
    const ROT_BASE = 27;

    // x = R * L' * M'  (permutation is correct; orientations re-derived)
    const xPerm = R.clone();
    xPerm.multiply(inverses[4]); // R * L'
    xPerm.multiply(inverses[6]); // R * L' * M'
    const x1 = CubeState.pureRotationState(xPerm.cp, xPerm.ep);
    const x2 = x1.clone(); x2.multiply(x1.clone());
    const x3 = x2.clone(); x3.multiply(x1.clone());

    // y = U * D' * E'
    const yPerm = U.clone();
    yPerm.multiply(inverses[3]); // U * D'
    yPerm.multiply(inverses[7]); // U * D' * E'
    const y1 = CubeState.pureRotationState(yPerm.cp, yPerm.ep);
    const y2 = y1.clone(); y2.multiply(y1.clone());
    const y3 = y2.clone(); y3.multiply(y1.clone());

    // z = F * B' * S  — the middle ring of a CW-from-+Z rotation cycles
    // UR→DR→DL→UL→UR, which is the S direction, NOT S' (the old composite
    // reversed the ring and produced an inconsistent permutation: no valid
    // face map existed for z, while x and y solved cleanly).
    const zPerm = F.clone();
    zPerm.multiply(inverses[5]); // F * B'
    zPerm.multiply(elementaryBases[8]); // F * B' * S
    const z1 = CubeState.pureRotationState(zPerm.cp, zPerm.ep);
    const z2 = z1.clone(); z2.multiply(z1.clone());
    const z3 = z2.clone(); z3.multiply(z1.clone());

    CubeState.moveBitTables[ROT_BASE + 0] = extractBitTable(x1);
    CubeState.moveBitTables[ROT_BASE + 1] = extractBitTable(x2);
    CubeState.moveBitTables[ROT_BASE + 2] = extractBitTable(x3);
    CubeState.moveBitTables[ROT_BASE + 3] = extractBitTable(y1);
    CubeState.moveBitTables[ROT_BASE + 4] = extractBitTable(y2);
    CubeState.moveBitTables[ROT_BASE + 5] = extractBitTable(y3);
    CubeState.moveBitTables[ROT_BASE + 6] = extractBitTable(z1);
    CubeState.moveBitTables[ROT_BASE + 7] = extractBitTable(z2);
    CubeState.moveBitTables[ROT_BASE + 8] = extractBitTable(z3);

    CubeState.isInitialized = true;
  }

  /**
   * The 24 whole-cube rotation states (the rotation group of the cube).
   *
   * Built lazily ONCE from the 9 pure-rotation move tables (indices 27–35:
   * x/x'/x2, y/y'/y2, z/z'/z2) by closing the group under composition. Each
   * entry is a CubeState equal to "the solved cube rotated by g" — an
   * element of the octahedral rotation group (|O| = 24).
   *
   * These states let us both TEST whether an arbitrary state is a rotation
   * of solved and ROTATE any state into (or out of) the canonical frame.
   */
  private static rotationGroupStates(): CubeState[] {
    if (CubeState.rotationGroup) return CubeState.rotationGroup;
    CubeState.initTables();
    const bases: CubeState[] = [];
    for (let i = 27; i < 36; i++) {
      const tbl = CubeState.moveBitTables[i];
      bases.push(
        new CubeState(
          Array.from(tbl.cornersSrc),
          Array.from(tbl.cornersTwist),
          Array.from(tbl.edgesSrc),
          Array.from(tbl.edgesFlip),
        ),
      );
    }
    const key = (c: CubeState) =>
      `${Array.from(c.cp).join(',')}|${Array.from(c.ep).join(',')}`;
    const solved = new CubeState();
    const seen = new Set<string>([key(solved)]);
    const group: CubeState[] = [solved];
    const queue: CubeState[] = [solved];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const base of bases) {
        const next = cur.clone();
        next.multiply(base);
        const k = key(next);
        if (!seen.has(k)) {
          seen.add(k);
          group.push(next);
          queue.push(next);
        }
      }
    }
    CubeState.rotationGroup = group;
    return group;
  }

  /**
   * Find the whole-cube rotation (a rotation-group state) that, applied to
   * this state, yields the CANONICAL solved cube.
   *
   * Returns null when this state is NOT solved up to a rotation (i.e. some
   * face is not monochromatic). Used by the analysis pipeline to recover
   * the solver's frame when a reconstruction ends "solved but rotated".
   */
  public findRecoveryRotation(): CubeState | null {
    for (const rot of CubeState.rotationGroupStates()) {
      const candidate = this.clone();
      candidate.multiply(rot);
      if (candidate.isSolved()) return rot;
    }
    return null;
  }

  /**
   * Test-only accessor for the pre-computed MoveBitTables.
   * Returns a DEEP COPY so that callers (including tests under direct mutation)
   * cannot accidentally corrupt the shared static cache. If you need the
   * live singleton for benchmarking, see `__getMoveBitTableLive` below.
   *
   * Initializes tables on demand.
   */
  public static __getMoveBitTable(move: Move): MoveBitTable {
    CubeState.initTables();
    const src = CubeState.moveBitTables[move];
    // Defensive deep-copy: external mutation of the singleton would
    // permanently corrupt every applyMove() call in the process.
    return {
      cornersSrc: new Uint8Array(src.cornersSrc),
      cornersTwist: new Int8Array(src.cornersTwist),
      edgesSrc: new Uint8Array(src.edgesSrc),
      edgesFlip: new Int8Array(src.edgesFlip),
    };
  }

  /**
   * INTERNAL USE ONLY — direct reference to the live move table. Mutating
   * entries will corrupt every `applyMove()` call in the process. Only
   * exported so the production code path can borrow frozen shared tables
   * without round-tripping through a defensive copy.
   *
   * Production code MUST NOT call this. Use `__getMoveBitTable` instead.
   */
  public static __getMoveBitTableLive(move: Move): Readonly<MoveBitTable> {
    CubeState.initTables();
    return CubeState.moveBitTables[move];
  }

  /**
   * Build the CubeState of a whole-cube rotation from its piece permutation.
   *
   * The permutation (cp/ep) is assumed correct (it comes from the
   * R·L'·M' / U·D'·E' / F·B'·S' composites, which permute the pieces like a
   * rotation). The orientation flags (co/eo) are re-derived from the
   * "solid faces" constraint: a rotation of the solved cube leaves every
   * face monochromatic, which fixes each cubie's twist in the Kociemba frame.
   */
  private static pureRotationState(
    cp: ArrayLike<number>,
    ep: ArrayLike<number>,
  ): CubeState {
    const g = CubeState.rotationFaceMap(cp, ep);
    const inv: Record<string, string> = {};
    for (const key of Object.keys(g)) inv[g[key]] = key;

    const ncp = new Int8Array(8);
    const nco = new Int8Array(8);
    const nep = new Int8Array(12);
    const neo = new Int8Array(12);

    for (let p = 0; p < 8; p++) {
      const piece = cp[p];
      ncp[p] = piece;
      let found = -1;
      for (let o = 0; o < 3; o++) {
        let ok = true;
        for (let j = 0; j < 3; j++) {
          // Slot j of position p sits on face ROT_CORNER_COLORS[p][j]; after
          // the rotation it shows the color of face g⁻¹(that face).
          const expected = inv[ROT_CORNER_COLORS[p][j]];
          if (ROT_CORNER_COLORS[piece][(j - o + 3) % 3] !== expected) {
            ok = false;
            break;
          }
        }
        if (ok) {
          found = o;
          break;
        }
      }
      if (found < 0) {
        throw new Error(`pureRotationState: no corner orientation for position ${p}`);
      }
      nco[p] = found;
    }

    for (let p = 0; p < 12; p++) {
      const piece = ep[p];
      nep[p] = piece;
      let found = -1;
      for (let o = 0; o < 2; o++) {
        let ok = true;
        for (let j = 0; j < 2; j++) {
          const expected = inv[ROT_EDGE_COLORS[p][j]];
          if (ROT_EDGE_COLORS[piece][(j - o + 2) % 2] !== expected) {
            ok = false;
            break;
          }
        }
        if (ok) {
          found = o;
          break;
        }
      }
      if (found < 0) {
        throw new Error(`pureRotationState: no edge orientation for position ${p}`);
      }
      neo[p] = found;
    }

    return new CubeState(ncp, nco, nep, neo);
  }

  /**
   * Recover the face-to-face map of a rotation from its piece permutation.
   *
   * For each edge/corner, the home faces of the piece now occupying a
   * position must map (under the rotation) onto that position's faces.
   * Solved by backtracking over the 6! face permutations with forward
   * pruning.
   */
  private static rotationFaceMap(
    cp: ArrayLike<number>,
    ep: ArrayLike<number>,
  ): Record<string, string> {
    const constraints: { src: string[]; dst: string[] }[] = [];
    for (let p = 0; p < 12; p++) {
      constraints.push({ src: ROT_EDGE_COLORS[ep[p]], dst: ROT_EDGE_COLORS[p] });
    }
    for (let p = 0; p < 8; p++) {
      constraints.push({ src: ROT_CORNER_COLORS[cp[p]], dst: ROT_CORNER_COLORS[p] });
    }

    const g: Partial<Record<string, string>> = {};
    // NOTE: `targets` is MUTATED (delete/add) as part of the backtracking
    // search — it is search state, not a fixed input.
    const targets = new Set<string>(ROT_FACES);

    const satisfies = (c: { src: string[]; dst: string[] }): boolean => {
      const mapped = c.src.map((s) => g[s]);
      if (mapped.some((m) => m === undefined)) return true; // not fully assigned
      const set = new Set(mapped as string[]);
      return (
        set.size === mapped.length &&
        (mapped as string[]).every((m) => c.dst.includes(m)) &&
        set.size === new Set(c.dst).size
      );
    };

    const assign = (): boolean => {
      const src = ROT_FACES.find((f) => !(f in g));
      if (!src) {
        return constraints.every(satisfies);
      }
      for (const t of [...targets]) {
        // src → t must respect every constraint mentioning src, and leave
        // enough room for the remaining unassigned faces of each constraint.
        let ok = true;
        for (const c of constraints) {
          if (!c.src.includes(src)) continue;
          if (!c.dst.includes(t)) {
            ok = false;
            break;
          }
          const unassigned = c.src.filter((s) => !(s in g) && s !== src).length;
          const remaining = c.dst.filter((d) => targets.has(d) && d !== t).length;
          if (unassigned > remaining) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        g[src] = t;
        targets.delete(t);
        if (assign()) return true;
        targets.add(t);
        delete g[src];
      }
      return false;
    };

    if (!assign()) {
      throw new Error('rotationFaceMap: no face map found for the given permutation');
    }
    return g as Record<string, string>;
  }
}
