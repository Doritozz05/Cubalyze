/**
 * probes/f2lSlotProbe.ts — F2L slot detection probe.
 *
 * The original detection strategy, extracted from CaseDetector.detect():
 * resolve the pair pieces BY COLOR for the slot, rotate the state onto the
 * D-cross anchor, and compute the relational pair signature (minimized over
 * y × AUF). See pairSignature.ts for the signature semantics.
 */
import { FaceletStringConverter } from '@cubeforge/math-core';
import { pairSignature } from '../pairSignature';
import { resolveSlotPiecesByColor, slotToFRRotation } from '../slotResolver';
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
    const { crossFace, slotName } = ctx;

    // Resolve the pair pieces BY COLOR for the slot — a corner parked in a
    // neighboring slot still resolves to its own pair (see slotResolver).
    const pieces = resolveSlotPiecesByColor(state, crossFace, slotName);
    if (!pieces) return '';

    // Normalize the pair into the D-cross anchor frame. The relational
    // signature additionally minimizes over all y-rotations × AUF, so the
    // pair is recognized regardless of which slot it sits in.
    const rotation = slotToFRRotation(crossFace, slotName);
    if (rotation === null) return '';

    const normalized = state.clone();
    if (rotation) normalized.applySequence(rotation);

    // The cross sticker's color in this state (the center of the cross
    // face): 'D' for D-cross solves, 'R' for R-cross, etc. The signature
    // identifies the pair's cross sticker by this color, then records it by
    // face POSITION — after the rotation above every cross face sits on the
    // D-cross anchor face, so the signature matches the 'D'-seeded catalog.
    const facelets = FaceletStringConverter.toFaceletString(state);
    const crossIdx = centerFacelet(crossFace);
    const crossColor =
      crossIdx !== undefined ? (facelets[crossIdx] ?? 'D') : 'D';

    try {
      return pairSignature(normalized, pieces.C, pieces.E, crossColor);
    } catch {
      return '';
    }
  },
};
