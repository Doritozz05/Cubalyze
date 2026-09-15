/**
 * probes/types.ts — Detection probe abstraction.
 *
 * The CaseDetector recognizes algorithmic cases by looking up a SIGNATURE
 * in a flat catalog. What a signature means depends on what is being
 * detected:
 *
 *   • f2l-slot — a relational pair signature (crossFace + slotName), the
 *     original Basic F2L detector.
 *   • last-layer-orientation — the orientation pattern of the 8 last-layer
 *     pieces (OLL).
 *   • last-layer-permutation — the permutation pattern of the 8 last-layer
 *     pieces once oriented (PLL).
 *
 * A DetectionProbe encapsulates ONE signature family: how to compute it
 * from a solver-frame state, and which anchor context the catalog is keyed
 * on. The catalog builder and the detector both consult the probe, so the
 * catalog and the lookups can never disagree on the signature format.
 */
import type { CubeState } from '@cubalyze/math-core';

/** The signature families the detector can recognize. */
export type ProbeKind =
  | 'f2l-slot'
  | 'last-layer-orientation'
  | 'last-layer-permutation';

/**
 * Optional piece-anchored contract for the F2L slot probe.
 *
 * When the caller KNOWS the pair's physical pieces (the training engine
 * injects pairs by piece ID; the analysis engine resolves them by color
 * in the solver's recolored frame), passing them here makes detection
 * independent of the letter–pose consistency of the input state — the
 * frame-color ambiguity that breaks rotated frames (see f2lSlotProbe).
 */
export interface F2LPairPieces {
  /** Corner piece ID (0-7). */
  C: number;
  /** Edge piece ID (0-11). */
  E: number;
  /**
   * The cross sticker's color letter to search for on the corner
   * ('D' = the D-cross anchor instance, e.g. pieces 4/8 on canonical
   * inputs; the solver's own cross-face letter for its frame instance,
   * e.g. 'U' for a white-on-U training cube). Defaults to the cross
   * face's own letter.
   */
  crossColor?: string;
}

/** Context for the F2L slot probe — a slot in a cross frame. */
export interface F2LSlotProbeContext {
  probe: 'f2l-slot';
  /** The solver's cross face (D, U, F, B, R, L). */
  crossFace: string;
  /** The slot name in this cross frame (FR, BR, BL, FL, …). */
  slotName: string;
  /**
   * The solver's frame-AUF (his own U-layer turn) at the observed cut
   * ('U', 'U2' or "U'"). The probe undoes it (conjugated into the
   * state's letter space) before signing. The relational signature's
   * built-in U-minimization already absorbs the AUF for D-cross inputs;
   * this closes the same gap for F/B/R/L frames, whose AUF conjugates
   * to a D-layer turn — an orbit the signature does not (and must not,
   * see the f2lSlotProbe docs) sweep. Optional.
   */
  auf?: string;
  /**
   * Explicit pair pieces. When provided, the signature is computed from
   * EXACTLY these pieces instead of the color-resolved ones — the
   * piece-anchored contract.
   */
  pieces?: F2LPairPieces;
}

/** Context for the last-layer probes — only the frame anchor matters. */
export interface LastLayerProbeContext {
  probe: 'last-layer-orientation' | 'last-layer-permutation';
  /** The solver's cross face — the last layer is the face opposite it. */
  crossFace: string;
}

/** Discriminated union: each probe knows exactly which context it needs. */
export type ProbeContext = F2LSlotProbeContext | LastLayerProbeContext;

/**
 * A detection probe — the signature strategy for one family of cases.
 *
 * `signature()` is symmetric: the catalog builder calls it on D-anchored
 * seed states with `catalogContext()`, and the detector calls it on
 * solver-frame states with the caller's context. Both sides must produce
 * identical strings for the same case, so the signature format lives in
 * exactly one place.
 *
 * Returns '' when no signature is derivable from the state (unknown).
 */
export interface DetectionProbe {
  readonly kind: ProbeKind;
  /** The anchor-frame context used to build catalog signatures. */
  catalogContext(): ProbeContext;
  /**
   * Compute the catalog signature for a state in the SOLVER's frame.
   *
   * @param state — Cube state at the detection point, already recolored to
   *                the solver's canonical scheme (same contract as the
   *                pipeline's F2L detection).
   * @param ctx — the probe's context (which slot / which frame anchor).
   */
  signature(state: CubeState, ctx: ProbeContext): string;
  /**
   * Optional ANCHOR-INSTANCE signature: the case of the cube itself,
   * independent of the frame label — computed from the D-cross anchor
   * pair instance (the pieces showing the anchor slot's letters after
   * the frame→D normalization). This is the fallback the detector uses
   * when the frame-context signature finds nothing (e.g. a physically
   * rotated state labeled with a rotated frame, where the frame's
   * letters describe a mirrored pair instance).
   */
  anchorSignature?(state: CubeState, ctx: ProbeContext): string;
  /**
   * The AUF face of the state that produced a signature — which sticker on
   * the U face sits at the F position of the solver's frame. Used to render
   * the case from the solver's exact angle (the catalog renders the case at
   * its canonical AUF; the caller rotates by this to match the observed
   * state). Returns undefined when the probe family does not carry an AUF
   * (e.g. the F2L slot probe).
   */
  aufFace?(state: CubeState, ctx: ProbeContext, signature: string): string | undefined;
}