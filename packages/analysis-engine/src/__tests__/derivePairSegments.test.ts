import { describe, expect, it } from 'vitest';
import type {
  CubeMoveEvent,
  F2LPairMetrics,
  SolveMetrics,
} from '@cubalyze/types';
import { derivePairSegments, deriveTimeline } from '../derived/timeline';

/**
 * derivePairSegments — F2L divided into per-pair timeline sub-segments.
 *
 * The shared segmentF2LPairs output (indices, timeMs, tps, detectedCase) is
 * what the phase bar paints: 4 sub-bars for F2L, each seekable to its first
 * move. These tests pin the mapping (move indices, ms from real timestamps,
 * fallback layout without moves, and empty guards).
 */

function makePair(overrides: Partial<F2LPairMetrics>): F2LPairMetrics {
  return {
    pairNumber: 1,
    slotId: 'FR',
    timeMs: 800,
    moves: 6,
    tps: 7.5,
    recognitionMs: 0,
    completionIndex: 9,
    detectedCase: {
      caseNumber: 'F2L 39',
      caseName: 'Pj',
      confidence: 'exact',
    },
    ...overrides,
  };
}

function makeAnalysis(pairs: F2LPairMetrics[]): SolveMetrics {
  return {
    solveId: 's1',
    totalTimeMs: 8000,
    totalMoves: 30,
    phases: [
      { phaseName: 'Cross', durationMs: 1000, moveCount: 6, tps: 6, pauseCount: 0, pauseTimeMs: 0 },
      { phaseName: 'F2L', durationMs: 4000, moveCount: 16, tps: 4, pauseCount: 0, pauseTimeMs: 0 },
      { phaseName: 'OLL', durationMs: 1500, moveCount: 8, tps: 5.33, pauseCount: 0, pauseTimeMs: 0 },
      { phaseName: 'PLL', durationMs: 1500, moveCount: 6, tps: 4, pauseCount: 0, pauseTimeMs: 0 },
    ],
    tps: { global: 3.75, effective: 3.75, byPhase: {}, peakInstantaneous: 5 },
    pauses: {
      totalCount: 0,
      maxDurationMs: 0,
      avgDurationMs: 0,
      byPhase: {},
      totalPauseTimeMs: 0,
      pauseRatio: 0,
      pauses: [],
    },
    fluidity: {
      stdDevMs: 0,
      coefficientOfVariation: 0,
      byPhase: {},
      burstCount: 0,
      accelerationCount: 0,
      decelerationCount: 0,
    },
    cfop: {
      crossEfficiency: 1,
      crossToF2LTransitionMs: 0,
      crossMoves: 6,
      crossTPS: 6,
      f2lPairs: pairs,
      f2lLookaheadScore: 0.8,
      ollRecognitionMs: 0,
      ollExecutionMs: 0,
      ollTPS: 0,
      pllRecognitionMs: 0,
      pllExecutionMs: 0,
      pllTPS: 0,
    },
  };
}

/** 30 moves, 100ms apart, starting at host t=1000. */
function makeMoves(count = 30): CubeMoveEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    face: (['U', 'R', 'F', 'D', 'L', 'B'] as const)[i % 6],
    direction: 1 as const,
    cubeTimestamp: i * 100,
    hostTimestamp: 1000 + i * 100,
  }));
}

