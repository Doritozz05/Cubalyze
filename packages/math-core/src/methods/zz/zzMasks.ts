import { Corner, Edge } from '../../Constants';
import { PhaseMask, MethodDefinition } from '../IMethodDefinition';

// ─── ZZ Method ──────────────────────────────────────────────────────────────
//
// ZZ has 3 phases:
//   1. EOLine — Orient all edges AND place DF & DB edges
//   2. F2L — Complete first two layers using only R, U, L moves (no rotations!)
//   3. LL — Last layer (already edges oriented, so OLL cases are simpler)

// 1. EOLine
// Requires all 12 edges to be oriented (eo = 0) AND
// DF, DB edges to be in their positions.
export const ZZEOLineMask: PhaseMask = {
  name: 'EOLine',
  edges: [
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
  ],
  // All edges must be oriented
  edgePositions: [
    { pos: Edge.UR, requiredEo: 0 },
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UL, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
    { pos: Edge.DR, requiredEo: 0 },
    { pos: Edge.DF, requiredEo: 0 },
    { pos: Edge.DL, requiredEo: 0 },
    { pos: Edge.DB, requiredEo: 0 },
    { pos: Edge.FR, requiredEo: 0 },
    { pos: Edge.FL, requiredEo: 0 },
    { pos: Edge.BL, requiredEo: 0 },
    { pos: Edge.BR, requiredEo: 0 },
  ],
};

// 2. ZZ F2L
// Requires EOLine + all F2L slots solved
export const ZZF2LMask: PhaseMask = {
  name: 'F2L',
  edges: [
    // EOLine preserved
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    // Remaining F2L edges (all must be in their positions, oriented)
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
  ],
  corners: [
    // All F2L corners solved
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
  ],
  // All edges remain oriented
  edgePositions: [
    { pos: Edge.UR, requiredEo: 0 },
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UL, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
  ],
};

// 3. LL (Last Layer)
// All edges already oriented, so only OLL cases with all edges oriented
// (subset of 7 OCLL cases) appear, followed by PLL.
// For simplicity, we check the full solved state.
export const ZZLLMask: PhaseMask = {
  name: 'LL',
  edges: [
    ...ZZF2LMask.edges!,
    { id: Edge.UR, requiredEp: Edge.UR, requiredEo: 0 },
    { id: Edge.UF, requiredEp: Edge.UF, requiredEo: 0 },
    { id: Edge.UL, requiredEp: Edge.UL, requiredEo: 0 },
    { id: Edge.UB, requiredEp: Edge.UB, requiredEo: 0 },
  ],
  corners: [
    ...ZZF2LMask.corners!,
    { id: Corner.URF, requiredCp: Corner.URF, requiredCo: 0 },
    { id: Corner.UFL, requiredCp: Corner.UFL, requiredCo: 0 },
    { id: Corner.ULB, requiredCp: Corner.ULB, requiredCo: 0 },
    { id: Corner.UBR, requiredCp: Corner.UBR, requiredCo: 0 },
  ],
};

export const ZZDefinition: MethodDefinition = {
  name: 'ZZ',
  phases: [ZZEOLineMask, ZZF2LMask, ZZLLMask],
};
