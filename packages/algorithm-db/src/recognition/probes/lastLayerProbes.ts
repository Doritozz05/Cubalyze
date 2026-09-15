/**
 * probes/lastLayerProbes.ts — Last-layer detection probes (OLL + PLL).
 *
 * Both probes normalize the solver frame onto the D-cross anchor (cross on
 * D → last layer on U), verify the U-layer positions actually hold the
 * last-layer pieces (the state is at the LL stage), and compute a signature
 * minimized over the 4 y-rotations (which for the LLM is exactly AUF).
 *
 *   • last-layer-orientation — reads the orientation of the 8 U-layer pieces
 *     by sticker color (the facelet carrying the last-layer color opposite
 *     to the cross face). OLL is the orientation pattern of the last layer,
 *     which is a bijection onto the 57 cases (validated in the recognition
 *     test suite). 100% color-neutral across all 6 cross faces and schemes.
 *
 *   • last-layer-permutation — reads the relative piece IDs of the 8 U-layer
 *     pieces from their side colors relative to the side centers once
 *     everything is oriented. The permutation of the 8 pieces up to AUF is
 *     exactly the PLL case (21 cases). The probe REJECTS any state with a
 *     misoriented last-layer piece, so an OLL state can never alias onto a
 *     PLL permutation signature.
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
import { CubeState, FaceletStringConverter } from '@cubalyze/math-core';
import { CROSS_TO_D } from '../crossFaceAdapter';
import type { DetectionProbe } from './types';

/** The 4 y-rotations — the AUF equivalence class of a last layer. */
const Y_ROTATIONS = ['', 'y', 'y2', "y'"] as const;

/** The 4 U-turns — the AUF turns of the last layer, for both sides of the orbit. */
const U_AUFS = ['', 'U', 'U2', "U'"] as const;

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
 * Map each cross face to the physical face colors that occupy the anchor's
 * { LL (U), F, R, B, L } positions after applying CROSS_TO_D[crossFace].
 */
const ANCHOR_FACE_COLORS: Record<
  string,
  { ll: string; F: string; R: string; B: string; L: string }
> = {
  D: { ll: 'U', F: 'F', R: 'R', B: 'B', L: 'L' },
  U: { ll: 'D', F: 'B', R: 'R', B: 'F', L: 'L' },
  F: { ll: 'B', F: 'U', R: 'R', B: 'D', L: 'L' },
  B: { ll: 'F', F: 'D', R: 'R', B: 'U', L: 'L' },
  R: { ll: 'L', F: 'F', R: 'U', B: 'B', L: 'D' },
  L: { ll: 'R', F: 'F', R: 'D', B: 'B', L: 'U' },
};

/**
 * Determine the last-layer color on an anchor state by finding the unique
 * color present on all 4 U-layer edges. Returns null if the edges do not
 * share a single last-layer color (i.e. not an assembled last layer).
 */
function getLLColor(facelets: string): string | null {
  // Edge 0 (UR: 5, 10), Edge 1 (UF: 7, 19), Edge 2 (UL: 3, 37), Edge 3 (UB: 1, 46)
  const e0 = new Set([facelets[5], facelets[10]]);
  const e1 = new Set([facelets[7], facelets[19]]);
  const e2 = new Set([facelets[3], facelets[37]]);
  const e3 = new Set([facelets[1], facelets[46]]);

  for (const c of e0) {
    if (e1.has(c) && e2.has(c) && e3.has(c)) {
      return c;
    }
  }
  return null;
}

/**
 * Extract the orientation (co and eo) of the 4 U-layer corners and 4 U-layer
 * edges by sticker color on a D-anchored state (cross on D, LL on U).
 *
 * Automatically detects the last-layer color dynamically, working across all
 * 6 cross faces, arbitrary color schemes, and rotated frames.
 */
function extractLLOrientation(
  anchor: CubeState,
  _crossFace = 'D',
): { eo: number[]; co: number[] } | null {
  const facelets = FaceletStringConverter.toFaceletString(anchor);
  const llColor = getLLColor(facelets);
  if (!llColor) return null;

  const co = new Array<number>(4);
  // Corner 0: URF (U: 8, R: 9, F: 20)
  if (facelets[8] === llColor) co[0] = 0;
  else if (facelets[9] === llColor) co[0] = 1;
  else if (facelets[20] === llColor) co[0] = 2;
  else return null;

  // Corner 1: UFL (U: 6, F: 18, L: 38)
  if (facelets[6] === llColor) co[1] = 0;
  else if (facelets[18] === llColor) co[1] = 1;
  else if (facelets[38] === llColor) co[1] = 2;
  else return null;

  // Corner 2: ULB (U: 0, L: 36, B: 47)
  if (facelets[0] === llColor) co[2] = 0;
  else if (facelets[36] === llColor) co[2] = 1;
  else if (facelets[47] === llColor) co[2] = 2;
  else return null;

  // Corner 3: UBR (U: 2, B: 45, R: 11)
  if (facelets[2] === llColor) co[3] = 0;
  else if (facelets[45] === llColor) co[3] = 1;
  else if (facelets[11] === llColor) co[3] = 2;
  else return null;

  const eo = new Array<number>(4);
  // Edge 0: UR (U: 5, R: 10)
  if (facelets[5] === llColor) eo[0] = 0;
  else if (facelets[10] === llColor) eo[0] = 1;
  else return null;

  // Edge 1: UF (U: 7, F: 19)
  if (facelets[7] === llColor) eo[1] = 0;
  else if (facelets[19] === llColor) eo[1] = 1;
  else return null;

  // Edge 2: UL (U: 3, L: 37)
  if (facelets[3] === llColor) eo[2] = 0;
  else if (facelets[37] === llColor) eo[2] = 1;
  else return null;

  // Edge 3: UB (U: 1, B: 46)
  if (facelets[1] === llColor) eo[3] = 0;
  else if (facelets[46] === llColor) eo[3] = 1;
  else return null;

  return { eo, co };
}

