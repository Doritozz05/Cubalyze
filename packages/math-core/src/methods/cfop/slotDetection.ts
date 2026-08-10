import { CubeState } from '../../CubeState';
import { cornerColor, edgeColor } from '../../FaceletStringConverter';
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
 * Rotate ONLY the D layer (D corners + D edges) of a CubeState by `steps`
 * quarter turns (mod 4), leaving the equator and U layer untouched.
 *
 * Needed to undo a solver-frame regrip when D and E did NOT rotate together
 * (a wide u regrip rotates U+E — the equator moves while the D layer stays,
 * so a D+E block rotation can never undo it). Returns a new state when
 * `steps` is non-zero, the same instance when zero.
 */
export function rotateDLayerOnly(state: CubeState, steps: number): CubeState {
  const s = steps & 3;
  if (s === 0) return state;
  const n = D_PLUS_E_CORNERS.length;
  const cp = Array.from(state.cp) as number[];
  const co = Array.from(state.co) as number[];
  const ep = Array.from(state.ep) as number[];
  const newCorners: number[] = [];
  const newCornerOrients: number[] = [];
  const newDEdges: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i - s + n) % n;
    newCorners[i] = cp[D_PLUS_E_CORNERS[from]];
    newCornerOrients[i] = co[D_PLUS_E_CORNERS[from]];
    newDEdges[i] = ep[D_PLUS_E_D_EDGES[from]];
  }
  for (let i = 0; i < n; i++) {
    cp[D_PLUS_E_CORNERS[i]] = newCorners[i];
    co[D_PLUS_E_CORNERS[i]] = newCornerOrients[i];
    ep[D_PLUS_E_D_EDGES[i]] = newDEdges[i];
  }
  return new CubeState(cp, co, ep, Array.from(state.eo));
}

/**
 * Rotate ONLY the equator (E edges) of a CubeState by `steps` quarter turns
 * (mod 4), leaving the D and U layers untouched. Includes the equator edge
 * orientation flip an odd number of E turns produces (same convention as
 * `rotateDPlusEBlock`). Returns a new state when `steps` is non-zero, the
 * same instance when zero.
 */
export function rotateELayerOnly(state: CubeState, steps: number): CubeState {
  const s = steps & 3;
  if (s === 0) return state;
  const n = D_PLUS_E_E_EDGES.length;
  const ep = Array.from(state.ep) as number[];
  const eo = Array.from(state.eo) as number[];
  const newEEdges: number[] = [];
  const newEEdgeOrients: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i - s + n) % n;
    newEEdges[i] = ep[D_PLUS_E_E_EDGES[from]];
    newEEdgeOrients[i] = eo[D_PLUS_E_E_EDGES[from]] ^ (s & 1);
  }
  for (let i = 0; i < n; i++) {
    ep[D_PLUS_E_E_EDGES[i]] = newEEdges[i];
    eo[D_PLUS_E_E_EDGES[i]] = newEEdgeOrients[i];
  }
  return new CubeState(Array.from(state.cp), Array.from(state.co), ep, eo);
}

/** A D-layer rotation step plus an E-layer rotation step (each 0-3). */
export interface FrameRotation {
  /** D-layer quarter turns to apply (0-3). */
  d: number;
  /** E-layer quarter turns to apply (0-3). */
  e: number;
}

/**
 * Apply a FrameRotation to a state: D-layer and E-layer independently.
 * Returns a new state when anything rotates, the same instance when both are
 * zero.
 */
export function applyFrameRotation(state: CubeState, rot: FrameRotation): CubeState {
  let cube = state;
  if (rot.d) cube = rotateDLayerOnly(cube, rot.d);
  if (rot.e) cube = rotateELayerOnly(cube, rot.e);
  return cube;
}

/**
 * Find the D/E frame rotation that maximizes the completed-slot count on a
 * state, for a given cross face + scheme. Tiebreaks toward `preferred` (the
 * rotation chosen at the previous index) so the chosen frame stays stable
 * across a solve and only changes when another rotation is strictly better.
 *
 * Why state-based instead of token-accumulated offsets: a wide `u` regrip
 * rotates U+E together (the equator moves while D stays), so the D+E block
 * does NOT always rotate as a rigid unit. A token-based d-accumulator is
 * therefore wrong whenever a `u` precedes a `d` (reconz-9068: the cross's
 * `u'` leaves D/E rotated; the F2L `d'` then COMPENSATES it, so the correct
 * frame is identity AFTER the d', not rotated). Measuring the frame that
 * maximizes home slots captures both real d-regrips (reconz-12340) and
 * compensated ones (9068) automatically.
 */
