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
 * Rotate ONLY the cross layer (cross corners + cross edges) of a CubeState by `steps`
 * quarter turns (mod 4), leaving the equator and opposite layer untouched.
 */
export function rotateCrossLayerOnly(
  state: CubeState,
  steps: number,
  crossFace: string = 'D',
): CubeState {
  const s = steps & 3;
  if (s === 0) return state;
  const faceData = FACE_LAYERS[crossFace] ?? FACE_LAYERS.D;
  const corners = faceData.f2lCorners;
  const edges = faceData.crossEdges;
  const n = 4;
  const cp = Array.from(state.cp) as number[];
  const co = Array.from(state.co) as number[];
  const ep = Array.from(state.ep) as number[];
  const eo = Array.from(state.eo) as number[];

  const newCorners: number[] = [];
  const newCornerOrients: number[] = [];
  const newEdges: number[] = [];
  const newEdgeOrients: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i - s + n) % n;
    newCorners[i] = cp[corners[from]];
    newCornerOrients[i] = co[corners[from]];
    newEdges[i] = ep[edges[from]];
    newEdgeOrients[i] = eo[edges[from]];
  }
  for (let i = 0; i < n; i++) {
    cp[corners[i]] = newCorners[i];
    co[corners[i]] = newCornerOrients[i];
    ep[edges[i]] = newEdges[i];
    eo[edges[i]] = newEdgeOrients[i];
  }
  return new CubeState(cp, co, ep, eo);
}

/**
 * Rotate the cross layer and equator layer together (the whole F2L block) of a
 * CubeState by `steps` quarter turns (mod 4), including the equator edge
 * orientation flip an odd number of turns produces.
 *
 * A wide d (or wide u/f/b/r/l) regrip rotates the cross and equator layers
 * together without moving the opposite layer. The inverse rotation is `-steps`.
 */
export function rotateDPlusEBlock(
  state: CubeState,
  steps: number,
  crossFace: string = 'D',
): CubeState {
  let cube = rotateCrossLayerOnly(state, steps, crossFace);
  cube = rotateELayerOnly(cube, steps, crossFace);
  return cube;
}

/**
 * Backward compatibility alias for rotateCrossLayerOnly.
 */
export function rotateDLayerOnly(
  state: CubeState,
  steps: number,
  crossFace: string = 'D',
): CubeState {
  return rotateCrossLayerOnly(state, steps, crossFace);
}

/**
 * Rotate ONLY the equator layer (f2l edges) of a CubeState by `steps` quarter turns
 * (mod 4), leaving the cross and opposite layers untouched. Includes the equator edge
 * orientation flip an odd number of turns produces.
 */
export function rotateELayerOnly(
  state: CubeState,
  steps: number,
  crossFace: string = 'D',
): CubeState {
  const s = steps & 3;
  if (s === 0) return state;
  const faceData = FACE_LAYERS[crossFace] ?? FACE_LAYERS.D;
  const edges = faceData.f2lEdges;
  const n = 4;
  const ep = Array.from(state.ep) as number[];
  const eo = Array.from(state.eo) as number[];
  const newEdges: number[] = [];
  const newEdgeOrients: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i - s + n) % n;
    newEdges[i] = ep[edges[from]];
    newEdgeOrients[i] = eo[edges[from]] ^ (s & 1);
  }
  for (let i = 0; i < n; i++) {
    ep[edges[i]] = newEdges[i];
    eo[edges[i]] = newEdgeOrients[i];
  }
  return new CubeState(Array.from(state.cp), Array.from(state.co), ep, eo);
}

/** A cross-layer rotation step plus an equator-layer rotation step (each 0-3). */
export interface FrameRotation {
  /** Cross-layer quarter turns to apply (0-3). */
  d: number;
  /** Equator-layer quarter turns to apply (0-3). */
  e: number;
}

/**
 * Apply a FrameRotation to a state: cross-layer and equator-layer independently.
 * Returns a new state when anything rotates, the same instance when both are zero.
 */
export function applyFrameRotation(
  state: CubeState,
  rot: FrameRotation,
  crossFace: string = 'D',
): CubeState {
  let cube = state;
  if (rot.d) cube = rotateCrossLayerOnly(cube, rot.d, crossFace);
  if (rot.e) cube = rotateELayerOnly(cube, rot.e, crossFace);
  return cube;
}

/**
 * Find the cross/equator frame rotation that maximizes the completed-slot count on a
 * state, for a given cross face + scheme. Tiebreaks toward `preferred` (the
 * rotation chosen at the previous index) so the chosen frame stays stable
 * across a solve and only changes when another rotation is strictly better.
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
      const rot = { d, e };
      const count = countF2LSlotsInFrameAfterRotation(state, rot, crossFace, scheme);
      if (count > bestCount) {
        bestCount = count;
        best = rot;
      } else if (count === bestCount && preferred) {
        const cur = dist(best.d, preferred.d) + dist(best.e, preferred.e);
        const cand = dist(d, preferred.d) + dist(e, preferred.e);
        if (cand < cur) best = rot;
      }
    }
  }
  return best;
}

/**
 * All 16 cross/equator frame rotations, enumerated cross-major so ties prefer the identity
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
 * Count completed F2L slots on a state AFTER applying a cross/equator frame rotation.
 */
export function countF2LSlotsInFrameAfterRotation(
  state: CubeState,
  rot: FrameRotation,
  crossFace: string,
  scheme: Record<string, string>,
): number {
  if (rot.d === 0 && rot.e === 0) {
    return countCompletedF2LSlotsInFrame(state, crossFace, scheme).completedCount;
  }
  const rotated = applyFrameRotation(state, rot, crossFace);
  return countCompletedF2LSlotsInFrame(rotated, crossFace, scheme).completedCount;
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
 * F2L slot completion detection.
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
