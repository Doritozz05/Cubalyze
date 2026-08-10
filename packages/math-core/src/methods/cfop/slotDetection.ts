import { CubeState } from '../../CubeState';
import { FaceletStringConverter, edgeColor } from '../../FaceletStringConverter';
import { Corner, Edge } from '../../Constants';
import { FACE_LAYERS } from './cfopMasks';
import { FACE_LETTERS, type FaceLetter } from './ColorPhaseDetector';

/**
 * The pieces a wide d (Dw) move rotates TOGETHER — the whole bottom two
 * layers (D face + equator), i.e. the solver's F2L frame. A plain D or E
 * move rotates only one of the groups and is a normal solve move, not a
 * frame change. Each list is in the cyclic order the D1/E1 base moves use
 * (verified against CubeState's baseD/baseE): new[i] = old[(i - k + 4) % 4]
 * for a k-step rotation.
 */
const D_PLUS_E_CORNERS = [Corner.DFR, Corner.DRB, Corner.DBL, Corner.DLF];
const D_PLUS_E_D_EDGES = [Edge.DF, Edge.DR, Edge.DB, Edge.DL];
const D_PLUS_E_E_EDGES = [Edge.FR, Edge.BR, Edge.BL, Edge.FL];

/**
 * Rotate the D+E block (D-layer corners + edges and equator edges) of a
 * CubeState by `steps` quarter turns (mod 4), including the equator edge
 * orientation flip an odd number of E turns produces.
 *
 * A wide d regrip rotates the bottom two layers together without moving the
 * U layer; undoing the accumulated d-rotations before the piece-anchored
 * slot check keeps slot identities stable across the regrip (the pieces stay
 * "home" in the solver's frame). The inverse rotation is `-steps`. Returns a
 * new state when `steps` is non-zero, the same instance when zero.
 */
export function rotateDPlusEBlock(state: CubeState, steps: number): CubeState {
  const s = steps & 3;
  if (s === 0) return state;
  const n = D_PLUS_E_CORNERS.length;
  const cp = Array.from(state.cp) as number[];
  const co = Array.from(state.co) as number[];
  const ep = Array.from(state.ep) as number[];
  const eo = Array.from(state.eo) as number[];

  // Orientations TRAVEL with their pieces (a corner's twist follows it to its
  // new position), and an odd number of E turns additionally flips the eo of
  // the 4 equator edges. Copying only the permutation (cp/ep) while leaving
  // co/eo in place would corrupt the slot check on real solves.
  const newCorners: number[] = [];
  const newCornerOrients: number[] = [];
  const newDEdges: number[] = [];
  const newEEdges: number[] = [];
  const newEEdgeOrients: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i - s + n) % n;
    newCorners[i] = cp[D_PLUS_E_CORNERS[from]];
    newCornerOrients[i] = co[D_PLUS_E_CORNERS[from]];
    newDEdges[i] = ep[D_PLUS_E_D_EDGES[from]];
    newEEdges[i] = ep[D_PLUS_E_E_EDGES[from]];
    newEEdgeOrients[i] = eo[D_PLUS_E_E_EDGES[from]] ^ (s & 1);
  }
  for (let i = 0; i < n; i++) {
    cp[D_PLUS_E_CORNERS[i]] = newCorners[i];
    co[D_PLUS_E_CORNERS[i]] = newCornerOrients[i];
    ep[D_PLUS_E_D_EDGES[i]] = newDEdges[i];
    ep[D_PLUS_E_E_EDGES[i]] = newEEdges[i];
    eo[D_PLUS_E_E_EDGES[i]] = newEEdgeOrients[i];
  }
  return new CubeState(cp, co, ep, eo);
}

/**
 * @file F2L slot completion detection.
 *
 * A slot is "complete" when its corner and edge are both home, oriented.
 * Because pieces are anchored to positions (not colors), a slot check only
 * makes sense in ONE color frame. This module checks slots in the SOLVER's
 * frame — the frame `ColorPhaseDetector` derives (face → color). For the
 * standard canonical frame the identity scheme is used.
 *
 * Shared by:
 *   - PhaseSplitter   → XCross/XXCross (`crossType`, `xcrossPairs`)
 *   - CFOPMetricsCalculator → F2L pair boundary detection
 *   - Fase 2 (analyzeSolveText) → per-pair slots/colors
 */

