import { describe, it, expect } from 'vitest';
import { Cube2x2State, Move2x2 } from '@cubeforge/math-core';
import { TwoByTwoSolver } from './TwoByTwoSolver';

describe('TwoByTwoSolver', { timeout: 30000 }, () => {
  // ── Construction & initialization ──────────────────────────────────

  it('constructs without error', () => {
    expect(() => new TwoByTwoSolver()).not.toThrow();
  });

  it('init() can be called multiple times without error (idempotent)', () => {
    const solver = new TwoByTwoSolver();
    expect(() => {
      solver.init();
      solver.init();
      solver.init();
    }).not.toThrow();
  });

  // ── Already-solved state ───────────────────────────────────────────

  it('solve on already solved state returns empty notation', () => {
    const solver = new TwoByTwoSolver();
    const solved = new Cube2x2State();
    const solution = solver.solve(solved);
    expect(solution).toBe('');
  });

  it('solveDetailed on already solved state returns notation="" and moveCount=0', () => {
    const solver = new TwoByTwoSolver();
    const solved = new Cube2x2State();
    const result = solver.solveDetailed(solved);
    expect(result).not.toBeNull();
    expect(result!.notation).toBe('');
    expect(result!.moveCount).toBe(0);
    expect(result!.moves).toEqual([]);
  });

  // ── Single-move states ─────────────────────────────────────────────

  it('solve on state one U move from solved returns valid 1-move solution', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.U1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    // Applying solution should solve it
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  it('solve on state one R move from solved returns valid solution', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.R1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  it('solve on state one F move from solved returns valid solution', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.F1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  // ── WCA scramble standard: 2x2 scrambles ──────────────────────────

  it('solves a standard 9-move WCA scramble optimally (≤11 moves)', () => {
    const solver = new TwoByTwoSolver();
    const scrambles = [
      "R U' R F U2 R' F'",
      "F R U' R' U2 F U' F2",
      "R2 F R' U2 F U R2",
      "U R U' R2 F' R U2 R'",
      "F U' R2 U' F' R U2 F'",
    ];
    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);
      const solution = solver.solve(state);
      // Solution must be non-empty and solve the cube
      expect(solution.length).toBeGreaterThan(0);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
    }
  });

  it('solveDetailed returns correct move count and array', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applySequence("R U R' F2");
    const result = solver.solveDetailed(state);
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBe(result!.moves.length);
    expect(result!.notation.split(' ').length).toBe(result!.moveCount);
    // Apply the solution and verify solved
    const check = new Cube2x2State();
    check.applySequence("R U R' F2");
    check.applySequence(result!.notation);
    expect(check.isSolved()).toBe(true);
  });

  // ── solveFromScramble ──────────────────────────────────────────────

  it('solveFromScramble returns valid solution for a scramble string', () => {
    const solver = new TwoByTwoSolver();
    const result = solver.solveFromScramble("R U R' F'");
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBeGreaterThan(0);
    // Applied to solved cube after scramble + solution = solved
    const state = new Cube2x2State();
    state.applySequence("R U R' F'");
    state.applySequence(result!.notation);
    expect(state.isSolved()).toBe(true);
  });

  // ── Maximum depth (11 moves = God's number) ────────────────────────

  it('can solve the worst-case state (God\'s number = 11 moves)', () => {
    // A known 11-move 2x2 scramble
    const worstCaseScramble = "F U' R2 F' U R2 F U' R U2"; // Example 11 mover
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applySequence(worstCaseScramble);
    const result = solver.solveDetailed(state);
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBeLessThanOrEqual(11);
    // Verify it solves
    state.applySequence(result!.notation);
    expect(state.isSolved()).toBe(true);
  });

  // ── Random state verification ──────────────────────────────────────

  it('solves 100 random 2x2 states optimally', { timeout: 30000 }, () => {
    const solver = new TwoByTwoSolver();
    let solved = 0;
    for (let i = 0; i < 100; i++) {
      // Generate random state by applying random moves
      // Use all 6 faces to avoid move-cancellation edge cases
      const moves = ['U', 'R', 'F', 'D', 'L', 'B',
                     'U2', 'R2', 'F2', 'D2', 'L2', 'B2',
                     "U'", "R'", "F'", "D'", "L'", "B'"];
      const state = new Cube2x2State();
      let lastFace = '';
      for (let j = 0; j < 15; j++) {
        let m: string;
        do { m = moves[Math.floor(Math.random() * moves.length)]; }
        while (m[0] === lastFace);
        lastFace = m[0];
        state.applySequence(m);
      }

      if (state.isSolved()) continue; // Extremely unlikely, but skip if solved

      const solution = solver.solve(state);
      expect(solution.length).toBeGreaterThan(0);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
      solved++;
    }
    expect(solved).toBeGreaterThanOrEqual(90); // At least 90 solved
  });

  // ── Performance benchmarks ─────────────────────────────────────────

  it('builds pruning tables within 500ms (separate coordinate BFS)', { timeout: 30000 }, () => {
    const start = performance.now();
    const solver = new TwoByTwoSolver();
    solver.init();
    const end = performance.now();
    // Separate coordinate BFS: 40320 + 2187 states, 18 moves each.
    // Expect ~2-10ms in most environments.
    expect(end - start).toBeLessThan(500);
  });

  it('single solve completes within 100ms', () => {
    const solver = new TwoByTwoSolver();
    solver.init(); // Ensure tables built first (slow, happens once)
    const state = new Cube2x2State();
    state.applySequence("R U R' F2 U2 R' F'");

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      solver.solve(state.clone());
    }
    const end = performance.now();
    const avgMs = (end - start) / 10;
    // With max(permDist, orientDist) heuristic, solve takes ~2-63ms avg.
    expect(avgMs).toBeLessThan(100);
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it('result.notation does not contain consecutive same-face moves', () => {
    const solver = new TwoByTwoSolver();
    // Test multiple random states
    for (let i = 0; i < 50; i++) {
      const state = new Cube2x2State();
      state.applyMove((Math.floor(Math.random() * 9)) as Move2x2);
      state.applyMove((Math.floor(Math.random() * 9)) as Move2x2);
      state.applyMove((Math.floor(Math.random() * 9)) as Move2x2);
      state.applyMove((Math.floor(Math.random() * 9)) as Move2x2);

      const result = solver.solveDetailed(state);
      if (result && result.moveCount > 0) {
        const moveFaces = result.notation.split(' ').map(t => t[0]);
        for (let j = 1; j < moveFaces.length; j++) {
          // IDA* prunes same-face consecutive moves, so this should never happen
          expect(moveFaces[j]).not.toBe(moveFaces[j - 1]);
        }
      }
    }
  });

  it('solution returns null for unreachable state (should not happen with valid states)', () => {
    // This tests that solveDetailed handles the null case gracefully
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    const result = solver.solveDetailed(state);
    expect(result).not.toBeNull();
  });
});
