import type { MethodDefinition } from '@cubeforge/math-core';
import type { PhaseDetectionReport, SolveTimeline } from '@cubeforge/types';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

/**
 * P2 frame recovery — shared by EVERY analysis route.
 *
 * Text reconstructions can end PERFECT but in a rotated frame (the stored
 * scramble and the solver's frame differ by one whole-cube rotation — the
 * known recon.nz quirk). When the final state is uniform but NOT canonically
 * solved, rotate EVERY snapshot by the rotation that resolves the final
 * state and re-detect: with an exactly solved end state, the real cross
 * completes the full 4-phase chain and wins the detector's heuristic over
 * any spurious cross.
 *
 * For smart-cube solves this is a functional no-op (a physically solved cube
 * ends canonically solved), but it runs by uniformity so no route can ever
 * diverge.
 */
export interface FrameRecoveryOptions {
  colorNeutral?: boolean;
  preferredCrossIdx?: number;
  /** Relax the cross criterion to permutation-only (see PhaseSplitter). */
  relaxedCross?: boolean;
  /** Written PLL block face-move count (text route) — AUF reclass guard. */
  writtenPllMoves?: number;
}

export function recoverRotatedFrame(
  timeline: SolveTimeline,
  method: MethodDefinition,
  options?: FrameRecoveryOptions,
): PhaseDetectionReport | null {
  const report = timeline.detectionReport;
  if (!report || !report.finalStateSolved) return null;

  const last = timeline.entries[timeline.entries.length - 1];
  if (!last) return null;
  const finalState = TimelineBuilder.fromSnapshot(last.state);
  if (finalState.isSolved()) return null;

  const recovery = finalState.findRecoveryRotation();
  if (!recovery) return null;

  for (const entry of timeline.entries) {
    const c = TimelineBuilder.fromSnapshot(entry.state);
    c.multiply(recovery);
    entry.state = TimelineBuilder.toSnapshot(c);
  }
  const rotated = PhaseSplitter.splitAndAnnotate(timeline, method, options);
  return rotated.detectionReport ?? null;
}
