import { Corner, Edge } from "../../Constants";
import { MethodDefinition, PhaseMask } from "../IMethodDefinition";

// 1. Cross (White on Bottom)
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
// Requires Cross + the 4 corner-edge pairs in the first two layers.
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
// Requires F2L + all U-layer pieces to be oriented (yellow facing up).
// We don't care about the U-layer permutation yet.
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
// Requires everything to be solved.
// The easiest way to check PLL is to require the U layer permutation too,
// but we can just use `CubeState.isSolved()`. 
// However, to keep it declarative, we can define the final pieces:
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