export function bestFrameRotation(
  state: CubeState,
  crossFace: string,
  scheme: Record<string, string>,
  preferred?: FrameRotation,
): FrameRotation {
  const dist = (a: number, b: number) => Math.min(Math.abs(a - b), 4 - Math.abs(a - b));
  let best: FrameRotation = { d: 0, e: 0 };
  let bestCount = -1;
  for (let d = 0; d < 4; d++) {
    for (let e = 0; e < 4; e++) {
      let cube = state;
      if (d) cube = rotateDLayerOnly(cube, d);
      if (e) cube = rotateELayerOnly(cube, e);
      const count = countCompletedF2LSlotsInFrame(cube, crossFace, scheme).completedCount;
      if (count > bestCount) {
        bestCount = count;
        best = { d, e };
      } else if (count === bestCount && preferred) {
        const cur = dist(best.d, preferred.d) + dist(best.e, preferred.e);
        const cand = dist(d, preferred.d) + dist(e, preferred.e);
        if (cand < cur) best = { d, e };
      }
    }
  }
  return best;
}

/**
 * All 16 D/E frame rotations, enumerated D-major so ties prefer the identity
 * rotation {0,0} (the canonical reading) when no rotation is strictly better.
 */
const FRAME_ROTATIONS: FrameRotation[] = (() => {
  const out: FrameRotation[] = [];
  for (let d = 0; d < 4; d++) {
    for (let e = 0; e < 4; e++) out.push({ d, e });
  }
  return out;
})();

/**
 * Piece-position groups the D/E frame rotation permutes, in the cyclic order
 * the D1/E1 base moves use (new[i] = old[(i - k + 4) % 4] for a k-step
 * rotation — the same lists as `rotateDPlusEBlock`). D corners and D edges
 * rotate together by the d component; E edges rotate by the e component.
 */
const D_CORNER_GROUP = [Corner.DFR, Corner.DRB, Corner.DBL, Corner.DLF];
const D_EDGE_GROUP = [Edge.DF, Edge.DR, Edge.DB, Edge.DL];
const E_EDGE_GROUP = [Edge.FR, Edge.BR, Edge.BL, Edge.FL];

/**
 * Preimage map: after a k-step rotation of `group`, the piece at position
 * group[i] is the piece that WAS at group[(i - k + 4) % 4]. Positions outside
 * the group map to themselves. Values are position ids; the map is indexed by
 * position id.
 */
function groupPreimage(group: readonly number[], k: number): Int8Array {
  const s = k & 3;
  const map = new Int8Array(12);
  for (let p = 0; p < 12; p++) map[p] = p;
  for (let i = 0; i < group.length; i++) {
    map[group[i]] = group[(i - s + 4) % 4];
  }
  return map;
}

/** Precomputed preimages for every rotation step (0-3) of the three groups. */
const PRE_D_EDGE: readonly Int8Array[] = [0, 1, 2, 3].map((k) =>
  groupPreimage(D_EDGE_GROUP, k),
);
const PRE_D_CORNER: readonly Int8Array[] = [0, 1, 2, 3].map((k) =>
  groupPreimage(D_CORNER_GROUP, k),
);
const PRE_E_EDGE: readonly Int8Array[] = [0, 1, 2, 3].map((k) =>
  groupPreimage(E_EDGE_GROUP, k),
);

/**
 * Count completed F2L slots on a state AFTER applying a D/E frame rotation,
 * WITHOUT materializing the rotated state. The rotation is a permutation of
 * the D corners / D edges / E edges groups, so the piece at each slot
 * position is read from its preimage in the base state (an odd E turn also
 * flips the equator edges' orientation). Exactly equivalent to
 * `countCompletedF2LSlotsInFrame(applyFrameRotation(state, rot), …)` — used
 * by the frame DP to avoid allocating ~16 rotated CubeStates per timeline
 * index.
 */
