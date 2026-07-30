/**
 * @cubeforge/solver-engine — TwoByTwoScrambler
 *
 * Generates WCA-style random-state scrambles for the 2×2×2 (Pocket Cube).
 *
 * ## Algorithm (identical to csTimer / cubing.js approach)
 *
 *   1. Generate a random valid 2×2 state (random corner permutation +
 *      random corner orientation, with orientation sum ≡ 0 mod 3).
 *   2. Solve it optimally using {@link TwoByTwoSolver} (≤ 11 moves).
 *   3. Invert the solution → that's the scramble.
 *
 * This produces **random-state scrambles** where every scramble is a
 * uniformly-distributed random position, and the scramble length is
 * optimal (≤ 11 moves). This is the WCA standard for 2×2 scrambling.
 *
 * ## WCA compliance
 *
 *   • Move set: U, R, F, D, L, B (all 6 faces, 18 moves total).
 *   • Random state: uniform over all 3,674,160 valid 2×2 states.
 *   • Minimum length: WCA regulation 4b3b requires at least 4 moves.
 *     We default to minLength=4 for WCA-compliant scrambles.
 */

import { Cube2x2State } from '@cubeforge/math-core';
import { TwoByTwoSolver, type TwoByTwoSolution } from './TwoByTwoSolver';

export class TwoByTwoScrambler {
  private solver: TwoByTwoSolver;

  constructor(solver?: TwoByTwoSolver) {
    this.solver = solver ?? new TwoByTwoSolver();
  }

  /**
   * Generate a uniformly random valid 2×2 state.
   *
   * Algorithm (WCA standard):
   *   1. Generate random permutation of 8 corners (uniform over 8! = 40320).
   *   2. Generate random orientation for 7 corners (uniform over 3^7 = 2187),
   *      with the 8th derived from sum ≡ 0 (mod 3).
   *   3. The resulting (cp, co) pair is a valid 2×2 state — the solver
   *      can find the optimal solution using all 6 faces (18 moves).
   *
   * This produces a uniform distribution over all 3,674,160 valid 2×2 states.
   */
  public static generateRandomState(): Cube2x2State {
    // Random permutation of 0..7
    const cp = new Uint8Array(8);
    const available = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor(Math.random() * available.length);
      cp[i] = available[idx];
      available.splice(idx, 1);
    }

    // Random orientation with sum ≡ 0 (mod 3)
    const co = new Uint8Array(8);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      co[i] = Math.floor(Math.random() * 3);
      sum += co[i];
    }
    co[7] = (3 - (sum % 3)) % 3;

    return new Cube2x2State(cp, co);
  }

  /**
   * Generate a single WCA-style random-state scramble.
   *
   * @param minLength  Minimum number of moves (default 4, per WCA 4b3b).
   * @returns Space-separated scramble notation (e.g. "U R' F2 U R2 F'").
   */
  public generateScramble(minLength: number = 4): string {
    let scramble = '';
    let attempts = 0;

    while (attempts < 100) {
      const state = TwoByTwoScrambler.generateRandomState();
      const solution = this.solver.solveDetailed(state);

      if (solution && solution.moveCount >= minLength) {
        // Invert the solution to get the scramble
        scramble = Cube2x2State.invertNotation(solution.notation);
        break;
      }
      attempts++;
    }

    return scramble;
  }

  /**
   * Generate a batch of scrambles.
   *
   * @param count  Number of scrambles to generate.
   * @param minLength  Minimum moves per scramble (default 4, WCA 4b3b).
   * @returns Array of scramble notation strings.
   */
  public generateScrambleBatch(count: number, minLength: number = 4): string[] {
    const scrambles: string[] = [];
    for (let i = 0; i < count; i++) {
      scrambles.push(this.generateScramble(minLength));
    }
    return scrambles;
  }

  /**
   * Generate a scramble AND its optimal solution (useful for verification
   * and training mode where you want to show the solve).
   *
   * @returns Object with `scramble` (notation to apply) and `solution`
   *          (optimal solve notation).
   */
  public generateScrambleWithSolution(minLength: number = 4): {
    scramble: string;
    solution: TwoByTwoSolution | null;
  } {
    let attempts = 0;
    while (attempts < 100) {
      const state = TwoByTwoScrambler.generateRandomState();
      const solution = this.solver.solveDetailed(state);

      if (solution && solution.moveCount >= minLength) {
        return {
          scramble: Cube2x2State.invertNotation(solution.notation),
          solution: {
            notation: solution.notation,
            moveCount: solution.moveCount,
            moves: solution.moves,
          },
        };
      }
      attempts++;
    }

    return { scramble: '', solution: null };
  }
}
