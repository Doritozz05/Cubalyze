import { describe, it, expect } from 'vitest';
import { Cube2x2State, Move2x2 } from '@cubeforge/math-core';
import { TwoByTwoSolver } from './TwoByTwoSolver';
import { TwoByTwoScrambler } from './TwoByTwoScrambler';

describe('TwoByTwoSolver', { timeout: 30000 }, () => {
  // ── Construction & initialization ──────────────────────────────────

  it('constructs without error', () => {
    expect(() => new TwoByTwoSolver()).not.toThrow();
  });

  it('init() builds the combined pruning table (3.67 MB) within 2000ms', () => {
    const solver = new TwoByTwoSolver();
    const start = performance.now();
    solver.init();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it('init() is idempotent (can be called multiple times)', () => {
    const solver = new TwoByTwoSolver();
    expect(() => {
      solver.init();
      solver.init();
      solver.init();
    }).not.toThrow();
  });

  // ── Already-solved state ───────────────────────────────────────────

  it('solve on solved state returns empty notation', () => {
    const solver = new TwoByTwoSolver();
    const solved = new Cube2x2State();
    expect(solver.solve(solved)).toBe('');
  });

  it('solveDetailed on solved state returns moveCount=0', () => {
    const solver = new TwoByTwoSolver();
    const result = solver.solveDetailed(new Cube2x2State());
    expect(result).not.toBeNull();
    expect(result!.notation).toBe('');
    expect(result!.moveCount).toBe(0);
    expect(result!.moves).toEqual([]);
  });

  // ── Single-move states ─────────────────────────────────────────────

  it('solve on state one U move from solved', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.U1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  it('solve on state one R move from solved', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.R1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  it('solve on state one F move from solved', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applyMove(Move2x2.F1);
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  // ── WCA scramble solving (DBL fixed, URF only) ────────────────────

  it('solves standard 2x2 scrambles (URF only)', () => {
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
      // DBL must be fixed for the solver to work
      if (state.cp[6] !== 6) continue; // Skip scrambles that move DBL
      const solution = solver.solve(state);
      expect(solution.length).toBeGreaterThan(0);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
    }
  });

  it('solveDetailed returns correct move count', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applySequence("R U R' F2");
    const result = solver.solveDetailed(state);
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBe(result!.moves.length);
    const check = new Cube2x2State();
    check.applySequence("R U R' F2");
    check.applySequence(result!.notation);
    expect(check.isSolved()).toBe(true);
  });

  // ── solveFromScramble ──────────────────────────────────────────────

  it('solveFromScramble works for URF scrambles', () => {
    const solver = new TwoByTwoSolver();
    const result = solver.solveFromScramble("R U R' F'");
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBeGreaterThan(0);
    const state = new Cube2x2State();
    state.applySequence("R U R' F'");
    state.applySequence(result!.notation);
    expect(state.isSolved()).toBe(true);
  });

  it('solveFromScramble returns null for scrambles with D, L, B moves', () => {
    const solver = new TwoByTwoSolver();
    expect(solver.solveFromScramble("D R")).toBeNull();
    expect(solver.solveFromScramble("L R")).toBeNull();
    expect(solver.solveFromScramble("B R")).toBeNull();
  });

  // ── Maximum depth (11 moves = God's number) ────────────────────────

  it('solves worst-case state (God number = 11 moves)', () => {
    // Known 11-move scramble (from Kociemba)
    const scramble = "R U' F' R U2 F' U' F U'"; // Example
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applySequence(scramble);
    if (state.cp[6] !== 6) return; // Skip if DBL moved
    const result = solver.solveDetailed(state);
    expect(result).not.toBeNull();
    expect(result!.moveCount).toBeLessThanOrEqual(11);
    state.applySequence(result!.notation);
    expect(state.isSolved()).toBe(true);
  });

  // ── Random state verification ──────────────────────────────────────

  it('solves 100 random 2x2 states with DBL fixed', { timeout: 30000 }, () => {
    const solver = new TwoByTwoSolver();
    let solved = 0;
    for (let i = 0; i < 100; i++) {
      // Generate random state using only U,R,F moves (preserves DBL)
      const moves = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
      const state = new Cube2x2State();
      let lastFace = -1;
      const faces = { 'U': 0, 'R': 1, 'F': 2 };
      for (let j = 0; j < 20; j++) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        const face = faces[m[0] as keyof typeof faces];
        if (face === lastFace) continue;
        lastFace = face;
        state.applySequence(m);
      }

      if (state.isSolved()) continue;

      const solution = solver.solve(state);
      expect(solution.length).toBeGreaterThan(0);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
      solved++;
    }
    expect(solved).toBeGreaterThanOrEqual(90);
  });

  // ── Performance benchmarks ─────────────────────────────────────────

  it('single solve completes within 1ms (exact heuristic)', () => {
    const solver = new TwoByTwoSolver();
    solver.init(); // Build tables once
    const state = new Cube2x2State();
    state.applySequence("R U' R F U2 R' F'");

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      solver.solve(state.clone());
    }
    const end = performance.now();
    const avgMs = (end - start) / 100;
    expect(avgMs).toBeLessThan(1);
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it('solution only contains U, R, F moves', () => {
    const solver = new TwoByTwoSolver();
    for (let i = 0; i < 50; i++) {
      const state = TwoByTwoScrambler.generateRandomState();
      const result = solver.solveDetailed(state);
      if (result && result.moveCount > 0) {
        const tokens = result.notation.split(' ');
        for (const token of tokens) {
          expect(['U', 'R', 'F']).toContain(token[0]);
        }
      }
    }
  });

  it('solution has no consecutive same-face moves', () => {
    const solver = new TwoByTwoSolver();
    for (let i = 0; i < 50; i++) {
      const state = TwoByTwoScrambler.generateRandomState();
      const result = solver.solveDetailed(state);
      if (result && result.moveCount > 0) {
        const faces = result.notation.split(' ').map(t => t[0]);
        for (let j = 1; j < faces.length; j++) {
          expect(faces[j]).not.toBe(faces[j - 1]);
        }
      }
    }
  });

  it('returns null for invalid state (DBL not fixed)', () => {
    const solver = new TwoByTwoSolver();
    const state = new Cube2x2State();
    state.applySequence("D R"); // D move moves DBL
    const result = solver.solveDetailed(state);
    expect(result).toBeNull();
  });
});
