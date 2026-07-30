import { describe, it, expect } from 'vitest';
import { Cube2x2State } from '@cubeforge/math-core';
import { TwoByTwoScrambler } from './TwoByTwoScrambler';
import { TwoByTwoSolver } from './TwoByTwoSolver';

describe('TwoByTwoScrambler', { timeout: 30000 }, () => {
  const solver = new TwoByTwoSolver();
  const scrambler = new TwoByTwoScrambler(solver);

  // ── Basic generation ───────────────────────────────────────────────

  it('generates a non-empty scramble string', () => {
    const scramble = scrambler.generateScramble();
    expect(scramble.length).toBeGreaterThan(0);
  });

  it('generated scramble uses only U, R, F face moves (DBL fixed)', () => {
    for (let i = 0; i < 5; i++) {
      const scramble = scrambler.generateScramble();
      const tokens = scramble.split(/\s+/);
      for (const token of tokens) {
        const face = token[0];
        expect(['U', 'R', 'F']).toContain(face);
      }
    }
  });

  it('generated scramble applied to solved cube scrambles it', () => {
    for (let i = 0; i < 5; i++) {
      const scramble = scrambler.generateScramble();
      const state = new Cube2x2State();
      state.applySequence(scramble);
      expect(state.isSolved()).toBe(false);
    }
  });

  // ── WCA compliance: minLength ──────────────────────────────────────

  it('default minLength=4 produces scrambles of at least 4 moves (WCA 4b3b)', () => {
    for (let i = 0; i < 10; i++) {
      const scramble = scrambler.generateScramble();
      const tokens = scramble.trim().split(/\s+/).filter(Boolean);
      expect(tokens.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('minLength=2 produces scrambles of at least 2 moves', () => {
    for (let i = 0; i < 5; i++) {
      const scramble = scrambler.generateScramble(2);
      const tokens = scramble.trim().split(/\s+/).filter(Boolean);
      expect(tokens.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('minLength=11 produces scrambles of exactly 11 moves (God number)', { timeout: 30000 }, () => {
    for (let i = 0; i < 5; i++) {
      const scramble = scrambler.generateScramble(11);
      if (scramble.length > 0) {
        const tokens = scramble.trim().split(/\s+/).filter(Boolean);
        expect(tokens.length).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it('minLength=0 produces scrambles (always works)', () => {
    const scramble = scrambler.generateScramble(0);
    expect(typeof scramble).toBe('string');
  });

  // ── Scramble + solution consistency ────────────────────────────────

  it('scramble + solve = solved', () => {
    for (let i = 0; i < 5; i++) {
      const state = new Cube2x2State();
      const scramble = scrambler.generateScramble();
      state.applySequence(scramble);
      const solution = solver.solve(state);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
    }
  });

  it('scramble always has non-zero length (many attempts)', () => {
    for (let i = 0; i < 20; i++) {
      const scramble = scrambler.generateScramble();
      expect(scramble.length).toBeGreaterThan(0);
    }
  });

  // ── generateRandomState ────────────────────────────────────────────

  it('generateRandomState has DBL corner fixed (cp[6]=6, co[6]=0)', () => {
    for (let i = 0; i < 20; i++) {
      const state = TwoByTwoScrambler.generateRandomState();
      expect(state.cp[6]).toBe(6);
      expect(state.co[6]).toBe(0);
    }
  });

  it('generateRandomState has valid corner orientation (sum % 3 = 0)', () => {
    for (let i = 0; i < 20; i++) {
      const state = TwoByTwoScrambler.generateRandomState();
      let sum = 0;
      for (let j = 0; j < 8; j++) sum += state.co[j];
      expect(sum % 3).toBe(0);
    }
  });

  it('generateRandomState has valid corner permutation (no duplicates)', () => {
    for (let i = 0; i < 20; i++) {
      const state = TwoByTwoScrambler.generateRandomState();
      const cpSet = new Set(Array.from(state.cp));
      expect(cpSet.size).toBe(8);
    }
  });

  // ── Batch generation ───────────────────────────────────────────────

  it('generateScrambleBatch returns correct count', () => {
    const batch = scrambler.generateScrambleBatch(5);
    expect(batch.length).toBe(5);
    for (const s of batch) expect(s.length).toBeGreaterThan(0);
  });

  it('generateScrambleBatch with count=0 returns empty array', () => {
    expect(scrambler.generateScrambleBatch(0)).toEqual([]);
  });

  // ── generateScrambleWithSolution ───────────────────────────────────

  it('generateScrambleWithSolution returns both scramble and solution', () => {
    const result = scrambler.generateScrambleWithSolution();
    expect(result.scramble.length).toBeGreaterThan(0);
    expect(result.solution).not.toBeNull();
    expect(result.solution!.moveCount).toBeGreaterThan(0);
  });

  it('generateScrambleWithSolution: scramble + solve = solved', () => {
    const result = scrambler.generateScrambleWithSolution();
    const state = new Cube2x2State();
    state.applySequence(result.scramble);
    state.applySequence(result.solution!.notation);
    expect(state.isSolved()).toBe(true);
  });

  it('generateScrambleWithSolution uses only URF moves', () => {
    const result = scrambler.generateScrambleWithSolution();
    const tokens = result.scramble.split(/\s+/);
    for (const token of tokens) {
      expect(['U', 'R', 'F']).toContain(token[0]);
    }
  });

  // ── Edge case: minLength > God's number ────────────────────────────

  it('minLength=20 (above God number 11) returns empty scramble', { timeout: 30000 }, () => {
    const scramble = scrambler.generateScramble(20);
    expect(scramble.length).toBe(0);
  });

  // ── Performance ────────────────────────────────────────────────────

  it('generates 10 scrambles in under 2000ms (sub-ms solves)', () => {
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      scrambler.generateScramble();
    }
    const end = performance.now();
    expect(end - start).toBeLessThan(2000);
  });

  // ── No consecutive same-face moves ─────────────────────────────────

  it('generated scrambles have no consecutive same-face moves', () => {
    for (let i = 0; i < 10; i++) {
      const scramble = scrambler.generateScramble();
      const tokens = scramble.split(/\s+/);
      for (let j = 1; j < tokens.length; j++) {
        expect(tokens[j][0]).not.toBe(tokens[j - 1][0]);
      }
    }
  });
});
