/**
 * lastLayerCases.ts — SHARED last-layer (OLL/PLL) case detection.
 *
 * Single implementation consumed by BOTH routes so a solve reported the same
 * OLL/PLL case whether it came from a reconstruction text or a smart/virtual
 * cube:
 *
 *   - reconstruction text (`analyzeSolveText`) → `detectLastLayerCase`
 *   - smart / virtual (`CFOPMetricsCalculator`) → `detectLastLayerCase`
 *
 * The case is the state the solver FACED at the phase's START — the last
 * timeline entry before the phase's first move (`startIndex - 1`). The
 * completion index is where the phase mask matched (already oriented/solved),
 * so detecting there would always read the solved pattern, never the case.
 *
 * The state is read from the POST-P2 timeline entries (NOT `solverFrameStates`):
 * the `crossFace` is measured on those entries and the last-layer probe must
 * see the state in the same frame as its crossFace — reading the possibly-
 * grip-rotated solver frames would put the cross on a different face and miss
 * side-cross PLLs (the reconz-3008/4996/2463 B-cross misses).
 */
import type { CubeState } from '@cubalyze/math-core';
import type {
  DetectedCase,
  PhaseDetectionReport,
  SolveTimeline,
} from '@cubalyze/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { getCFOPDetector } from './caseDetectors';

export type LastLayerProbe =
  | 'last-layer-orientation'
  | 'last-layer-permutation';

/** State at a given POST-P2 timeline index (the frame the crossFace lives in). */
function llStateAt(
  timeline: SolveTimeline,
  index: number | undefined,
): CubeState | null {
  if (index === undefined || index < 0 || index >= timeline.entries.length) {
    return null;
  }
  const snap = timeline.entries[index]?.state;
  if (!snap) return null;
  return TimelineBuilder.fromSnapshot(snap);
}

/**
 * Detect the OLL/PLL case for a phase.
 *
 * @returns The recognized case with `aufFace`, or undefined when the phase is
 *          skipped, the state is unavailable, or the state is not in the
 *          catalog. Never throws — detection must not break the solve.
 */
export function detectLastLayerCase(
  timeline: SolveTimeline,
  phase: PhaseDetectionReport['phases'][number] | undefined,
  probe: LastLayerProbe,
  crossFace: string,
): DetectedCase | undefined {
  if (!phase || phase.skipped) return undefined;
  // The case the solver FACED is the state at the phase's start: the last
  // entry BEFORE its first move (startIndex - 1), which is the previous
  // phase's completion — exactly the frame with the solver's AUF applied.
  const start = phase.startIndex;
  const state = llStateAt(timeline, start !== undefined ? start - 1 : undefined);
  if (!state) return undefined;
  try {
    const result = getCFOPDetector().detectWith(state, { probe, crossFace });
    if (result.entry && result.confidence === 'exact') {
      return {
        caseNumber: result.entry.caseNumber,
        caseName: result.entry.caseName,
        confidence: result.confidence,
        aufFace: result.aufFace,
      };
    }
  } catch {
    // Detection must never break the reconstruction / metrics.
  }
  return undefined;
}