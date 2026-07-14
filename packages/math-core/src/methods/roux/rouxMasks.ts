import { Corner, Edge } from "../../Constants";
import { MethodDefinition, PhaseMask } from "../IMethodDefinition";

// First Block (Left side 1x2x3)
// Requires DL, FL, BL edges and DLF, DBL corners
export const RouxFirstBlockMask: PhaseMask = {
  name: "First Block",
  edges: [
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
    { id: Edge.FL, requiredEp: Edge.FL, requiredEo: 0 },
    { id: Edge.BL, requiredEp: Edge.BL, requiredEo: 0 },
  ],
  corners: [
    { id: Corner.DLF, requiredCp: Corner.DLF, requiredCo: 0 },
    { id: Corner.DBL, requiredCp: Corner.DBL, requiredCo: 0 },
  ],
};

// Second Block (Right side 1x2x3)
// Requires First Block + DR, FR, BR edges and DFR, DRB corners
export const RouxSecondBlockMask: PhaseMask = {
  name: "Second Block",
  edges: [
    ...RouxFirstBlockMask.edges!,
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.FR, requiredEp: Edge.FR, requiredEo: 0 },
    { id: Edge.BR, requiredEp: Edge.BR, requiredEo: 0 },
  ],
  corners: [
    ...RouxFirstBlockMask.corners!,
    { id: Corner.DFR, requiredCp: Corner.DFR, requiredCo: 0 },
    { id: Corner.DRB, requiredCp: Corner.DRB, requiredCo: 0 },
  ],
};

export const RouxDefinition: MethodDefinition = {
  name: "Roux",
  phases: [RouxFirstBlockMask, RouxSecondBlockMask],
};
