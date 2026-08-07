/**
 * signatures.ts — Formal, convention-independent state signatures.
 *
 * The core insight: a F2L/OLL/PLL case is an EQUIVALENCE CLASS of states
 * under the transformations that do not change the case:
 *
 *   - F2L: rotations of the frame (slot choice, y) and of the U layer (AUF, U)
 *   - OLL: rotations of the U layer (AUF, U) — orientation pattern only
 *   - PLL: rotations of the U layer (AUF, U) — permutation pattern only
 *
 * Every piece gets a ROLE = its home position in the normalized frame (the
 * position it occupies in frame · solved). Roles are therefore structural and
 * convention-independent: whether the cross is pieces 4-7 (catalog) or 0-3
 * (solver), "the piece that belongs at DFR" always has role 4.
 *
 * Signatures are min over the allowed transformation group, so they are
 * invariant under (slot × AUF × frame choice) — two states are the same case
 * iff their signatures are equal.
 */
import { CubeState } from '@cubeforge/math-core';
import { applyRotation, findCrossOnDFrames } from './rotationGroup';

const AUFS = ['', 'U', 'U2', "U'"] as const;

/**
 * Role map of a frame: for every piece, its home position in frame · solved.
 * Roles for corners and edges are tracked separately (corner and edge piece
 * id spaces overlap: both use ids 0-3 for U pieces).
 */
function roleMap(frame: string): { cornerHome: Map<number, number>; edgeHome: Map<number, number> } {
  const solved = applyRotation(new CubeState(), frame);
  const cornerHome = new Map<number, number>();
  const edgeHome = new Map<number, number>();
  for (let pos = 0; pos < 8; pos++) cornerHome.set(solved.cp[pos], pos);
  for (let pos = 0; pos < 12; pos++) edgeHome.set(solved.ep[pos], pos);
  return { cornerHome, edgeHome };
}

/** Apply y^k U^j to a clone of `base` and return it. */
function rotateVariant(base: CubeState, k: number, j: number): CubeState {
  const t = base.clone();
  for (let i = 0; i < k; i++) t.applySequence('y');
  if (j > 0) t.applySequence(AUFS[j]);
  return t;
}

/** The 4 F2L slot homes: corner position (4-7) + edge position (8-11). */
export const F2L_SLOTS: readonly { cornerHome: number; edgeHome: number }[] = [
  { cornerHome: 4, edgeHome: 8 }, // FR
  { cornerHome: 5, edgeHome: 9 }, // FL
  { cornerHome: 6, edgeHome: 10 }, // BL
  { cornerHome: 7, edgeHome: 11 }, // BR
];

/**
 * True when the pair whose home is (cornerHome, edgeHome) is fully solved
 * (both pieces at home with orientation 0) in the cross-on-D frame.
 */
export function pairSolved(
  state: CubeState,
  crossEdges: readonly number[],
  cornerHome: number,
  edgeHome: number,
): boolean {
  const frames = findCrossOnDFrames(state, crossEdges);
  if (frames.length === 0) return false;
  const { cornerHome: ch, edgeHome: eh } = roleMap(frames[0]);
  let cornerPiece = -1;
  let edgePiece = -1;
  for (const [piece, home] of ch) if (home === cornerHome) cornerPiece = piece;
  for (const [piece, home] of eh) if (home === edgeHome) edgePiece = piece;
  if (cornerPiece < 0 || edgePiece < 0) return false;
  const base = applyRotation(state, frames[0]);
  return (
    base.cp[cornerHome] === cornerPiece &&
    base.co[cornerHome] === 0 &&
    base.ep[edgeHome] === edgePiece &&
    base.eo[edgeHome] === 0
  );
}

/**
 * Canonical pair signature — THE F2L case classifier.
 *
 * An F2L case IS the relative arrangement of one corner+edge pair. The
 * signature records, for the pair whose home is (cornerHome, edgeHome),
 * their current positions and orientations, min over the transformation
 * group {y, y², y'} × {∅, U, U², U'}.
 *
 *   - min over y  ⇒ invariant under slot rotation (FR↔FL↔BL↔BR)
 *   - min over U  ⇒ invariant under AUF (case + U = same case)
 *   - no piece ids ⇒ convention-independent (the same arrangement reads the
 *     same in the catalog and in a solver's color scheme)
 *
 * Crucially it only involves the ONE pair: in a real solve the other three
 * pairs are still scrambled, so a full-state signature can never match the
 * catalog. Returns null when the cross is not solved in any frame.
 */
