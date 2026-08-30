import type {
  SolveTimeline,
  CFOPMetrics,
  F2LPairMetrics,
} from '@cubeforge/types';
import { ColorPhaseDetector, CubeState } from '@cubeforge/math-core';
import { solveCross } from '@cubeforge/solver-engine';
import { segmentF2LPairs } from '../pipeline/segmentF2LPairs';
import { detectLastLayerCase } from '../cases/lastLayerCases';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

/**
 * Computes CFOP-specific metrics from a solve timeline.
 *
 * Requires the timeline to already be annotated with CFOP phases
 * (Cross, F2L, OLL, PLL) via PhaseSplitter.
 *
 * F2L pair analysis is delegated to the UNIFIED `segmentF2LPairs` (the same
 * function the reconstruction text route uses) — the smart route and the
 * text route can never diverge on pair boundaries.
 */
export class CFOPMetricsCalculator {
  /**
   * Compute all CFOP-specific metrics.
   *
   * @param opts.scramble - The original scramble. When present (plus a
   *   detected cross color) the cross efficiency is the REAL optimal-based
   *   ratio (solveCross / actual moves) instead of the legacy heuristic.
   */
  static compute(
    timeline: SolveTimeline,
    opts?: { scramble?: string },
  ): CFOPMetrics {
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

    // ─── Solver-frame crossFace/scheme (shared with reconstruction) ──────
    // Derived the SAME way the reconstruction text route derives it
    // (ColorPhaseDetector re-detect over the timeline entries). The
    // smart/virtual route has no written text and no P2 frame recovery, so
    // the physical entries ARE the solver frame — the case detection below
    // must answer the exact cases a reconstruction of the same solve would.
    const report = timeline.detectionReport;
    const reportPhases = report?.phases ?? phases;
    let crossFace = (report?.crossFace ?? 'D') as string;
    let scheme: Record<string, string> | undefined;
    try {
      const states = entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
      const detection = ColorPhaseDetector.detect(states, undefined, {});
      if (detection && (detection.completions?.[0] ?? -1) >= 0) {
        if (detection.crossFace) crossFace = detection.crossFace as string;
        scheme = detection.scheme as Record<string, string> | undefined;
      }
    } catch {
      // Fall back to the report's crossFace + identity scheme.
    }

    // ─── Shared last-layer case detection (OLL + PLL) ──────────────────
    // Same function the reconstruction text route uses, so a smart/virtual
    // solve reports the exact OLL/PLL cases a reconstruction would.
    defaultResult.ollCase = detectLastLayerCase(
      timeline,
      reportPhases.find((p) => p.phaseName === 'OLL'),
      'last-layer-orientation',
      crossFace,
    );
    defaultResult.pllCase = detectLastLayerCase(
      timeline,
      reportPhases.find((p) => p.phaseName === 'PLL'),
      'last-layer-permutation',
      crossFace,
    );

    // ─── Cross metrics ──────────────────────────────────────────────────
    const crossPhase = phases.find((p) => p.phaseName === 'Cross');
    if (crossPhase) {
      defaultResult.crossMoves = crossPhase.moveCount;
      const completionIdx = crossPhase.completionIndex;
      const completionState =
        completionIdx !== undefined && completionIdx < entries.length
          ? TimelineBuilder.fromSnapshot(entries[completionIdx].state)
          : undefined;
      const preCompletionState =
        completionIdx !== undefined && completionIdx > 0 && completionIdx < entries.length
          ? TimelineBuilder.fromSnapshot(entries[completionIdx - 1].state)
          : undefined;
      defaultResult.crossEfficiency = CFOPMetricsCalculator.computeCrossEfficiency(
        crossPhase.moveCount,
        opts?.scramble,
        report?.crossColor,
        completionState,
        preCompletionState,
      );
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

    // ─── F2L pair analysis (UNIFIED segmentF2LPairs) ─────────────────────
    const f2lPhase = phases.find((p) => p.phaseName === 'F2L');
    if (f2lPhase) {
      defaultResult.f2lPairs = segmentF2LPairs(timeline, { crossFace, scheme }).map((p) => ({
        pairNumber: p.pairNumber,
        slotId: p.slot,
        timeMs: p.timeMs,
        moves: p.movesCount,
        tps: p.tps,
        recognitionMs: p.recognitionMs,
        // Legacy alias so pre-0.3.0 readers keep working.
        pauseBeforeMs: p.recognitionMs,
        colors: p.colors,
        auf: p.auf,
        movesNotation: p.moves,
        completionIndex: p.completionIndex,
        // Basic F2L case (41-case catalog) — shared with the reconstruction
        // text route, so smart/virtual reports the same pair cases.
        detectedCase: p.detectedCase,
      }));
      defaultResult.f2lLookaheadScore = CFOPMetricsCalculator.computeLookaheadScore(defaultResult.f2lPairs);
    }

    // ─── OLL metrics ────────────────────────────────────────────────────
    const ollPhase = phases.find((p) => p.phaseName === 'OLL');
    if (
      ollPhase &&
      !ollPhase.skipped &&
      ollPhase.startIndex >= 0 &&
      ollPhase.startIndex < entries.length
    ) {
      // Recognition = gap between last F2L move and first OLL move. The
      // previous entry may not exist when OLL was already complete at the
      // first captured move, so recognition is then reported as unknown/0.
      const preOLLEntry = entries[ollPhase.startIndex - 1];
      const firstOLLEntry = entries[ollPhase.startIndex];
      if (!firstOLLEntry) return defaultResult;
      defaultResult.ollRecognitionMs = Math.max(
        0,
        preOLLEntry
          ? firstOLLEntry.hostTimestamp - preOLLEntry.hostTimestamp
          : 0,
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
    if (
      pllPhase &&
      !pllPhase.skipped &&
      pllPhase.startIndex >= 0 &&
      pllPhase.startIndex < entries.length
    ) {
      const prePLLEntry = entries[pllPhase.startIndex - 1];
      const firstPLLEntry = entries[pllPhase.startIndex];
      if (!firstPLLEntry) return defaultResult;
      defaultResult.pllRecognitionMs = Math.max(
        0,
        prePLLEntry
          ? firstPLLEntry.hostTimestamp - prePLLEntry.hostTimestamp
          : 0,
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
   * Real cross efficiency: optimal cross move count (solveCross over the
   * solver's ACTUAL cross color) divided by the moves the solver used.
   * 1.0 = the cross was built optimally, whatever the optimal length is
   * (3, 5, 8…). Falls back to the legacy "distance from 8" heuristic when
   * the optimal cannot be computed (no scramble, no detected cross color,
   * or the solver returns no solution).
   */
  private static computeCrossEfficiency(
    actualMoves: number,
    scramble?: string,
    reportCrossColor?: string,
    completionState?: CubeState,
    preCompletionState?: CubeState,
  ): number {
    if (actualMoves <= 0) return 0;
    try {
      if (scramble) {
        const state = new CubeState();
        CubeState.initTables();
        state.applySequence(scramble);
        const crossColor =
          reportCrossColor ??
          CFOPMetricsCalculator.solverCrossColorAt(completionState, preCompletionState);
        if (crossColor) {
          const solutions = solveCross(state, crossColor, { maxDepth: 8 });
          const optimal = solutions.length > 0 ? solutions[0].moveCount : 0;
          if (optimal > 0) {
            return Math.min(1, Math.round((optimal / actualMoves) * 100) / 100);
          }
        }
      }
    } catch {
      // Fall back to the heuristic below.
    }
    // Legacy heuristic: any cross can be solved in ≤ 8 face turns, so 8 was
    // used as the reference length.
    return actualMoves <= 8
      ? Math.round((actualMoves / 8) * 100) / 100
      : Math.round((8 / actualMoves) * 100) / 100;
  }

  /**
   * Deterministic cross-color lookup: the solver's cross is the one that
   * COMPLETES on the final cross move — complete at the detected completion
   * state but not at the previous entry. A depth-0 solveCross is a pure mask
   * match (no search), so this is cheap. Avoids the ColorPhaseDetector
   * "longest-stable" heuristic, which can pick a different color on
   * degenerate timelines where another color's cross is coincidentally
   * complete too.
   */
  private static solverCrossColorAt(
    state?: CubeState,
    prevState?: CubeState,
  ): string | undefined {
    if (!state) return undefined;
    const faces = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
    for (const face of faces) {
      const completeNow = solveCross(state, face, { maxDepth: 0 }).length > 0;
      const completeBefore = prevState
        ? solveCross(prevState, face, { maxDepth: 0 }).length > 0
        : false;
      if (completeNow && !completeBefore) return face;
    }
    // No cross "just completed" (degenerate): accept any complete cross.
    for (const face of faces) {
      if (solveCross(state, face, { maxDepth: 0 }).length > 0) return face;
    }
    return undefined;
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
