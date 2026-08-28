/**
 * probes/lastLayerProbes.ts — Last-layer detection probes (OLL + PLL).
 *
 * Both probes normalize the solver frame onto the D-cross anchor (cross on
 * D → last layer on U), verify the U-layer positions actually hold the
 * last-layer pieces (the state is at the LL stage), and compute a signature
 * minimized over the 4 y-rotations (which for the LLM is exactly AUF).
 *
 *   • last-layer-orientation — reads the Kociemba orientation bits (eo/co)
 *     of the 8 U-layer pieces. OLL is the orientation pattern of the last
 *     layer, so this is a bijection onto the 57 cases (validated in the
 *     recognition test suite). Color-agnostic by construction: a white- or
 *     yellow-cross solver sees the same OLL pattern, just rotated.
 *
 *   • last-layer-permutation — reads the piece IDs (cp/ep) of the 8 U-layer
 *     pieces once everything is oriented. The permutation of the 8 pieces
 *     up to AUF is exactly the PLL case (21 cases). The probe REJECTS any
 *     state with a misoriented last-layer piece, so an OLL state can never
 *     alias onto a PLL permutation signature.
 *
 *   The permutation signature is canonicalized over the TWO-SIDED AUF orbit
 *   { U^a · state · U^b } — not just the one-sided y-rotation orbit
 *   { state · y^k }. A PLL executed with its AUF folded into the algorithm
 *   (a leading regrip or a trailing U') produces a pre-state that differs
 *   from the catalog case by a LEFT multiplication U^a · state, which a
 *   one-sided minimization can never reach. Canonicalizing both sides makes
 *   the signature invariant under any AUF placement, which is exactly the
 *   PLL equivalence class (validated: no two of the 21 cases collide).
 *
 * Both probes expose `aufFace`: the sticker on the U face that sits at the
 * solver's F position in the observed state. The catalog renders a case at
 * its canonical AUF; the renderer rotates the diagram by this AUF so the
 * case is shown from the solver's exact angle.
 *
 * Signatures are namespaced ('O:' / 'P:') so the three probe families can
 * share the same flat catalog without ever colliding.
 */
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { CROSS_TO_D } from '../crossFaceAdapter';
import type { DetectionProbe } from './types';

/** The 4 y-rotations — the AUF equivalence class of a last layer. */
const Y_ROTATIONS = ['', 'y', 'y2', "y'"] as const;

/** The 4 U-turns — the AUF turns of the last layer, for both sides of the orbit. */
const U_AUFS = ['', 'U', 'U2', "U'"] as const;

/**
 * Which piece family occupies the 4 U-layer positions (the last-layer
 * positions of the D-cross anchor):
 *
 *   'upper' — pieces 0-3 / 0-3 (corners/edges): the canonical U-color
 *             pieces. This is the seed/catalog convention (LL on U with the
 *             U color).
 *   'lower' — pieces 4-7 / 4-7: the canonical D-color pieces. Reached when
 *             the solver's cross color is the canonical U color on a NON-D
 *             cross face (e.g. a white cross built on U — the recolor then
 *             leaves the identity scheme, so the LL keeps the canonical D
 *             color and lands on the anchor's U positions as pieces 4-7
 *             after normalization). The PLL signature must relabel these
 *             onto 0-3 to compare against the catalog.
 *   null    — mixed (or E-slice) pieces: the last layer is not assembled
 *             yet, no LL signature applies.
 */
function lastLayerPieceKind(
  state: CubeState,
): 'upper' | 'lower' | null {
  const cp = state.cp;
  const ep = state.ep;
  const cUpper = cp[0] <= 3 && cp[1] <= 3 && cp[2] <= 3 && cp[3] <= 3;
  const cLower = cp[0] >= 4 && cp[1] >= 4 && cp[2] >= 4 && cp[3] >= 4;
  const eUpper = ep[0] <= 3 && ep[1] <= 3 && ep[2] <= 3 && ep[3] <= 3;
  const eLower = ep[0] >= 4 && ep[1] >= 4 && ep[2] >= 4 && ep[3] >= 4;
  if (cUpper && eUpper) return 'upper';
  if (cLower && eLower) return 'lower';
  return null;
}

/**
 * Rotate a solver-frame state onto the D-cross anchor (cross face on D,
 * last layer on U). Identity for D-cross frames.
 */
function normalizeToAnchor(state: CubeState, crossFace: string): CubeState {
  const rotation = CROSS_TO_D[crossFace];
  if (!rotation) return state;
  const normalized = state.clone();
  normalized.applySequence(rotation);
  return normalized;
}

