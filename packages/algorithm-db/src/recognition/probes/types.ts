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
import type { CubeState } from '@cubeforge/math-core';

/** The signature families the detector can recognize. */
export type ProbeKind =
  | 'f2l-slot'
  | 'last-layer-orientation'
  | 'last-layer-permutation';

/** Context for the F2L slot probe — a slot in a cross frame. */
export interface F2LSlotProbeContext {
  probe: 'f2l-slot';
  /** The solver's cross face (D, U, F, B, R, L). */
  crossFace: string;
  /** The slot name in this cross frame (FR, BR, BL, FL, …). */
  slotName: string;
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
   * The AUF face of the state that produced a signature — which sticker on
   * the U face sits at the F position of the solver's frame. Used to render
   * the case from the solver's exact angle (the catalog renders the case at
   * its canonical AUF; the caller rotates by this to match the observed
   * state). Returns undefined when the probe family does not carry an AUF
   * (e.g. the F2L slot probe).
   */
  aufFace?(state: CubeState, ctx: ProbeContext, signature: string): string | undefined;
}