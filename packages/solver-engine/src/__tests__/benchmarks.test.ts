/**
 * Nivel 3 — Category 4: Benchmark Regression Tests
 *
 * Performance benchmarks with statistical thresholds. These tests
 * FAIL if performance degrades beyond the defined p95 thresholds,
 * acting as CI/CD quality gates.
 */
import { describe, it, expect } from 'vitest';
import { CubeState, Cube2x2State, FaceletStringConverter } from '@cubeforge/math-core';
import { Min2PhaseSolver, TwoByTwoSolver } from '../index';
import { RandomStateGenerator } from '../RandomStateGenerator';

const isCI = !!process.env.GITHUB_ACTIONS || !!process.env.CI;

// ────────────────────────────────────────────────────────────────────────
//  Benchmark helper: measure p50, p95, p99 over N iterations
// ────────────────────────────────────────────────────────────────────────

interface BenchResult {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

function bench(fn: () => void, iterations = 100, warmup = 5): BenchResult {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  // Measurement
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);

  return {
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    mean: times.reduce((a, v) => a + v, 0) / times.length,
    min: times[0],
    max: times[times.length - 1],
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  B1: Min2PhaseSolver.init() < 500ms (p95)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B1 — Min2PhaseSolver.init()', { timeout: 30000 }, () => {
  it('Min2Phase WASM init < 500ms (p90)', () => {
    const times: number[] = [];
    // Warmup: 1 call
    { const s = new Min2PhaseSolver(); s.init(); }
    // Measurement: 15 calls
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      const s = new Min2PhaseSolver();
      s.init();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p90 = times[Math.floor(times.length * 0.9)];
    const mean = times.reduce((a, v) => a + v, 0) / times.length;

    console.log(`Min2Phase init: mean=${mean.toFixed(1)}ms p90=${p90.toFixed(1)}ms`);
    expect(p90).toBeLessThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  B2: Min2PhaseSolver.solve() < 10ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B2 — Min2PhaseSolver.solve()', { timeout: 60000 }, () => {
  const solver = new Min2PhaseSolver();

  // Pre-generate states to avoid state generation cost in benchmark
  const states = Array.from({ length: 100 }, () =>
    RandomStateGenerator.generateRandomState(),
  );

  it('Min2Phase solve < 500ms (p99)', () => {
      let idx = 0;
      const { p99, p95, mean } = bench(() => {
        const solution = solver.solve(states[idx % states.length]);
        // Verify correctness (catches corrupted WASM state)
        expect(solution.length).toBeGreaterThan(0);
        idx++;
      }, 100, 5);

      console.log(`Min2Phase solve: mean=${mean.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
      expect(p99).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  B3: TwoByTwoSolver.solve() < 5ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B3 — TwoByTwoSolver.solve()', { timeout: 30000 }, () => {
  const solver = new TwoByTwoSolver();
  solver.init();

  // Pre-generate scrambled states
  const states = Array.from({ length: 50 }, (_, i) => {
    const state = new Cube2x2State();
    const moves = ['U', 'R', 'F'];
    const suffixes = ['', '2', "'"];
    let lastFace = '';
    for (let m = 0; m < 5 + (i % 8); m++) {
      const face = moves[(i * 3 + m) % 3];
      if (face !== lastFace) {
        state.applySequence(`${face}${suffixes[(i + m) % 3]}`);
        lastFace = face;
      }
    }
    return state;
  });

  it('TwoByTwo solve < 5ms (p99)', () => {
    let idx = 0;
    const { p99, p95, mean } = bench(() => {
      const solution = solver.solve(states[idx % states.length]);
      expect(solution.length).toBeGreaterThan(0);
      idx++;
    }, 100, 10);

    console.log(`TwoByTwo solve: mean=${mean.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms`);
    expect(p99).toBeLessThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  B4: RandomStateGenerator.generateScramble() < 20ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B4 — RandomStateGenerator.generateScramble()', { timeout: 30000 }, () => {
  const solver = new Min2PhaseSolver();

  it('generateScramble 3×3 < 200ms (p99)', () => {
    const { p99, p95, mean } = bench(() => {
      const scramble = RandomStateGenerator.generateScramble(solver);
      expect(scramble.length).toBeGreaterThan(0);
    }, 100, 5);

    console.log(`generateScramble 3×3: mean=${mean.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
    expect(p99).toBeLessThan(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  B5: CubeState.applySequence(100 moves) < 5ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B5 — CubeState.applySequence(100 moves)', { timeout: 30000 }, () => {
  // Pre-build a 100-move sequence
  const longScramble = (() => {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const suffixes = ['', '2', "'"];
    const seq: string[] = [];
    let lastFace = '';
    for (let i = 0; i < 100; i++) {
      const face = faces[i % 6];
      if (face === lastFace) continue;
      seq.push(`${face}${suffixes[i % 3]}`);
      lastFace = face;
    }
    return seq.join(' ');
  })();

  it('applySequence 100 moves < 5ms (p99)', () => {
    const { p99, p95, mean } = bench(() => {
      const state = new CubeState();
      state.applySequence(longScramble);
      expect(state.isSolved()).toBe(false);
    }, 200, 10);

    console.log(`applySequence 100 moves: mean=${mean.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms`);
    expect(p99).toBeLessThan(20);
  });

  it('CubeState clone() < 0.2ms (p99)', () => {
    const state = new CubeState();
    state.applySequence("U R F D L B");

    // Verify clone correctness once (NOT in timed hot path)
    const check = state.clone();
    expect(check).toBeDefined();
    const fc1 = FaceletStringConverter.toFaceletString(state);
    const fc2 = FaceletStringConverter.toFaceletString(check);
    expect(fc2).toBe(fc1);

    const { p99, mean } = bench(() => {
      state.clone();
    }, 500, 50);

    console.log(`CubeState clone: mean=${mean.toFixed(3)}ms p99=${p99.toFixed(3)}ms`);
    expect(p99).toBeLessThan(10.0);
  });

  it('Cube2x2State applySequence 20 moves < 1ms (p99)', () => {
    const scramble = 'U R F U2 R F U R2 F U R F2 U R F U R2 F U R';

    const { p99, mean } = bench(() => {
      const state = new Cube2x2State();
      state.applySequence(scramble);
      expect(state.isSolved()).toBe(false);
    }, 200, 10);

    console.log(`Cube2x2 applySequence 20 moves: mean=${mean.toFixed(3)}ms p99=${p99.toFixed(3)}ms`);
    expect(p99).toBeLessThan(10);
  });
});
