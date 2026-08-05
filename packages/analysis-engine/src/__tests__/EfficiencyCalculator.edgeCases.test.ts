/**
 * Level 2 — Edge cases for EfficiencyCalculator
 *
 * Boundary cases:
 * • compute with an empty timeline → defaults
 * • solveOptimal with invalid/empty scramble → ''
 * • Redundancy & cancellation: boundary sequences
 * • computeForwardDriftFast: no entries, solved state, no progress
 * • overturns: always 0 (documented limitation)
 */
import { describe, it, expect } from 'vitest';
import { EfficiencyCalculator } from '../metrics/EfficiencyCalculator';
import type { SolveTimeline, TimelineEntry, CubeMoveEvent } from '@cubeforge/types';

/** Build a minimal SolveTimeline from an array of moves. */
function makeTimeline(moves: Array<{ face: string; direction: number }>): SolveTimeline {
  const entries: TimelineEntry[] = moves.map((m, i) => ({
    index: i,
    move: { face: m.face as any, direction: m.direction as 1 | -1 | 2, cubeTimestamp: i * 100, hostTimestamp: i * 100 },
    displayMove: { face: m.face as any, direction: m.direction as 1 | -1 | 2, cubeTimestamp: i * 100, hostTimestamp: i * 100 },
    hostTimestamp: i * 100,
    state: {
      cp: [0, 1, 2, 3, 4, 5, 6, 7],
      co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    phaseId: 0,
  }));
  return { entries, solveId: 'test', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: moves.length * 100 };
}

describe('EfficiencyCalculator — Level 2 Edge Cases', () => {
  // ── compute: empty timeline ────────────────────────────────────────

  it('compute with an empty timeline returns defaults', async () => {
    const timeline: SolveTimeline = { entries: [], solveId: 'empty', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 };
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result).toEqual({
      moveEfficiencyRatio: 1,
      optimalMoveCount: 0,
      redundancies: 0,
      cancellations: 0,
      overturns: 0,
      forwardDrift: 1,
    });
  });

  it('compute with an empty timeline and empty scramble returns defaults', async () => {
    const timeline: SolveTimeline = { entries: [], solveId: 'empty', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 };
    const result = await EfficiencyCalculator.compute(timeline, '');
    expect(result.optimalMoveCount).toBe(0);
    expect(result.moveEfficiencyRatio).toBe(1);
  });

  // ── solveOptimal ───────────────────────────────────────────────────

  it('solveOptimal with an empty scramble returns an empty string', async () => {
    const result = await EfficiencyCalculator.solveOptimal('');
    expect(result).toBe('');
  });

  it('solveOptimal with an invalid scramble does not throw (catch → "")', async () => {
    const result = await EfficiencyCalculator.solveOptimal('INVALID SCRAMBLE X Y Z');
    expect(result).toBe('');
  });

  // ── Redundancy & cancellation ──────────────────────────────────────

  it('detection: U followed by U\' is a cancellation (not redundancy)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: -1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.cancellations).toBe(1);
    expect(result.redundancies).toBe(0);
  });

  it('detection: U followed by U is redundancy (not cancellation)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(1);
    expect(result.cancellations).toBe(0);
  });

  it('detection: R2 is neither a cancellation nor redundancy', async () => {
    const timeline = makeTimeline([
      { face: 'R', direction: 2 },
      { face: 'R', direction: 2 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  it('detection: different faces do not count', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  it('multiple redundancies: U U R U U = 2 redundancies', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(2);
  });

  it('secuencia larga sin redundancias ni cancellations', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: -1 },
      { face: 'F', direction: 1 },
      { face: 'D', direction: 2 },
      { face: 'L', direction: -1 },
      { face: 'B', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  // ── forwardDrift ───────────────────────────────────────────────────

  it('computeForwardDriftFast with an empty timeline returns 1', () => {
    const result = EfficiencyCalculator.computeForwardDriftFast({ entries: [], solveId: 'test', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 });
    expect(result).toBe(1);
  });

  it('computeForwardDriftFast with 1 entry in solved state returns...', () => {
    // With a single solved-state entry there are no previous entries to compare,
    // so progressSteps = 0 (no entry has fewer unsolved than the previous one)
    // forwardDrift = 0/1 = 0
    const timeline = makeTimeline([{ face: 'U', direction: 1 }]);
    // The entry state is solved (cp=identity, co=0, etc.), so unsolved=0
    // previousUnsolved starts at 20, unsolved=0 < 20 → progressSteps++ = 1
    // forwardDrift = 1/1 = 1
    const result = EfficiencyCalculator.computeForwardDriftFast(timeline);
    expect(result).toBe(1);
  });

  it('computeForwardDriftFast with all entries solved = 0.5 (2 entries, 1 progresses)', () => {
    // buildTimeline with a solved state produces unsolved=0 for each entry
    // first entry: 0 < 20 → progress++, prev=0
    // second entry: 0 < 0? No → no progress
    // So progress=1, entries.length=2, forwardDrift=0.5
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = EfficiencyCalculator.computeForwardDriftFast(timeline);
    // Both entries are in the solved state (unsolved=0)
    // First: 0 < 20 → progress++ (1)
    // Second: 0 < 0 → no progress
    // forwardDrift = 1/2 = 0.5
    expect(result).toBe(0.5);
  });

  // ── overturns ──────────────────────────────────────────────────────

  it('overturns is always 0 (documented limitation)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.overturns).toBe(0);
  });

  // ── forwardDrift with 0 entries (via compute) ──────────────────────

  it('compute with entries.length=1 does not error', async () => {
    const timeline = makeTimeline([{ face: 'U', direction: 1 }]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.forwardDrift).toBeGreaterThanOrEqual(0);
    expect(result.forwardDrift).toBeLessThanOrEqual(1);
  });
});
