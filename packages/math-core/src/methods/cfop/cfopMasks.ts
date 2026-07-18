import { Corner, Edge } from "../../Constants";
import { MethodDefinition, PhaseMask } from "../IMethodDefinition";

// ═══════════════════════════════════════════════════════════════════════════
// Standard (D-cross) CFOP masks — kept for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════

// 1. Cross (White on Bottom / Yellow on D)
// Requires DF, DR, DB, DL edges to be in their exact positions and oriented (0).
export const CrossMask: PhaseMask = {
  name: "Cross",
  edges: [
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
  ],
};

// 2. F2L
export const F2LMask: PhaseMask = {
  name: "F2L",
  edges: [
    ...CrossMask.edges!,
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
  ],
  corners: [
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
  ],
};

// 3. OLL
export const OLLMask: PhaseMask = {
  name: "OLL",
  edges: F2LMask.edges,
  corners: F2LMask.corners,
  edgePositions: [
    { pos: Edge.UR, requiredEo: 0 },
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UL, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
  ],
  cornerPositions: [
    { pos: Corner.URF, requiredCo: 0 },
    { pos: Corner.UFL, requiredCo: 0 },
    { pos: Corner.ULB, requiredCo: 0 },
    { pos: Corner.UBR, requiredCo: 0 },
  ],
};

// 4. PLL
export const PLLMask: PhaseMask = {
  name: "PLL",
  edges: [
    ...F2LMask.edges!,
    { id: Edge.UR, requiredEp: Edge.UR, requiredEo: 0 },
    { id: Edge.UF, requiredEp: Edge.UF, requiredEo: 0 },
    { id: Edge.UL, requiredEp: Edge.UL, requiredEo: 0 },
    { id: Edge.UB, requiredEp: Edge.UB, requiredEo: 0 },
  ],
  corners: [
    ...F2LMask.corners!,
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
  ],
};

export const CFOPDefinition: MethodDefinition = {
  name: "CFOP",
  phases: [CrossMask, F2LMask, OLLMask, PLLMask],
};

// ═══════════════════════════════════════════════════════════════════════════
// Color-Neutral CFOP — masks for all 6 cross faces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-face layer data for generating CFOP phase masks.
 *
 * The "cross layer" is the face where the cross is built.
 * The "last layer" is the opposite face (oriented in OLL, permuted in PLL).
 * The "equator" is the set of edges between the cross layer and the
 * opposite layer (solved in F2L).
 */
interface FaceLayerData {
  crossEdges: Edge[];
  f2lCorners: Corner[];
  f2lEdges: Edge[];
  lastLayerEdges: Edge[];
  lastLayerCorners: Corner[];
}

/**
 * Layer data for each of the 6 possible cross faces.
 *
 * Verified against Kociemba coordinate system:
 *   Edges: UR=0, UF=1, UL=2, UB=3, DR=4, DF=5, DL=6, DB=7, FR=8, FL=9, BL=10, BR=11
 *   Corners: URF=0, UFL=1, ULB=2, UBR=3, DFR=4, DLF=5, DBL=6, DRB=7
 */
const FACE_LAYERS: Record<string, FaceLayerData> = {
  D: {
    crossEdges: [Edge.DF, Edge.DR, Edge.DB, Edge.DL],
    f2lCorners: [Corner.DFR, Corner.DRB, Corner.DBL, Corner.DLF],
    f2lEdges: [Edge.FR, Edge.BR, Edge.BL, Edge.FL],
    lastLayerEdges: [Edge.UR, Edge.UF, Edge.UL, Edge.UB],
    lastLayerCorners: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR],
  },
  U: {
    crossEdges: [Edge.UF, Edge.UR, Edge.UB, Edge.UL],
    f2lCorners: [Corner.URF, Corner.UBR, Corner.ULB, Corner.UFL],
    f2lEdges: [Edge.FR, Edge.BR, Edge.BL, Edge.FL],
    lastLayerEdges: [Edge.DR, Edge.DF, Edge.DL, Edge.DB],
    lastLayerCorners: [Corner.DFR, Corner.DRB, Corner.DBL, Corner.DLF],
  },
  F: {
    crossEdges: [Edge.UF, Edge.DF, Edge.FR, Edge.FL],
    f2lCorners: [Corner.URF, Corner.UFL, Corner.DFR, Corner.DLF],
    f2lEdges: [Edge.UR, Edge.UL, Edge.DR, Edge.DL],
    lastLayerEdges: [Edge.UB, Edge.DB, Edge.BR, Edge.BL],
    lastLayerCorners: [Corner.UBR, Corner.ULB, Corner.DBL, Corner.DRB],
  },
  B: {
    crossEdges: [Edge.UB, Edge.DB, Edge.BR, Edge.BL],
    f2lCorners: [Corner.UBR, Corner.ULB, Corner.DBL, Corner.DRB],
    f2lEdges: [Edge.UR, Edge.UL, Edge.DR, Edge.DL],
    lastLayerEdges: [Edge.UF, Edge.DF, Edge.FR, Edge.FL],
    lastLayerCorners: [Corner.URF, Corner.UFL, Corner.DFR, Corner.DLF],
  },
  R: {
    crossEdges: [Edge.UR, Edge.DR, Edge.FR, Edge.BR],
    f2lCorners: [Corner.URF, Corner.UBR, Corner.DFR, Corner.DRB],
    f2lEdges: [Edge.UF, Edge.UB, Edge.DF, Edge.DB],
    lastLayerEdges: [Edge.UL, Edge.DL, Edge.FL, Edge.BL],
    lastLayerCorners: [Corner.UFL, Corner.ULB, Corner.DLF, Corner.DBL],
  },
  L: {
    crossEdges: [Edge.UL, Edge.DL, Edge.FL, Edge.BL],
    f2lCorners: [Corner.UFL, Corner.ULB, Corner.DLF, Corner.DBL],
    f2lEdges: [Edge.UF, Edge.UB, Edge.DF, Edge.DB],
    lastLayerEdges: [Edge.UR, Edge.DR, Edge.FR, Edge.BR],
    lastLayerCorners: [Corner.URF, Corner.UBR, Corner.DFR, Corner.DRB],
  },
};

