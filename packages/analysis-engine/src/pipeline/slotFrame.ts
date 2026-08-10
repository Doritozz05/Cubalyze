import {
  ColorPhaseDetector,
  countCompletedF2LSlotsInFrame,
  rotateDPlusEBlock,
  IDENTITY_SCHEME,
} from '@cubeforge/math-core';
import type { SolveTimeline } from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

export interface SlotFrame {
  /** Cross face in the winning frame. */
  crossFace: string;
  /** Winning scheme (face → color) for the slot analysis. */
  scheme: Record<string, string>;
}

/**
 * Pick the frame (crossFace + scheme) the slot analysis should run in.
 *
 * Two valid labelings of the same physical cube can exist (the color
 * detector derives whichever rotation of the sticker colors fits best — for
 * a solve whose FINAL state is a rotation off canonical, it can pick a
 * rotated scheme even though the solver's actual labeling is the canonical
 * one, and vice versa). The correct labeling for piece-anchored slot checks
 * is the one under which the SOLVER's pairs are home — i.e. the labeling
 * that maximizes completed slots across the F2L span (a wrong labeling only
 * aligns pieces coincidentally).
 *
 * Candidates:
 *   1. the report's scheme (post-recovery detection) — correct for solves
 *      whose recovery rotation matches the solver's frame (grip solves, and
 *      no-grip solves whose final is canonical),
 *   2. the detection re-derived from the preserved SOLVER-FRAME states —
 *      correct for solves that end in a rotated frame with no grip (the
 *      Yiheng-12340 scramble-quirk case) and for consistent grip solves.
 *
 * The F2L span is passed explicitly: the picker must not read
 * `timeline.detectionReport`, which is not yet attached while the report
 * that calls it is being built (the PhaseSplitter runs this DURING
 * buildReport).
 *
 * The winning candidate is used by BOTH the xcross check (PhaseSplitter) and
 * the F2L pair scan (segmentF2LPairs) so the two can never diverge.
 */
export function pickSlotFrame(
  timeline: SolveTimeline,
  reportCrossFace: string | undefined,
  reportScheme: Record<string, string> | null,
  preferredCrossIdx: number | undefined,
  f2lStart: number,
  f2lEnd: number,
): SlotFrame {
  const fallback: SlotFrame = {
    crossFace: reportCrossFace ?? 'D',
    scheme: reportScheme ?? IDENTITY_SCHEME,
  };
  const solverStates = timeline.solverFrameStates;
  if (!solverStates || solverStates.length !== timeline.entries.length) {
    return fallback;
  }

  const states = solverStates.map((snapshot) => TimelineBuilder.fromSnapshot(snapshot));
  const start = f2lStart;
  const end = f2lEnd;

  const candidates: SlotFrame[] = [fallback];
  const solverDetection = ColorPhaseDetector.detect(states, preferredCrossIdx);
  if (solverDetection && solverDetection.completions[0] >= 0) {
    candidates.push({
      crossFace: solverDetection.crossFace as string,
      scheme: solverDetection.scheme as Record<string, string>,
    });
  }

  const score = (frame: SlotFrame): number => {
    let total = 0;
    for (let i = start; i <= end; i++) {
      let cube = states[i];
      const offset = timeline.solverFrameOffsets?.[i] ?? 0;
      if (offset !== 0) cube = rotateDPlusEBlock(cube, -offset);
      total += countCompletedF2LSlotsInFrame(
        cube,
        frame.crossFace,
        frame.scheme,
      ).completedCount;
    }
    return total;
  };

  if (candidates.length === 1) return fallback;
  const reportScore = score(candidates[0]);
  const solverScore = score(candidates[1]);
  return solverScore > reportScore ? candidates[1] : candidates[0];
}
