import { CubeState } from '../../CubeState';
import { FaceletStringConverter, edgeColor } from '../../FaceletStringConverter';
import { Edge } from '../../Constants';
import { FACE_LAYERS } from './cfopMasks';
import { FACE_LETTERS, type FaceLetter } from './ColorPhaseDetector';

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
