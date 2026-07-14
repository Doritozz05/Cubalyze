import { Corner, Edge } from "../Constants";

export interface EdgeRule {
  id: Edge; // The piece we are looking for (e.g. White-Red edge)
  requiredEp?: Edge; // The position it MUST be in. If undefined, we don't care where it is.
  requiredEo?: number; // 0 or 1. If undefined, we don't care about orientation
}

export interface CornerRule {
  id: Corner; // The piece we are looking for (e.g. White-Red-Blue corner)
  requiredCp?: Corner; // The position it MUST be in.
  requiredCo?: number; // 0, 1, or 2. If undefined, we don't care about orientation
}

export interface PositionEdgeRule {
  pos: Edge; // The physical position we are checking
  requiredEo?: number; // The orientation required at this position, regardless of which piece is there
}

export interface PositionCornerRule {
  pos: Corner;
  requiredCo?: number;
}

/**
 * A PhaseMask defines a set of conditions that a CubeState must meet 
 * to be considered "completed" for this particular phase.
 */
export interface PhaseMask {
  name: string; // e.g., "Cross", "F2L1", "OLL"
  edges?: EdgeRule[];
  corners?: CornerRule[];
  edgePositions?: PositionEdgeRule[];
  cornerPositions?: PositionCornerRule[];
}

export interface MethodDefinition {
  name: string; // e.g., "CFOP", "Roux"
  phases: PhaseMask[];
}
