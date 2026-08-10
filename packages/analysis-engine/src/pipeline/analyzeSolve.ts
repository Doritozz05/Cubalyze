import type {
  CubeMoveEvent,
  CubeOrientation,
  CubeStateSnapshot,
  SolveMetrics,
  SolveTimeline,
} from '@cubeforge/types';
import { CubeState } from '@cubeforge/math-core';
import {
  CFOPDefinition,
  PetrusDefinition,
  RouxFullDefinition,
  ZZDefinition,
  type MethodDefinition,
} from '@cubeforge/math-core';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { recoverRotatedFrame, type FrameRecoveryOptions } from './frameRecovery';

/**
 * Unified analysis core — the ONLY place phase detection runs.
 *
 * Both routes feed the exact same detection code:
 *   - smart cube (useSolveSession): analyzeSolve (async, adds metrics)
 *   - reconstruction text (analyzeSolveText): buildAnnotatedTimeline directly
 *     (it consumes the timeline/report, not the metrics)
 *
 * The detection order is identical for every input:
 *   1. TimelineBuilder.build (initialFacelets > scramble > solved)
 *   2. solveTimeMs override (timer-authoritative duration — smart route)
 *   3. PhaseSplitter.splitAndAnnotate (colorNeutral + optional cross tiebreak)
 *   4. P2 frame recovery (no-op when the final state is canonically solved)
 *
 * Consumers must NEVER re-detect phases or re-derive pairs on their own —
 * that is how divergence creeps in.
 */
export interface AnalyzeSolveInput {
  moves: CubeMoveEvent[];
  method: string;
  scramble?: string;
  orientations?: (CubeOrientation | undefined)[];
  /** 54-char facelet string from the real Smart Cube at solve start. */
  initialFacelets?: string;
  /** Full face+slice token stream for exact state (text path only). */
  stateTokens?: readonly string[];
  /** Tiebreak-only hint: timeline index where the written cross ends. */
  preferredCrossIdx?: number;
  solveTimeMs?: number;
  /**
   * Raw display tokens, one per timeline entry (text route only). Used to
   * track wide d (Dw) regrips — the ONLY signal that distinguishes a d from
   * a plain D in the face-move timeline — so the F2L frame offset can be
   * computed for the solver-frame slot analysis.
   */
  displayTokens?: readonly string[];
  /**
   * The solver's inspection grip — the rotation tokens performed before the
   * first move (text route only). The conjugated timeline is expressed in the
   * scramble frame; piece-anchored slot checks are only meaningful in the
   * frame the solver actually held (built the cross in). The solver-frame
   * states are therefore rotated by the grip's INVERSE. Smart route:
   * undefined — there is no written grip, and the physical frame IS the
   * solver's frame, so the states are kept as-is.
   */
  solverGrip?: readonly string[];
}

/** Wide d (Dw) tokens — the bottom two layers rotate together. Plain 'D'
 *  (uppercase, no w) is a normal face move and must NOT match. */
const WIDE_D_RE = /^d[wW]?[2']?$|^Dw[2']?$/;

/**
 * Invert a rotation token: x → x', x' → x, x2 → x2. Applying the WRITTEN
 * grip tokens (each inverted, same order) to a state composes the inverse of
 * the grip — the grip is built as `compose(latest, previous)` in
 * conjugateToBaseFrame, so its inverse applies the tokens in their written
 * order, each inverted.
 */
function invertRotationToken(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.includes('2')) return token;
  return `${token}'`;
}

/**
 * True when the grip (as applied to the solver-frame states) preserves the
 * D+E block as a SET — i.e. the pieces sitting in the D-layer + equator
 * positions after the rotation are exactly the D+E pieces (identity and
 * y-rotations qualify; x/z grips move the D face off D and do not).
 *
 * The d-regrip offsets (solverFrameOffsets) undo a mid-F2L d with a
 * CANONICAL D+E rotation, which only cancels the regrip when the solver's d
 * was itself a canonical D+E rotation — true when the grip kept the D+E
 * block in place. For an x/z grip the conjugated d rotates a different block
 * and the canonical undo actively corrupts the slot check (the reconz-1296
 * "all pairs vanish" regression), so the offsets are disabled there and the
 * slot scan runs on the grip-fixed states directly.
 */
function gripPreservesDPlusE(grip: readonly string[]): boolean {
  if (grip.length === 0) return true;
  const cube = new CubeState();
  CubeState.initTables();
  for (const token of grip) cube.applySequence(token);
  // D+E piece IDs: D corners + D edges + equator edges (enum values).
  const block = new Set([
    // corners: DFR, DLF, DBL, DRB
    4, 5, 6, 7,
    // edges: DR, DF, DL, DB
    4, 5, 6, 7,
    // equator: FR, FL, BL, BR
    8, 9, 10, 11,
  ]);
  for (let p = 4; p <= 7; p++) if (!block.has(cube.cp[p])) return false;
  for (let p = 4; p <= 11; p++) if (!block.has(cube.ep[p])) return false;
  return true;
}

