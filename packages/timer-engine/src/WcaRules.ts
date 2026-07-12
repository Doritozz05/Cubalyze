export enum Penalty {
  NONE = 'NONE',
  PLUS_TWO = '+2',
  DNF = 'DNF'
}

export function getInspectionPenalty(inspectionTimeMs: number): Penalty {
  const seconds = inspectionTimeMs / 1000;
  if (seconds >= 17) {
    return Penalty.DNF;
  }
  if (seconds >= 15) {
    return Penalty.PLUS_TWO;
  }
  return Penalty.NONE;
}

export function calculateFinalTime(solveTimeMs: number, penalty: Penalty): number {
  if (penalty === Penalty.DNF) {
    return Infinity; // Or however DNF is represented numerically
  }
  if (penalty === Penalty.PLUS_TWO) {
    return solveTimeMs + 2000;
  }
  return solveTimeMs;
}
