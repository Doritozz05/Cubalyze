/**
 * Nivel 3 — Category 2: Cross-Package Integration Tests
 *
 * Tests complete end-to-end flows that span multiple packages,
 * simulating real-world usage: scramble → solve → analyze → persist.
 */
import { describe, it, expect } from 'vitest';
import { CubeState, Cube2x2State, Cube2x2FaceletConverter } from '@cubalyze/math-core';
import { Min2PhaseSolver, TwoByTwoSolver } from '@cubalyze/solver-engine';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { CFOPDefinition, RouxFullDefinition } from '@cubalyze/math-core';
import { makeSolveFromScramble, makeMoves } from './test-helpers';

// ═══════════════════════════════════════════════════════════════════════
//  I1: Full CFOP pipeline — scramble → solver → analysis
// ═══════════════════════════════════════════════════════════════════════

describe('I1 — Full CFOP pipeline: Scramble → Solve → Analyze (3×3)', { timeout: 30000 }, () => {
  const solver = new Min2PhaseSolver();

  it('T-Perm: full pipeline produces consistent metrics', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    expect(metrics.totalMoves).toBe(solveMoves.length);
    expect(metrics.totalTimeMs).toBeGreaterThan(0);
    expect(metrics.tps.global).toBeGreaterThan(0);
    expect(metrics.phases.length).toBeGreaterThan(0);
    expect(metrics.cfop).toBeDefined();
    expect(metrics.cfop!.crossMoves).toBeGreaterThan(0);
  });

  it('solver-generated solution is analyzable (solver → analysis pipeline)', async () => {
    const state = new CubeState();
    state.applySequence("D L B' R F U' D2 R2");
    const solution = solver.solve(state);
    expect(solution.length).toBeGreaterThan(0);

    const solveMoves = makeMoves(solution, 1000, 100);
    const scramble = "D L B' R F U' D2 R2";
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // The last entry's state is a CubeStateSnapshot (plain object).
    // Reconstruct into CubeState to check isSolved().
    const lastSnapshot = timeline.entries[timeline.entries.length - 1].state;
    const lastState = TimelineBuilder.fromSnapshot(lastSnapshot);
    expect(lastState.isSolved()).toBe(true);
    expect(metrics.totalMoves).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.tps.global)).toBe(true);
  });

  it('Roux method: full pipeline produces Roux-specific metrics', async () => {
    const scramble = "U' L' U L U F U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Roux', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, RouxFullDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    expect(metrics.roux).toBeDefined();
    expect(metrics.roux!.firstBlockMoves).toBeGreaterThan(0);
    expect(metrics.cfop).toBeUndefined();
  });

  it('multiple scrambles produce valid metrics consistently', async () => {
    const scrambles = [
      "R U R' U'",
      "R U R' U' R' F R F'",
      "F R U R' U' F'",
      "R U2 R' U' R U R' U' R U' R'",
    ];

    for (const scramble of scrambles) {
      const { solveMoves } = makeSolveFromScramble(scramble);
      const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      const metrics = await MetricsAggregator.computeAll(timeline, scramble);

      expect(metrics.totalMoves).toBe(solveMoves.length);
      expect(Number.isFinite(metrics.tps.global)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  I2: Full 2×2 pipeline — scramble → solver → analysis
// ═══════════════════════════════════════════════════════════════════════

describe('I2 — Full 2×2 pipeline', { timeout: 30000 }, () => {
  const solver2x2 = new TwoByTwoSolver();
  solver2x2.init();

  it('2×2 scramble → solve → facelet verification', () => {
    const state = new Cube2x2State();
    state.applySequence("U R F U2 R'");

    const solution = solver2x2.solve(state);
    expect(solution.length).toBeGreaterThan(0);

    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });

  it('2×2 facelet string pipeline: scramble → facelets → verify structure', () => {
    const state = new Cube2x2State();
    state.applySequence("U R F");

    const facelets = Cube2x2FaceletConverter.toFaceletString(state);
    expect(facelets.length).toBe(24);
    expect(facelets).toMatch(/^[URFDLB]{24}$/);

    const counts: Record<string, number> = {};
    for (const c of facelets) counts[c] = (counts[c] || 0) + 1;
    for (const color of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(counts[color]).toBe(4);
    }
  });

  it('2×2: multiple scrambles produce valid solves', () => {
    const scrambles = ["U R F U2 R'", "R2 U' F", "U R U' R'"];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);
      const solution = solver2x2.solve(state);
      expect(solution.length).toBeGreaterThan(0);
      state.applySequence(solution);
      expect(state.isSolved()).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  I7: Export → Import round-trip
// ═══════════════════════════════════════════════════════════════════════

describe('I7 — Solve data export/import round-trip', () => {
  it('solve with moves survives JSON round-trip', () => {
    const solve = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      timeMs: 12345,
      date: '2026-01-01T00:00:00.000Z',
      scramble: "R U R' U'",
      penalty: 'none' as const,
      method: 'CFOP',
      source: 'smart' as const,
      moves: [
        { face: 'R' as const, direction: -1 as const, cubeTimestamp: 100, hostTimestamp: 110 },
        { face: 'U' as const, direction: 1 as const, cubeTimestamp: 200, hostTimestamp: 215 },
        { face: 'R' as const, direction: 1 as const, cubeTimestamp: 300, hostTimestamp: 320 },
        { face: 'U' as const, direction: -1 as const, cubeTimestamp: 400, hostTimestamp: 425 },
      ],
      puzzleType: '333',
    };

    const json = JSON.stringify(solve);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe(solve.id);
    expect(parsed.timeMs).toBe(solve.timeMs);
    expect(parsed.scramble).toBe(solve.scramble);
    expect(parsed.method).toBe('CFOP');
    expect(parsed.source).toBe('smart');
    expect(parsed.moves).toHaveLength(4);
    expect(parsed.moves[0].face).toBe('R');
    expect(parsed.moves[0].direction).toBe(-1);
  });

  it('solve with analysis field survives JSON round-trip', () => {
    const solve = {
      id: 's1', sessionId: 'ses1', timeMs: 5000,
      date: '2026-01-01T00:00:00.000Z', scramble: 'U R F',
      penalty: 'none' as const, source: 'manual' as const,
      moves: [],
      analysis: JSON.stringify({ phases: [{ name: 'Cross', durationMs: 500 }] }),
      puzzleType: '333',
    };

    const json = JSON.stringify(solve);
    const parsed = JSON.parse(json);
    expect(parsed.analysis).toBe(solve.analysis);
    const analysisObj = JSON.parse(parsed.analysis);
    expect(analysisObj.phases[0].name).toBe('Cross');
  });

  it('solve with orientationTimeline survives JSON round-trip', () => {
    const solve = {
      id: 's2', sessionId: 'ses2', timeMs: 3000,
      date: '2026-01-01T00:00:00.000Z', scramble: 'U',
      penalty: 'none' as const, source: 'smart' as const,
      moves: [],
      orientationTimeline: [[0, 0], [5, 3], [15, 7]] as [number, number][],
      puzzleType: '333',
    };

    const json = JSON.stringify(solve);
    const parsed = JSON.parse(json);
    expect(parsed.orientationTimeline).toEqual([[0, 0], [5, 3], [15, 7]]);
  });

  it('batch of 50 solves survives JSON round-trip', () => {
    const solves = [];
    for (let i = 0; i < 50; i++) {
      solves.push({
        id: `s${i}`, sessionId: 'ses1', timeMs: 1000 + i * 100,
        date: new Date(2026, 0, 1, 0, 0, 0, i * 1000).toISOString(),
        scramble: `U${i % 2 === 0 ? '' : "'"} R${i % 3 === 0 ? '2' : ''}`,
        penalty: 'none' as const, source: 'manual' as const, moves: [], puzzleType: '333',
      });
    }

    const json = JSON.stringify(solves);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(50);
    expect(parsed[49].timeMs).toBe(5900);
  });
});