/**
 * Canonical signature = the lexicographically smallest string over the 4
 * y-rotations. Applying 'y' to the state rotates the U-layer positions, so
 * the min exactly canonicalizes the AUF class.
 *
 * Returns the signature AND the y-rotation that produced it, so the AUF
 * face of the observed state can be recovered for exact-angle rendering.
 */
function minimizeOverY(
  state: CubeState,
  build: (rotated: CubeState) => string,
): { signature: string; y: string } {
  let best: { signature: string; y: string } | null = null;
  for (const y of Y_ROTATIONS) {
    const rotated = y
      ? (() => {
          const t = state.clone();
          t.applySequence(y);
          return t;
        })()
      : state;
    const sig = build(rotated);
    if (best === null || sig < best.signature) best = { signature: sig, y };
  }
  return best ?? { signature: '', y: '' };
}

/**
 * Canonical signature = the lexicographically smallest string over the
 * TWO-SIDED AUF orbit { U^a · state · U^b }.
 *
 * The one-sided y-minimization only canonicalizes AUFs applied AFTER the
 * state (state · U^b). But a PLL executed with its AUF folded into the
 * algorithm — a leading regrip, or a trailing U' as in #2286's
 * `x R2 F R F' R U2 r' U r U2 x' U'` — leaves a pre-state that differs from
 * the catalog case by a LEFT multiplication U^a · state. That state is
 * unreachable from the one-sided orbit, so the case goes unrecognized.
 *
 * Minimizing over both sides makes the signature invariant under any AUF
 * placement — exactly the PLL equivalence class. The left multiplication is
 * `state(U^a).multiply(state)` (compose the U-turn permutation onto the
 * state); the right multiplication appends the U-turn to the state.
 *
 * Returns the signature AND the (left, right) turns that produced it, so
 * the AUF face of the observed state can be recovered for exact-angle
 * rendering.
 */
function minimizeOverTwoSidedU(
  state: CubeState,
  build: (rotated: CubeState) => string,
): { signature: string; left: string; right: string } {
  let best: { signature: string; left: string; right: string } | null = null;
  for (const left of U_AUFS) {
    // U^left · state  (compose the U-turn permutation in front of the state)
    const leftState = left
      ? (() => {
          const u = new CubeState();
          u.applySequence(left);
          u.multiply(state);
          return u;
        })()
      : state;
    for (const right of U_AUFS) {
      // (U^left · state) · U^right
      const cand = right
        ? (() => {
            const t = leftState.clone();
            t.applySequence(right);
            return t;
          })()
        : leftState;
      const sig = build(cand);
      if (best === null || sig < best.signature) best = { signature: sig, left, right };
    }
  }
  return best ?? { signature: '', left: '', right: '' };
}

/**
 * The canonical U facelet index that sits at the solver's F position.
 *
 * The canonical U face is facelet indices 0-8, with the F position at the
 * bottom-center (indices 6-8 are the row touching F; the center of that
 * row is index 7). The y-rotation that minimized the signature maps the
 * solver's frame onto the canonical one; reading the anchor's U facelet at
 * this position yields the sticker that faced the solver.
 */
const U_F_FACELET = 7;

/**
 * Mapping for lower LL pieces (canonical D-color pieces rotated to the U layer):
 * Relabels piece IDs onto 0-3 according to their home position under the D-cross anchor
 * without spatial reflection (preserving chirality and permutation conjugacy).
 */
const LOWER_CORNER_MAP: Record<number, number> = { 7: 0, 6: 1, 5: 2, 4: 3 };
const LOWER_EDGE_MAP: Record<number, number> = { 4: 0, 7: 1, 6: 2, 5: 3 };

function relabelLowerAnchor(anchor: CubeState): CubeState {
  const cp = Array.from(anchor.cp);
  const ep = Array.from(anchor.ep);
  for (let i = 0; i < 4; i++) {
    cp[i] = LOWER_CORNER_MAP[cp[i]] ?? cp[i];
    ep[i] = LOWER_EDGE_MAP[ep[i]] ?? ep[i];
  }
  return new CubeState(cp, anchor.co, ep, anchor.eo);
}

/**
 * Which sticker on the U face sits at the F position of the SOLVER's frame.
 *
 * `anchor` is the solver-frame state normalized onto the D-cross anchor
 * (before any y-minimization). The y-rotation that minimized the signature
 * maps the solver frame onto the canonical one, so the canonical U facelet
 * at the F position shows the sticker that faced the solver.
 */
