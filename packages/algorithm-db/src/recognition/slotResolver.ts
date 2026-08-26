/**
 * slotResolver.ts — Map crossFace + slotName → piece IDs, and the
 * slot→FR normalization rotation.
 *
 * For 3×3 CFOP F2L, each cross face has 4 slots in a fixed order.
 * This module resolves the Kociemba piece IDs for a given slot in a
 * given crossFace using the canonical FACE_LAYERS table.
 *
 * Extensible to other puzzles by adding their own resolution tables.
 */
import {
  CubeState,
  FaceletStringConverter,
  cornerFacelet,
  edgeFacelet,
  FACE_LAYERS,
} from '@cubeforge/math-core';
import { f2lSlotNames } from '@cubeforge/math-core';

/**
 * Resolve the (cornerId, edgeId) pair for an F2L slot.
 *
 * @param crossFace — The solver's cross face (D, U, F, B, R, L).
 * @param slotName — The slot name in this cross frame (FR, BR, BL, FL).
 * @returns piece IDs, or null when the face or slot is unrecognized.
 */
export function resolveSlotPieces(
  crossFace: string,
  slotName: string,
): { C: number; E: number } | null {
  const data = FACE_LAYERS[crossFace];
  if (!data) return null;

  const names = f2lSlotNames(crossFace);
  const idx = names.indexOf(slotName);
  if (idx < 0) return null;

  return {
    C: data.f2lCorners[idx],
    E: data.f2lEdges[idx],
  };
}

// Facelet index of each face's center (U:4, R:13, F:22, D:31, L:40, B:49).
const CENTER_FACELET: Record<string, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

/** The face a facelet index belongs to (URFDLB order, 9 facelets per face). */
function faceOf(facelet: number): string {
  return 'URFDLB'[Math.floor(facelet / 9)];
}

/**
 * Resolve the pair pieces of an F2L slot BY COLOR — the corner with the
 * slot's {cross, sideA, sideB} colors and the edge with its {sideA,
 * sideB} colors — wherever those pieces sit in the state.
 *
 * This is the slot/piece-agnostic lookup the detection contract wants:
 * a pair is identified by its colors, never by its position or by which
 * physical piece happens to carry them (the 2388 case: the blue-red
 * corner parked in a neighboring slot still resolves to the BR pair).
 *
 * `state` must be ALREADY recolored to the solver's canonical scheme,
 * exactly like the pipeline does before detection. The cross color is
 * read off the cross face's center (any letter — 'D', 'U', 'R', …) and
 * the slot's side colors off the faces adjacent to the slot (the
 * corner's faces minus the cross face), so any frame's slot resolves
 * without extra tables.
 *
 * @returns piece IDs, or null when the face/slot is unrecognized or the
 *          color sets are not present (an incomplete/popped state).
 */
export function resolveSlotPiecesByColor(
  state: CubeState,
  crossFace: string,
  slotName: string,
): { C: number; E: number } | null {
  const data = FACE_LAYERS[crossFace];
  if (!data) return null;

  const names = f2lSlotNames(crossFace);
  const idx = names.indexOf(slotName);
  if (idx < 0) return null;

  const facelets = FaceletStringConverter.toFaceletString(state);
  // The cross color is whatever color the solver's cross face shows in
  // this state (after the pipeline's recolor). It is NOT restricted to
  // 'D'/'U': an R-cross solve keeps its cross color 'R' (identity
  // scheme), and the pair is still found by its color triple.
  const crossColor = facelets[CENTER_FACELET[crossFace]] ?? 'D';

  // Side faces of the slot = the corner position's faces minus the cross
  // face; their colors (canonical letters shown in this frame) are the
  // pair's side colors.
  const cornerPos = data.f2lCorners[idx];
  const sideFaces = cornerFacelet[cornerPos]
    .map((f) => faceOf(f))
    .filter((f) => f !== crossFace);
  if (sideFaces.length !== 2) return null;
  const sideColors = sideFaces
    .map((f) => facelets[CENTER_FACELET[f]])
    .sort();

  const cornerColors = [crossColor, ...sideColors].sort().join('');
  const edgeColors = sideColors.join('');

  // Find the corner whose three stickers are exactly {cross, sideA, sideB}
  // and the edge whose two stickers are {sideA, sideB}.
  let C = -1;
  for (let p = 0; p < 8; p++) {
    const cols = cornerFacelet[p]
      .map((f) => facelets[f])
      .sort()
      .join('');
    if (cols === cornerColors) {
      C = state.cp[p];
      break;
    }
  }
  let E = -1;
  for (let p = 0; p < 12; p++) {
    const f0 = facelets[edgeFacelet[p][0]];
    const f1 = facelets[edgeFacelet[p][1]];
    if ([f0, f1].sort().join('') === edgeColors) {
      E = state.ep[p];
      break;
    }
  }

  if (C < 0 || E < 0) return null;
  return { C, E };
}

