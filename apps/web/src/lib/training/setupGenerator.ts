import { CaseStateGenerator } from '@cubeforge/algorithm-db';
import { Min2PhaseSolver } from '@cubeforge/solver-engine';

/**
 * Generates a random setup scramble for an algorithm case.
 *
 * Pipeline:
 *   1. Apply inverse algorithm to solved cube → case state
 *   2. Apply random AUF (U-layer rotation) to randomize
 *   3. Clean state (co=0, eo=0, parity-fixed) for solver
 *   4. Solve with Min2Phase → optimal solution from case to solved
 *   5. Invert the solution → setup scramble from solved to case
 *
 * The random AUF ensures the setup looks different each time,
 * preventing memorization. Setup length is typically the same as
 * the algorithm's move count (optimal for that case).
 *
 * @param moves - The algorithm moves to generate a setup for
 * @returns A scramble string that creates the case state from solved
 */
const Z2_MOVE_MAP: Record<string, string> = {
  U: 'D', "U'": "D'", U2: 'D2',
  D: 'U', "D'": "U'", D2: 'U2',
  R: 'L', "R'": "L'", R2: 'L2',
  L: 'R', "L'": "R'", L2: 'R2',
  F: 'F', "F'": "F'", F2: 'F2',
  B: 'B', "B'": "B'", B2: 'B2',
  M: "M'", "M'": 'M', M2: 'M2',
  E: "E'", "E'": 'E', E2: 'E2',
  S: 'S', "S'": "S'", S2: 'S2',
};

function transformMovesZ2(moves: string[]): string[] {
  return moves.map((m) => Z2_MOVE_MAP[m] ?? m);
}

/**
 * Generates a random setup scramble for an algorithm case.
 *
 * Pipeline:
 *   1. Apply inverse algorithm to solved cube → case state
 *   2. Apply random AUF (U-layer rotation) to randomize
 *   3. Clean state (co=0, eo=0, parity-fixed) for solver
 *   4. Solve with Min2Phase → optimal solution from case to solved
 *   5. Invert the solution → setup scramble from solved to case
 *
 * For targetFace === 'Y' (default for CFOP OLL/PLL/COLL/ZBLL drills), moves are
 * mapped through z2 so the setup scramble creates the case state on the
 * Yellow face (top layer when solving CFOP).
 *
 * @param moves - The algorithm moves to generate a setup for
 * @param targetFace - 'Y' for Yellow face (CFOP standard), 'W' for White face
 * @returns A scramble string that creates the case state from solved
 */
export function generateRandomSetup(moves: string[], targetFace: 'Y' | 'W' = 'Y'): string {
  if (!moves || moves.length === 0) return '';

  try {
    const effectiveMoves = targetFace === 'Y' ? transformMovesZ2(moves) : moves;

    // 1. Generate case state from algorithm moves (inverse algorithm → solved cube)
    const caseState = CaseStateGenerator.generateCaseState(effectiveMoves);

    // 2. Apply random AUF to randomize the case state
    const aufMoves = targetFace === 'Y' ? ['', 'D', 'D2', "D'"] : ['', 'U', 'U2', "U'"];
    const randomAuf = aufMoves[Math.floor(Math.random() * aufMoves.length)];
    if (randomAuf) {
      caseState.applySequence(randomAuf);
    }

    // 3. Solve caseState with Min2Phase to find optimal solution
    const solver = new Min2PhaseSolver();
    const solution = solver.solve(caseState);

    if (!solution || solution.trim().length === 0) {
      console.warn('[generateRandomSetup] Min2Phase returned empty solution, retrying...');
      // Retry once without AUF as fallback
      const fallbackState = CaseStateGenerator.generateCaseState(effectiveMoves);
      const fallbackSolution = solver.solve(fallbackState);
      if (!fallbackSolution) return '';
      const fallbackMoves = fallbackSolution.trim().split(/\s+/).filter(Boolean);
      const invertedFallback = invertMoves(fallbackMoves);
      return targetFace === 'Y' ? transformMovesZ2(invertedFallback).join(' ') : invertedFallback.join(' ');
    }

    // 5. Invert solution to get setup scramble
    const solutionMoves = solution.trim().split(/\s+/).filter(Boolean);
    const invertedSolution = invertMoves(solutionMoves);
    const finalSetupMoves = targetFace === 'Y' ? transformMovesZ2(invertedSolution) : invertedSolution;
    return finalSetupMoves.join(' ');
  } catch (err) {
    console.error('[generateRandomSetup] Failed:', err);
    return '';
  }
}

/**
 * Inverts a sequence of moves (reverse order + invert each move).
 * R U R' → R U' R'
 */
function invertMoves(moves: string[]): string[] {
  const inverted: string[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i];
    if (move.endsWith("'") || move.endsWith('3')) {
      // R' → R, R3 → R
      inverted.push(move.charAt(0));
    } else if (move.endsWith('2')) {
      // R2 → R2
      inverted.push(move);
    } else {
      // R → R'
      inverted.push(move + "'");
    }
  }
  return inverted;
}