/**
 * Build a Cross mask for a specific face.
 */
function makeCrossMask(face: string): PhaseMask {
  const { crossEdges } = FACE_LAYERS[face];
  return {
    name: "Cross",
    edges: crossEdges.map((e) => ({
      id: e,
      requiredEp: e,
      requiredEo: 0,
    })),
  };
}

/**
 * Build an F2L mask for a specific face.
 */
function makeF2LMask(face: string): PhaseMask {
  const { crossEdges, f2lEdges, f2lCorners } = FACE_LAYERS[face];
  return {
    name: "F2L",
    edges: [...crossEdges, ...f2lEdges].map((e) => ({
      id: e,
      requiredEp: e,
      requiredEo: 0,
    })),
    corners: f2lCorners.map((c) => ({
      id: c,
      requiredCp: c,
      requiredCo: 0,
    })),
  };
}

/**
 * Build an OLL mask for a specific face.
 *
 * The last layer (opposite the cross face) must have all pieces oriented.
 * Position rules are used (instead of piece-ID rules) so we only check
 * orientation, not permutation.
 *
 * NOTE: The Kociemba eo/co system defines orientation relative to the
 * U/D faces only. For crosses on U or D, OLL detection is fully correct.
 * For crosses on F, B, L, R, the `requiredEo: 0` / `requiredCo: 0` checks
 * at last-layer positions verify the piece's U/D sticker is on U/D, not
 * that the last-layer-face sticker is on the last layer. This means OLL
 * detection for non-U/D crosses is approximate. Cross, F2L, and PLL are
 * fully correct for all 6 faces.
 */
function makeOLLMask(face: string): PhaseMask {
  const { crossEdges, f2lEdges, f2lCorners, lastLayerEdges, lastLayerCorners } =
    FACE_LAYERS[face];
  return {
    name: "OLL",
    edges: [...crossEdges, ...f2lEdges].map((e) => ({
      id: e,
      requiredEp: e,
      requiredEo: 0,
    })),
    corners: f2lCorners.map((c) => ({
      id: c,
      requiredCp: c,
      requiredCo: 0,
    })),
    edgePositions: lastLayerEdges.map((e) => ({
      pos: e,
      requiredEo: 0,
    })),
    cornerPositions: lastLayerCorners.map((c) => ({
      pos: c,
      requiredCo: 0,
    })),
  };
}

/**
 * Build a PLL mask for a specific face (full solve).
 */
function makePLLMask(face: string): PhaseMask {
  const { crossEdges, f2lEdges, f2lCorners, lastLayerEdges, lastLayerCorners } =
    FACE_LAYERS[face];
  const allEdges = [...crossEdges, ...f2lEdges, ...lastLayerEdges];
  const allCorners = [...f2lCorners, ...lastLayerCorners];
  return {
    name: "PLL",
    edges: allEdges.map((e) => ({
      id: e,
      requiredEp: e,
      requiredEo: 0,
    })),
    corners: allCorners.map((c) => ({
      id: c,
      requiredCp: c,
      requiredCo: 0,
    })),
  };
}

/**
 * A complete set of CFOP phase masks for a single cross face.
 */
export interface FaceCFOPMasks {
  face: string;
  masks: [PhaseMask, PhaseMask, PhaseMask, PhaseMask];
}

/** All 6 face names in canonical order. */
export const CROSS_FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;

/**
 * Pre-computed color-neutral CFOP masks for all 6 cross faces.
 *
 * Usage in PhaseSplitter:
 *  1. Try all 6 Cross masks (index 0 of each FaceCFOPMasks.masks)
 *  2. When one matches, use that face's F2L/OLL/PLL masks
 */
export const COLOR_NEUTRAL_CFOP_MASKS: FaceCFOPMasks[] = CROSS_FACES.map(
  (face) => ({
    face,
    masks: [
      makeCrossMask(face),
      makeF2LMask(face),
      makeOLLMask(face),
      makePLLMask(face),
    ],
  }),
);
