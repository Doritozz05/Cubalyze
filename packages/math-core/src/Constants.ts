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
  B1, B2, B3,
  // Extended moves: slice turns (M, E, S) + whole-cube rotations (x, y, z)
  M1, M2, M3,
  E1, E2, E3,
  S1, S2, S3,
  X1, X2, X3,  // x rotation
  Y1, Y2, Y3,  // y rotation
  Z1, Z2, Z3,  // z rotation
}

export const StringToMove: Record<string, Move> = {
  "U": Move.U1, "U2": Move.U2, "U'": Move.U3, "U3": Move.U3,
  "R": Move.R1, "R2": Move.R2, "R'": Move.R3, "R3": Move.R3,
  "F": Move.F1, "F2": Move.F2, "F'": Move.F3, "F3": Move.F3,
  "D": Move.D1, "D2": Move.D2, "D'": Move.D3, "D3": Move.D3,
  "L": Move.L1, "L2": Move.L2, "L'": Move.L3, "L3": Move.L3,
  "B": Move.B1, "B2": Move.B2, "B'": Move.B3, "B3": Move.B3,
  // Slice moves
  "M": Move.M1, "M2": Move.M2, "M'": Move.M3, "M3": Move.M3,
  "E": Move.E1, "E2": Move.E2, "E'": Move.E3, "E3": Move.E3,
  "S": Move.S1, "S2": Move.S2, "S'": Move.S3, "S3": Move.S3,
  // Whole-cube rotations
  "x": Move.X1, "x2": Move.X2, "x'": Move.X3, "x3": Move.X3,
  "y": Move.Y1, "y2": Move.Y2, "y'": Move.Y3, "y3": Move.Y3,
  "z": Move.Z1, "z2": Move.Z2, "z'": Move.Z3, "z3": Move.Z3,
};
