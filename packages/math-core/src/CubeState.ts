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

// ── Bit-level constants ────────────────────────────────────────────────────

const BITS = 5n;
const FULL = 0b11111n;

/** Build solved edges bigint: OEEEE × 12, all oriented, piece IDs 0-11 */
function buildSolvedEdges(): bigint {
  let r = 0n;
  for (let i = 0; i < 12; i++) {
    r |= BigInt(i) << (BigInt(i) * BITS);
  }
  return r;
}

/** Build solved corners bigint: OOCCC × 8, all oriented, piece IDs 0-7 */
function buildSolvedCorners(): bigint {
  let r = 0n;
  for (let i = 0; i < 8; i++) {
    r |= BigInt(i) << (BigInt(i) * BITS);
  }
  return r;
}

const SOLVED_EDGES = buildSolvedEdges();
const SOLVED_CORNERS = buildSolvedCorners();

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

  // Static pre-computed table for all 18 moves
  private static moveTable: CubeState[] = [];
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

  public isSolved(): boolean {
    return this._edges === SOLVED_EDGES && this._corners === SOLVED_CORNERS;
  }

  /**
   * Multiply this state with another state 'b' → this = this * b
   *
   * Operates DIRECTLY on internal bigints. NEVER touches the Proxy adapters.
   * This is the hot path — called from applyMove() and initTables().
   */
  public multiply(b: CubeState): void {
    let newEdges = 0n;
    let newCorners = 0n;

    // ── Corners ──────────────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const bShift = BigInt(i) * BITS;
      const bEntry = (b._corners >> bShift) & FULL;
      const bPieceId = Number(bEntry & 0b111n);
      const bOrient = Number((bEntry >> 3n) & 0b11n);

      const thisShift = BigInt(bPieceId) * BITS;
      const thisEntry = (this._corners >> thisShift) & FULL;
      const thisNewPieceId = Number(thisEntry & 0b111n);
      const thisOrient = Number((thisEntry >> 3n) & 0b11n);

      const newOrient = (thisOrient + bOrient) % 3;
      const newEntry = (BigInt(newOrient) << 3n) | BigInt(thisNewPieceId);
      newCorners |= newEntry << (BigInt(i) * BITS);
    }

    // ── Edges ────────────────────────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const bShift = BigInt(i) * BITS;
      const bEntry = (b._edges >> bShift) & FULL;
      const bPieceId = Number(bEntry & 0b1111n);
      const bOrient = Number((bEntry >> 4n) & 0b1n);

      const thisShift = BigInt(bPieceId) * BITS;
      const thisEntry = (this._edges >> thisShift) & FULL;
      const thisNewPieceId = Number(thisEntry & 0b1111n);
      const thisOrient = Number((thisEntry >> 4n) & 0b1n);

      const newOrient = thisOrient ^ bOrient;
      const newEntry = (BigInt(newOrient) << 4n) | BigInt(thisNewPieceId);
      newEdges |= newEntry << (BigInt(i) * BITS);
    }

    this._edges = newEdges;
    this._corners = newCorners;
  }

  public applyMove(move: Move): void {
    CubeState.initTables();
    this.multiply(CubeState.moveTable[move]);
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

  public static initTables(): void {
    if (CubeState.isInitialized) return;

    // Create base states
    const U = new CubeState(baseU.cp, baseU.co, baseU.ep, baseU.eo);
    const R = new CubeState(baseR.cp, baseR.co, baseR.ep, baseR.eo);
    const F = new CubeState(baseF.cp, baseF.co, baseF.ep, baseF.eo);
    const D = new CubeState(baseD.cp, baseD.co, baseD.ep, baseD.eo);
    const L = new CubeState(baseL.cp, baseL.co, baseL.ep, baseL.eo);
    const B = new CubeState(baseB.cp, baseB.co, baseB.ep, baseB.eo);

    const bases = [U, R, F, D, L, B];

    // Build the 18 moves (U1, U2, U3, R1, R2, R3...)
    for (let i = 0; i < 6; i++) {
      const move1 = bases[i].clone();
      const move2 = move1.clone();
      move2.multiply(move1);
      const move3 = move2.clone();
      move3.multiply(move1);

      CubeState.moveTable[i * 3 + 0] = move1;
      CubeState.moveTable[i * 3 + 1] = move2;
      CubeState.moveTable[i * 3 + 2] = move3;
    }

    CubeState.isInitialized = true;
  }
}
