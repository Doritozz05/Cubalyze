import { CubeState, Min2PhaseSolver } from '@cubeforge/math-core';
import type { SolveTimeline, EfficiencyMetrics } from '@cubeforge/types';

/**
 * Computes move efficiency metrics by comparing the user's solve
 * against the optimal solution found by the Kociemba two-phase solver.
 *
 * Efficiency metrics reveal how many extra moves the user made
 * compared to what was mathematically necessary. Forward drift
 * uses a fast heuristic (piece counting) instead of full solving
 * to avoid performance issues.
 */
export class EfficiencyCalculator {
  /**
   * Find an optimal solution for the scrambled state.
   *
   * NOTE: This calls the Min2PhaseSolver which takes ~50-100ms.
   * Call sparingly — once per solve, not once per move.
   */
  static solveOptimal(scramble: string): string {
    try {
      const state = new CubeState();
      CubeState.initTables();
      state.applySequence(scramble);
      const solver = new Min2PhaseSolver();
      return solver.solve(state);
    } catch {
      return '';
    }
  }

  /**
   * Compute efficiency metrics for a solve timeline.
   *
   * @param timeline - The annotated SolveTimeline.
   * @param scramble - The original scramble string (e.g. "R U R' U'").
   * @returns EfficiencyMetrics.
   */
  static compute(
    timeline: SolveTimeline,
    scramble: string,
  ): EfficiencyMetrics {
    const { entries } = timeline;

    if (entries.length === 0) {
      return {
        moveEfficiencyRatio: 1,
        optimalMoveCount: 0,
        redundancies: 0,
        cancellations: 0,
        overturns: 0,
        forwardDrift: 1,
      };
    }

    // ─── Optimal solution ───────────────────────────────────────────────
    const optimalSolution = EfficiencyCalculator.solveOptimal(scramble);
    const optimalMoveCount = optimalSolution
      ? optimalSolution.trim().split(/\s+/).filter(Boolean).length
      : 0;

    // ─── Move efficiency ratio ──────────────────────────────────────────
    const moveEfficiencyRatio = optimalMoveCount > 0
      ? Math.round((entries.length / optimalMoveCount) * 1000) / 1000
      : 0;

    // ─── Redundancy & cancellation detection ────────────────────────────
    let redundancies = 0;
    let cancellations = 0;

    for (let i = 0; i < entries.length; i++) {
      if (i < entries.length - 1) {
        const move = entries[i].move;
        const nextMove = entries[i + 1].move;

        // Cancellation: same face, opposite CW/CCW (R then R')
        if (
          move.face === nextMove.face &&
          move.direction === -nextMove.direction &&
          Math.abs(move.direction) === 1
        ) {
          cancellations++;
        }

        // Redundancy: same face, same direction (U U → could be U2)
        if (
          move.face === nextMove.face &&
          move.direction === nextMove.direction &&
          Math.abs(move.direction) === 1
        ) {
          redundancies++;
        }
      }
    }

    // ─── Forward drift (fast heuristic: unsolved piece counting) ────────
    const forwardDrift = EfficiencyCalculator.computeForwardDriftFast(timeline);

    return {
      moveEfficiencyRatio,
      optimalMoveCount,
      redundancies,
      cancellations,
      overturns: 0, // Not detectable with current CubeMoveDirection type (1|-1|2)
      forwardDrift,
    };
  }

  /**
   * Compute forward drift using a fast heuristic: count how many moves
   * reduce the number of unsolved pieces (edges + corners).
   *
   * This is O(n) per solve and avoids calling the full solver on every move.
   *
   * @returns A value between 0 and 1. 1.0 = every move reduced unsolved count.
   */
  static computeForwardDriftFast(timeline: SolveTimeline): number {
    const { entries } = timeline;
    if (entries.length === 0) return 1;

    let progressSteps = 0;

    for (const entry of entries) {
      const state = entry.state;
      let unsolved = 0;

      // Count unsolved pieces (piece not in correct position OR wrong orientation)
      for (let i = 0; i < 8; i++) {
        if (state.cp[i] !== i || state.co[i] !== 0) unsolved++;
      }
      for (let i = 0; i < 12; i++) {
        if (state.ep[i] !== i || state.eo[i] !== 0) unsolved++;
      }

      // Each step progresses if total unsolved <= previous step.
      // Since we're moving toward solved, unsolved should monotonically
      // decrease throughout the solve.
      // This is a simplification — use unsolved count as a proxy.
    }

    // For a proper forward drift: count how many states have strictly fewer
    // unsolved pieces than the previous state.
    let previousUnsolved = 20; // max: 8 corners + 12 edges
    for (let i = 0; i < entries.length; i++) {
      const state = entries[i].state;
      let unsolved = 0;
      for (let j = 0; j < 8; j++) {
        if (state.cp[j] !== j || state.co[j] !== 0) unsolved++;
      }
      for (let j = 0; j < 12; j++) {
        if (state.ep[j] !== j || state.eo[j] !== 0) unsolved++;
      }

      if (unsolved < previousUnsolved) {
        progressSteps++;
      }
      previousUnsolved = unsolved;
    }

    return entries.length > 0
      ? Math.round((progressSteps / entries.length) * 1000) / 1000
      : 1;
  }
}
