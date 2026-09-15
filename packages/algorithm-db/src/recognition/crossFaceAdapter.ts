/**
 * crossFaceAdapter.ts — Cube rotations that map between cross faces.
 *
 * The seed catalog is defined with the D-cross frame (corners 4-7,
 * edges 8-11). To build a native catalog for a solver whose cross is on
 * U (or any other face), we rotate the catalog states by the inverse of
 * the cross-face rotation BEFORE computing signatures.
 *
 * This is done ONCE at catalog build time — the solver states are NEVER
 * rotated to D-cross (that approach loses slot ancestry and is fragile).
 *
 * Also provides `recolorState` for normalizing sticker colors via the
 * solver's color scheme.
 */
import { CubeState, FaceletStringConverter } from '@cubalyze/math-core';

// ─── Cross-face rotations ───────────────────────────────────────────────────

/**
 * Cube rotation that maps the canonical D-cross frame to each cross face.
 * Applying this rotation to a D-cross state produces a state in the
 * target crossFace frame.
 *
 * Verified: the 4 D-cross F2L corners (4-7) rotate exactly to the
 * target crossFace's f2lCorners (e.g. x2 → U-cross corners 0-3).
 *
 * Inverses are used when the catalog is built natively for the target
 * crossFace (the builder applies `inverse` to the catalog state so it
 * sits in the solver's frame).
 */
export const D_TO_CROSS: Record<string, string> = {
  D: '',       // identity
  U: 'x2',     // U↔D, F↔B
  F: 'x',      // D→F
  B: "x'",     // D→B
  R: "z'",     // D→R
  L: 'z',      // D→L
};

/** Inverse of D_TO_CROSS: maps crossFace → D (= CROSS_TO_D). */
export const CROSS_TO_D: Record<string, string> = {
  D: '',
  U: 'x2',
  F: "x'",
  B: 'x',
  R: 'z',
  L: "z'",
};

// ─── Recoloring ─────────────────────────────────────────────────────────────

/**
 * Recolor a cube state from the solver's color scheme to the canonical
 * (identity) scheme. Same mechanism as `ColorPhaseDetector`: each sticker
 * is re-labelled with the solver face that shows it.
 *
 * `scheme` maps solver face → canonical color letter
 *   (e.g. { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' }
 *         for a white-on-U solver's cross color).
 */
export function recolorState(
  state: CubeState,
  scheme: Record<string, string>,
): CubeState {
  const facelets = FaceletStringConverter.toFaceletString(state);
  const inverse: Record<string, string> = {};
  for (const f of 'URFDLB'.split('')) inverse[scheme[f]] = f;

  let out = '';
  for (const ch of facelets) out += inverse[ch] ?? ch;

  return FaceletStringConverter.fromFaceletString(out);
}