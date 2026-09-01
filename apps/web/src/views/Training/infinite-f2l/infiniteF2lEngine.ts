import { Corner, Edge, CubeState, type PhaseMask } from "@cubeforge/math-core";

export type CrossColor = "white" | "yellow" | "green" | "blue" | "red" | "orange";
export type F2LSlotId = "FR" | "FL" | "BL" | "BR";

export interface F2LSlotDef {
  id: F2LSlotId;
  name: string;
  nameKey: string;
  cornerId: Corner;
  edgeId: Edge;
  adjacentCrossEdges: Edge[];
  colorName: string;
}

export interface CrossColorDef {
  id: CrossColor;
  name: string;
  nameKey: string;
  face: "D" | "U" | "F" | "B" | "R" | "L";
  crossEdges: Edge[];
  slots: Record<F2LSlotId, F2LSlotDef>;
}

/**
 * Standard slot definitions for D-face (White cross) and other cross colors.
 */
export const CROSS_COLOR_CONFIGS: Record<CrossColor, CrossColorDef> = {
  white: {
    id: "white",
    name: "White",
    nameKey: "crossColor.white",
    face: "U",
    crossEdges: [Edge.UF, Edge.UR, Edge.UB, Edge.UL],
    slots: {
      FR: {
        id: "FR",
        name: "FR (White-Green-Red)",
        nameKey: "slot.FR",
        cornerId: Corner.URF,
        edgeId: Edge.FR,
        adjacentCrossEdges: [Edge.UF, Edge.UR],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "FL (White-Green-Orange)",
        nameKey: "slot.FL",
        cornerId: Corner.UFL,
        edgeId: Edge.FL,
        adjacentCrossEdges: [Edge.UF, Edge.UL],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "BL (White-Blue-Orange)",
        nameKey: "slot.BL",
        cornerId: Corner.ULB,
        edgeId: Edge.BL,
        adjacentCrossEdges: [Edge.UB, Edge.UL],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "BR (White-Blue-Red)",
        nameKey: "slot.BR",
        cornerId: Corner.UBR,
        edgeId: Edge.BR,
        adjacentCrossEdges: [Edge.UB, Edge.UR],
        colorName: "#a855f7",
      },
    },
  },
  yellow: {
    id: "yellow",
    name: "Yellow",
    nameKey: "crossColor.yellow",
    face: "D",
    crossEdges: [Edge.DF, Edge.DR, Edge.DB, Edge.DL],
    slots: {
      FR: {
        id: "FR",
        name: "FR (Yellow-Green-Red)",
        nameKey: "slot.FR",
        cornerId: Corner.DFR,
        edgeId: Edge.FR,
        adjacentCrossEdges: [Edge.DF, Edge.DR],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "FL (Yellow-Green-Orange)",
        nameKey: "slot.FL",
        cornerId: Corner.DLF,
        edgeId: Edge.FL,
        adjacentCrossEdges: [Edge.DF, Edge.DL],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "BL (Yellow-Blue-Orange)",
        nameKey: "slot.BL",
        cornerId: Corner.DBL,
        edgeId: Edge.BL,
        adjacentCrossEdges: [Edge.DB, Edge.DL],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "BR (Yellow-Blue-Red)",
        nameKey: "slot.BR",
        cornerId: Corner.DRB,
        edgeId: Edge.BR,
        adjacentCrossEdges: [Edge.DB, Edge.DR],
        colorName: "#a855f7",
      },
    },
  },
  green: {
    id: "green",
    name: "Green",
    nameKey: "crossColor.green",
    face: "F",
    crossEdges: [Edge.UF, Edge.FR, Edge.DF, Edge.FL],
    slots: {
      FR: {
        id: "FR",
        name: "URF (Green-White-Red)",
        nameKey: "slot.FR",
        cornerId: Corner.URF,
        edgeId: Edge.UR,
        adjacentCrossEdges: [Edge.UF, Edge.FR],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "UFL (Green-White-Orange)",
        nameKey: "slot.FL",
        cornerId: Corner.UFL,
        edgeId: Edge.UL,
        adjacentCrossEdges: [Edge.UF, Edge.FL],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "DLF (Green-Yellow-Orange)",
        nameKey: "slot.BL",
        cornerId: Corner.DLF,
        edgeId: Edge.DL,
        adjacentCrossEdges: [Edge.DF, Edge.FL],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "DFR (Green-Yellow-Red)",
        nameKey: "slot.BR",
        cornerId: Corner.DFR,
        edgeId: Edge.DR,
        adjacentCrossEdges: [Edge.DF, Edge.FR],
        colorName: "#a855f7",
      },
    },
  },
  blue: {
    id: "blue",
    name: "Blue",
    nameKey: "crossColor.blue",
    face: "B",
    crossEdges: [Edge.UB, Edge.BR, Edge.DB, Edge.BL],
    slots: {
      FR: {
        id: "FR",
        name: "UBR (Blue-White-Red)",
        nameKey: "slot.FR",
        cornerId: Corner.UBR,
        edgeId: Edge.UR,
        adjacentCrossEdges: [Edge.UB, Edge.BR],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "ULB (Blue-White-Orange)",
        nameKey: "slot.FL",
        cornerId: Corner.ULB,
        edgeId: Edge.UL,
        adjacentCrossEdges: [Edge.UB, Edge.BL],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "DBL (Blue-Yellow-Orange)",
        nameKey: "slot.BL",
        cornerId: Corner.DBL,
        edgeId: Edge.DL,
        adjacentCrossEdges: [Edge.DB, Edge.BL],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "DRB (Blue-Yellow-Red)",
        nameKey: "slot.BR",
        cornerId: Corner.DRB,
        edgeId: Edge.DR,
        adjacentCrossEdges: [Edge.DB, Edge.BR],
        colorName: "#a855f7",
      },
    },
  },
  red: {
    id: "red",
    name: "Red",
    nameKey: "crossColor.red",
    face: "R",
    crossEdges: [Edge.UR, Edge.BR, Edge.DR, Edge.FR],
    slots: {
      FR: {
        id: "FR",
        name: "URF (Red-White-Green)",
        nameKey: "slot.FR",
        cornerId: Corner.URF,
        edgeId: Edge.UF,
        adjacentCrossEdges: [Edge.UR, Edge.FR],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "UBR (Red-White-Blue)",
        nameKey: "slot.FL",
        cornerId: Corner.UBR,
        edgeId: Edge.UB,
        adjacentCrossEdges: [Edge.UR, Edge.BR],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "DRB (Red-Yellow-Blue)",
        nameKey: "slot.BL",
        cornerId: Corner.DRB,
        edgeId: Edge.DB,
        adjacentCrossEdges: [Edge.DR, Edge.BR],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "DFR (Red-Yellow-Green)",
        nameKey: "slot.BR",
        cornerId: Corner.DFR,
        edgeId: Edge.DF,
        adjacentCrossEdges: [Edge.DR, Edge.FR],
        colorName: "#a855f7",
      },
    },
  },
  orange: {
    id: "orange",
    name: "Orange",
    nameKey: "crossColor.orange",
    face: "L",
    crossEdges: [Edge.UL, Edge.FL, Edge.DL, Edge.BL],
    slots: {
      FR: {
        id: "FR",
        name: "UFL (Orange-White-Green)",
        nameKey: "slot.FR",
        cornerId: Corner.UFL,
        edgeId: Edge.UF,
        adjacentCrossEdges: [Edge.UL, Edge.FL],
        colorName: "#ef4444",
      },
      FL: {
        id: "FL",
        name: "ULB (Orange-White-Blue)",
        nameKey: "slot.FL",
        cornerId: Corner.ULB,
        edgeId: Edge.UB,
        adjacentCrossEdges: [Edge.UL, Edge.BL],
        colorName: "#f97316",
      },
      BL: {
        id: "BL",
        name: "DBL (Orange-Yellow-Blue)",
        nameKey: "slot.BL",
        cornerId: Corner.DBL,
        edgeId: Edge.DB,
        adjacentCrossEdges: [Edge.DL, Edge.BL],
        colorName: "#3b82f6",
      },
      BR: {
        id: "BR",
        name: "DLF (Orange-Yellow-Green)",
        nameKey: "slot.BR",
        cornerId: Corner.DLF,
        edgeId: Edge.DF,
        adjacentCrossEdges: [Edge.DL, Edge.FL],
        colorName: "#a855f7",
      },
    },
  },
};

