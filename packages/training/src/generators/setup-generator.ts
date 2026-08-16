/**
 * @cubeforge/training — Setup scramble generator
 *
 * Generates random setup scrambles for algorithm case drills.
 * Uses the Min2Phase solver to find an optimal setup from solved
 * to the target case state.
 *
 * Pipeline:
 *   1. Apply inverse algorithm to solved cube → case state
 *   2. Apply random AUF (U-layer rotation) to randomize
 *   3. Solve with Min2Phase → optimal solution from case to solved
 *   4. Invert the solution → setup scramble from solved to case
 */

import { CaseStateGenerator } from '@cubeforge/algorithm-db';
import { Min2PhaseSolver } from '@cubeforge/solver-engine';

// ─── Z2 Move Map ────────────────────────────────────────────────────────

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

// ─── Internal helpers ────────────────────────────────────────────────────

function transformMovesZ2(moves: string[]): string[] {
  return moves.map((m) => Z2_MOVE_MAP[m] ?? m);
}

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

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Generates a random setup scramble for an algorithm case.
 *
 * For targetFace === 'Y' (default for CFOP OLL/PLL/COLL/ZBLL drills),
 * 3x3 moves are mapped through z2 so the setup scramble creates the case
 * state on the Yellow face (top layer when solving CFOP).
 *
 * For 2x2 cases (puzzleType === '222' — WCA code, ADR-002), 2x2 inverse moves or seeded setup
 * scrambles with random AUF are used to keep scrambles short (4-8 moves)
 * and in standard 2x2 notation (R, U, F).
 *
 * @param moves - The algorithm moves to generate a setup for
 * @param targetFace - 'Y' for Yellow face (CFOP standard), 'W' for White face
 * @param puzzleType - '333' or '222'
 * @param presetSetupScramble - Pre-computed setup scramble if available in case definition
 * @returns A scramble string that creates the case state from solved
 */
export function generateRandomSetup(
  moves: string[],
  targetFace: 'Y' | 'W' = 'Y',
  puzzleType: string = '333',
  presetSetupScramble?: string,
): string {
  if (!moves || moves.length === 0) {
    if (presetSetupScramble) return presetSetupScramble;
    return '';
  }

  const aufOptions = ['', 'U', 'U2', "U'"];
  const randomAuf = aufOptions[Math.floor(Math.random() * aufOptions.length)];

  if (presetSetupScramble && presetSetupScramble.trim()) {
    return (presetSetupScramble.trim() + (randomAuf ? ' ' + randomAuf : '')).trim();
  }

  // ── 2×2 setup scramble generation ───────────────────────────────────────
  if (puzzleType === '222') {
    const inverse = invertMoves(moves);
    if (randomAuf) {
      inverse.push(randomAuf);
    }
    return inverse.join(' ');
  }

  // ── 3×3 setup scramble generation ───────────────────────────────────────
  try {
    const effectiveMoves =
      targetFace === 'Y' ? transformMovesZ2(moves) : moves;

    // 1. Generate case state from algorithm moves
    const caseState = CaseStateGenerator.generateCaseState(effectiveMoves);

    // 2. Apply random AUF to randomize
    const aufMoves =
      targetFace === 'Y'
        ? ['', 'D', 'D2', "D'"]
        : ['', 'U', 'U2', "U'"];
    const randomAuf =
      aufMoves[Math.floor(Math.random() * aufMoves.length)];
    if (randomAuf) {
      caseState.applySequence(randomAuf);
    }

    // 3. Solve with Min2Phase
    const solver = new Min2PhaseSolver();
    const solution = solver.solve(caseState);

    if (
      !solution ||
      solution.trim().length === 0 ||
      solution.includes('Error')
    ) {
      // Fallback: inverse moves + random AUF
      const fallbackMoves = invertMoves(effectiveMoves);
      if (randomAuf) {
        fallbackMoves.push(randomAuf);
      }
      return fallbackMoves.join(' ');
    }

    // 4. Invert solution → setup scramble
    const solutionMoves = solution.trim().split(/\s+/).filter(Boolean);
    const invertedSolution = invertMoves(solutionMoves);
    return invertedSolution.join(' ');
  } catch (err) {
    console.error('[generateRandomSetup] Failed:', err);
    return '';
  }
}