describe('derivePairSegments', () => {
  it('maps each F2L pair to a sub-segment with real move timestamps', () => {
    const analysis = makeAnalysis([
      makePair({ pairNumber: 1, slotId: 'FR', timeMs: 800, moves: 6, tps: 7.5, completionIndex: 9, recognitionMs: 0 }),
      makePair({ pairNumber: 2, slotId: 'FL', timeMs: 1000, moves: 7, tps: 7, completionIndex: 17, recognitionMs: 120, detectedCase: { caseNumber: 'F2L 2', caseName: 'Jm', confidence: 'exact' } }),
      makePair({ pairNumber: 3, slotId: 'BR', timeMs: 900, moves: 6, tps: 6.67, completionIndex: 24, recognitionMs: 60 }),
      makePair({ pairNumber: 4, slotId: 'BL', timeMs: 700, moves: 5, tps: 7.14, completionIndex: 30, recognitionMs: 40, detectedCase: undefined }),
    ]);
    const moves = makeMoves();

    const segments = derivePairSegments(analysis, moves);

    expect(segments).toHaveLength(4);
    expect(segments.every((s) => s.phaseName === 'F2L')).toBe(true);

    // Indices: first move = completionIndex - moves + 1, last = completion.
    const first = segments[0];
    expect(first.pairNumber).toBe(1);
    expect(first.slot).toBe('FR');
    expect(first.moveStartIndex).toBe(9 - 6 + 1); // 4
    expect(first.moveEndIndex).toBe(9);
    expect(first.completionIndex).toBe(9);
    expect(first.moves).toBe(6);
    expect(first.tps).toBe(7.5);
    expect(first.recognitionMs).toBe(0);

    // Milliseconds from the real move timestamps (base = moves[0]).
    expect(first.startMs).toBe(1000 + 4 * 100 - 1000); // 400
    expect(first.durationMs).toBe(800);
    expect(first.endMs).toBe(400 + 800);

    // Case detection passes through.
    expect(first.caseName).toBe('Pj');
    expect(first.caseNumber).toBe('F2L 39');
    expect(segments[1].caseName).toBe('Jm');
    expect(segments[1].slot).toBe('FL');
    expect(segments[1].recognitionMs).toBe(120);
    expect(segments[3].caseName).toBeUndefined();
  });

  it('returns [] when there are no F2L pairs (or no analysis)', () => {
    expect(derivePairSegments(undefined)).toEqual([]);
    expect(derivePairSegments(makeAnalysis([]))).toEqual([]);
  });

  it('falls back to a sequential layout when move timestamps are absent', () => {
    const analysis = makeAnalysis([
      makePair({ pairNumber: 1, timeMs: 800, moves: 6, completionIndex: 5 }),
      makePair({ pairNumber: 2, timeMs: 1000, moves: 7, completionIndex: 12 }),
      makePair({ pairNumber: 3, timeMs: 900, moves: 6, completionIndex: 18 }),
    ]);

    const segments = derivePairSegments(analysis);

    expect(segments).toHaveLength(3);
    // No moves → start at 0 and accumulate timeMs.
    expect(segments[0].startMs).toBe(0);
    expect(segments[0].endMs).toBe(800);
    expect(segments[1].startMs).toBe(800);
    expect(segments[1].endMs).toBe(1800);
    expect(segments[2].startMs).toBe(1800);
    // Indices are still derived from completion - moves + 1.
    expect(segments[0].moveStartIndex).toBe(5 - 6 + 1); // 0
    expect(segments[2].moveStartIndex).toBe(18 - 6 + 1); // 13
  });

  it('clamps move indices when completionIndex is missing', () => {
    const analysis = makeAnalysis([
      makePair({ pairNumber: 1, completionIndex: undefined, moves: 4 }),
    ]);

    const segments = derivePairSegments(analysis);

    expect(segments[0].moveStartIndex).toBe(-1);
    expect(segments[0].moveEndIndex).toBe(-1);
    expect(segments[0].startMs).toBe(0);
  });

  it('falls inside the F2L phase segment of the same timeline (divided bar)', () => {
    // Consistent synthetic solve: Cross 6 + F2L 16 + OLL 8 + PLL 6 = 36
    // moves at 100 ms; four pairs of 4 moves each cover the F2L phase.
    const moves = makeMoves(36);
    const analysis = makeAnalysis([
      makePair({ pairNumber: 1, timeMs: 400, moves: 4, completionIndex: 9 }),
      makePair({ pairNumber: 2, timeMs: 400, moves: 4, completionIndex: 13 }),
      makePair({ pairNumber: 3, timeMs: 400, moves: 4, completionIndex: 17 }),
      makePair({ pairNumber: 4, timeMs: 400, moves: 4, completionIndex: 21 }),
    ]);

    const tl = deriveTimeline({ time: 3600, moves, analysis });
    const f2l = tl.stageSegments.find((s) => s.phaseName === 'F2L');
    expect(f2l).toBeDefined();

    const pairs = derivePairSegments(analysis, moves);
    expect(pairs).toHaveLength(4);

    // The pair slices are the bars painted inside the F2L phase block:
    // they must be ordered, contiguous, and (within one inter-move gap)
    // inside the F2L segment's own bounds.
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      expect(p.startMs).toBeGreaterThanOrEqual(f2l!.startMs - 0.001);
      expect(p.endMs).toBeLessThanOrEqual(f2l!.endMs + 250);
      if (i > 0) {
        expect(p.startMs).toBeGreaterThanOrEqual(pairs[i - 1].endMs - 0.001);
      }
    }
    // First pair starts exactly where the F2L phase starts (after the cross).
    expect(pairs[0].startMs).toBe(f2l!.startMs);
  });
});
