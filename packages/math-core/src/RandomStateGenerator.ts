import { CubeState } from './CubeState';

export interface ISolver {
  solve(state: CubeState): string;
}

export class RandomStateGenerator {
  /**
   * Generates a physically valid random CubeState for 3x3x3.
   * Ensures corner orientation, edge orientation, and permutation parities are valid.
   */
  public static generateRandomState(): CubeState {
    const cp = [0, 1, 2, 3, 4, 5, 6, 7];
    const ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const co = new Int8Array(8);
    const eo = new Int8Array(12);

    // 1. Corner Orientation (sum must be divisible by 3)
    let coSum = 0;
    for (let i = 0; i < 7; i++) {
      const val = Math.floor(Math.random() * 3);
      co[i] = val;
      coSum += val;
    }
    co[7] = (3 - (coSum % 3)) % 3;

    // 2. Edge Orientation (sum must be divisible by 2)
    let eoSum = 0;
    for (let i = 0; i < 11; i++) {
      const val = Math.floor(Math.random() * 2);
      eo[i] = val;
      eoSum += val;
    }
    eo[11] = (2 - (eoSum % 2)) % 2;

    // 3. Permutations
    this.shuffle(cp);
    this.shuffle(ep);

    // 4. Fix permutation parity
    const cpParity = this.getInversions(cp) % 2;
    const epParity = this.getInversions(ep) % 2;

    if (cpParity !== epParity) {
      // Swap two edges to fix parity
      const temp = ep[10];
      ep[10] = ep[11];
      ep[11] = temp;
    }

    return new CubeState(cp, co, ep, eo);
  }

  /**
   * Generates a scramble using an injected solver.
   * Retries if the solution is less than 2 moves (WCA 4b3).
   */
  public static generateScramble(solver: ISolver): string {
    let scramble = '';
    let valid = false;

    while (!valid) {
      const state = this.generateRandomState();
      const solution = solver.solve(state);
      const moves = solution.trim().split(/\s+/).filter(m => m.length > 0);
      
      if (moves.length >= 2) {
        scramble = this.invertSolution(moves);
        valid = true;
      }
    }

    return scramble;
  }

  /**
   * Generates a batch of scrambles.
   */
  public static generateScrambleBatch(solver: ISolver, count: number): string[] {
    const scrambles: string[] = [];
    for (let i = 0; i < count; i++) {
      scrambles.push(this.generateScramble(solver));
    }
    return scrambles;
  }

  private static shuffle(array: number[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  private static getInversions(array: number[]): number {
    let inversions = 0;
    for (let i = 0; i < array.length - 1; i++) {
      for (let j = i + 1; j < array.length; j++) {
        if (array[i] > array[j]) {
          inversions++;
        }
      }
    }
    return inversions;
  }

  private static invertSolution(moves: string[]): string {
    const inverted: string[] = [];
    for (let i = moves.length - 1; i >= 0; i--) {
      const move = moves[i];
      if (move.endsWith("'") || move.endsWith('3')) {
        inverted.push(move.charAt(0));
      } else if (move.endsWith('2')) {
        inverted.push(move);
      } else {
        inverted.push(move + "'");
      }
    }
    return inverted.join(' ');
  }
}
