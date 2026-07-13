import { Corner, Edge, Move, StringToMove } from './Constants';

// Base moves defined manually (Kociemba standard)
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

export class CubeState {
  public cp: Int8Array = new Int8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  public co: Int8Array = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0]);
  public ep: Int8Array = new Int8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  public eo: Int8Array = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Static pre-computed table for all 18 moves
  private static moveTable: CubeState[] = [];
  private static isInitialized = false;

  constructor(cp?: number[] | Int8Array, co?: number[] | Int8Array, ep?: number[] | Int8Array, eo?: number[] | Int8Array) {
    if (cp) this.cp.set(cp);
    if (co) this.co.set(co);
    if (ep) this.ep.set(ep);
    if (eo) this.eo.set(eo);
  }

  public clone(): CubeState {
    return new CubeState(this.cp, this.co, this.ep, this.eo);
  }

  public isSolved(): boolean {
    for (let i = 0; i < 8; i++) {
      if (this.cp[i] !== i || this.co[i] !== 0) return false;
    }
    for (let i = 0; i < 12; i++) {
      if (this.ep[i] !== i || this.eo[i] !== 0) return false;
    }
    return true;
  }

  // Multiply this state with another state 'b' -> this = this * b
  public multiply(b: CubeState): void {
    const nextCp = new Int8Array(8);
    const nextCo = new Int8Array(8);
    const nextEp = new Int8Array(12);
    const nextEo = new Int8Array(12);

    for (let i = 0; i < 8; i++) {
      nextCp[i] = this.cp[b.cp[i]];
      nextCo[i] = (this.co[b.cp[i]] + b.co[i]) % 3;
    }

    for (let i = 0; i < 12; i++) {
      nextEp[i] = this.ep[b.ep[i]];
      nextEo[i] = (this.eo[b.ep[i]] + b.eo[i]) % 2;
    }

    this.cp.set(nextCp);
    this.co.set(nextCo);
    this.ep.set(nextEp);
    this.eo.set(nextEo);
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