/**
 * Extract the relative permutation of the 4 U-layer corners and 4 U-layer
 * edges by matching their side stickers against the side centers (F, R, B, L).
 *
 * Returns a canonical CubeState representing the relative permutation (pieces
 * 0..3 for U-layer, pieces 4..11 identity), or null if the last layer is not
 * fully oriented or not a valid permutation.
 */
function extractLLPermutationState(
  anchor: CubeState,
  crossFace = 'D',
): CubeState | null {
  const orient = extractLLOrientation(anchor, crossFace);
  if (!orient) return null;
  for (let i = 0; i < 4; i++) {
    if (orient.co[i] !== 0 || orient.eo[i] !== 0) return null;
  }

  const facelets = FaceletStringConverter.toFaceletString(anchor);
  const llColor = getLLColor(facelets);
  const colors =
    llColor && llColor === ANCHOR_FACE_COLORS[crossFace]?.ll
      ? ANCHOR_FACE_COLORS[crossFace]
      : ANCHOR_FACE_COLORS.D;

  const cF = colors.F;
  const cR = colors.R;
  const cB = colors.B;
  const cL = colors.L;

  // Map corner side color pairs to logical piece ID:
  // 0: URF {R, F}
  // 1: UFL {F, L}
  // 2: ULB {L, B}
  // 3: UBR {B, R}
  const matchCorner = (sideA: string, sideB: string): number => {
    if ((sideA === cR && sideB === cF) || (sideA === cF && sideB === cR)) return 0;
    if ((sideA === cF && sideB === cL) || (sideA === cL && sideB === cF)) return 1;
    if ((sideA === cL && sideB === cB) || (sideA === cB && sideB === cL)) return 2;
    if ((sideA === cB && sideB === cR) || (sideA === cR && sideB === cB)) return 3;
    return -1;
  };

  const cp = [
    matchCorner(facelets[9], facelets[20]),  // Corner 0: URF (R: 9, F: 20)
    matchCorner(facelets[18], facelets[38]), // Corner 1: UFL (F: 18, L: 38)
    matchCorner(facelets[36], facelets[47]), // Corner 2: ULB (L: 36, B: 47)
    matchCorner(facelets[45], facelets[11]), // Corner 3: UBR (B: 45, R: 11)
  ];
  if (cp.includes(-1) || new Set(cp).size !== 4) return null;

  // Map edge side color to logical piece ID:
  // 0: UR (R)
  // 1: UF (F)
  // 2: UL (L)
  // 3: UB (B)
  const matchEdge = (side: string): number => {
    if (side === cR) return 0;
    if (side === cF) return 1;
    if (side === cL) return 2;
    if (side === cB) return 3;
    return -1;
  };

  const ep = [
    matchEdge(facelets[10]), // Edge 0: UR (R: 10)
    matchEdge(facelets[19]), // Edge 1: UF (F: 19)
    matchEdge(facelets[37]), // Edge 2: UL (L: 37)
    matchEdge(facelets[46]), // Edge 3: UB (B: 46)
  ];
  if (ep.includes(-1) || new Set(ep).size !== 4) return null;

  // Build canonical state for two-sided AUF minimization:
  return new CubeState(
    [cp[0], cp[1], cp[2], cp[3], 4, 5, 6, 7],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [ep[0], ep[1], ep[2], ep[3], 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
}

/**
 * Canonical OLL signature = the lexicographically smallest string over the 4
 * y-rotations.
 */
function minimizeOLLOverY(
  anchor: CubeState,
  crossFace = 'D',
): { signature: string; y: string } {
  let best: { signature: string; y: string } | null = null;
  for (const y of Y_ROTATIONS) {
    const rotated = y
      ? (() => {
          const t = anchor.clone();
          t.applySequence(y);
          return t;
        })()
      : anchor;
    const orient = extractLLOrientation(rotated, crossFace);
    if (!orient) return { signature: '', y: '' };
    const sig = `O:${orient.eo[0]}${orient.eo[1]}${orient.eo[2]}${orient.eo[3]}|${orient.co[0]}${orient.co[1]}${orient.co[2]}${orient.co[3]}`;
    if (best === null || sig < best.signature) best = { signature: sig, y };
  }
  return best ?? { signature: '', y: '' };
}

/**
 * Canonical signature = the lexicographically smallest string over the
 * TWO-SIDED AUF orbit { U^a · state · U^b }.
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
 */
const U_F_FACELET = 7;

/**
 * Which sticker on the U face sits at the F position of the SOLVER's frame.
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
    return minimizeOLLOverY(anchor, ctx.crossFace).signature;
  },

  aufFace(state, ctx, signature) {
    if (ctx.probe !== 'last-layer-orientation' || !signature) return undefined;
    const anchor = normalizeToAnchor(state, ctx.crossFace);
    const { y } = minimizeOLLOverY(anchor, ctx.crossFace);
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
    const work = extractLLPermutationState(anchor, ctx.crossFace);
    if (!work) return '';

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
    const work = extractLLPermutationState(anchor, ctx.crossFace);
    if (!work) return undefined;
    const facelets = FaceletStringConverter.toFaceletString(anchor);
    return facelets[U_F_FACELET] ?? undefined;
  },
};