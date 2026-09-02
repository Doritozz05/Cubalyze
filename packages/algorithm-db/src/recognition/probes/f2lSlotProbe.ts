/**
 * probes/f2lSlotProbe.ts — F2L slot detection probe.
 *
 * Two complementary reading strategies, both framed around PIECE identity:
 *
 *   1. FRAME instance (the production path, unchanged): resolve the pair
 *      pieces BY COLOR for the slot, rotate the state onto the D-cross
 *      anchor, and compute the relational pair signature (minimized over
 *      y × AUF). See pairSignature.ts for the signature semantics.
 *
 *   2. ANCHOR instance (fallback, `anchorSignature`): normalize the state
 *      onto the D-cross anchor FIRST, then resolve the pair as the pieces
 *      showing the anchor slot's letters ('D','F','R') and sign them with
 *      the anchor cross color 'D'. This answers "which case is THIS
 *      physical cube", independent of the frame label.
 *
 * Why both are needed (measured, see the matrix tests):
 *   A physically rotated state labeled with a rotated frame (the same cube
 *   held x2, labeled U-cross) makes the frame-color resolution read the
 *   MIRROR pair instance (white-blue-red instead of white-green-red) — the
 *   letters shown by the frame's slot are not the anchor pair's letters.
 *   The frame-context path then returns another case or unknown, while the
 *   anchor path returns the cube's true case. Conversely, real solves fed
 *   as recolored solver-frame states are only consistent under the FRAME
 *   reading — so the detector tries the frame path first (zero behavior
 *   change there) and falls back to the anchor path.
 *
 *   The frame-AUF ('U','U2','U\'') is undone BEFORE signing when the caller
 *   provides it: for D/U crosses the relational signature's internal
 *   U-orbit already absorbs it, but for F/B/R/L frames the solver's U-turn
 *   conjugates to a D-layer turn in the anchor frame — an orbit the
 *   signature must NOT sweep (sweeping it merges genuinely distinct D-cross
 *   cases: measured collisions like F2L 5+U ≡ F2L 21). Regularizing the
 *   observed state instead keeps the signature's discrimination intact.
 */
import { FaceletStringConverter, type CubeState } from '@cubeforge/math-core';
import { pairSignature } from '../pairSignature';
import { resolveSlotPiecesByColor, slotToFRRotation } from '../slotResolver';
import { CROSS_TO_D, D_TO_CROSS } from '../crossFaceAdapter';
import type { DetectionProbe } from './types';

/** Facelet index of each face's center (U:4, R:13, F:22, D:31, L:40, B:49). */
const CENTER_FACELET: Record<string, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

/** Facelet index of the center of a given face (undefined for unknown). */
function centerFacelet(face: string): number | undefined {
  return CENTER_FACELET[face];
}

/**
 * Undo the solver's frame-AUF in the observed state's letter space.
 *
 * The solver's U-turn, seen from the frame's camera, is the conjugation
 * `r auf⁻¹ r'` with r = D_TO_CROSS[crossFace] — a plain move sequence.
 */
function undoCubeAuf(state: CubeState, crossFace: string, auf: string): CubeState {
  const inv = auf === 'U' ? "U'" : auf === 'U2' ? 'U2' : 'U';
  const seq = [D_TO_CROSS[crossFace], inv, CROSS_TO_D[crossFace]]
    .filter((m): m is string => Boolean(m))
    .join(' ');
  const t = state.clone();
  if (seq) t.applySequence(seq);
  return t;
}

export const f2lSlotProbe: DetectionProbe = {
  kind: 'f2l-slot',

  /**
   * The catalog is keyed on the D-cross FR anchor: every seed setup is
   * D-cross, and its FR slot is the canonical anchor slot.
   */
  catalogContext: () => ({
    probe: 'f2l-slot',
    crossFace: 'D',
    slotName: 'FR',
  }),

  signature(state, ctx) {
    if (ctx.probe !== 'f2l-slot') return '';
    const { crossFace, slotName, auf, pieces } = ctx;

    // Regularize the observed AUF before any reading (see module docs).
    const observed = auf ? undoCubeAuf(state, crossFace, auf) : state;

    // Resolve the pair pieces BY COLOR for the slot — a corner parked in a
    // neighboring slot still resolves to its own pair (see slotResolver).
    // The PIECE-ANCHORED contract overrides this: when the caller passes
    // the pair's pieces (it knows them — e.g. the trainer injects by piece
    // ID), those win over any color reading.
    const resolved = resolveSlotPiecesByColor(observed, crossFace, slotName);
    if (!resolved && !pieces) return '';

    // Normalize the pair into the D-cross anchor frame. The relational
    // signature additionally minimizes over all y-rotations × AUF, so the
    // pair is recognized regardless of which slot it sits in.
    const rotation = slotToFRRotation(crossFace, slotName);
    if (rotation === null) return '';

    const normalized = observed.clone();
    if (rotation) normalized.applySequence(rotation);

    // The cross sticker's color in this state (the center of the cross
    // face): 'D' for D-cross solves, 'R' for R-cross, etc. The signature
    // identifies the pair's cross sticker by this color, then records it by
    // face POSITION — after the rotation above every cross face sits on the
    // D-cross anchor face, so the signature matches the 'D'-seeded catalog.
    const facelets = FaceletStringConverter.toFaceletString(state);
    const crossIdx = centerFacelet(crossFace);
    const frameCrossColor =
      crossIdx !== undefined ? (facelets[crossIdx] ?? 'D') : 'D';

    const C = pieces?.C ?? resolved!.C;
    const E = pieces?.E ?? resolved!.E;
    const crossColor = pieces?.crossColor ?? frameCrossColor;

    try {
      return pairSignature(normalized, C, E, crossColor);
    } catch {
      return '';
    }
  },

  /**
   * ANCHOR-instance signature: the case of the physical cube.
   *
   * Normalize the state onto the D-cross anchor, then resolve the pair as
   * the pieces showing the ANCHOR slot's letters — the same instance every
   * D-cross seed case is built from. On states whose letters are frame-
   * consistent this equals the frame reading; on rotated states labeled
   * with a rotated frame it is the reading that identifies the true cube.
   */
  anchorSignature(state, ctx) {
    if (ctx.probe !== 'f2l-slot') return '';
    const { crossFace, slotName, auf } = ctx;
    const observed = auf ? undoCubeAuf(state, crossFace, auf) : state;

    const rotation = slotToFRRotation(crossFace, slotName);
    if (rotation === null) return '';
    const normalized = observed.clone();
    if (rotation) normalized.applySequence(rotation);

    const pieces = resolveSlotPiecesByColor(normalized, 'D', 'FR');
    if (!pieces) return '';
    try {
      return pairSignature(normalized, pieces.C, pieces.E, 'D');
    } catch {
      return '';
    }
  },
};