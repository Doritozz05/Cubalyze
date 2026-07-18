import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { makeMoves } from './test-helpers';

describe('TimelineBuilder', () => {
  it('returns empty timeline for empty moves', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    expect(timeline.entries).toEqual([]);
    expect(timeline.phases).toEqual([]);
    expect(timeline.startTimestamp).toBe(0);
    expect(timeline.endTimestamp).toBe(0);
    expect(timeline.method).toBe('CFOP');
  });

  it('creates entries with correct structure', () => {
    const moves = makeMoves("R U R' U'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    expect(timeline.entries).toHaveLength(4);
    expect(timeline.entries[0].index).toBe(0);
    expect(timeline.entries[0].move.face).toBe('R');
    expect(timeline.entries[0].move.direction).toBe(1);
    expect(timeline.entries[0].hostTimestamp).toBe(1000);
  });

  it('tracks time boundaries correctly', () => {
    const moves = makeMoves("R U", 2000, 50);
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    expect(timeline.startTimestamp).toBe(2000);
    expect(timeline.endTimestamp).toBe(2050);
  });

  it('creates cube state snapshots at each entry', () => {
    const moves = makeMoves("R U R'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    for (const entry of timeline.entries) {
      expect(entry.state).toBeDefined();
      expect(entry.state.cp).toHaveLength(8);
      expect(entry.state.co).toHaveLength(8);
      expect(entry.state.ep).toHaveLength(12);
      expect(entry.state.eo).toHaveLength(12);
    }
  });

  it('replays to solved state for T-Perm applied twice', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const moves = makeMoves(`${tPerm} ${tPerm}`);
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    // T-Perm has 14 moves, so 28 total
    expect(timeline.entries).toHaveLength(28);

    // Last entry should be solved
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

  it('fromStoredSolve sets solveId', () => {
    const moves = makeMoves("R U");
    const timeline = TimelineBuilder.fromStoredSolve('solve-123', moves, 'CFOP');

    expect(timeline.solveId).toBe('solve-123');
    expect(timeline.entries).toHaveLength(2);
  });

  it('annotatePhases assigns phaseId and phaseName to entries', () => {
    const moves = makeMoves("R U R' U'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    const phases = [
      { phaseName: 'Cross', startIndex: 0, endIndex: 1, startTimestamp: 1000, endTimestamp: 1100, durationMs: 100, moveCount: 2 },
      { phaseName: 'F2L', startIndex: 2, endIndex: 3, startTimestamp: 1200, endTimestamp: 1300, durationMs: 100, moveCount: 2 },
    ];

    TimelineBuilder.annotatePhases(timeline, phases);

    expect(timeline.entries[0].phaseId).toBe(0);
    expect(timeline.entries[0].phaseName).toBe('Cross');
    expect(timeline.entries[2].phaseId).toBe(1);
    expect(timeline.entries[2].phaseName).toBe('F2L');
    expect(timeline.phases).toEqual(phases);
  });

  it('toSnapshot and fromSnapshot round-trip', () => {
    const moves = makeMoves("R U R'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const snapshot = timeline.entries[timeline.entries.length - 1].state;

    const reconstructed = TimelineBuilder.fromSnapshot(snapshot);
    // CubeState uses Int8Array; snapshot uses number[] from Array.from()
    expect(Array.from(reconstructed.cp)).toEqual(snapshot.cp);
    expect(Array.from(reconstructed.co)).toEqual(snapshot.co);
    expect(Array.from(reconstructed.ep)).toEqual(snapshot.ep);
    expect(Array.from(reconstructed.eo)).toEqual(snapshot.eo);
  });
});
