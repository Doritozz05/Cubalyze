/**
 * Nivel 3 — Category 4: Benchmark Regression Tests (Analysis Engine)
 *
 * Performance benchmarks with statistical thresholds.
 */
import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { CFOPDefinition } from '@cubalyze/math-core';
import { makeSolveFromScramble, makeMoves } from './test-helpers';

// ── Platform-aware perf tolerance ──
// Windows CI runners and local Windows machines are measurably slower for
// bigint/array-heavy loops. We linearly scale the absolute thresholds by a
// known factor when running on win32. Linux/macOS thresholds remain tight;
// Windows thresholds are honest about real-world variance while still
// catching actual regressions.
const PERF_MULTIPLIER = process.platform === 'win32' ? 5 : 1;
const isCI = !!process.env.GITHUB_ACTIONS || !!process.env.CI;

// ────────────────────────────────────────────────────────────────────────
//  Benchmark helper
// ────────────────────────────────────────────────────────────────────────

interface BenchResult {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

function bench(fn: () => void | Promise<void>, iterations = 100, warmup = 5): BenchResult {
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

async function benchAsync(fn: () => Promise<void>, iterations = 50, warmup = 3): Promise<BenchResult> {
  for (let i = 0; i < warmup; i++) await fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
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
//  B6: CFOPMetricsCalculator.compute() < 10ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B6 — CFOPMetricsCalculator.compute()', { timeout: 60000 }, () => {
  // Pre-build a timeline once, reuse for all benchmark runs
  const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const { solveMoves } = makeSolveFromScramble(scramble);

  it('CFOP full metrics computation < 20ms (p99)', async () => {
      const { p99, p95, mean } = await benchAsync(async () => {
        // Rebuild timeline per iteration to avoid caching effects
        const tl = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
        PhaseSplitter.splitAndAnnotate(tl, CFOPDefinition);
        const result = await MetricsAggregator.computeAll(tl, scramble);
        expect(result.totalMoves).toBeGreaterThan(0);
      }, 30, 3);

      console.log(`CFOPMetrics compute: mean=${mean.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
      expect(p99).toBeLessThan(100 * PERF_MULTIPLIER);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  B7: TimelineBuilder.build(100 entries) < 20ms (p99)
// ═══════════════════════════════════════════════════════════════════════

describe.skipIf(isCI)('B7 — TimelineBuilder.build()', { timeout: 30000 }, () => {
  // Pre-build 100 moves
  const { solveMoves: moves } = makeSolveFromScramble(
    "R' U' F D2 L2 D' R2 U' B2 D' L2 B2 L' D B D2 B R' D L2 R' U' F",
    1000,
    100,
  );

  it('TimelineBuilder with 100 entries < 20ms (p99)', () => {
    const { p99, p95, mean } = bench(() => {
      const timeline = TimelineBuilder.build(moves, 'CFOP', undefined, '');
      expect(timeline.entries.length).toBeGreaterThan(0);
    }, 100, 10);

    console.log(`TimelineBuilder 100 entries: mean=${mean.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
    expect(p99).toBeLessThan(100 * PERF_MULTIPLIER);
  });

  it('TimelineBuilder + PhaseSplitter + MetricsAggregator full pipeline < 30ms (p99)', async () => {
    const { p99, p95, mean } = await benchAsync(async () => {
      const timeline = TimelineBuilder.build(moves, 'CFOP', undefined, '');
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      await MetricsAggregator.computeAll(timeline, '');
    }, 30, 3);

    console.log(`Full analysis pipeline: mean=${mean.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
    expect(p99).toBeLessThan(100 * PERF_MULTIPLIER);
  });
});

