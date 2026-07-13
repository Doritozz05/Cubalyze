export enum Corner {
  URF = 0,
  UFL,
  ULB,
  UBR,
  DFR,
  DLF,
  DBL,
  DRB
}

export enum Edge {
  UR = 0,
  UF,
  UL,
  UB,
  DR,
  DF,
  DL,
  DB,
  FR,
  FL,
  BL,
  BR
}

export enum Move {
  U1 = 0, U2, U3,
  R1, R2, R3,
  F1, F2, F3,
  D1, D2, D3,
  L1, L2, L3,
  B1, B2, B3
}

export const StringToMove: Record<string, Move> = {
  "U": Move.U1, "U2": Move.U2, "U'": Move.U3, "U3": Move.U3,
  "R": Move.R1, "R2": Move.R2, "R'": Move.R3, "R3": Move.R3,
  "F": Move.F1, "F2": Move.F2, "F'": Move.F3, "F3": Move.F3,
  "D": Move.D1, "D2": Move.D2, "D'": Move.D3, "D3": Move.D3,
  "L": Move.L1, "L2": Move.L2, "L'": Move.L3, "L3": Move.L3,
  "B": Move.B1, "B2": Move.B2, "B'": Move.B3, "B3": Move.B3
};
