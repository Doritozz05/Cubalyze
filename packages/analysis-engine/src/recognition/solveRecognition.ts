/**
 * solveRecognition.ts — bridge between the analysis pipeline (TimelineBuilder
 * → PhaseSplitter) and the formal reconstruction recognition in
 * `@cubeforge/algorithm-db` (recognition/).
 *
 * The metrics pipeline computes TIMINGS (TPS, pauses, phase durations) from
 * the timeline. This module adds CASE RECOGNITION — the F2L case per pair,
 * the OLL case, the PLL case, the cross verification, the recovered
 * inspection — computed from the SAME timeline phases and the same scramble,
 * so both views are consistent and nothing from the metrics pipeline is
 * lost: `recognizeSolve` is a pure, deterministic companion, not a
 * replacement.
 *
 * The timeline entries were built by replaying `moveToNotation(face,
 * direction)` per event, so the phase move strings we feed to
 * `analyzeReconstruction` reproduce the timeline's states exactly.
 */
import { analyzeReconstruction } from '@cubeforge/algorithm-db';
import { MoveTransformer } from '@cubeforge/math-core';
import type { CubeState } from '@cubeforge/math-core';
import type { SolveTimeline } from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

/** One recognized F2L pair (a slot that completed during an F2L phase). */
export interface RecognizedPair {
  pairNumber: number;
  /** The slot that completed: FR/FL/BL/BR (frame-relative) or null. */
  slot: 'FR' | 'FL' | 'BL' | 'BR' | null;
  /** Catalog case number (e.g. "F2L 11") or null when unrecognized. */
  caseNumber: string | null;
  /** All catalog numbers sharing this arrangement (advanced reuse). */
  candidates: string[];
  /** Case matched AND the slot completed — otherwise the entry is UNKNOWN. */
  verified: boolean;
  /** Leading U moves of the pair's phase (heuristic AUF; display-only). */
  aufMove: string[];
}

export interface SolveRecognition {
  /** The full stream returns to a rotation of the scheme's solved cube. */
  finalSolved: boolean;
  /** Grip rotation of the final state, or null when exactly solved. */
  finalRotation: string | null;
  /**
   * Whole-cube rotation recovered (or given) as the solver's inspection.
   * Empty when none was needed/found.
   */
  inspection: string;
  /** The Cross phase leaves the cross on D (in the detected scheme). */
  crossVerified: boolean;
  /** One entry per completed slot in the F2L phases. */
  pairs: RecognizedPair[];
  /** OLL case + AUF (null when no OLL phase or no convention). */
  oll: {
    caseNumber: string | null;
    candidates: string[];
    auf: number | null;
    /** Last layer oriented at the OLL phase end. */
    verified: boolean;
  } | null;
  /** PLL case + AUF (null when no PLL phase or no convention). */
  pll: {
    caseNumber: string | null;
    candidates: string[];
    auf: number | null;
    /** Final state solved (exactly or up to a rotation). */
    verified: boolean;
  } | null;
  /** Justification trace (for debugging / UI "why this case"). */
  debug: string[];
}

export interface RecognizeSolveOptions {
  /**
   * The solver's inspection (e.g. "x2") for reconstructions written in the
   * solver's coordinate system (CubeRoot/Quest pastes). Smart-cube solves
   * (physical moves) should omit it; the pipeline then recovers any
   * stripped inspection automatically.
   */
  inspection?: string;
}

/**
 * Recognize the cases of an already phase-annotated solve timeline.
 *
 * @param timeline - SolveTimeline with `phases` populated (PhaseSplitter).
 * @param scramble - The WCA scramble the solve started from (when known).
 * @returns The recognition result, or null when the timeline has no phases.
 */
export function recognizeSolve(
  timeline: SolveTimeline,
  scramble?: string,
  options: RecognizeSolveOptions = {},
): SolveRecognition | null {
  // The PhaseSplitter emits one segment per stage (Cross / F2L / OLL / PLL).
  // Segments are completion-based, NOT a strict partition: a phase whose mask
  // completes at the same move as the previous one is `skipped` (owns no move,
  // its startIndex == endIndex == completionIndex) and must not be replayed.
  // Filtering `skipped` leaves a clean, non-overlapping partition of the
  // attributed moves. `analyzeReconstruction` additionally walks a single F2L
  // phase and splits it into per-pair entries, so no functionality is lost.
  const phaseMoves = timeline.phases
    .filter((p) => !p.skipped && p.startIndex <= p.endIndex)
    .map((p) => ({
      name: p.phaseName,
      moves: timeline.entries
        .slice(p.startIndex, p.endIndex + 1)
        .map((e) => MoveTransformer.moveToNotation(e.move.face, e.move.direction))
        .join(' '),
    }));

  if (phaseMoves.length === 0) return null;

  // Replay from the timeline's ACTUAL initial state — the state the first
  // move was applied to (derived by un-applying it from the first entry).
  // When the timeline was seeded from real facelets (smart cube), this
  // differs from `scramble·solved`; passing it as `startState` keeps the
  // recognition bit-for-bit aligned with the timeline's physical states
  // (the analyzer then skips the scramble). The inverse is trivial for a
  // single move: 1→3 (R→R'), -1→1 (R'→R), 2→2.
  let startState: CubeState | undefined;
  const first = timeline.entries[0];
  if (first) {
    const init = TimelineBuilder.fromSnapshot(first.state);
    const invToken =
      first.move.face + (first.move.direction === -1 ? '' : first.move.direction === 2 ? '2' : "'");
    try {
      init.applySequence(invToken);
      startState = init;
    } catch {
      startState = undefined;
    }
  }

  const result = analyzeReconstruction({
    phases: phaseMoves,
    inspection: options.inspection,
    startState,
  });

  return {
    finalSolved: result.finalSolved,
    finalRotation: result.finalRotation,
    inspection: result.inspection,
    crossVerified: result.crossVerified,
    pairs: result.pairs.map((p, i) => ({
      pairNumber: i + 1,
      slot: p.slot,
      caseNumber: p.caseMatch.caseNumber,
      candidates: p.caseMatch.candidates,
      verified: p.verified,
      aufMove: p.aufMove,
    })),
    oll: result.oll
      ? {
          caseNumber: result.oll.caseMatch.caseNumber,
          candidates: result.oll.caseMatch.candidates,
          auf: result.oll.auf,
          verified: result.oll.verified,
        }
      : null,
    pll: result.pll
      ? {
          caseNumber: result.pll.caseMatch.caseNumber,
          candidates: result.pll.caseMatch.candidates,
          auf: result.pll.auf,
          verified: result.pll.verified,
        }
      : null,
    debug: result.debug,
  };
}