export interface F2LSlotInfo {
  /** Index into `FACE_LAYERS[crossFace].f2lEdges` (0-3). */
  slotIndex: number;
  /** Slot name in the cross frame, e.g. "FR", "BR", "BL", "FL" (D cross). */
  name: string;
  /** The pair's two side colors (canonical face letters), e.g. ["F","R"]. */
  colors: [FaceLetter, FaceLetter];
}

export interface F2LSlotCompletion {
  /** Bitmask of completed slots (bit i = slot i). */
  slotMask: number;
  /** Number of completed slots (0-4). */
  completedCount: number;
  /** Details of the completed slots, in FACE_LAYERS order. */
  slots: F2LSlotInfo[];
}

/** Identity scheme — the canonical yellow-on-D frame. */
export const IDENTITY_SCHEME: Record<FaceLetter, FaceLetter> = {
  U: 'U',
  R: 'R',
  F: 'F',
  D: 'D',
  L: 'L',
  B: 'B',
};

/**
 * Slot names for a cross face, in `FACE_LAYERS` order.
 * E.g. a D cross → ["FR", "BR", "BL", "FL"].
 */
export function f2lSlotNames(crossFace: string): string[] {
  const faceData = FACE_LAYERS[crossFace];
  if (!faceData) return ['SLOT-0', 'SLOT-1', 'SLOT-2', 'SLOT-3'];
  return faceData.f2lEdges.map((e) => Edge[e] ?? String(e));
}

/**
 * Count completed F2L slots on a state that is ALREADY in the canonical color
 * frame (identity scheme). Piece-anchored: the piece whose home is the slot
 * position must sit there, oriented.
 */
export function countCompletedF2LSlotsCanonical(
  state: CubeState,
  crossFace: string,
): F2LSlotCompletion {
  const faceData = FACE_LAYERS[crossFace];
  if (!faceData) return { slotMask: 0, completedCount: 0, slots: [] };

  const names = f2lSlotNames(crossFace);
  let slotMask = 0;
  const slots: F2LSlotInfo[] = [];

  for (let i = 0; i < 4; i++) {
    const edgePos = faceData.f2lEdges[i];
    const cornerPos = faceData.f2lCorners[i];

    const edgeOk = state.ep[edgePos] === edgePos && state.eo[edgePos] === 0;
    const cornerOk = state.cp[cornerPos] === cornerPos && state.co[cornerPos] === 0;

    if (edgeOk && cornerOk) {
      slotMask |= 1 << i;
      slots.push({
        slotIndex: i,
        name: names[i],
        colors: (edgeColor[edgePos] as [FaceLetter, FaceLetter]),
      });
    }
  }

  return { slotMask, completedCount: slots.length, slots };
}

/**
 * Count completed F2L slots in the SOLVER's frame (any cross color).
 *
 * Re-colors the state with the inverse of the given scheme so that the
 * solver's cross color becomes the canonical color of the cross face, then
 * performs the piece-anchored check. `scheme` maps solver face → color
 * letter (e.g. white-on-D ⇒ { D: 'U', U: 'D', … }) and comes from
 * `ColorPhaseDetector`.
 */
export function countCompletedF2LSlotsInFrame(
  state: CubeState,
  crossFace: string,
  scheme: Record<string, string>,
): F2LSlotCompletion {
  const facelets = FaceletStringConverter.toFaceletString(state);

  const inverseScheme: Record<string, string> = {};
  for (const f of FACE_LETTERS) inverseScheme[scheme[f]] = f;

  let canonical = '';
  for (let i = 0; i < facelets.length; i++) {
    canonical += inverseScheme[facelets[i]] ?? facelets[i];
  }

  const canonicalState = FaceletStringConverter.fromFaceletString(canonical);
  return countCompletedF2LSlotsCanonical(canonicalState, crossFace);
}
