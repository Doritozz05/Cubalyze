import { describe, expect, it } from 'vitest';
import { CFOPDefinition } from '@cubeforge/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { PauseDetector } from '../metrics/PauseDetector';
import { makeMoves, makeSolveFromScramble, TEST_SCRAMBLES } from './test-helpers';

describe('Phase A hardening contracts', () => {
  it('does not let skipped phases overwrite the phase that owns a move', () => {
    // Starting from solved, a U move leaves Cross/F2L/OLL complete while PLL
    // is not fully solved. F2L and OLL are therefore zero-move skips.
    const timeline = TimelineBuilder.build(makeMoves('U'), 'CFOP');

    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    const skipped = timeline.phases.filter((phase) => phase.skipped);
    expect(skipped.length).toBeGreaterThan(0);
    expect(timeline.entries[0].phaseName).toBe('Cross');
    expect(timeline.entries[0].phaseId).toBe(0);
    expect(skipped.every((phase) => phase.moveCount === 0)).toBe(true);
  });

  it('uses authoritative solveTimeMs and propagates the detection report', async () => {
    const timeline = TimelineBuilder.build(makeMoves("R U R' U'"), 'CFOP');
    timeline.solveTimeMs = 5000;
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    const metrics = await MetricsAggregator.computeAll(timeline, '');

    expect(metrics.totalTimeMs).toBe(5000);
    expect(metrics.detectionReport).toBe(timeline.detectionReport);
    expect(metrics.detectionReport?.solveTimeMs).toBe(5000);

    const core = MetricsAggregator.computeCore(timeline);
    expect(core.totalTimeMs).toBe(5000);
    expect(core.detectionReport).toBe(timeline.detectionReport);
  });

  it('reports non-finite timestamps without producing non-finite pause metrics', () => {
    const timeline = TimelineBuilder.build(makeMoves("R U R' U'"), 'CFOP');
    timeline.entries[1].hostTimestamp = Number.NaN;

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition);
    expect(report.warnings).toContain('non-finite-timestamps');
    expect(report.confidence).toBe('invalid');

    const pauses = PauseDetector.detect(timeline);
    expect(Number.isFinite(pauses.totalPauseTimeMs)).toBe(true);
    expect(Number.isFinite(pauses.pauseRatio)).toBe(true);
    expect(pauses.pauseRatio).toBeLessThanOrEqual(1);
  });

  it('clamps pauseRatio when event gaps exceed the authoritative timer duration', () => {
    const timeline = TimelineBuilder.build([
      { face: 'R', direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: 'U', direction: 1, cubeTimestamp: 2000, hostTimestamp: 2000 },
    ], 'CFOP');
    timeline.solveTimeMs = 100;

    const pauses = PauseDetector.detect(timeline, 0);

    expect(pauses.totalPauseTimeMs).toBe(1900);
    expect(pauses.pauseRatio).toBe(1);
  });

  it('does not emit scramble-only-seed for a scramble-seeded timeline', () => {
    const { scramble, solveMoves } = makeSolveFromScramble('R U R\' U\'');
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition);
    expect(report.initialStateSource).toBe('scramble');
    expect(report.warnings).not.toContain('scramble-only-seed');
  });

  it('does not emit unattributed-time when the timer duration exceeds the move span', () => {
    const { scramble, solveMoves } = makeSolveFromScramble(TEST_SCRAMBLES.tPerm);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const spanMs = timeline.endTimestamp - timeline.startTimestamp;
    // Timer lag: the stop fires after the last move (BLE facelet polling /
    // manual stop reaction), so the authoritative duration > move span.
    timeline.solveTimeMs = spanMs + 2000;
    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition);
    expect(report.complete).toBe(true);
    expect(report.solveTimeMs).toBe(spanMs + 2000);
    // Unattributed time is measured against the timeline span, NOT the timer:
    // the timer lag must not surface as a warning.
    expect(report.unattributedTimeMs ?? 0).toBeLessThan(1);
    expect(report.warnings).not.toContain('unattributed-time');
  });

  it('does not emit unattributed-time on an empty timeline', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition);
    expect(report.unattributedTimeMs).toBe(0);
    expect(report.warnings).not.toContain('unattributed-time');
  });
});