export function countF2LSlotsInFrameAfterRotation(
  state: CubeState,
  rot: FrameRotation,
  crossFace: string,
  scheme: Record<string, string>,
): number {
  const faceData = FACE_LAYERS[crossFace];
  if (!faceData) return 0;
  const inverseScheme: Record<string, string> = {};
  for (const f of FACE_LETTERS) inverseScheme[scheme[f]] = f;

  const preDEdge = PRE_D_EDGE[rot.d & 3];
  const preDCorner = PRE_D_CORNER[rot.d & 3];
  const preEEdge = PRE_E_EDGE[rot.e & 3];
  const flip = rot.e & 1;

  let count = 0;
  for (let i = 0; i < 4; i++) {
    const edgePos = faceData.f2lEdges[i];
    const cornerPos = faceData.f2lCorners[i];

    let ec: number;
    let eo: number;
    if (edgePos >= 8) {
      const pe = preEEdge[edgePos];
      ec = state.ep[pe];
      eo = state.eo[pe] ^ flip;
    } else if (edgePos >= 4) {
      const pe = preDEdge[edgePos];
      ec = state.ep[pe];
      eo = state.eo[pe];
    } else {
      ec = state.ep[edgePos];
      eo = state.eo[edgePos];
    }

    let cc: number;
    let co: number;
    if (cornerPos >= 4) {
      const pc = preDCorner[cornerPos];
      cc = state.cp[pc];
      co = state.co[pc];
    } else {
      cc = state.cp[cornerPos];
      co = state.co[cornerPos];
    }

    let edgeOk = true;
    for (let j = 0; j < 2; j++) {
      if (inverseScheme[edgeColor[ec][(j - eo + 2) % 2]] !== edgeColor[edgePos][j]) {
        edgeOk = false;
        break;
      }
    }
    let cornerOk = true;
    for (let j = 0; j < 3; j++) {
      if (
        inverseScheme[cornerColor[cc][(j - co + 3) % 3]] !==
        cornerColor[cornerPos][j]
      ) {
        cornerOk = false;
        break;
      }
    }
    if (edgeOk && cornerOk) count++;
  }
  return count;
}

/** Cyclic distance between two quarter-turn counts (0-2). */
function cyclicDist(a: number, b: number): number {
  return Math.min(Math.abs(a - b), 4 - Math.abs(a - b));
}

/**
 * Rotation-change cost between two frames (0-4): each layer's cyclic
 * distance summed. A real regrip is a d1 (or e1) change (cost 1); a
 * half-turn regrip costs 2.
 */
function frameDist(a: FrameRotation, b: FrameRotation): number {
  return cyclicDist(a.d, b.d) + cyclicDist(a.e, b.e);
}

/**
 * Compute the D/E frame rotation for EVERY index of a span at once — the
 * sequence that maximizes the total completed-slot count, with a cost for
 * changing frame between adjacent indices (a Viterbi DP over the 16
 * rotations).
 *
 * Why a sequence and not per-index argmax: the per-index best is ambiguous
 * on real solves (reconz-9068 @7: rotations 1/1 and 3/3 both show exactly
 * one slot home), and the correct frame is only decided by the WHOLE
 * segment — the frame under which the solver's pairs stay home across many
 * indices. The DP picks the globally optimal frame path, so it naturally:
 *
 *   - keeps the cross's residual block rotation (9068: the `u'` inside the
 *     cross leaves D/E rotated; the F2L `d'` later COMPENSATES it — the DP
 *     reads the compensated frame from the state instead of accumulating
 *     tokens, which would wrongly sum them),
 *   - switches to the rotated frame after a REAL persistent d-regrip
 *     (reconz-12340: the pair-4 `d` keeps the block rotated to the end),
 *   - refuses a single-index lucky frame (the change cost must be repaid by
 *     sustained slot gains).
 *
 * `states` is the full solver-frame state list; `start`/`end` are inclusive
 * timeline indices (clamped defensively). Returns one FrameRotation per
 * index of the clamped span, or [] when the span is empty. `changePenalty`
 * is the cost per unit of rotation change (1 = a d1/e1 regrip); it must
 * repay itself in slot gains or the DP keeps the previous frame.
 */