export interface InfiniteF2LOptions {
  crossColor?: CrossColor;
  concurrentPairs?: number; // 1 to 4 (default 2)
  allowedSlots?: F2LSlotId[]; // default all 4 slots
  allowTrapped?: boolean; // allow spawning in non-home F2L slots vs U layer
  enableSound?: boolean;
}

export interface ActivePairState {
  slotId: F2LSlotId;
  def: F2LSlotDef;
  spawnTime: number;
}

export interface InfiniteF2LState {
  options: Required<InfiniteF2LOptions>;
  activePairs: ActivePairState[];
  solvedCount: number;
  startTime: number;
  lastSolvedTime?: number;
  resolvedSlotHistory: { slotId: F2LSlotId; timestamp: number }[];
}

/**
 * Check if an F2L slot is correctly solved on a given CubeState.
 * Requires:
 * 1. The slot's corner is at its home position with orientation 0.
 * 2. The slot's edge is at its home position with orientation 0.
 * 3. The cross edges adjacent to this slot are at their home positions with orientation 0.
 */
export function isF2LSlotSolved(
  cubeState: CubeState,
  slotDef: F2LSlotDef,
): boolean {
  // Check corner
  if (cubeState.cp[slotDef.cornerId] !== slotDef.cornerId || cubeState.co[slotDef.cornerId] !== 0) {
    return false;
  }
  // Check edge
  if (cubeState.ep[slotDef.edgeId] !== slotDef.edgeId || cubeState.eo[slotDef.edgeId] !== 0) {
    return false;
  }
  // Check adjacent cross edges
  for (const crossEdge of slotDef.adjacentCrossEdges) {
    if (cubeState.ep[crossEdge] !== crossEdge || cubeState.eo[crossEdge] !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * Generate a PhaseMask highlighting the cross edges and all currently active pairs.
 */
export function buildInfiniteF2LMask(
  crossColor: CrossColor,
  activePairs: ActivePairState[],
): PhaseMask {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const edges: { id: number }[] = config.crossEdges.map((id) => ({ id }));
  const corners: { id: number }[] = [];

  for (const pair of activePairs) {
    edges.push({ id: pair.def.edgeId });
    corners.push({ id: pair.def.cornerId });
  }

  return { name: "infinite-f2l", edges, corners };
}

/**
 * Available U-layer candidate positions for scrambling pairs (White cross on D).
 */
const U_LAYER_CORNERS = [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR];
const U_LAYER_EDGES = [Edge.UR, Edge.UF, Edge.UL, Edge.UB];

function findCornerPos(cp: { [index: number]: number; length: number }, cornerId: number): number {
  for (let i = 0; i < cp.length; i++) {
    if (cp[i] === cornerId) return i;
  }
  return -1;
}

function findEdgePos(ep: { [index: number]: number; length: number }, edgeId: number): number {
  for (let i = 0; i < ep.length; i++) {
    if (ep[i] === edgeId) return i;
  }
  return -1;
}

/**
 * Scramble setup generator: creates a CubeState with the cross solved and
 * active pairs placed in non-solved positions.
 */
export function spawnInfiniteF2LState(
  crossColor: CrossColor = "white",
  activeSlots: F2LSlotId[] = ["FR", "BL"],
  allowTrapped: boolean = true,
): { state: CubeState; activePairs: ActivePairState[] } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const state = new CubeState(); // Starts solved

  const activePairs: ActivePairState[] = activeSlots.map((slotId) => ({
    slotId,
    def: config.slots[slotId],
    spawnTime: Date.now(),
  }));

  // List of candidate corner positions and edge positions
  const availableCorners = [...U_LAYER_CORNERS];
  const availableEdges = [...U_LAYER_EDGES];

  if (allowTrapped) {
    // Add other slot positions as candidates
    for (const [, slot] of Object.entries(config.slots) as [F2LSlotId, F2LSlotDef][]) {
      if (!availableCorners.includes(slot.cornerId)) availableCorners.push(slot.cornerId);
      if (!availableEdges.includes(slot.edgeId)) availableEdges.push(slot.edgeId);
    }
  }

  // Shuffle candidate pools
  const shuffle = <T>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);
  const shuffledCorners = shuffle(availableCorners);
  const shuffledEdges = shuffle(availableEdges);

  // Position assignments
  const usedCorners = new Set<Corner>();
  const usedEdges = new Set<Edge>();

  // Ensure cross edges stay in their home positions
  for (const ce of config.crossEdges) {
    usedEdges.add(ce);
  }

  for (const pair of activePairs) {
    // Pick corner slot
    let cornerSlot = shuffledCorners.find((c) => !usedCorners.has(c));
    if (cornerSlot === undefined) cornerSlot = pair.def.cornerId;

    // Pick edge slot
    let edgeSlot = shuffledEdges.find((e) => !usedEdges.has(e));
    if (edgeSlot === undefined) edgeSlot = pair.def.edgeId;

    usedCorners.add(cornerSlot);
    usedEdges.add(edgeSlot);

    // Random orientations
    let cornerOri = Math.floor(Math.random() * 3);
    let edgeOri = Math.floor(Math.random() * 2);

    // CRITICAL: Ensure the pair is NOT already fully solved in its own slot!
    if (
      cornerSlot === pair.def.cornerId &&
      cornerOri === 0 &&
      edgeSlot === pair.def.edgeId &&
      edgeOri === 0
    ) {
      // Twist the corner or flip the edge to ensure a valid non-solved case
      cornerOri = (cornerOri + 1) % 3;
    }

    // Assign piece permutation and orientation in CubeState
    const currentCornerPos = findCornerPos(state.cp, pair.def.cornerId);
    if (currentCornerPos !== -1 && currentCornerPos !== cornerSlot) {
      const occupant = state.cp[cornerSlot];
      state.cp[cornerSlot] = pair.def.cornerId;
      state.cp[currentCornerPos] = occupant;
    }
    state.co[cornerSlot] = cornerOri;

    const currentEdgePos = findEdgePos(state.ep, pair.def.edgeId);
    if (currentEdgePos !== -1 && currentEdgePos !== edgeSlot) {
      const occupant = state.ep[edgeSlot];
      state.ep[edgeSlot] = pair.def.edgeId;
      state.ep[currentEdgePos] = occupant;
    }
    state.eo[edgeSlot] = edgeOri;
  }

  return { state, activePairs };
}

/**
 * Check a move for any solved pairs among the active pairs.
 * Returns array of solved slot IDs in order.
 */
export function checkSolvedPairs(
  cubeState: CubeState,
  activePairs: ActivePairState[],
): F2LSlotId[] {
  const solved: F2LSlotId[] = [];
  for (const pair of activePairs) {
    if (isF2LSlotSolved(cubeState, pair.def)) {
      solved.push(pair.slotId);
    }
  }
  return solved;
}

/**
 * Replace a solved pair with a new random pair, placing it in an available slot.
 */
export function respawnPair(
  state: CubeState,
  crossColor: CrossColor,
  currentActive: ActivePairState[],
  solvedSlotId: F2LSlotId,
  allowedSlots: F2LSlotId[] = ["FR", "FL", "BL", "BR"],
): { nextActivePairs: ActivePairState[]; newPair: ActivePairState } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;

  // Filter remaining active
  const remaining = currentActive.filter((p) => p.slotId !== solvedSlotId);

  // Pick a new slot from allowed slots
  const usedSlots = new Set(remaining.map((p) => p.slotId));
  const availableSlots = allowedSlots.filter((s) => !usedSlots.has(s));

  // If all allowed slots are active or available list is empty, reuse the solved slot
  const nextSlotId =
    availableSlots.length > 0
      ? availableSlots[Math.floor(Math.random() * availableSlots.length)]
      : solvedSlotId;

  const newPairDef = config.slots[nextSlotId];
  const newPair: ActivePairState = {
    slotId: nextSlotId,
    def: newPairDef,
    spawnTime: Date.now(),
  };

  // Find an unoccupied corner and edge slot in U layer (or other slots)
  const candidateCorners = U_LAYER_CORNERS.filter(
    (c) => state.cp[c] !== newPairDef.cornerId && !remaining.some((p) => p.def.cornerId === state.cp[c]),
  );
  const targetCorner =
    candidateCorners.length > 0
      ? candidateCorners[Math.floor(Math.random() * candidateCorners.length)]
      : U_LAYER_CORNERS[0];

  const candidateEdges = U_LAYER_EDGES.filter(
    (e) => state.ep[e] !== newPairDef.edgeId && !remaining.some((p) => p.def.edgeId === state.ep[e]),
  );
  const targetEdge =
    candidateEdges.length > 0
      ? candidateEdges[Math.floor(Math.random() * candidateEdges.length)]
      : U_LAYER_EDGES[0];

  let cornerOri = Math.floor(Math.random() * 3);
  let edgeOri = Math.floor(Math.random() * 2);

  if (
    targetCorner === newPairDef.cornerId &&
    cornerOri === 0 &&
    targetEdge === newPairDef.edgeId &&
    edgeOri === 0
  ) {
    cornerOri = 1;
  }

  // Swap pieces into position
  const currentCornerPos = findCornerPos(state.cp, newPairDef.cornerId);
  if (currentCornerPos !== -1 && currentCornerPos !== targetCorner) {
    const occupant = state.cp[targetCorner];
    state.cp[targetCorner] = newPairDef.cornerId;
    state.cp[currentCornerPos] = occupant;
  }
  state.co[targetCorner] = cornerOri;

  const currentEdgePos = findEdgePos(state.ep, newPairDef.edgeId);
  if (currentEdgePos !== -1 && currentEdgePos !== targetEdge) {
    const occupant = state.ep[targetEdge];
    state.ep[targetEdge] = newPairDef.edgeId;
    state.ep[currentEdgePos] = occupant;
  }
  state.eo[targetEdge] = edgeOri;

  return {
    nextActivePairs: [...remaining, newPair],
    newPair,
  };
}