function aufFaceOf(anchor: CubeState, y: string): string | undefined {
  if (!y) return undefined; // already canonical — no rotation needed
  const facelets = FaceletStringConverter.toFaceletString(anchor);
  return facelets[U_F_FACELET] ?? undefined;
}

export const lastLayerOrientationProbe: DetectionProbe = {
  kind: 'last-layer-orientation',

  /** Seed setups are canonical: cross on D, last layer on U. */
  catalogContext: () => ({
    probe: 'last-layer-orientation',
    crossFace: 'D',
  }),

  signature(state, ctx) {
    if (ctx.probe !== 'last-layer-orientation') return '';
    const anchor = normalizeToAnchor(state, ctx.crossFace);
    const kind = lastLayerPieceKind(anchor);
    if (!kind) return '';

    return minimizeOverY(anchor, (t) => {
      const eo = t.eo;
      const co = t.co;
      // Edge orientation bits (0/1) + corner twists (0/1/2) of the 4
      // U-layer pieces: the complete OLL orientation pattern.
      return `O:${eo[0]}${eo[1]}${eo[2]}${eo[3]}|${co[0]}${co[1]}${co[2]}${co[3]}`;
    }).signature;
  },

  aufFace(state, ctx, signature) {
    if (ctx.probe !== 'last-layer-orientation' || !signature) return undefined;
    const anchor = normalizeToAnchor(state, ctx.crossFace);
    if (!lastLayerPieceKind(anchor)) return undefined;
    const { y } = minimizeOverY(anchor, (t) => {
      const eo = t.eo;
      const co = t.co;
      return `O:${eo[0]}${eo[1]}${eo[2]}${eo[3]}|${co[0]}${co[1]}${co[2]}${co[3]}`;
    });
    return aufFaceOf(anchor, y);
  },
};

export const lastLayerPermutationProbe: DetectionProbe = {
  kind: 'last-layer-permutation',

  /** Seed catalog is canonical (last layer on U, fully oriented). */
  catalogContext: () => ({
    probe: 'last-layer-permutation',
    crossFace: 'D',
  }),

  signature(state, ctx) {
    if (ctx.probe !== 'last-layer-permutation') return '';
    const anchor = normalizeToAnchor(state, ctx.crossFace);
    const kind = lastLayerPieceKind(anchor);
    if (!kind) return '';

    // A PLL state is fully oriented by definition: reject any misoriented
    // last-layer piece so an OLL state can never alias a permutation.
    for (let p = 0; p < 4; p++) {
      if (anchor.co[p] !== 0 || anchor.eo[p] !== 0) return '';
    }

    const work = kind === 'lower' ? relabelLowerAnchor(anchor) : anchor;

    // Canonicalize over the TWO-SIDED AUF orbit: a PLL pre-state can differ
    // from the catalog case by a leading AUF (left multiplication) when the
    // solver folds the AUF into the algorithm, so a one-sided y-rotation
    // minimization would miss it.
    return minimizeOverTwoSidedU(work, (t) => {
      const cp = t.cp;
      const ep = t.ep;
      // Piece IDs of the 4 U-layer corners + 4 U-layer edges — the
      // permutation of the last layer, canonicalized over AUF.
      return `P:${cp[0]}${cp[1]}${cp[2]}${cp[3]}|${ep[0]}${ep[1]}${ep[2]}${ep[3]}`;
    }).signature;
  },

  aufFace(state, ctx, signature) {
    if (ctx.probe !== 'last-layer-permutation' || !signature) return undefined;
    const anchor = normalizeToAnchor(state, ctx.crossFace);
    if (!lastLayerPieceKind(anchor)) return undefined;
    // A PLL state is fully oriented by definition: reject any misoriented
    // last-layer piece so an OLL state can never alias a permutation.
    for (let p = 0; p < 4; p++) {
      if (anchor.co[p] !== 0 || anchor.eo[p] !== 0) return undefined;
    }
    // The AUF face is the sticker on the solver's U face at the F position
    // in the OBSERVED state (the anchor before any canonicalization
    // rotation) — the sticker the solver actually faced. Return it whenever
    // the state is a valid PLL, so the renderer can rotate the diagram to
    // the solver's exact angle.
    const facelets = FaceletStringConverter.toFaceletString(anchor);
    return facelets[U_F_FACELET] ?? undefined;
  },
};