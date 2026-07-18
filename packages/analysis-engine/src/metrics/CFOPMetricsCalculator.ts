import type { SolveTimeline, CFOPMetrics, F2LPairMetrics } from '@cubeforge/types';
import { CubeState, StateMatcher, CrossMask } from '@cubeforge/math-core';

/**
 * Computes CFOP-specific metrics from a solve timeline.
 *
 * Requires the timeline to already be annotated with CFOP phases
 * (Cross, F2L, OLL, PLL) via PhaseSplitter.
 */
export class CFOPMetricsCalculator {
  /**
   * Compute all CFOP-specific metrics.
   */
  static compute(timeline: SolveTimeline): CFOPMetrics {
    const { entries, phases } = timeline;

    const defaultResult: CFOPMetrics = {
      crossEfficiency: 0,
      crossToF2LTransitionMs: 0,
      crossMoves: 0,
      crossTPS: 0,
      f2lPairs: [],
      f2lLookaheadScore: 0,
      ollRecognitionMs: 0,
      ollExecutionMs: 0,
      ollTPS: 0,
      pllRecognitionMs: 0,
      pllExecutionMs: 0,
      pllTPS: 0,
    };

    if (entries.length === 0) return defaultResult;

    // ─── Cross metrics ──────────────────────────────────────────────────
    const crossPhase = phases.find((p) => p.phaseName === 'Cross');
    if (crossPhase) {
      // Cross efficiency: optimal cross is always ≤ 8 moves
      defaultResult.crossMoves = crossPhase.moveCount;
      defaultResult.crossEfficiency = crossPhase.moveCount <= 8
        ? Math.round((crossPhase.moveCount / 8) * 100) / 100
        : Math.round((8 / crossPhase.moveCount) * 100) / 100;
      defaultResult.crossTPS = crossPhase.durationMs > 0
        ? Math.round((crossPhase.moveCount / (crossPhase.durationMs / 1000)) * 100) / 100
        : 0;

      // Cross-to-F2L transition: gap between last Cross move and first F2L move
      const f2lPhase = phases.find((p) => p.phaseName === 'F2L');
      if (f2lPhase && crossPhase.endIndex + 1 === f2lPhase.startIndex) {
        const lastCrossEntry = entries[crossPhase.endIndex];
        const firstF2LEntry = entries[f2lPhase.startIndex];
        defaultResult.crossToF2LTransitionMs = Math.max(
          0,
          firstF2LEntry.hostTimestamp - lastCrossEntry.hostTimestamp,
        );
      }
    }

    // ─── F2L pair analysis ──────────────────────────────────────────────
    const f2lPhase = phases.find((p) => p.phaseName === 'F2L');
    if (f2lPhase) {
      defaultResult.f2lPairs = CFOPMetricsCalculator.analyzeF2LPairs(
        entries,
        f2lPhase.startIndex,
        f2lPhase.endIndex,
      );
      defaultResult.f2lLookaheadScore = CFOPMetricsCalculator.computeLookaheadScore(defaultResult.f2lPairs);
    }

    // ─── OLL metrics ────────────────────────────────────────────────────
    const ollPhase = phases.find((p) => p.phaseName === 'OLL');
    if (ollPhase && ollPhase.startIndex > 0) {
      // Recognition = gap between last F2L move and first OLL move
      const preOLLEntry = entries[ollPhase.startIndex - 1];
      const firstOLLEntry = entries[ollPhase.startIndex];
      defaultResult.ollRecognitionMs = Math.max(
        0,
        firstOLLEntry.hostTimestamp - preOLLEntry.hostTimestamp,
      );
      // Execution = OLL phase duration minus recognition
      defaultResult.ollExecutionMs = Math.max(
        0,
        ollPhase.durationMs - defaultResult.ollRecognitionMs,
      );
      defaultResult.ollTPS = ollPhase.moveCount > 0 && ollPhase.durationMs > 0
        ? Math.round((ollPhase.moveCount / (ollPhase.durationMs / 1000)) * 100) / 100
        : 0;
    }

    // ─── PLL metrics ────────────────────────────────────────────────────
    const pllPhase = phases.find((p) => p.phaseName === 'PLL');
    if (pllPhase && pllPhase.startIndex > 0) {
      const prePLLEntry = entries[pllPhase.startIndex - 1];
      const firstPLLEntry = entries[pllPhase.startIndex];
      defaultResult.pllRecognitionMs = Math.max(
        0,
        firstPLLEntry.hostTimestamp - prePLLEntry.hostTimestamp,
      );
      defaultResult.pllExecutionMs = Math.max(
        0,
        pllPhase.durationMs - defaultResult.pllRecognitionMs,
      );
      defaultResult.pllTPS = pllPhase.moveCount > 0 && pllPhase.durationMs > 0
        ? Math.round((pllPhase.moveCount / (pllPhase.durationMs / 1000)) * 100) / 100
        : 0;
    }

    return defaultResult;
  }

  /**
   * Analyze individual F2L pairs.
   *
   * APPROXIMATION: F2L has 4 pairs. Without per-slot phase masks,
   * we heuristically split the F2L entries into 4 approximately equal
   * segments. This gives useful aggregate metrics but individual pair
   * times may be inaccurate.
   *
   * TODO: Implement per-slot PhaseMasks for exact pair boundary detection.
   */
  private static analyzeF2LPairs(
    entries: SolveTimeline['entries'],
    startIdx: number,
    endIdx: number,
  ): F2LPairMetrics[] {
    const f2lEntries = entries.slice(startIdx, endIdx + 1);
    if (f2lEntries.length === 0) return [];

    // Heuristic: split F2L into 4 equal segments
    const pairSize = Math.ceil(f2lEntries.length / 4);
    const pairs: F2LPairMetrics[] = [];

    let prevEndTs = f2lEntries[0]?.hostTimestamp || 0;

    for (let p = 0; p < 4; p++) {
      const segStart = p * pairSize;
      const segEnd = Math.min((p + 1) * pairSize - 1, f2lEntries.length - 1);

      if (segStart >= f2lEntries.length) break;

      const segEntries = f2lEntries.slice(segStart, segEnd + 1);
      const startTs = segEntries[0]?.hostTimestamp || prevEndTs;
      const endTs = segEntries[segEntries.length - 1]?.hostTimestamp || startTs;
      const durationMs = endTs - startTs;

      pairs.push({
        pairNumber: p + 1,
        timeMs: durationMs,
        moves: segEntries.length,
        tps: durationMs > 0
          ? Math.round((segEntries.length / (durationMs / 1000)) * 100) / 100
          : 0,
        pauseBeforeMs: p === 0 ? 0 : Math.max(0, startTs - prevEndTs),
      });

      prevEndTs = endTs;
    }

    return pairs;
  }

  /**
   * Compute a lookahead score for F2L.
   *
   * Lookahead score is based on the consistency of pair times.
   * Lower variance between pairs = better lookahead (more consistent
   * recognition and execution).
   *
   * Score 0-1 where 1 = perfect lookahead (identical pair times).
   */
  private static computeLookaheadScore(pairs: F2LPairMetrics[]): number {
    if (pairs.length < 2) return 0;

    const times = pairs.map((p) => p.timeMs);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    if (mean === 0) return 0;

    const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // Score: 1 - CV, clamped to [0, 1]
    return Math.max(0, Math.min(1, Math.round((1 - cv) * 100) / 100));
  }
}
