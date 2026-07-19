import type { SolveTimeline, CFOPMetrics, F2LPairMetrics, CubeStateSnapshot } from '@cubeforge/types';
import {
  CubeState,
  StateMatcher,
  COLOR_NEUTRAL_CFOP_MASKS,
  FACE_LAYERS,
  Edge,
  Corner,
} from '@cubeforge/math-core';

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

    // ─── F2L pair analysis (state-based detection) ──────────────────────
    const f2lPhase = phases.find((p) => p.phaseName === 'F2L');
    if (f2lPhase) {
      // Detect which cross face was used
      const crossFace = CFOPMetricsCalculator.detectCrossFace(entries, crossPhase);

      defaultResult.f2lPairs = CFOPMetricsCalculator.analyzeF2LPairs(
        entries,
        f2lPhase.startIndex,
        f2lPhase.endIndex,
        crossFace,
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
   * Detect which cross face was used by checking the state at the end
   * of the Cross phase against all 6 color-neutral cross masks.
   *
   * @returns The cross face letter ('D', 'U', 'F', 'B', 'R', 'L') or null.
   */
  private static detectCrossFace(
    entries: SolveTimeline['entries'],
    crossPhase: SolveTimeline['phases'][0] | undefined,
  ): string | null {
    if (!crossPhase) return null;

    const state = CFOPMetricsCalculator.stateFromSnapshot(entries[crossPhase.endIndex].state);

    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      if (StateMatcher.matchesMask(state, faceMasks.masks[0])) {
        return faceMasks.face;
      }
    }
    return null;
  }

  /**
   * Count how many of the 4 F2L slots are completed in the given cube state.
   *
   * A slot is "complete" when:
   *   - The correct edge piece is in its home position with eo=0
   *   - The correct corner piece is in its home position with co=0
   *
   * @param state - The cube state to check.
   * @param crossFace - The cross face ('D', 'U', 'F', 'B', 'R', 'L').
   * @returns Number of completed F2L slots (0–4).
   */
  private static countCompletedF2LSlots(state: CubeState, crossFace: string): number {
    const faceData = FACE_LAYERS[crossFace];
    if (!faceData) return 0;

    let count = 0;
    for (let i = 0; i < 4; i++) {
      const edgePos = faceData.f2lEdges[i];
      const cornerPos = faceData.f2lCorners[i];

      const edgeOk =
        state.ep[edgePos] === edgePos && state.eo[edgePos] === 0;
      const cornerOk =
        state.cp[cornerPos] === cornerPos && state.co[cornerPos] === 0;

      if (edgeOk && cornerOk) {
        count++;
      }
    }
    return count;
  }

  /**
   * Analyze individual F2L pairs using STATE-BASED detection.
   *
   * Instead of splitting F2L into 4 equal segments (heuristic), this method
   * scans every entry in the F2L phase and counts how many slots are completed.
   * When the count increases (e.g. 0→1, 1→2, 2→3, 3→4), a pair boundary is
   * detected and per-pair metrics are computed.
   *
   * Fallback: if cross face cannot be detected, falls back to equal segments.
   */
  private static analyzeF2LPairs(
    entries: SolveTimeline['entries'],
    startIdx: number,
    endIdx: number,
    crossFace: string | null,
  ): F2LPairMetrics[] {
    const f2lEntries = entries.slice(startIdx, endIdx + 1);
    if (f2lEntries.length === 0) return [];

    // Fallback to heuristic if cross face unknown
    if (!crossFace) {
      return CFOPMetricsCalculator.analyzeF2LPairsHeuristic(f2lEntries);
    }

    // ── State-based pair boundary detection ──────────────────────────
    // KEY INSIGHT: During F2L, inserting pair N may temporarily un-do slots
    // from pairs 0..N-1 (pieces get moved around). So slotCount FLUCTUATES.
    // We track the MAXIMUM slot count ever seen (maxSlotCountSeen). A new
    // pair boundary is only recorded when we exceed that maximum.
    // This guarantees exactly 4 pairs for a full F2L solve.
    const boundaries: Array<{ start: number; end: number }> = [];
    let maxSlotCountSeen = 0;
    let pairStartIdx = 0;

    for (let i = 0; i < f2lEntries.length; i++) {
      const entry = f2lEntries[i];
      const state = CFOPMetricsCalculator.stateFromSnapshot(entry.state);
      const slotCount = CFOPMetricsCalculator.countCompletedF2LSlots(state, crossFace);

      // New pair completed only when we exceed the historical max
      if (slotCount > maxSlotCountSeen && boundaries.length < 4) {
        boundaries.push({ start: pairStartIdx, end: i });
        pairStartIdx = i + 1;
        maxSlotCountSeen = slotCount;
      }
    }

    // Handle remaining entries (if last pair wasn't detected by state transition)
    if (pairStartIdx < f2lEntries.length && boundaries.length < 4) {
      boundaries.push({ start: pairStartIdx, end: f2lEntries.length - 1 });
    }

    // Safety: never return more than 4 pairs
    if (boundaries.length > 4) {
      boundaries.length = 4;
    }

    // ── Build F2LPairMetrics from boundaries ─────────────────────────
    const pairs: F2LPairMetrics[] = [];
    let prevPairEndTs = f2lEntries[0]?.hostTimestamp ?? 0;

    for (let p = 0; p < boundaries.length; p++) {
      const { start, end } = boundaries[p];
      const pairEntries = f2lEntries.slice(start, end + 1);
      const startTs = pairEntries[0].hostTimestamp;
      const endTs = pairEntries[pairEntries.length - 1].hostTimestamp;
      const durationMs = Math.max(0, endTs - startTs);

      pairs.push({
        pairNumber: p + 1,
        timeMs: durationMs,
        moves: pairEntries.length,
        tps: durationMs > 0
          ? Math.round((pairEntries.length / (durationMs / 1000)) * 100) / 100
          : 0,
        pauseBeforeMs: p === 0 ? 0 : Math.max(0, startTs - prevPairEndTs),
      });

      prevPairEndTs = endTs;
    }

    return pairs;
  }

  /**
   * Heuristic fallback: split F2L into 4 equal segments.
   * Used when cross face cannot be detected.
   */
  private static analyzeF2LPairsHeuristic(
    f2lEntries: SolveTimeline['entries'],
  ): F2LPairMetrics[] {
    if (f2lEntries.length === 0) return [];

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

  /**
   * Create a CubeState from a serialized snapshot.
   */
  private static stateFromSnapshot(snapshot: CubeStateSnapshot): CubeState {
    return new CubeState(snapshot.cp, snapshot.co, snapshot.ep, snapshot.eo);
  }
}
