import { describe, it, expect } from 'vitest';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { CFOPDefinition } from '@cubeforge/math-core';
import { makeMoves } from './test-helpers';

describe('MetricsAggregator', () => {
  function buildAnnotatedTimeline(notation: string) {
    const moves = makeMoves(notation);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    return timeline;
  }

  it('returns default metrics for empty timeline', async () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalTimeMs).toBe(0);
    expect(metrics.totalMoves).toBe(0);
    expect(metrics.phases).toEqual([]);
    expect(metrics.tps.global).toBe(0);
  });

  it('computes totalMoves correctly', async () => {
    const timeline = buildAnnotatedTimeline("R U R' U'");
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalMoves).toBe(4);
  });

  it('computes totalTimeMs from timestamps', async () => {
    const moves = makeMoves("R U", 1000, 200);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalTimeMs).toBe(200);
  });

  it('computes TPS metrics', async () => {
    const moves = makeMoves("R U R' U'", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.tps.global).toBeGreaterThan(0);
    expect(metrics.tps.effective).toBeGreaterThan(0);
    expect(metrics.tps.peakInstantaneous).toBeGreaterThanOrEqual(metrics.tps.global);
  });

  it('computes pause metrics', async () => {
    const moves = [
      makeMoves("R U", 1000, 100)[0],
      makeMoves("R U", 1000, 100)[1],
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1800, hostTimestamp: 1800 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 1900, hostTimestamp: 1900 },
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.pauses.totalCount).toBeGreaterThanOrEqual(1);
    expect(metrics.pauses.maxDurationMs).toBeGreaterThan(0);
  });

  it('computes fluidity metrics', async () => {
    const timeline = buildAnnotatedTimeline("R U R' U' R U R' U'");
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.fluidity.stdDevMs).toBeGreaterThanOrEqual(0);
    expect(metrics.fluidity.coefficientOfVariation).toBeGreaterThanOrEqual(0);
  });

  it('computes efficiency metrics', async () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(`${tPerm} ${tPerm}`);
    const metrics = await MetricsAggregator.computeAll(timeline, tPerm);

    expect(metrics.efficiency).toBeDefined();
    expect(metrics.efficiency!.moveEfficiencyRatio).toBeGreaterThan(0);
    expect(metrics.efficiency!.optimalMoveCount).toBeGreaterThan(0);
  });

  it('computes rotation metrics', async () => {
    const timeline = buildAnnotatedTimeline("R U R' U'");
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.rotation).toBeDefined();
    expect(metrics.rotation!.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('computes phase-level metrics', async () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(`${tPerm} ${tPerm}`);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.phases.length).toBeGreaterThan(0);
    for (const phase of metrics.phases) {
      expect(phase.phaseName).toBeDefined();
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      if (phase.skipped) {
        expect(phase.moveCount).toBe(0);
        expect(phase.durationMs).toBe(0);
        expect(phase.tps).toBe(0);
      } else {
        expect(phase.moveCount).toBeGreaterThan(0);
        expect(phase.durationMs).toBeGreaterThan(0);
        expect(phase.tps).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('phase pause counts are populated from pauses', async () => {
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 1100, hostTimestamp: 1100 },
      { face: 'R' as const, direction: -1 as const, cubeTimestamp: 1800, hostTimestamp: 1800 },
      { face: 'U' as const, direction: -1 as const, cubeTimestamp: 1900, hostTimestamp: 1900 },
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    const hasPauses = metrics.phases.some(p => p.pauseCount > 0 || p.pauseTimeMs > 0);
    expect(hasPauses).toBe(true);
  });

  it('computeCore returns subset of metrics', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(`${tPerm} ${tPerm}`);
    const core = MetricsAggregator.computeCore(timeline);

    expect(core.totalTimeMs).toBeGreaterThan(0);
    expect(core.totalMoves).toBe(28);
    expect(core.tps.global).toBeGreaterThan(0);
    expect(core.pauses).toBeDefined();
    expect(core.fluidity).toBeDefined();
    expect(core.rotation).toBeDefined();
  });

  it('sets correct method for CFOP', async () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(`${tPerm} ${tPerm}`);
    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.cfop).toBeDefined();
    expect(metrics.roux).toBeUndefined();
  });
});
