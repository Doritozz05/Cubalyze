/**
 * pairSignature.ts — Relational pair signature.
 *
 * A pair is identified by its two pieces (corner C + edge E). The
 * signature captures their positions AND the color RELATIONSHIP between
 * them in a form that is:
 *
 *   • invariant under AUF (U turns) and under slot choice (y rotations) —
 *     the minimum over the 16 rotations {id, y, y2, y'} × {id, U, U2, U'},
 *   • piece-agnostic: it encodes the sticker arrangement through the
 *     colors shared between corner and edge, never through the (piece,
 *     position)-relative orientation bits.  The same case with the two
 *     side colors swapped (the "mirror" twist, e.g. a blue-red pair vs a
 *     green-red pair) collapses onto the same signature — the pair does
 *     not connect after the up move in both, i.e. both are the same case.
 *   • distinct across all 41 Basic F2L cases (validated empirically).
 *
 * Format: "cornerPos|crossFace+cornerSideFaces|edgePos|edgeLabels"
 *   • cornerPos/edgePos — positions after the minimizing rotation.
 *   • crossFace+cornerSideFaces — which face holds the cross-color
 *     sticker and (sorted) which faces hold the two side stickers.
 *   • edgeLabels — for each edge face (sorted), the corner side face
 *     whose color the edge sticker shares ('?' when it matches nothing,
 *     which cannot be a valid F2L pair).
 *
 * The Pb/Pi distinction falls out of edgeLabels: the front-coincidence
 * rule (edge-front sticker == corner-front sticker ⟺ the pair does NOT
 * connect after the up move ⟺ Pb) is exactly the label of the edge's
 * front face matching the corner's front side face.
 */
import {
  CubeState,
  FaceletStringConverter,
  cornerFacelet,
  edgeFacelet,
} from '@cubeforge/math-core';

/** Canonical face order used to sort face pairs deterministically. */
const FACE_ORDER: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

/** The face a facelet index belongs to (URFDLB order, 9 facelets per face). */
function faceOf(facelet: number): string {
  return 'URFDLB'[Math.floor(facelet / 9)];
}

/**
 * Compute the canonical (slot- and AUF-minimized) relational signature of
 * a pair.
 *
 * The signature is cross-face-agnostic: `crossColor` is the color letter
 * of the pair's cross sticker (the center color of the cross face in the
 * observed state — 'D' for a D-cross solve, 'R' for an R-cross solve,
 * etc.). The detector's slot→anchor rotation maps every cross face onto
 * the D-cross anchor (cross face position 'D'), so the signature records
 * the cross sticker by its FACE POSITION and the edge↔corner matching by
 * color RELATIONSHIP — never by absolute color letters. A D-cross and an
 * R-cross state with the same relative pair arrangement therefore yield
 * the same signature.
 *
 * @param state — Cube state already rotated to the D-cross anchor frame
 *                (the cross face sits on the 'D' face position).
 * @param cornerId — The piece ID of the corner.
 * @param edgeId — The piece ID of the edge.
 * @param crossColor — The color letter of the cross sticker in `state`
 *                     ('D' for the D-cross seed catalog).
 */
export function pairSignature(
  state: CubeState,
  cornerId: number,
  edgeId: number,
  crossColor = 'D',
): string {
  const cp = Array.from(state.cp);
  const ep = Array.from(state.ep);

  if (cp.indexOf(cornerId) < 0 || ep.indexOf(edgeId) < 0) {
    throw new Error(
      `pairSignature: pieces (C=${cornerId}, E=${edgeId}) not found in state`,
    );
  }

  const yRots = ['', 'y', 'y2', "y'"];
  const aufs = ['', 'U', 'U2', "U'"];
  let best: string | null = null;

  for (const y of yRots) {
    for (const u of aufs) {
      const t = state.clone();
      if (u) t.applySequence(u);
      if (y) t.applySequence(y);

      const facelets = FaceletStringConverter.toFaceletString(t);
      const pC = Array.from(t.cp).indexOf(cornerId);
      const pE = Array.from(t.ep).indexOf(edgeId);

      // Corner: which face holds each sticker, and which is the cross
      // (the sticker carrying the cross face's color).
      const cF = cornerFacelet[pC].map((f) => ({
        face: faceOf(f),
        color: facelets[f],
      }));
      const cross = cF.find((x) => x.color === crossColor);
      if (!cross) continue;
      const sides = cF.filter((x) => x !== cross);

      // Edge: label each face by the corner side face whose color it shares.
      const eF = edgeFacelet[pE].map((f) => ({
        face: faceOf(f),
        color: facelets[f],
      }));
      const sortedEFaces = eF
        .map((x) => x.face)
        .sort((a, b) => FACE_ORDER[a] - FACE_ORDER[b]);
      let labels = '';
      for (const f of sortedEFaces) {
        const c = eF.find((x) => x.face === f)!.color;
        const m = sides.find((s) => s.color === c);
        labels += m ? m.face : '?';
      }

      const sideStr = sides
        .map((s) => s.face)
        .sort((a, b) => FACE_ORDER[a] - FACE_ORDER[b])
        .join('');
      const key = `${pC}|${cross.face}${sideStr}|${pE}|${labels}`;

      if (best === null || key < best) best = key;
    }
  }

  // A pair whose corner lacks a recognizable cross sticker (not a valid
  // recolored F2L pair) yields no key and cannot match the catalog.
  return best ?? '';
}