export function f2lPairSignature(
  state: CubeState,
  crossEdges: readonly number[],
  cornerHome: number,
  edgeHome: number,
): string | null {
  const frames = findCrossOnDFrames(state, crossEdges);
  if (frames.length === 0) return null;
  const { cornerHome: ch, edgeHome: eh } = roleMap(frames[0]);
  let cornerPiece = -1;
  let edgePiece = -1;
  for (const [piece, home] of ch) if (home === cornerHome) cornerPiece = piece;
  for (const [piece, home] of eh) if (home === edgeHome) edgePiece = piece;
  if (cornerPiece < 0 || edgePiece < 0) return null;

  const base = applyRotation(state, frames[0]);
  let best: string | null = null;
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 4; j++) {
      const t = rotateVariant(base, k, j);
      const cPos = Array.from(t.cp).indexOf(cornerPiece);
      const ePos = Array.from(t.ep).indexOf(edgePiece);
      const key = `${cPos}#${t.co[cPos]}|${ePos}#${t.eo[ePos]}`;
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

/**
 * OLL signature — the orientation pattern of the last layer.
 *
 * Reads corner/edge orientation at the U positions (0-3) in the normalized
 * frame, min over the 4 AUF rotations. Returns null when the cross is not on
 * D in any frame.
 */
export function ollSignature(
  state: CubeState,
  crossEdges: readonly number[],
): string | null {
  return ollSignatureWithAuf(state, crossEdges)?.sig ?? null;
}

/** OLL signature plus the AUF offset (0-3) that aligns the canonical form. */
export function ollSignatureWithAuf(
  state: CubeState,
  crossEdges: readonly number[],
): { sig: string; auf: 0 | 1 | 2 | 3 } | null {
  const frames = findCrossOnDFrames(state, crossEdges);
  if (frames.length === 0) return null;
  const base = applyRotation(state, frames[0]);
  let best: { sig: string; auf: 0 | 1 | 2 | 3 } | null = null;
  for (let j = 0; j < 4; j++) {
    const t = rotateVariant(base, 0, j);
    const sig = `${Array.from(t.co).slice(0, 4).join(',')}|${Array.from(t.eo).slice(0, 4).join(',')}`;
    if (best === null || sig < best.sig) best = { sig, auf: j as 0 | 1 | 2 | 3 };
  }
  return best;
}

/**
 * PLL signature — the permutation pattern of the last layer, role-based.
 *
 * Every last-layer piece carries its home position as role, so signatures are
 * comparable across conventions (catalog LL = pieces 0-3, solver LL = 4-7).
 * Min over the 4 AUF rotations.
 */
export function pllSignature(
  state: CubeState,
  crossEdges: readonly number[],
): string | null {
  return pllSignatureWithAuf(state, crossEdges)?.sig ?? null;
}

/** PLL signature plus the AUF offset (0-3) that aligns the canonical form. */
export function pllSignatureWithAuf(
  state: CubeState,
  crossEdges: readonly number[],
): { sig: string; auf: 0 | 1 | 2 | 3 } | null {
  const frames = findCrossOnDFrames(state, crossEdges);
  if (frames.length === 0) return null;
  const { cornerHome, edgeHome } = roleMap(frames[0]);
  const base = applyRotation(state, frames[0]);
  let best: { sig: string; auf: 0 | 1 | 2 | 3 } | null = null;
  for (let j = 0; j < 4; j++) {
    const t = rotateVariant(base, 0, j);
    const entries: string[] = [];
    for (let pos = 0; pos < 4; pos++) {
      const home = cornerHome.get(t.cp[pos]);
      if (home !== undefined && home <= 3) entries.push(`C${home}@${pos}#${t.co[pos]}`);
    }
    for (let pos = 0; pos < 4; pos++) {
      const home = edgeHome.get(t.ep[pos]);
      if (home !== undefined && home <= 3) entries.push(`E${home}@${pos}#${t.eo[pos]}`);
    }
    const sig = entries.sort().join('|');
    if (best === null || sig < best.sig) best = { sig, auf: j as 0 | 1 | 2 | 3 };
  }
  return best;
}
