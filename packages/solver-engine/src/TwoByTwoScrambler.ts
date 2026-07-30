/**
 * @cubeforge/solver-engine — TwoByTwoScrambler
 *
 * WCA-compliant random-state scrambler for the 2×2×2 (Pocket Cube).
 *
 * ## Algorithm (professional — Kociemba / cubing.js / WCA standard)
 *
 *   1. Generate a random valid 2×2 state **with the DBL corner fixed**.
 *      Random permutation of the 7 non-DBL corners + random orientation
 *      with sum ≡ 0 (mod 3). DBL stays at position 6 with twist 0.
 *   2. Solve it optimally using {@link TwoByTwoSolver} (combined pruning
 *      table, exact heuristic, <1 ms).
 *   3. Invert the solution → that's the scramble.
 *
 * ## WCA compliance
 *
 *   • **Regulation 4b3b**: "The 2×2×2 Cube scrambling must produce random
 *     states that require at least 4 moves to solve (based on the fixed
 *     corner in DBL position)." — We default to minLength=4.
 *   • **DBL corner fixed**: Only U, R, F moves appear in scrambles (since
 *     the DBL corner never moves). This matches WCA standards.
 *   • **Random state**: Uniform over all 3,674,160 valid 2×2 states.
 *   • **Optimal scramble**: The solver finds the shortest possible scramble.
 */

import { Cube2x2State } from '@cubeforge/math-core';
import { TwoByTwoSolver, type TwoByTwoSolution } from './TwoByTwoSolver';

// DBL corner (position 6) is always fixed
const DBL_POS = 6;

/** IDs of the 7 non-DBL corners. */
const NON_DBL_CORNERS = [0, 1, 2, 3, 4, 5, 7];

export class TwoByTwoScrambler {
  private solver: TwoByTwoSolver;

  constructor(solver?: TwoByTwoSolver) {
    this.solver = solver ?? new TwoByTwoSolver();
  }

  /**
   * Generate a uniformly random valid 2×2 state with DBL corner fixed.
   *
   * Algorithm (WCA standard):
   *   1. Random permutation of 7 non-DBL corners (uniform over 7! = 5040).
   *   2. Random orientation for 6 corners (uniform over 3⁶ = 729),
   *      with the 7th derived from sum ≡ 0 (mod 3).
   *   3. DBL corner stays at position 6 with twist 0.
   */
  public static generateRandomState(): Cube2x2State {
    const cp = new Uint8Array(8);
    const co = new Uint8Array(8);

    // DBL fixed
    cp[DBL_POS] = DBL_POS;
    co[DBL_POS] = 0;

    // Random permutation of the 7 non-DBL corners (Fisher-Yates)
    const available = [...NON_DBL_CORNERS];
    const positions = [0, 1, 2, 3, 4, 5, 7]; // All except DBL_POS
    for (let i = 0; i < 7; i++) {
      const idx = Math.floor(Math.random() * available.length);
      cp[positions[i]] = available[idx];
      available.splice(idx, 1);
    }

    // Random orientation with sum ≡ 0 (mod 3) for 6 of 7 non-DBL corners
    // We set orientation for positions 0,1,2,3,4,5 (6 values) and derive position 7
    let sum = 0;
    for (let i = 0; i < 6; i++) {
      co[positions[i]] = Math.floor(Math.random() * 3);
      sum += co[positions[i]];
    }
    co[positions[6]] = (3 - (sum % 3)) % 3;

    return new Cube2x2State(cp, co);
  }

  /**
   * Generate a single WCA-style random-state scramble.
   *
   * @param minLength  Minimum number of moves (default 4, per WCA 4b3b).
   * @returns Space-separated scramble notation (e.g. "U R' F2 U R2").
   */
  public generateScramble(minLength: number = 4): string {
    let scramble = '';
    let attempts = 0;

    while (attempts < 100) {
      const state = TwoByTwoScrambler.generateRandomState();
      const solution = this.solver.solveDetailed(state);

      if (solution && solution.moveCount >= minLength) {
        scramble = Cube2x2State.invertNotation(solution.notation);
        break;
      }
      attempts++;
    }

    return scramble;
  }

  /**
   * Generate a batch of scrambles.
   */
  public generateScrambleBatch(count: number, minLength: number = 4): string[] {
    const scrambles: string[] = [];
    for (let i = 0; i < count; i++) {
      scrambles.push(this.generateScramble(minLength));
    }
    return scrambles;
  }

  /**
   * Generate a scramble AND its optimal solution.
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
