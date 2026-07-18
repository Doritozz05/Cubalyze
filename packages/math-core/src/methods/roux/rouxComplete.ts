import { Corner, Edge } from '../../Constants';
import { PhaseMask, MethodDefinition } from '../IMethodDefinition';

// ─── CMLL (Corners of Last Layer) ────────────────────────────────────────────
//
// After both blocks are built, CMLL orients and permutes the U-layer
// corners. The blocks (left 1x2x3 and right 1x2x3) must remain intact.
//
// CMLL is complete when:
// - Both blocks are solved (edges + corners in F2L positions)
// - All 4 U-layer corners are in their correct positions
// - All 4 U-layer corners have correct orientation (co = 0)
//
// We can check this by requiring the DL, FL, BL, DR, FR, BR edges
// AND DLF, DBL, DFR, DRB corners to stay in place
// AND all U-layer corners (URF, UFL, ULB, UBR) to be in their
// correct positions with correct orientation.

export const RouxCMMLMask: PhaseMask = {
  name: 'CMLL',
  edges: [
    // Left block edges must stay solved
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    // Right block edges must stay solved
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
  ],
  corners: [
    // Left block corners must stay solved
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    // Right block corners must stay solved
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
    // U-layer corners must be in correct positions with correct orientation
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
  ],
};

// ─── LSE (Last Six Edges) ──────────────────────────────────────────────────
//
// LSE solves the 6 remaining edges (UR, UF, UL, UB, DF, DB).
// It is typically broken into 3 sub-steps:
//   1. EO (Edge Orientation): All 6 remaining edges oriented
//   2. UL/UR: Place UL and UR edges in their positions
//   3. M-slice: Permute the 4 remaining edges in the M-slice
//
// For simplicity, we define LSE as a single phase where all
// edges are fully solved. This is equivalent to checking
// `CubeState.isSolved()` since CMLL already handled the corners.

export const RouxLSEMask: PhaseMask = {
  name: 'LSE',
  edges: [
    // All edges must be solved
    { id: Edge.UR, requiredEp: Edge.UR, requiredEo: 0 },
    { id: Edge.UF, requiredEp: Edge.UF, requiredEo: 0 },
    { id: Edge.UL, requiredEp: Edge.UL, requiredEo: 0 },
    { id: Edge.UB, requiredEp: Edge.UB, requiredEo: 0 },
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
  ],
  corners: [
    // All corners must be solved
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
  ],
};

// ─── Sub-phase: EO (Edge Orientation) ────────────────────────────────────────
//
// After CMLL, only 6 edges remain unsolved: UR, UF, UL, UB, DF, DB.
// Edge orientation in Roux means the edge's sticker matches the U/D centers
// when on the U/D face, or matches F/B centers when on the M-slice.

export const RouxEOMask: PhaseMask = {
  name: 'LSE-EO',
  edges: [
    // Blocks must stay solved
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
  ],
  corners: [
    // CMLL corners must stay solved
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
  ],
  // All remaining edges (U-layer + DF, DB) must be oriented correctly
  edgePositions: [
    { pos: Edge.UR, requiredEo: 0 },
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UL, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
    { pos: Edge.DF, requiredEo: 0 },
    { pos: Edge.DB, requiredEo: 0 },
  ],
};

// ─── Sub-phase: UL/UR ───────────────────────────────────────────────────────
//
// After EO, place UL and UR edges in their correct positions.
// All other edges and corners must stay solved.

export const RouxULURMask: PhaseMask = {
  name: 'LSE-ULUR',
  edges: [
    // Blocks + UL/UR must be in correct positions
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
    { id: Edge.UL, requiredEp: Edge.UL, requiredEo: 0 },
    { id: Edge.UR, requiredEp: Edge.UR, requiredEo: 0 },
  ],
  corners: [
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
  ],
  // Remaining edges must be oriented
  edgePositions: [
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
    { pos: Edge.DF, requiredEo: 0 },
    { pos: Edge.DB, requiredEo: 0 },
  ],
};

import { RouxFirstBlockMask, RouxSecondBlockMask } from './rouxMasks';

/** Complete Roux method definition with all phases and sub-phases. */
export const RouxFullDefinition: MethodDefinition = {
  name: 'Roux',
  phases: [
    RouxFirstBlockMask,
    RouxSecondBlockMask,
    RouxCMMLMask,
    // LSE sub-phases
    RouxEOMask,
    RouxULURMask,
    RouxLSEMask,
  ],
};
