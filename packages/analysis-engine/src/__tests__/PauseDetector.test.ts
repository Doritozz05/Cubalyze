import { describe, it, expect } from 'vitest';
import { PauseDetector } from '../metrics/PauseDetector';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { makeMoves } from './test-helpers';

describe('PauseDetector', () => {
  it('returns no pauses for empty timeline', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.totalCount).toBe(0);
    expect(pauses.totalPauseTimeMs).toBe(0);
    expect(pauses.pauses).toEqual([]);
  });

  it('returns no pauses for 1 move', () => {
    const moves = makeMoves("R", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.totalCount).toBe(0);
  });

  it('detects a pause when gap exceeds threshold', () => {
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 1700, hostTimestamp: 1700 }, // 700ms gap - 100ms turn = 600ms pause
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.totalCount).toBe(1);
    expect(pauses.pauses[0].durationMs).toBeGreaterThanOrEqual(500);
  });

  it('does not detect pause for small gaps', () => {
    const moves = makeMoves("R U R' U'", 1000, 100); // 100ms gaps
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.totalCount).toBe(0);
  });

  it('respects custom threshold', () => {
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 1200, hostTimestamp: 1200 }, // 200ms gap
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    // With low threshold (100ms), 200ms gap should be detected
    const pauses = PauseDetector.detect(timeline, 100);
    expect(pauses.totalCount).toBe(1);

    // With high threshold (500ms), 200ms gap should NOT be detected
    const pauses2 = PauseDetector.detect(timeline, 500);
    expect(pauses2.totalCount).toBe(0);
  });

  it('computes max and avg duration', () => {
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 2000, hostTimestamp: 2000 }, // 1000ms gap
      { face: 'R' as const, direction: -1 as const, cubeTimestamp: 3000, hostTimestamp: 3000 }, // 1000ms gap
      { face: 'U' as const, direction: -1 as const, cubeTimestamp: 3600, hostTimestamp: 3600 }, // 600ms gap
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.totalCount).toBe(3);
    expect(pauses.maxDurationMs).toBeGreaterThanOrEqual(900); // ~900ms (1000 - 100 turn)
    expect(pauses.avgDurationMs).toBeGreaterThan(0);
  });

  it('computes pauseRatio correctly', () => {
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 2000, hostTimestamp: 2000 }, // 1000ms gap
      { face: 'R' as const, direction: -1 as const, cubeTimestamp: 2100, hostTimestamp: 2100 }, // 100ms gap
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const pauses = PauseDetector.detect(timeline);

    expect(pauses.pauseRatio).toBeGreaterThan(0);
    expect(pauses.pauseRatio).toBeLessThanOrEqual(1);
  });

  it('classifies pause category based on phase context', () => {
    // Build a timeline with phases annotated via PhaseSplitter
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const tPerm2 = `${tPerm} ${tPerm}`;
    const moves = makeMoves(tPerm2);
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    // Inject a large gap between entries to create a detectable pause
    timeline.entries[5].hostTimestamp = timeline.entries[4].hostTimestamp + 2000;

    const pauses = PauseDetector.detect(timeline);

    // Should detect at least one pause
    expect(pauses.totalCount).toBeGreaterThanOrEqual(1);
    // All pauses should have a valid category
    for (const p of pauses.pauses) {
      expect(['mid-phase', 'mid-algorithm', 'recognition']).toContain(p.category);
    }
  });

  it('longPauses filters pauses >= 1500ms', () => {
    const metrics = {
      totalCount: 3,
      maxDurationMs: 2000,
      avgDurationMs: 1000,
      byPhase: {},
      totalPauseTimeMs: 3000,
      pauseRatio: 0.5,
      pauses: [
        { startIndex: 0, endIndex: 1, durationMs: 2000, phase: 'Cross', category: 'mid-phase' as const },
        { startIndex: 2, endIndex: 3, durationMs: 800, phase: 'F2L', category: 'mid-phase' as const },
        { startIndex: 4, endIndex: 5, durationMs: 1600, phase: 'OLL', category: 'mid-phase' as const },
      ],
    };

    const long = PauseDetector.longPauses(metrics);
    expect(long).toHaveLength(2);
    expect(long.every(p => p.durationMs >= 1500)).toBe(true);
  });

  it('criticalPauses filters pauses >= 3000ms', () => {
    const metrics = {
      totalCount: 2,
      maxDurationMs: 3500,
      avgDurationMs: 2250,
      byPhase: {},
      totalPauseTimeMs: 4500,
      pauseRatio: 0.6,
      pauses: [
        { startIndex: 0, endIndex: 1, durationMs: 3500, phase: 'Cross', category: 'mid-phase' as const },
        { startIndex: 2, endIndex: 3, durationMs: 1000, phase: 'F2L', category: 'mid-phase' as const },
      ],
    };

    const critical = PauseDetector.criticalPauses(metrics);
    expect(critical).toHaveLength(1);
    expect(critical[0].durationMs).toBe(3500);
  });
});
