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
  // Standard face moves
  U: 'D', "U'": "D'", U2: 'D2',
  D: 'U', "D'": "U'", D2: 'U2',
  R: 'L', "R'": "L'", R2: 'L2',
  L: 'R', "L'": "R'", L2: 'R2',
  F: 'F', "F'": "F'", F2: 'F2',
  B: 'B', "B'": "B'", B2: 'B2',

  // Wide moves (standard notation)
  Rw: 'Lw', "Rw'": "Lw'", Rw2: 'Lw2', "Rw2'": 'Lw2',
  Lw: 'Rw', "Lw'": "Rw'", Lw2: 'Rw2', "Lw2'": 'Rw2',
  Uw: 'Dw', "Uw'": "Dw'", Uw2: 'Dw2', "Uw2'": 'Dw2',
  Dw: 'Uw', "Dw'": "Uw'", Dw2: 'Uw2', "Dw2'": 'Uw2',
  Fw: 'Fw', "Fw'": "Fw'", Fw2: 'Fw2', "Fw2'": 'Fw2',
  Bw: 'Bw', "Bw'": "Bw'", Bw2: 'Bw2',

  // Wide moves (lowercase notation)
  r: 'l', "r'": "l'", r2: 'l2', "r2'": 'l2',
  l: 'r', "l'": "r'", l2: 'r2', "l2'": 'r2',
  u: 'd', "u'": "d'", u2: 'd2', "u2'": 'd2',
  d: 'u', "d'": "u'", d2: 'u2', "d2'": 'u2',
  f: 'f', "f'": "f'", f2: 'f2', "f2'": 'f2',
  b: 'b', "b'": "b'", b2: 'b2', "b2'": 'b2',

  // Slice moves
  M: "M'", "M'": 'M', M2: 'M2',
  E: "E'", "E'": 'E', E2: 'E2',
  S: 'S', "S'": "S'", S2: 'S2',

  // Rotations
  x: "x'", "x'": 'x', x2: 'x2',
  y: "y'", "y'": 'y', y2: 'y2',
  z: 'z', "z'": "z'", z2: 'z2',
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

    if (!solution || solution.trim().length === 0 || solution.includes('Error')) {
      console.warn('[generateRandomSetup] Min2Phase returned empty or error solution:', solution);
      // Fallback: generate setup scramble directly from inverse moves + random AUF
      const fallbackMoves = invertMoves(effectiveMoves);
      if (randomAuf) {
        fallbackMoves.push(randomAuf);
      }
      return fallbackMoves.join(' ');
    }

    // 5. Invert solution to get setup scramble.
    // Note: effectiveMoves was already z2-transformed at step 1 for targetFace === 'Y',
    // so invertedSolution is ALREADY the setup scramble that acts on the Yellow face (D layer).
    const solutionMoves = solution.trim().split(/\s+/).filter(Boolean);
    const invertedSolution = invertMoves(solutionMoves);
    return invertedSolution.join(' ');
  } catch (err) {
    console.error('[generateRandomSetup] Failed:', err);
    return '';
  }
}

/**
 * Inverts a sequence of moves (reverse order + invert each move).
 * R U R' → R U' R'
 * Rw U2 Rw' → Rw U2 Rw'
 */
function invertMoves(moves: string[]): string[] {
  const inverted: string[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i];
    if (move.endsWith("'")) {
      inverted.push(move.slice(0, -1));
    } else if (move.endsWith('2') || move.endsWith("2'")) {
      inverted.push(move.endsWith("'") ? move.slice(0, -1) : move);
    } else if (move.endsWith('3')) {
      inverted.push(move.slice(0, -1));
    } else {
      inverted.push(move + "'");
    }
  }
  return inverted;
}
