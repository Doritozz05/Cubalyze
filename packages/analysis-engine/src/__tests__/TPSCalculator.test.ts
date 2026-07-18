import { describe, it, expect } from 'vitest';
import { TPSCalculator } from '../metrics/TPSCalculator';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { makeMoves } from './test-helpers';

describe('TPSCalculator', () => {
  it('returns zero for empty timeline', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const tps = TPSCalculator.compute(timeline, 0);

    expect(tps.global).toBe(0);
    expect(tps.effective).toBe(0);
    expect(tps.peakInstantaneous).toBe(0);
    expect(tps.byPhase).toEqual({});
  });

  it('computes global TPS correctly', () => {
    // 4 moves: timestamps 1000, 1100, 1200, 1300 → 300ms span
    // TPS = 4 / (300/1000) = 13.33
    const moves = makeMoves("R U R' U'", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const tps = TPSCalculator.compute(timeline, 0);

    expect(tps.global).toBe(13.33);
  });

  it('effective TPS excludes pause time', () => {
    // 4 moves in 400ms total, but 100ms pause
    const tps = TPSCalculator.compute(
      TimelineBuilder.build(makeMoves("R U R' U'", 1000, 100), 'CFOP'),
      100, // 100ms pause
    );

    // effective = 4 / ((400 - 100) / 1000) = 4 / 0.3 = 13.33
    expect(tps.effective).toBeGreaterThan(tps.global);
  });

  it('peak TPS >= global TPS', () => {
    const moves = makeMoves("R U R' U' R U R' U'", 1000, 80);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const tps = TPSCalculator.compute(timeline, 0);

    expect(tps.peakInstantaneous).toBeGreaterThanOrEqual(tps.global);
  });

  it('computePeakTPS returns 0 for < 2 moves', () => {
    const moves = makeMoves("R", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const peak = TPSCalculator.computePeakTPS(timeline.entries, 1000);

    expect(peak).toBe(0);
  });

  it('computePeakTPS finds the fastest window', () => {
    // Create a timeline with a burst in the middle
    const moves = [
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1000, hostTimestamp: 1000 },
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 1500, hostTimestamp: 1500 }, // slow
      { face: 'R' as const, direction: -1 as const, cubeTimestamp: 1600, hostTimestamp: 1600 }, // fast burst
      { face: 'U' as const, direction: -1 as const, cubeTimestamp: 1700, hostTimestamp: 1700 }, // fast burst
      { face: 'R' as const, direction: 1 as const, cubeTimestamp: 1800, hostTimestamp: 1800 }, // fast burst
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 2500, hostTimestamp: 2500 }, // slow
    ];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const peak = TPSCalculator.computePeakTPS(timeline.entries, 1000);

    // The burst (moves 2-4) should have higher TPS than global
    const globalTPS = 6 / ((2500 - 1000) / 1000);
    expect(peak).toBeGreaterThan(globalTPS);
  });

  it('phaseTPS returns correct TPS for a phase', () => {
    const moves = makeMoves("R U R' U'", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    timeline.phases = [
      { phaseName: 'Cross', startIndex: 0, endIndex: 3, startTimestamp: 1000, endTimestamp: 1300, durationMs: 300, moveCount: 4 },
    ];

    const phaseTps = TPSCalculator.phaseTPS(timeline, 'Cross');
    expect(phaseTps).toBeCloseTo(4 / 0.3, 0); // ~13.33
  });

  it('phaseTPS returns null for nonexistent phase', () => {
    const moves = makeMoves("R U", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    timeline.phases = [];

    expect(TPSCalculator.phaseTPS(timeline, 'Nonexistent')).toBeNull();
  });

  it('instantaneousWindow returns array of TPS values', () => {
    const moves = makeMoves("R U R' U' R U", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const window = TPSCalculator.instantaneousWindow(timeline.entries, 3);

    expect(window.length).toBeGreaterThan(0);
    for (const tps of window) {
      expect(tps).toBeGreaterThan(0);
    }
  });

  it('instantaneousWindow returns empty for insufficient moves', () => {
    const moves = makeMoves("R U", 1000, 100);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const window = TPSCalculator.instantaneousWindow(timeline.entries, 5);

    expect(window).toEqual([]);
  });
});
