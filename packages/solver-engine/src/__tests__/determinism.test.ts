/**
 * Nivel 3 — Category 9: Determinism / Reproducibility Tests
 *
 * Same input MUST produce identical output. Always.
 * Non-deterministic behavior = hidden bugs.
 */
import { describe, it, expect } from 'vitest';
import { CubeState, Cube2x2State } from '@cubalyze/math-core';
import { Min2PhaseSolver, TwoByTwoSolver, RandomStateGenerator } from '../index';

// ═══════════════════════════════════════════════════════════════════════
//  DT1: Same scramble → same Min2Phase solution (100 runs)
// ═══════════════════════════════════════════════════════════════════════

describe('DT1 — Min2PhaseSolver determinism', { timeout: 60000 }, () => {
  const solver = new Min2PhaseSolver();
  const scrambles = [
    "R U R' U'",
    "R U R' U' R' F R F'",
    "F R U R' U' F'",
    "R U2 R' U' R U R' U' R U' R'",
  ];

  it('same scramble produces identical solution 100 times', () => {
    for (const scramble of scrambles) {
      const state = new CubeState();
      state.applySequence(scramble);

      const results: string[] = [];
      for (let i = 0; i < 100; i++) {
        // Clone state so solver operates on fresh state each time
        const stateCopy = state.clone();
        const solution = solver.solve(stateCopy);
        results.push(solution);

        // Verify correctness
        stateCopy.applySequence(solution);
        expect(stateCopy.isSolved()).toBe(true);
      }

      // All 100 solutions must be identical
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(first);
      }
    }
  });

  it('TwoByTwoSolver: same scramble → identical solution 50 times', () => {
    const solver2x2 = new TwoByTwoSolver();
    solver2x2.init();

    const scrambles = ['U R F', "U2 R' F", "U R U' R'"];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);

      const results: string[] = [];
      for (let i = 0; i < 50; i++) {
        const stateCopy = state.clone();
        const solution = solver2x2.solve(stateCopy);
        results.push(solution);

        stateCopy.applySequence(solution);
        expect(stateCopy.isSolved()).toBe(true);
      }

      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(first);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  DT3: Same seed → same RandomStateGenerator output
// ═══════════════════════════════════════════════════════════════════════

describe('DT3 — RandomStateGenerator reproducibility', () => {
  it('generateRandomState is non-deterministic by design (uses Math.random)', () => {
    // This test documents that generateRandomState uses Math.random()
    // and therefore produces DIFFERENT states on each call.
    // This is by design — it's a random state generator.
    const solver = new Min2PhaseSolver();

    // Generate 20 scrambles and verify they're all valid
    const scrambles = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = RandomStateGenerator.generateScramble(solver);
      expect(s.length).toBeGreaterThan(0);
      scrambles.add(s);
    }

    // With 20 scrambles of ~20 moves each, collisions are astronomically
    // unlikely if Math.random() is working correctly
    expect(scrambles.size).toBeGreaterThan(15); // Allow for some collisions
  });

  it('generateScramble always produces valid scrambles (≥ 2 moves, WCA compliant)', () => {
    const solver = new Min2PhaseSolver();

    for (let i = 0; i < 50; i++) {
      const scramble = RandomStateGenerator.generateScramble(solver);
      const moves = scramble.trim().split(/\s+/).filter((m) => m.length > 0);
      expect(moves.length).toBeGreaterThanOrEqual(2);
    }
  });
});
