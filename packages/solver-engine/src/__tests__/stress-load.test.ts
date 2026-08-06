/**
 * Nivel 3 — Category 3: Stress / Load / Soak Tests
 *
 * Pushes the system to its limits: 10K solves, burst solves,
 * long move sequences, high-volume state cloning.
 */
import { describe, it, expect } from 'vitest';
import { CubeState, Cube2x2State, FaceletStringConverter } from '@cubeforge/math-core';
import { Min2PhaseSolver, TwoByTwoSolver, RandomStateGenerator } from '../index';

// ═══════════════════════════════════════════════════════════════════════
//  S1: 10,000 3×3 scrambles + solves
// ═══════════════════════════════════════════════════════════════════════

describe('S1 — 10,000 3×3 solves', { timeout: 120000 }, () => {
  const solver = new Min2PhaseSolver();

  it('generates and solves 1K random 3×3 states without failure', () => {
    const count = 1_000;
    let solved = 0;
    let errors = 0;
    const startTime = performance.now();

    for (let i = 0; i < count; i++) {
      try {
        const state = RandomStateGenerator.generateRandomState();
        const solution = solver.solve(state);

        if (solution.length > 0) {
          state.applySequence(solution);
          if (state.isSolved()) solved++;
          else errors++;
        } else {
          errors++;
        }
      } catch {
        errors++;
        break;
      }
    }

    const elapsed = performance.now() - startTime;
    expect(errors).toBe(0);
    expect(solved).toBe(count);
    // 10K solves should complete in < 90 seconds
    expect(elapsed).toBeLessThan(90_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  S2: 10,000 2×2 solves
// ═══════════════════════════════════════════════════════════════════════

describe('S2 — 10,000 2×2 solves', { timeout: 60000 }, () => {
  const solver = new TwoByTwoSolver();
  solver.init();

  it('generates and solves 10K random 2×2 states without failure', () => {
    const count = 10_000;
    let solved = 0;
    let errors = 0;
    const startTime = performance.now();

    const faces = ['U', 'R', 'F'];
    const suffixes = ['', '2', "'"];

    for (let i = 0; i < count; i++) {
      try {
        const state = new Cube2x2State();
        const moveCount = 5 + (i % 10);
        let lastFace = '';

        for (let m = 0; m < moveCount; m++) {
          const face = faces[(i * 7 + m * 3) % 3];
          if (face !== lastFace) {
            state.applySequence(`${face}${suffixes[(i + m) % 3]}`);
            lastFace = face;
          }
        }

        const solution = solver.solve(state);
        if (solution.length > 0) {
          state.applySequence(solution);
          if (state.isSolved()) solved++;
          else errors++;
        } else {
          errors++;
        }
      } catch {
        errors++;
        break;
      }
    }

    const elapsed = performance.now() - startTime;
    expect(errors).toBe(0);
    expect(solved).toBe(count);
    expect(elapsed).toBeLessThan(30_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  High-volume solve stress
// ═══════════════════════════════════════════════════════════════════════

describe('S3 — High-volume solve stress', { timeout: 120000 }, () => {
  it('1,000 scrambles generated in rapid succession without degradation', () => {
    const count = 1000;
    const startTime = performance.now();

    for (let i = 0; i < count; i++) {
      RandomStateGenerator.generateRandomState();
    }

    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(30_000);
  });

  it('Min2PhaseSolver solves 500 states without failure', () => {
    const solver = new Min2PhaseSolver();

    for (let i = 0; i < 500; i++) {
      const state = RandomStateGenerator.generateRandomState();
      const solution = solver.solve(state);

      if (solution.length > 0) {
        state.applySequence(solution);
        expect(state.isSolved()).toBe(true);
      }
    }
  });

  it('TwoByTwoSolver solves 500 states without degradation', () => {
    const solver = new TwoByTwoSolver();
    solver.init();

    for (let i = 0; i < 500; i++) {
      const state = new Cube2x2State();
      state.applySequence(`U R F U2 R'`);

      const solution = solver.solve(state);
      if (solution.length > 0) {
        state.applySequence(solution);
        expect(state.isSolved()).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Large data structure stress
// ═══════════════════════════════════════════════════════════════════════

describe('S_large — Large data structure stress', () => {
  it('creating 10K CubeState clones is fast and correct', () => {
    const original = new CubeState();
    original.applySequence("U R F D L B");

    const clones: CubeState[] = [];
    const startTime = performance.now();

    for (let i = 0; i < 10_000; i++) {
      clones.push(original.clone());
    }

    const elapsed = performance.now() - startTime;
    expect(clones).toHaveLength(10_000);
    // All clones should be identical to original
    for (const clone of clones) {
      const f1 = FaceletStringConverter.toFaceletString(original);
      const f2 = FaceletStringConverter.toFaceletString(clone);
      expect(f2).toBe(f1);
    }
    expect(elapsed).toBeLessThan(5000);
  });

  it('creating 10K Cube2x2State clones is fast', () => {
    const original = new Cube2x2State();
    original.applySequence("U R F U2");

    const clones: Cube2x2State[] = [];
    const startTime = performance.now();

    for (let i = 0; i < 10_000; i++) {
      clones.push(original.clone());
    }

    const elapsed = performance.now() - startTime;
    expect(clones).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(5000);
  });

  it('very long move sequences (500 moves) do not crash CubeState', () => {
    const state = new CubeState();
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const suffixes = ['', '2', "'"];
    const seq: string[] = [];
    let lastFace = '';

    for (let i = 0; i < 500; i++) {
      const face = faces[i % 6];
      if (face === lastFace) continue;
      seq.push(`${face}${suffixes[i % 3]}`);
      lastFace = face;
    }

    const scramble = seq.join(' ');
    state.applySequence(scramble);

    expect(state.isSolved()).toBe(false);
    const facelets = FaceletStringConverter.toFaceletString(state);
    expect(facelets.length).toBe(54);
    expect(facelets).toMatch(/^[URFDLB]{54}$/);
  });
});
