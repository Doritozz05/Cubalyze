/**
 * @cubeforge/solver-engine — TwoByTwoScrambler
 *
 * Generates WCA-style random-state scrambles for the 2×2×2 (Pocket Cube).
 *
 * ## Algorithm (identical to csTimer / cubing.js approach)
 *
 *   1. Generate a random valid 2×2 state (random corner permutation +
 *      random corner orientation, with parity/orientation constraints).
 *   2. Solve it optimally using {@link TwoByTwoSolver} (≤ 11 moves).
 *   3. Invert the solution → that's the scramble.
 *
 * This produces **random-state scrambles** where every scramble is a
 * uniformly-distributed random position, and the scramble length is
 * optimal (≤ 11 moves). This is the WCA standard for 2×2 scrambling.
 *
 * ## WCA compliance notes
 *
 *   • Move set: U, R, F only (the other faces are redundant on 2×2
 *     because there are no fixed centers — D/L/B are equivalent to
 *     whole-cube rotations).
 *   • Minimum length: WCA regulation 4b3 requires scrambles of at
 *     least 2 moves. We retry if the optimal solution is < 2 moves.
 *   • These scrambles are "competition-grade" but NOT certified
 *     official (per the PRD Part 0.5).
 */

import { Cube2x2State } from '@cubeforge/math-core';
import { TwoByTwoSolver, type TwoByTwoSolution } from './TwoByTwoSolver';

export class TwoByTwoScrambler {
  private solver: TwoByTwoSolver;

  constructor(solver?: TwoByTwoSolver) {
    this.solver = solver ?? new TwoByTwoSolver();
  }

  /**
   * Generate a random valid 2×2 corner state.
   *
   * Ensures:
   *   • Corner permutation is a random permutation of [0..7]
   *   • Corner orientation sum ≡ 0 (mod 3)
   *   • The state is NOT already solved (to avoid trivial scrambles)
   */
  public static generateRandomState(): Cube2x2State {
    let state: Cube2x2State;

    do {
      // Random permutation
      const cp = [0, 1, 2, 3, 4, 5, 6, 7];
      this.shuffle(cp);

      // Random orientation (first 7 corners random, 8th derived)
      const co = new Uint8Array(8);
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        co[i] = Math.floor(Math.random() * 3);
        sum += co[i];
      }
      co[7] = (3 - (sum % 3)) % 3;

      state = new Cube2x2State(cp, co);
    } while (state.isSolved()); // reject trivial solved state

    return state;
  }

  /**
   * Generate a single WCA-style random-state scramble.
   *
   * @param minLength  Minimum number of moves (default 2, per WCA 4b3).
   * @returns Space-separated scramble notation (e.g. "U R' F2 U R2 F'").
   */
  public generateScramble(minLength: number = 9): string {
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
   * @param minLength  Minimum moves per scramble (default 2).
   * @returns Array of scramble notation strings.
   */
  public generateScrambleBatch(count: number, minLength: number = 2): string[] {
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
  public generateScrambleWithSolution(minLength: number = 2): {
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

  // ── Helpers ────────────────────────────────────────────────────────────

  private static shuffle(array: number[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }
}