export function bestFrameRotationSequence(
  states: readonly CubeState[],
  start: number,
  end: number,
  crossFace: string,
  scheme: Record<string, string>,
  changePenalty = 2,
): FrameRotation[] {
  const lo = Math.max(0, start);
  const hi = Math.min(states.length - 1, end);
  const n = hi - lo + 1;
  if (n <= 0 || states.length === 0) return [];

  // slots[i][r] = completed slots on states[lo+i] after applying rotation r.
  // Counted WITHOUT materializing the rotated states (see
  // countF2LSlotsInFrameAfterRotation) — the DP evaluates 16 rotations per
  // index and allocating a CubeState for each would dominate the cost.
  const slots: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(16);
    for (let r = 0; r < 16; r++) {
      row[r] = countF2LSlotsInFrameAfterRotation(
        states[lo + i],
        FRAME_ROTATIONS[r],
        crossFace,
        scheme,
      );
    }
    slots[i] = row;
  }

  // Viterbi forward pass. The FIRST index is free (no change cost); every
  // later index pays `changePenalty * frameDist` to switch frames.
  const dp: number[][] = new Array(n);
  const back: Int8Array[] = new Array(n);
  const first = slots[0];
  dp[0] = Array.from(first);
  back[0] = new Int8Array(16).fill(-1);
  for (let i = 1; i < n; i++) {
    const row = slots[i];
    const cur: number[] = new Array(16);
    const bk = new Int8Array(16);
    for (let r = 0; r < 16; r++) {
      let bestVal = -Infinity;
      let bestPrev = 0;
      const prevRow = dp[i - 1];
      for (let p = 0; p < 16; p++) {
        const v = prevRow[p] - changePenalty * frameDist(FRAME_ROTATIONS[p], FRAME_ROTATIONS[r]);
        if (v > bestVal) {
          bestVal = v;
          bestPrev = p;
        }
      }
      cur[r] = row[r] + bestVal;
      bk[r] = bestPrev;
    }
    dp[i] = cur;
    back[i] = bk;
  }

  // Backtrack from the best final frame (ties → earliest = identity-preferred).
  let last = 0;
  const finalRow = dp[n - 1];
  for (let r = 1; r < 16; r++) {
    if (finalRow[r] > finalRow[last]) last = r;
  }
  const out: FrameRotation[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = FRAME_ROTATIONS[last];
    last = back[i][last];
  }
  return out;
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
 * `scheme` maps solver face → color letter (e.g. white-on-D ⇒ { D: 'U',
 * U: 'D', … }) and comes from `ColorPhaseDetector`. The original
 * implementation re-colored the state through a full 54-facelet conversion
 * + parse; this version computes the SAME verdict directly on the
 * permutation arrays, which the frame DP calls thousands of times per
 * solve.
 *
 * Why it is exactly equivalent: the scheme re-labels every sticker with the
 * solver face that shows it (inverseScheme). A slot is complete iff, after
 * that relabeling, the piece at the slot's position shows precisely the
 * position's canonical home colors — and because every edge/corner color
 * set is unique, showing the home colors in the home order is equivalent
 * to the piece-anchored `ep[p]===p && eo[p]===0` check. For an invalid
 * scheme (repeated colors — incoherent reconstructions) the inversions
 * simply fail, matching the old path's degraded behavior without throwing.
 */
export function countCompletedF2LSlotsInFrame(
  state: CubeState,
  crossFace: string,
  scheme: Record<string, string>,
): F2LSlotCompletion {
  const inverseScheme: Record<string, string> = {};
  for (const f of FACE_LETTERS) inverseScheme[scheme[f]] = f;

  const faceData = FACE_LAYERS[crossFace];
  if (!faceData) return { slotMask: 0, completedCount: 0, slots: [] };
  const names = f2lSlotNames(crossFace);
  let slotMask = 0;
  const slots: F2LSlotInfo[] = [];

  for (let i = 0; i < 4; i++) {
    const edgePos = faceData.f2lEdges[i];
    const cornerPos = faceData.f2lCorners[i];

    let edgeOk = true;
    const ec = state.ep[edgePos];
    const eo = state.eo[edgePos];
    for (let j = 0; j < 2; j++) {
      // Sticker at facelet edgeFacelet[edgePos][j] = edgeColor[ec][(j - eo + 2) % 2]
      // (inverse of toFaceletString). Relabeled, it must be the home color.
      if (inverseScheme[edgeColor[ec][(j - eo + 2) % 2]] !== edgeColor[edgePos][j]) {
        edgeOk = false;
        break;
      }
    }

    let cornerOk = true;
    const cc = state.cp[cornerPos];
    const co = state.co[cornerPos];
    for (let j = 0; j < 3; j++) {
      // Sticker at cornerFacelet[cornerPos][j] = cornerColor[cc][(j - co + 3) % 3].
      if (
        inverseScheme[cornerColor[cc][(j - co + 3) % 3]] !==
        cornerColor[cornerPos][j]
      ) {
        cornerOk = false;
        break;
      }
    }

    if (edgeOk && cornerOk) {
      slotMask |= 1 << i;
      slots.push({
        slotIndex: i,
        name: names[i],
        colors: edgeColor[edgePos] as [FaceLetter, FaceLetter],
      });
    }
  }

  return { slotMask, completedCount: slots.length, slots };
}