/**
 * Cube rotation that normalizes a pair sitting in `slotName` of
 * `crossFace` onto the D-cross anchor frame (the frame the catalog and
 * the relational signature are keyed on).
 *
 * Every non-D rotation maps the cross face onto the D-cross anchor face
 * (CROSS_TO_D): x2 for U, x' for F, x for B, z for R, z' for L; D is
 * identity. The slot's y-offset is NOT needed — the relational signature
 * minimizes over all y-rotations × AUF, so every slot of a frame
 * collapses onto the same anchor signature (e.g. the four U-cross slots
 * map bijectively onto the four D-cross slots under x2).
 *
 * The tables below are validated empirically by the recognition test
 * matrix: all 41 cases × 6 cross faces × 4 slots round-trip exactly.
 *
 * Returns '' (identity) for D/FR, or null for unknown crossFaces/slots.
 */
export function slotToFRRotation(
  crossFace: string,
  slotName: string,
): string | null {
  // Validated empirically: applying this rotation to a solved cube maps
  // the slot's pair onto the FR anchor positions, for all 6 cross faces.
  //
  // Every non-D rotation first maps the cross face onto the D-cross
  // anchor face (CROSS_TO_D): x2 for U, x' for F, x for B, z for R, z' for
  // L. The slot's y-offset is optional — the relational signature already
  // minimizes over all y-rotations × AUF, so every slot of a frame
  // collapses onto the same anchor signature (the four U-cross slots map
  // bijectively onto the four D-cross slots under x2). Keeping one
  // canonical rotation per frame is enough.
  const TABLE: Record<string, Record<string, string>> = {
    D: { FR: '', BR: 'y', BL: 'y2', FL: "y'" },
    U: { FR: 'x2', BR: 'x2', BL: 'x2', FL: 'x2' },
    F: { UR: "x'", UL: "x'", DR: "x'", DL: "x'" },
    B: { UR: 'x', UL: 'x', DR: 'x', DL: 'x' },
    R: { UF: 'z', UB: 'z', DF: 'z', DB: 'z' },
    L: { UF: "z'", UB: "z'", DF: "z'", DB: "z'" },
  };
  return TABLE[crossFace]?.[slotName] ?? null;
}

/**
 * All slot→FR rotations for a cross face (one per slot, in the same
 * order as `f2lSlotNames(crossFace)`). The relational signature already
 * minimizes over y-rotations × AUF, so every slot of a frame shares the
 * same rotation (the frame→D-cross map); the per-slot entry is kept for
 * API symmetry with `slotToFRotation`.
 *
 * Returns an empty array for unknown cross faces.
 */
export function slotFRRotations(crossFace: string): string[] {
  const TABLE: Record<string, Record<string, string>> = {
    D: { FR: '', BR: 'y', BL: 'y2', FL: "y'" },
    U: { FR: 'x2', BR: 'x2', BL: 'x2', FL: 'x2' },
    F: { UR: "x'", UL: "x'", DR: "x'", DL: "x'" },
    B: { UR: 'x', UL: 'x', DR: 'x', DL: 'x' },
    R: { UF: 'z', UB: 'z', DF: 'z', DB: 'z' },
    L: { UF: "z'", UB: "z'", DF: "z'", DB: "z'" },
  };
  const row = TABLE[crossFace];
  return row ? Object.values(row) : [];
}
