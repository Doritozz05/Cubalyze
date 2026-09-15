import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { CFOPDefinition, RouxFullDefinition } from '@cubalyze/math-core';
import { makeSolveFromScramble, makeMoves, inverseScramble } from './test-helpers';

/**
 * End-to-end pipeline tests.
 *
 * These tests validate the FULL pipeline:
 *   Scramble → TimelineBuilder → PhaseSplitter → MetricsAggregator → SolveMetrics
 *
 * This is the critical path from Smart Cube moves to UI-displayed metrics.
 */
describe('Pipeline — End-to-End', () => {
  // ── Full CFOP pipeline ──────────────────────────────────────────────────

  it('CFOP: full pipeline produces non-empty phases with valid metrics', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // Step 1: Build timeline from scrambled state
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    // Step 2: Phase detection
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    // Step 3: Compute all metrics
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // Verify structural integrity
    expect(metrics.totalTimeMs).toBeGreaterThan(0);
    expect(metrics.totalMoves).toBe(solveMoves.length);
    expect(metrics.solveId).toBe('');

    // Phase metrics must exist
    expect(metrics.phases.length).toBeGreaterThan(0);
    for (const phase of metrics.phases) {
      expect(phase.phaseName).toBeTruthy();
      if (phase.skipped) {
        expect(phase.durationMs).toBe(0);
        expect(phase.moveCount).toBe(0);
        expect(phase.tps).toBe(0);
      } else {
        expect(phase.durationMs).toBeGreaterThan(0);
        expect(phase.moveCount).toBeGreaterThan(0);
        expect(phase.tps).toBeGreaterThanOrEqual(0);
      }
    }

    // Core metrics must exist
    expect(metrics.tps).toBeDefined();
    expect(metrics.tps.global).toBeGreaterThan(0);
    expect(metrics.pauses).toBeDefined();
    expect(metrics.fluidity).toBeDefined();
    expect(metrics.rotation).toBeDefined();
    expect(metrics.efficiency).toBeDefined();

    // CFOP-specific metrics must exist
    expect(metrics.cfop).toBeDefined();
    expect(metrics.cfop!.crossEfficiency).toBeGreaterThan(0);
    expect(metrics.cfop!.crossMoves).toBeGreaterThan(0);
  });

  it('CFOP: phase metrics have correct phase names', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    const phaseNames = metrics.phases.map((p) => p.phaseName);
    expect(phaseNames).toContain('Cross');
  });

  it('CFOP: metrics structure is complete (all fields present)', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // Verify every expected field exists on the metrics object
    expect(metrics).toHaveProperty('solveId');
    expect(metrics).toHaveProperty('totalTimeMs');
    expect(metrics).toHaveProperty('totalMoves');
    expect(metrics).toHaveProperty('phases');
    expect(metrics).toHaveProperty('tps');
    expect(metrics).toHaveProperty('pauses');
    expect(metrics).toHaveProperty('fluidity');
    expect(metrics).toHaveProperty('efficiency');
    expect(metrics).toHaveProperty('rotation');
    expect(metrics).toHaveProperty('redundancy');
    expect(metrics).toHaveProperty('cfop');
    expect(metrics).toHaveProperty('roux');

    // TPS sub-fields
    expect(metrics.tps).toHaveProperty('global');
    expect(metrics.tps).toHaveProperty('effective');
    expect(metrics.tps).toHaveProperty('byPhase');
    expect(metrics.tps).toHaveProperty('peakInstantaneous');

    // Pause sub-fields
    expect(metrics.pauses).toHaveProperty('totalCount');
    expect(metrics.pauses).toHaveProperty('maxDurationMs');
    expect(metrics.pauses).toHaveProperty('totalPauseTimeMs');
    expect(metrics.pauses).toHaveProperty('pauseRatio');
    expect(metrics.pauses).toHaveProperty('pauses');

    // CFOP sub-fields
    expect(metrics.cfop!).toHaveProperty('crossEfficiency');
    expect(metrics.cfop!).toHaveProperty('crossToF2LTransitionMs');
    expect(metrics.cfop!).toHaveProperty('crossMoves');
    expect(metrics.cfop!).toHaveProperty('crossTPS');
    expect(metrics.cfop!).toHaveProperty('f2lPairs');
    expect(metrics.cfop!).toHaveProperty('f2lLookaheadScore');
    expect(metrics.cfop!).toHaveProperty('ollRecognitionMs');
    expect(metrics.cfop!).toHaveProperty('ollExecutionMs');
    expect(metrics.cfop!).toHaveProperty('ollTPS');
    expect(metrics.cfop!).toHaveProperty('pllRecognitionMs');
    expect(metrics.cfop!).toHaveProperty('pllExecutionMs');
    expect(metrics.cfop!).toHaveProperty('pllTPS');
  });

  // ── Roux pipeline ───────────────────────────────────────────────────────

  it('Roux: full pipeline produces Roux-specific metrics', async () => {
    const scramble = "U' L' U L U F U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Roux', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, RouxFullDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // Roux metrics should be populated, CFOP should be undefined
    expect(metrics.roux).toBeDefined();
    expect(metrics.cfop).toBeUndefined();
    expect(metrics.roux!).toHaveProperty('firstBlockMoves');
    expect(metrics.roux!).toHaveProperty('firstBlockTPS');
    expect(metrics.roux!).toHaveProperty('firstBlockEfficiency');
  });

  // ── Pipeline stability ──────────────────────────────────────────────────

  it('same input produces identical output (idempotent)', async () => {
    const scramble = "R U R' U'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const run = async () => {
      const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      return await MetricsAggregator.computeAll(timeline, scramble);
    };

    const result1 = await run();
    const result2 = await run();

    expect(result1).toEqual(result2);
  });

  it('pipeline handles varying move counts', async () => {
    const scrambles = [
      'R U',
      "R U R' U'",
      "R U R' U' R' F R F'",
    ];

    for (const scramble of scrambles) {
      const { solveMoves } = makeSolveFromScramble(scramble);
      const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      const metrics = await MetricsAggregator.computeAll(timeline, scramble);

      expect(metrics.totalMoves).toBe(solveMoves.length);
      expect(metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('efficiency metrics use the provided scramble', async () => {
    const scramble = "R U R' U'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // EfficiencyCalculator uses the scramble to compute optimal move count
    expect(metrics.efficiency).toBeDefined();
    expect(metrics.efficiency!.moveEfficiencyRatio).toBeGreaterThan(0);
    expect(metrics.efficiency!.optimalMoveCount).toBeGreaterThan(0);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('empty moves produces valid empty metrics', async () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalTimeMs).toBe(0);
    expect(metrics.totalMoves).toBe(0);
    expect(metrics.phases).toEqual([]);
    expect(metrics.tps.global).toBe(0);
    // With method='CFOP', CFOPMetricsCalculator returns default (all-zeros) object
    // rather than undefined, because the method check passes even with empty moves
    expect(metrics.cfop).toBeDefined();
    expect(metrics.roux).toBeUndefined();
  });

  it('scramble with no solve moves produces empty timeline', async () => {
    const timeline = TimelineBuilder.build([], 'CFOP', undefined, 'R U');
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalMoves).toBe(0);
    expect(metrics.phases).toEqual([]);
  });

  // ── Inverse scramble correctness ────────────────────────────────────────

  it('inverseScramble correctly inverts move sequences', () => {
    expect(inverseScramble("R U")).toBe("U' R'");
    expect(inverseScramble("R U R' U'")).toBe("U R U' R'");
    expect(inverseScramble("R2 U")).toBe("U' R2");
    expect(inverseScramble("R' U2 F")).toBe("F' U2 R");
  });

  it('applying inverse after scramble returns to solved', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    // The last entry's state should be solved (all pieces in correct positions)
    const lastState = timeline.entries[timeline.entries.length - 1].state;
    for (let i = 0; i < 8; i++) {
      expect(lastState.cp[i]).toBe(i);
      expect(lastState.co[i]).toBe(0);
    }
    for (let i = 0; i < 12; i++) {
      expect(lastState.ep[i]).toBe(i);
      expect(lastState.eo[i]).toBe(0);
    }
  });

  // ── Real-world simulation ──────────────────────────────────────────────

  it('simulates a complete CFOP solve with realistic move count', async () => {
    // A more complex scramble — typical CFOP solve
    const scramble = "R' U' F D2 L2 D' R2 U' B2 D' L2 B2 L' D B D2 B R' D L2 R' U' F";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // This would fail if the pipeline couldn't handle longer sequences
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    expect(timeline.entries.length).toBeGreaterThan(0);
    // Start timestamp should be before end timestamp
    expect(timeline.startTimestamp).toBeLessThanOrEqual(timeline.endTimestamp);

    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // Basic sanity checks
    expect(metrics.totalMoves).toBeGreaterThan(0);
    expect(metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(metrics.phases.length).toBeGreaterThan(0);
  });
});
