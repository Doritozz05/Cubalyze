/**
 * conventions.ts — Color conventions for the recognition pipeline.
 *
 * The catalog (seed) is anchored to the Kociemba convention: cross = pieces
 * 4-7 on D, last layer = pieces 0-3 on U. Real reconstructions are written
 * in the solver's color scheme, which can differ (e.g. the solver's white
 * cross uses the pieces the catalog calls "U/yellow"). Rather than making
 * every signature convention-aware, we convert the whole replay into the
 * catalog's scheme with a color remap derived from the solve's own cross
 * color (detected by sticker geometry at the cross completion).
 *
 * After the remap the solve is in the catalog convention: cross = pieces 4-7,
 * LL = pieces 0-3, final state = the catalog's solved cube. All signatures
 * then work unchanged, convention-free.
 */
import {
  CubeState,
  FaceletStringConverter,
  cornerColor,
  edgeColor,
  edgeFacelet,
} from '@cubeforge/math-core';

export interface Convention {
  /** The 4 edge pieces forming the cross (piece ids, catalog frame). */
  crossEdges: number[];
  /** The 4 corner pieces of the first layer (catalog frame). */
  clCorners: number[];
  /** The 4 corner pieces of the last layer (catalog frame). */
  llCorners: number[];
  /** The 4 U/D-ring edge pieces of the last layer (catalog frame). */
  llEdges: number[];
}

/** The catalog convention (Kociemba frame: cross = pieces 4-7 on D). */
export const CATALOG_CONVENTION: Convention = {
  crossEdges: [4, 5, 6, 7],
  clCorners: [4, 5, 6, 7],
  llCorners: [0, 1, 2, 3],
  llEdges: [0, 1, 2, 3],
};

/** The inverted color scheme (solver cross = catalog U color, e.g. white↔yellow swaps). */
export const INVERTED_CONVENTION: Convention = {
  crossEdges: [0, 1, 2, 3],
  clCorners: [0, 1, 2, 3],
  llCorners: [4, 5, 6, 7],
  llEdges: [4, 5, 6, 7],
};

/**
 * Conventions tried when color-based detection fails. Both are U/D-axial
 * (the only frames the Kociemba orientation convention can express). Side
 * crosses are intentionally not listed: they are out of scope.
 */
export const FALLBACK_CONVENTIONS: readonly Convention[] = [
  CATALOG_CONVENTION,
  INVERTED_CONVENTION,
];

const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

function faceOfFacelet(i: number): string {
  if (i < 9) return 'U';
  if (i < 18) return 'R';
  if (i < 27) return 'F';
  if (i < 36) return 'D';
  if (i < 45) return 'L';
  return 'B';
}

const OPPOSITE: Record<string, string> = {
  U: 'D',
  D: 'U',
  F: 'B',
  B: 'F',
  R: 'L',
  L: 'R',
};

/** A color remap: facelet letter → replacement letter. */
export type ColorRemap = Record<string, string>;

/**
 * Detect the solver's cross color at a cross-completed state: the color
 * letter shown by the 4 edge stickers of the face holding the completed
 * cross. Returns null when no face holds a completed cross.
 */
export function detectCrossColor(state: CubeState): string | null {
  const facelets = FaceletStringConverter.toFaceletString(state);
  for (const face of FACE_LETTERS) {
    const stickers: number[] = [];
    for (let e = 0; e < 12; e++) {
      const [a, b] = edgeFacelet[e];
      if (faceOfFacelet(a) === face) stickers.push(a);
      else if (faceOfFacelet(b) === face) stickers.push(b);
    }
    const colors = stickers.map((i) => facelets[i]);
    if (stickers.length === 4 && new Set(colors).size === 1) {
      return colors[0];
    }
  }
  return null;
}

/**
 * Build the color remap converting the solver's scheme to the catalog's:
 * the solver's cross color becomes the catalog's D (white), its opposite
 * becomes U (yellow), everything else is preserved.
 *
 * Returns null when the cross color is not detected or is a side color
 * (side crosses are out of scope: the Kociemba orientation convention is
 * anchored to U/D).
 */
