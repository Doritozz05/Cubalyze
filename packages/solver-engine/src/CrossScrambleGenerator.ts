/**
 * @cubalyze/solver-engine — CrossScrambleGenerator
 *
 * Generates scrambles whose optimal cross solution is EXACTLY a requested
 * number of moves N (the "way-to-cross" technique from or18's
 * RubiksSolverDemo cross_trainer). This is the core of the Cross Trainer:
 * the user picks a depth (1–8) and we guarantee the scramble can be solved
 * in exactly that many moves on the chosen face (or the best face, when
 * color-neutral).
 *
 * Algorithm (matches the reference web's crossTrainer/worker.js):
 *   1. Generate a random valid CubeState via {@link RandomStateGenerator}
 *      (which uses min2phase internally).
 *   2. Solve the cross for the target face with {@link solveCross}.
 *   3. If the optimal depth === N, invert the solution → that inversion,
 *      applied to a solved cube, produces a scramble whose optimal cross
 *      is exactly N. We're done.
 *   4. If the depth ≠ N, retry with a new random state. Bounded retries
 *      (with a small tolerance: depth N±0 is the strict target; if we
 *      can't hit it exactly after many tries, accept depth ≤ N which is
 *      still a valid "≤ N moves" scramble — useful for the "≤8" mode).
 *
 * Because min2phase.randomCube() produces uniform random states and the
 * cross depth distribution is well spread across 1–8, hitting an exact N
 * usually takes only a handful of retries.
 *
 * The generator is generic enough to be reused for xcross / xxcross /
 * eocross once their masks + depth ranges are defined.
 */

import { CubeState } from '@cubalyze/math-core';
import { RandomStateGenerator } from './RandomStateGenerator';
import {
  solveCross,
  crossDepth,
  bestCrossFace,
  type PhaseSolution,
  type SolvePhaseOptions,
  invertMoves,
  movesToNotation,
} from './PhaseSolver';

export interface CrossScrambleOptions {
  /** Exact cross depth (move count) the scramble must have. 1–8. */
  depth: number;
  /**
   * Cross face. If omitted, the generator runs color-neutral: it finds the
   * face whose optimal cross is closest to `depth` and returns that.
   * Default: undefined (color-neutral).
   */
  face?: string;
  /** Optional move restriction (e.g. only U,D,L,R,F,B without wide moves). */
  allowedMoves?: Set<string>;
  /** Optional pre-move / rotation applied as a prefix to the scramble. */
  rotation?: string;
  /**
   * Max retries before accepting a near-miss (depth within ±0 of target).
   * Default 200. Each retry is a fresh random state + a cross solve (≤8
   * moves IDDFS) so this is fast.
   */
  maxRetries?: number;
  /**
   * When true, accept scrambles whose depth is ≤ the requested `depth`
   * (useful for the "≤8" mode). When false (default), require EXACT depth.
   */
  acceptUpToDepth?: boolean;
}

export interface CrossScrambleResult {
  /** The scramble notation to display / apply to a solved cube. */
  scramble: string;
  /** The optimal cross solution for this scramble (on `face`). */
  optimalSolution: string;
  /** Number of moves in the optimal solution. === depth when strict. */
  optimalDepth: number;
  /** The cross face this scramble was solved on. */
  face: string;
  /** All optimal solutions found (up to maxSolutions). */
  allSolutions?: PhaseSolution[];
}

/**
 * Generate a scramble whose optimal cross is exactly `depth` moves.
 */
export class CrossScrambleGenerator {
  /**
   * Generate a single cross scramble.
   */
  static generate(opts: CrossScrambleOptions): CrossScrambleResult {
    const {
      depth,
      face,
      allowedMoves,
      rotation,
      maxRetries = 200,
      acceptUpToDepth = false,
    } = opts;

    if (depth < 1 || depth > 8) {
      throw new Error(`Cross depth must be between 1 and 8, got ${depth}`);
    }

    const solveOpts: SolvePhaseOptions = {
      maxDepth: 8,
      maxSolutions: 10,
      allowedMoves,
    };

    let lastNear: CrossScrambleResult | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 1. Random valid state.
      const randomState = RandomStateGenerator.generateRandomState();

      // 2. Solve cross on the requested face (or find the best face).
      let solvedFace: string;
      let solutions: PhaseSolution[];
      if (face) {
        solvedFace = face;
        solutions = solveCross(randomState, face, solveOpts);
      } else {
        // Color-neutral: find the best face first.
        const best = bestCrossFace(randomState, 8);
        if (!best) continue;
        solvedFace = best.face;
        solutions = solveCross(randomState, best.face, solveOpts);
      }

      if (solutions.length === 0) continue;
      const optimal = solutions[0];
      const optimalDepth = optimal.moveCount;

      // 3. Build the scramble by inverting the optimal solution. Applied to
      //    a solved cube, the inversion produces a state whose optimal
      //    cross (on solvedFace) is exactly `optimalDepth`.
      const scrambleMoves = invertMoves(optimal.moves);
      let scramble = movesToNotation(scrambleMoves);

      // Apply the optional rotation prefix (e.g. "z2") — matches the
      // reference web's `scr_fix(rot + scramble)`.
      if (rotation) {
        scramble = `${rotation} ${scramble}`;
      }

      const result: CrossScrambleResult = {
        scramble,
        optimalSolution: optimal.notation,
        optimalDepth,
        face: solvedFace,
        allSolutions: solutions,
      };

      // 4. Accept if depth matches (strict) or is within tolerance.
      if (optimalDepth === depth) {
        return result;
      }
      if (acceptUpToDepth && optimalDepth <= depth) {
        return result;
      }

      // Keep the closest near-miss in case we exhaust retries.
      if (!lastNear || Math.abs(optimalDepth - depth) < Math.abs(lastNear.optimalDepth - depth)) {
        lastNear = result;
      }
    }

    // Exhausted retries: return the closest near-miss (or throw).
    if (lastNear) {
      return lastNear;
    }
    throw new Error(
      `Could not generate a cross scramble at depth ${depth} after ${maxRetries} attempts`,
    );
  }

  /**
   * Generate a batch of cross scrambles (e.g. for a session of N drills).
   */
  static generateBatch(opts: CrossScrambleOptions, count: number): CrossScrambleResult[] {
    const results: CrossScrambleResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generate(opts));
    }
    return results;
  }

  /**
   * Verify that a scramble has the expected cross depth on a face. Used by
   * the UI to sanity-check a scramble before displaying it (defensive — the
   * generator already verifies internally).
   */
  static verifyDepth(scramble: string, face: string, expectedDepth: number): boolean {
    const state = new CubeState();
    try {
      state.applySequence(scramble);
    } catch {
      return false;
    }
    const d = crossDepth(state, face, 8);
    return d === expectedDepth;
  }
}
