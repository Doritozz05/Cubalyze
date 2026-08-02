import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';

/**
 * Create a sequence of moves from notation strings like "R", "U'", "L2".
 * Each move gets an incrementing timestamp starting at baseTimestamp.
 */
export function makeMoves(
  notation: string,
  baseTimestamp = 1000,
  gapMs = 100,
): CubeMoveEvent[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  return tokens.map((token, i) => {
    const face = token[0] as CubeFace;
    let direction: CubeMoveDirection = 1;
    if (token.includes("'")) direction = -1;
    else if (token.includes('2')) direction = 2;

    return {
      face,
      direction,
      cubeTimestamp: baseTimestamp + i * gapMs,
      hostTimestamp: baseTimestamp + i * gapMs,
    };
  });
}

// ─── Scramble utilities ──────────────────────────────────────────────────────

/**
 * Compute the inverse of a scramble string.
 *
 * To "solve" a scramble, you must apply its inverse. This function
 * reverses the move sequence and inverts each move (CW → CCW, CCW → CW,
 * 180° stays 180°).
 *
 * @example inverseScramble("R U R' U'") → "U R U' R'"
 */
export function inverseScramble(scramble: string): string {
  return scramble
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((move) => {
      if (move.endsWith("'")) return move[0];
      if (move.endsWith('2')) return move;
      return move + "'";
    })
    .join(' ');
}

/**
 * Generate a complete solve from a scramble.
 *
 * Returns the original scramble, the solve notation (inverse of scramble),
 * and the CubeMoveEvents for the solve. This simulates what a real solver
 * would do: apply the inverse of the scramble to return the cube to solved.
 *
 * @returns { scramble, notation, solveMoves }
 */
export function makeSolveFromScramble(
  scramble: string,
  baseTimestamp = 1000,
  gapMs = 100,
): {
  scramble: string;
  notation: string;
  solveMoves: CubeMoveEvent[];
} {
  const notation = inverseScramble(scramble);
  // Guard: empty notation produces no moves (solved cube, no solve needed)
  const solveMoves = notation ? makeMoves(notation, baseTimestamp, gapMs) : [];
  return { scramble, notation, solveMoves };
}

/**
 * Pre-defined scrambles and their expected solve characteristics for testing.
 *
 * Each entry documents the expected phase breakdown for validation.
 */
export const TEST_SCRAMBLES = {
  /** Simple 4-move scramble: Cross → F2L → OLL → PLL (all detectable) */
  fourMove: 'R U R\' U\'',

  /** 8-move scramble requiring cross, F2L, OLL, PLL */
  eightMove: "R U R' U' R' F R F'",

  /**
   * T-Perm applied twice to a solved cube acts as a PLL skip solve.
   * Starting from scrambled state with inverse solves the scramble.
   */
  tPerm: "R U R' U' R' F R2 U' R' U' R U R' F'",

  /** Roux-friendly scramble */
  roux: "U' L' U L U F U' F'",

  /** ZZ-friendly scramble (EO-friendly) */
  zz: "F R U R' U' F'",
} as const;
