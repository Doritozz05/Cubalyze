/**
 * WCA compliance regression test — Cubeforge scramble generators.
 *
 * Verifies that the 2×2 and 3×3 scrambles satisfy the WCA Regulations
 * (April 1, 2026 version):
 *
 *   • Regulation 12a1 — notation: only face moves U D L R F B (2×2: U R F,
 *     DBL corner fixed), suffixes ', 2. No rotations or wide moves.
 *   • Regulation 4b3  — 3×3: the scramble produces a random state that
 *     requires at least 2 moves to solve (equal probability per state is
 *     guaranteed by construction of RandomStateGenerator: uniform cp/ep
 *     permutations, orientation sums constrained, parity fixed).
 *   • Regulation 4b3b — 2×2: the state must require at least 4 moves to
 *     solve (verified with the optimal TwoByTwoSolver).
 *   • Official length convention — 2×2 scrambles are written with exactly
 *     11 moves (TNoodle `TWO_BY_TWO_MIN_SCRAMBLE_LENGTH`, God's number),
 *     so scrambles cannot be distinguished by length.
 *   • No consecutive same-face moves (matches the official program output).
 *
 * Reference implementation behavior (TNoodle-WCA / cubing.js) is documented
 * in docs/wca.md → "Official scramble program (Regulation 4b)".
 */
import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { Cube2x2State } from '@cubeforge/math-core';
import { RandomStateGenerator } from './RandomStateGenerator';
import { Min2PhaseSolver } from './Min2PhaseSolver';
import { TwoByTwoScrambler } from './TwoByTwoScrambler';
import { TwoByTwoSolver } from './TwoByTwoSolver';

const TOKEN_3x3 = /^[UDRLFB][2']?$/;
const TOKEN_2x2 = /^[UFR][2']?$/;

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

describe('WCA compliance: 2x2 scrambles (4b3b: state ≥ 4 moves to solve)', { timeout: 120000 }, () => {
  const solver = new TwoByTwoSolver();
  const scrambler = new TwoByTwoScrambler(solver);

  const N = 300;
  const list: string[] = [];
  for (let i = 0; i < N; i++) list.push(scrambler.generateScramble());

  it('notation: every token matches ^[UFR][2\']?$ (DBL fixed, U/R/F only)', () => {
    for (const s of list) {
      for (const t of tokens(s)) {
        expect(t, `bad token "${t}" in "${s}"`).toMatch(TOKEN_2x2);
      }
    }
  });

  it('no consecutive same-face moves', () => {
    for (const s of list) {
      const t = tokens(s);
      for (let i = 1; i < t.length; i++) {
        expect(t[i][0], `consecutive same face in "${s}"`).not.toBe(t[i - 1][0]);
      }
    }
  });

  it('applied to a solved cube → not solved', () => {
    for (const s of list) {
      const state = new Cube2x2State();
      state.applySequence(s);
      expect(state.isSolved(), `"${s}" leaves cube solved`).toBe(false);
    }
  });

  it('WCA 4b3b: optimal solution length ≥ 4 moves for every scramble', () => {
    for (const s of list) {
      const state = new Cube2x2State();
      state.applySequence(s);
      const sol = solver.solveDetailed(state);
      expect(sol, `"${s}" unsolvable`).not.toBeNull();
      expect(sol!.moveCount, `"${s}" optimal depth ${sol!.moveCount} < 4`).toBeGreaterThanOrEqual(4);
    }
  });

  it('length distribution is exactly 11 moves (TNoodle official convention)', () => {
    for (const s of list) {
      expect(tokens(s).length, `"${s}" is not 11 moves`).toBe(11);
    }
    console.log('[2x2] all scrambles are exactly 11 moves (N =', N, ')');
  });
});

describe('WCA compliance: 3x3 scrambles (4b3: state ≥ 2 moves to solve)', { timeout: 300000 }, () => {
  const solver = new Min2PhaseSolver();
  solver.init();

  const N = 150;
  const list: string[] = [];
  for (let i = 0; i < N; i++) list.push(RandomStateGenerator.generateScramble(solver));

  it('notation: every token matches ^[UDRLFB][2\']?$ (no rotations/wide moves)', () => {
    for (const s of list) {
      for (const t of tokens(s)) {
        expect(t, `bad token "${t}" in "${s}"`).toMatch(TOKEN_3x3);
      }
    }
  });

  it('no consecutive same-face moves', () => {
    for (const s of list) {
      const t = tokens(s);
      for (let i = 1; i < t.length; i++) {
        expect(t[i][0], `consecutive same face in "${s}"`).not.toBe(t[i - 1][0]);
      }
    }
  });

  it('applied to a solved cube → not solved', () => {
    for (const s of list) {
      const state = new CubeState();
      state.applySequence(s);
      expect(state.isSolved(), `"${s}" leaves cube solved`).toBe(false);
    }
  });

  it('WCA 4b3: state requires ≥ 2 moves to solve (no single move solves it)', () => {
    const SINGLE = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
    for (const s of list) {
      const state = new CubeState();
      state.applySequence(s);
      for (const m of SINGLE) {
        const probe = new CubeState();
        probe.applySequence(s);
        probe.applySequence(m);
        expect(probe.isSolved(), `"${s}" is solvable in 1 move (${m})`).toBe(false);
      }
    }
  });

  it('min2phase solution length ≥ 2 (sanity)', () => {
    for (const s of list) {
      const state = new CubeState();
      state.applySequence(s);
      const sol = solver.solve(state);
      const n = tokens(sol).length;
      expect(n, `"${s}" solved in ${n} moves`).toBeGreaterThanOrEqual(2);
    }
  });

  it('length distribution is sane (informative)', () => {
    const counts: Record<number, number> = {};
    for (const s of list) {
      const n = tokens(s).length;
      counts[n] = (counts[n] ?? 0) + 1;
    }
    // Matches TNoodle 3x3 output (min2phase inverse solution, typically 19–21).
    expect(Math.max(...Object.keys(counts).map(Number))).toBeLessThanOrEqual(21);
    console.log('[3x3] scramble length distribution over', N, 'scrambles:', counts);
  });
});
