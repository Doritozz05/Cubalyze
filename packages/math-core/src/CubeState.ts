import { Corner, Edge, Move, StringToMove } from './Constants';
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
//   Cycles edges: UF→DF→DB→UB→UF. No corners affected. No edge flips.
// E = equatorial slice (y=0), turned like D (CW from -Y).
//   Cycles edges: FR→BR→BL→FL→FR. No corners affected. No edge flips.
// S = standing slice (z=0), turned like F (CW from +Z).
//   Cycles edges: UR→DR→DL→UL→UR. No corners affected. All 4 edges flipped.
//
// Verified by hand against the existing L/D/F base move conventions:
//   L cycles UL→FL→DL→BL, M cycles UF→DF→DB→UB (same rotation direction)
//   D cycles DR→DB→DL→DF, E cycles FR→BR→BL→FL (same rotation direction)
//   F cycles UF→FR→DF→FL (flips all), S cycles UR→DR→DL→UL (flips all)

const baseM = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UR, Edge.UB, Edge.UL, Edge.DB, Edge.DR, Edge.UF, Edge.DL, Edge.DF, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseE = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UR, Edge.UF, Edge.UL, Edge.UB, Edge.DR, Edge.DF, Edge.DL, Edge.DB, Edge.FL, Edge.BL, Edge.BR, Edge.FR],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
const baseS = {
  cp: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR, Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [Edge.UL, Edge.UF, Edge.DL, Edge.UB, Edge.UR, Edge.DF, Edge.DR, Edge.DB, Edge.FR, Edge.FL, Edge.BL, Edge.BR],
  eo: [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0]
};

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

  constructor();
  constructor(cp: ArrayLike<number> | null, co: ArrayLike<number> | null, ep: ArrayLike<number> | null, eo: ArrayLike<number> | null);
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
    const tokens = moves.trim().split(/\s+/);
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

    // ── Build whole-cube rotations as composites ─────────────────────────
    // x = R · L' · M'  (all X layers rotated like R, CW from +X)
    // y = U · D' · E'  (all Y layers rotated like U, CW from +Y)
    // z = F · B' · S'  (all Z layers rotated like F, CW from +Z)
    //
    // Components affect non-overlapping layers → they commute, so order
    // doesn't matter. The composition via multiply() produces the correct
    // cubie permutation + orientation for the entire-cube rotation.
    //
    // Enum layout: [X1-3][Y1-3][Z1-3] = indices 27–35
    const ROT_BASE = 27;

    // x = R * L' * M'
    const x1 = R.clone();
    x1.multiply(inverses[4]); // R * L'
    x1.multiply(inverses[6]); // R * L' * M'
    const x2 = x1.clone(); x2.multiply(x1.clone());
    const x3 = x2.clone(); x3.multiply(x1.clone());

    // y = U * D' * E'
    const y1 = U.clone();
    y1.multiply(inverses[3]); // U * D'
    y1.multiply(inverses[7]); // U * D' * E'
    const y2 = y1.clone(); y2.multiply(y1.clone());
    const y3 = y2.clone(); y3.multiply(y1.clone());

    // z = F * B' * S'
    const z1 = F.clone();
    z1.multiply(inverses[5]); // F * B'
    z1.multiply(inverses[8]); // F * B' * S'
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
}