export function buildCatalogRemap(crossColor: string | null): ColorRemap | null {
  if (crossColor === null) return null;
  if (crossColor !== 'U' && crossColor !== 'D') return null; // side cross unsupported
  const opposite = OPPOSITE[crossColor];
  const map: ColorRemap = {};
  for (const f of FACE_LETTERS) map[f] = f;
  map[crossColor] = 'D';
  map[opposite] = 'U';
  return map;
}

/**
 * The color remap converting the inverted scheme to the catalog: the solver
 * writes their cross color with the catalog's U letter, so white↔yellow swap.
 */
export const U_D_SWAP_REMAP: ColorRemap = { U: 'D', D: 'U', R: 'R', F: 'F', L: 'L', B: 'B' };

/**
 * The piece-id permutation induced by a U↔D color swap. White/yellow pieces
 * (ids 0-3 ↔ 4-7) trade identities; the middle-layer pieces (no U/D color)
 * are unchanged. Orientation (co/eo) is preserved: a piece's U/D sticker is
 * still on the same face, so the recolored piece has the same orientation.
 *
 * This is EXACTLY equivalent to the facelet-letter swap for valid states but
 * operates directly on cp/ep — facelet round-trips were found to disagree
 * with CubeState.applySequence on some states (a corner's twist can be
 * re-expressed ambiguously), which silently corrupted remapped trajectories.
 */
const U_D_PIECE_SWAP: { c: [number, number][]; e: [number, number][] } = {
  c: [
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  e: [
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
};

function isUDSwap(remap: ColorRemap): boolean {
  return (
    remap['U'] === 'D' && remap['D'] === 'U' &&
    remap['R'] === 'R' && remap['F'] === 'F' &&
    remap['L'] === 'L' && remap['B'] === 'B'
  );
}

/**
 * Apply a color remap to a state. The cube is physically unchanged; only the
 * color scheme (which pieces are "white") changes. The U↔D swap is applied
 * as an exact piece-id permutation; any other remap falls back to the
 * facelet round-trip (not used by the pipeline today).
 */
export function applyColorRemap(state: CubeState, remap: ColorRemap): CubeState {
  if (isUDSwap(remap)) {
    const cp = Array.from(state.cp);
    const ep = Array.from(state.ep);
    for (const [a, b] of U_D_PIECE_SWAP.c) {
      for (let i = 0; i < 8; i++) {
        if (cp[i] === a) cp[i] = b;
        else if (cp[i] === b) cp[i] = a;
      }
    }
    for (const [a, b] of U_D_PIECE_SWAP.e) {
      for (let i = 0; i < 12; i++) {
        if (ep[i] === a) ep[i] = b;
        else if (ep[i] === b) ep[i] = a;
      }
    }
    return new CubeState(cp, Array.from(state.co), ep, Array.from(state.eo));
  }
  const facelets = FaceletStringConverter.toFaceletString(state);
  const remapped = facelets
    .split('')
    .map((ch) => remap[ch] ?? ch)
    .join('');
  return FaceletStringConverter.fromFaceletString(remapped);
}

/** Detect the solver convention (piece ids) from a cross-completed state. */
export function detectConventionFromColors(state: CubeState): Convention | null {
  const crossColor = detectCrossColor(state);
  if (crossColor === null) return null;
  const crossEdges: number[] = [];
  for (let e = 0; e < 12; e++) if (edgeColor[e].includes(crossColor)) crossEdges.push(e);
  const clCorners: number[] = [];
  for (let c = 0; c < 8; c++) if (cornerColor[c].includes(crossColor)) clCorners.push(c);
  const llCorners: number[] = [];
  for (let c = 0; c < 8; c++) if (!cornerColor[c].includes(crossColor)) llCorners.push(c);
  const llEdges: number[] = [];
  for (let e = 0; e < 8; e++) if (!edgeColor[e].includes(crossColor)) llEdges.push(e);
  if (
    crossEdges.length === 4 && clCorners.length === 4 &&
    llCorners.length === 4 && llEdges.length === 4
  ) {
    return { crossEdges, clCorners, llCorners, llEdges };
  }
  return null;
}