/**
 * Rotate a snapshot by the inverse of the solver's inspection grip, so the
 * result is the cube as the SOLVER held it during the solve.
 */
function rotateByGripInverse(
  snapshot: CubeStateSnapshot,
  grip: readonly string[],
): CubeStateSnapshot {
  const cube = TimelineBuilder.fromSnapshot(snapshot);
  for (const token of grip) cube.applySequence(invertRotationToken(token));
  return TimelineBuilder.toSnapshot(cube);
}

/**
 * Accumulated F2L frame offset per entry: how many quarter turns the bottom
 * two layers (D+E) were rotated by wide d regrips up to and including that
 * entry. The slot analysis applies the inverse offset (see
 * `rotateDPlusEBlock`) so slot identities stay stable across a mid-F2L d.
 */
export function computeSolverFrameOffsets(
  displayTokens: readonly string[],
): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const token of displayTokens) {
    const norm = token.endsWith("2'") ? token.slice(0, -1) : token;
    if (WIDE_D_RE.test(norm)) {
      if (norm.includes('2')) acc = (acc + 2) & 3;
      else if (norm.includes("'")) acc = (acc + 3) & 3;
      else acc = (acc + 1) & 3;
    }
    offsets.push(acc);
  }
  return offsets;
}

export interface AnalyzeSolveResult {
  timeline: SolveTimeline;
  metrics: SolveMetrics;
}

const METHOD_DEFS: Record<string, MethodDefinition> = {
  CFOP: CFOPDefinition,
  Roux: RouxFullDefinition,
  ZZ: ZZDefinition,
  Petrus: PetrusDefinition,
};

/**
 * Build + annotate the timeline for ANY analysis route (synchronous core).
 *
 * Shared by:
 *   - `analyzeSolve` (smart route) — passes `solveTimeMs` so the report is
 *     built with the authoritative duration (real timestamps);
 *   - `analyzeSolveText` (text route) — omits `solveTimeMs` and applies the
 *     record's total time AFTER detection, so the report keeps the synthetic
 *     timestamp duration and never fabricates an 'unattributed-time' warning.
 *
 * splitAndAnnotate ALWAYS attaches `timeline.detectionReport`, so callers
 * can read it directly.
 */
export function buildAnnotatedTimeline(input: AnalyzeSolveInput): SolveTimeline {
  const methodDef = METHOD_DEFS[input.method] ?? CFOPDefinition;

  const timeline = TimelineBuilder.build(
    input.moves,
    input.method,
    input.orientations,
    input.scramble,
    input.initialFacelets,
    input.stateTokens,
  );

  // Preserve the SOLVER-FRAME states + F2L frame offsets BEFORE the P2 frame
  // recovery rotates the snapshots: slot-level analysis (xcross detection,
  // F2L pairs) is only meaningful in the frame the reconstruction was
  // written in. After the rotation, piece-anchored checks no longer see the
  // solver's slots (the Yiheng-12340 "xcross → plain" regression). The text
  // route rotates them by the inverse of the inspection grip (the conjugated
  // timeline is in the scramble frame); the smart route keeps the physical
  // frame, which IS the solver's frame. Offsets (from the raw d/Dw tokens)
  // are only computable on the text route.
  if (input.displayTokens && input.displayTokens.length === timeline.entries.length) {
    // Text route only: the solver-frame states are the pre-recovery snapshots
    // rotated by the inverse of the inspection grip (the conjugated timeline
    // is in the scramble frame). The smart route keeps NO solver-frame states
    // — its timeline already IS the physical solver frame (P2 never fires
    // there in practice), so its slot analysis stays on the timeline states.
    const grip = input.solverGrip;
    timeline.solverFrameStates = timeline.entries.map((entry) =>
      grip && grip.length > 0
        ? rotateByGripInverse(entry.state, grip)
        : entry.state,
    );
    // The d-regrip offsets are only computable from the raw tokens, and the
    // canonical D+E undo only cancels the regrip when the grip kept the D+E
    // block in place (identity / y-rotations).
    if (gripPreservesDPlusE(grip ?? [])) {
      timeline.solverFrameOffsets = computeSolverFrameOffsets(input.displayTokens);
    }
  }

  if (input.solveTimeMs !== undefined && Number.isFinite(input.solveTimeMs)) {
    timeline.solveTimeMs = Math.max(0, input.solveTimeMs);
  }

  const splitOptions: FrameRecoveryOptions = {
    colorNeutral: true,
    preferredCrossIdx: input.preferredCrossIdx,
  };

  PhaseSplitter.splitAndAnnotate(timeline, methodDef, splitOptions);
  recoverRotatedFrame(timeline, methodDef, splitOptions);
  return timeline;
}

export async function analyzeSolve(
  input: AnalyzeSolveInput,
): Promise<AnalyzeSolveResult> {
  const timeline = buildAnnotatedTimeline(input);
  const metrics = await MetricsAggregator.computeAll(timeline, input.scramble ?? '');
  return { timeline, metrics };
}
