import { Corner, Edge } from '../../Constants';
import { PhaseMask, MethodDefinition } from '../IMethodDefinition';

// ─── Petrus Method ──────────────────────────────────────────────────────────
//
// Petrus has 4 phases:
//   1. 2x2x2 Block — Build a 2x2x2 block in one corner
//   2. 2x2x3 Block — Extend to a 2x2x3 block
//   3. EO — Orient remaining edges
//   4. F2L + LL — Complete F2L then last layer

// 1. 2x2x2 Block (DLB corner block)
// Requires DL edge, DB edge, BL edge, and DBL corner
export const PetrusBlock2x2x2Mask: PhaseMask = {
  name: '2x2x2',
  edges: [
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
  ],
  corners: [
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
  ],
};

// 2. 2x2x3 Block (extends 2x2x2 with FL and DF edges + DLF corner)
export const PetrusBlock2x2x3Mask: PhaseMask = {
  name: '2x2x3',
  edges: [
    // 2x2x2 block
    ...PetrusBlock2x2x2Mask.edges!,
    // Extension to 2x2x3
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
  ],
  corners: [
    ...PetrusBlock2x2x2Mask.corners!,
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
  ],
};

// 3. Edge Orientation
// Orient all remaining edges (those not in the 2x2x3 block)
// The 2x2x3 block must stay solved
export const PetrusEOMask: PhaseMask = {
  name: 'EO',
  edges: [
    // 2x2x3 block preserved
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
  ],
  corners: [
    ...PetrusBlock2x2x3Mask.corners!,
  ],
  // All remaining edges must be oriented
  edgePositions: [
    { pos: Edge.UR, requiredEo: 0 },
    { pos: Edge.UF, requiredEo: 0 },
    { pos: Edge.UL, requiredEo: 0 },
    { pos: Edge.UB, requiredEo: 0 },
    { pos: Edge.DR, requiredEo: 0 },
    { pos: Edge.FR, requiredEo: 0 },
    { pos: Edge.BR, requiredEo: 0 },
  ],
};

// 4. F2L + LL (remaining solve)
// After EO, complete F2L with only R, U moves, then LL
// This checks the fully solved state since the rest follows efficiently
export const PetrusF2LLLMask: PhaseMask = {
  name: 'F2L+LL',
  edges: [
    // All edges solved
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
    // All corners solved
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

export const PetrusDefinition: MethodDefinition = {
  name: 'Petrus',
  phases: [
    PetrusBlock2x2x2Mask,
    PetrusBlock2x2x3Mask,
    PetrusEOMask,
    PetrusF2LLLMask,
  ],
};
