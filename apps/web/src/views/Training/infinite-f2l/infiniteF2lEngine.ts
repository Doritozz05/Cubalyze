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
  oppositeLayerCorners: Corner[];
  oppositeLayerEdges: Edge[];
  slots: Record<F2LSlotId, F2LSlotDef>;
}

/**
 * Standard slot definitions for all cross colors.
 * Identifies the cross face, the 4 F2L slots, and the opposite layer.
 */
export const CROSS_COLOR_CONFIGS: Record<CrossColor, CrossColorDef> = {
  white: {
    id: "white",
    name: "White",
    nameKey: "crossColor.white",
    face: "U",
    crossEdges: [Edge.UF, Edge.UR, Edge.UB, Edge.UL],
    oppositeLayerCorners: [Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB],
    oppositeLayerEdges: [Edge.DF, Edge.DR, Edge.DB, Edge.DL],
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
    oppositeLayerCorners: [Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR],
    oppositeLayerEdges: [Edge.UF, Edge.UR, Edge.UB, Edge.UL],
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
    oppositeLayerCorners: [Corner.ULB, Corner.UBR, Corner.DBL, Corner.DRB],
    oppositeLayerEdges: [Edge.UB, Edge.UR, Edge.DB, Edge.DL],
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
    oppositeLayerCorners: [Corner.URF, Corner.UFL, Corner.DFR, Corner.DLF],
    oppositeLayerEdges: [Edge.UF, Edge.UR, Edge.DF, Edge.DL],
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
    oppositeLayerCorners: [Corner.UFL, Corner.ULB, Corner.DLF, Corner.DBL],
    oppositeLayerEdges: [Edge.UF, Edge.UL, Edge.DF, Edge.DL],
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
    oppositeLayerCorners: [Corner.URF, Corner.UBR, Corner.DFR, Corner.DRB],
    oppositeLayerEdges: [Edge.UF, Edge.UR, Edge.DF, Edge.DR],
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

/**
 * Check if an F2L slot is correctly solved on a given CubeState.
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

function findPieceIndex(arr: { [index: number]: number; length: number }, id: number): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === id) return i;
  }
  return -1;
}

/**
 * Direct piece injector: places a new pair's corner and edge into unoccupied
 * slots on the current CubeState WITHOUT modifying or disrupting any other
 * pieces (cross edges and in-flight active pairs remain 100% in place).
 */
export function injectPair(
  state: CubeState,
  pairDef: F2LSlotDef,
  config: CrossColorDef,
  occupiedCorners: Set<number>,
  occupiedEdges: Set<number>,
  allowTrapped: boolean = true,
): { targetCorner: number; targetEdge: number } {
  // 1. Determine eligible corner positions
  const allCorners = [0, 1, 2, 3, 4, 5, 6, 7];
  let eligibleCorners = allCorners.filter((c) => !occupiedCorners.has(c));

  if (!allowTrapped) {
    const oppCorners = config.oppositeLayerCorners.filter((c) => !occupiedCorners.has(c));
    if (oppCorners.length > 0) {
      eligibleCorners = oppCorners;
    }
  }

  // Pick target corner
  const targetCorner =
    eligibleCorners.length > 0
      ? eligibleCorners[Math.floor(Math.random() * eligibleCorners.length)]
      : config.oppositeLayerCorners[0];

  // 2. Determine eligible edge positions (cannot be cross edges or occupied)
  const allEdges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let eligibleEdges = allEdges.filter((e) => !occupiedEdges.has(e));

  if (!allowTrapped) {
    const oppEdges = config.oppositeLayerEdges.filter((e) => !occupiedEdges.has(e));
    if (oppEdges.length > 0) {
      eligibleEdges = oppEdges;
    }
  }

  // Pick target edge
  const targetEdge =
    eligibleEdges.length > 0
      ? eligibleEdges[Math.floor(Math.random() * eligibleEdges.length)]
      : eligibleEdges[0] ?? pairDef.edgeId;

  // 3. Random orientations (0, 1, 2 for corner; 0, 1 for edge)
  let co = Math.floor(Math.random() * 3);
  const eo = Math.floor(Math.random() * 2);

  // Guard: Avoid spawning already 100% solved in its own slot
  if (targetCorner === pairDef.cornerId && co === 0 && targetEdge === pairDef.edgeId && eo === 0) {
    co = (co + 1) % 3;
  }

  // 4. Swap corner piece into targetCorner
  const curCornerPos = findPieceIndex(state.cp, pairDef.cornerId);
  if (curCornerPos !== -1 && curCornerPos !== targetCorner) {
    const occupant = state.cp[targetCorner];
    state.cp[targetCorner] = pairDef.cornerId;
    state.cp[curCornerPos] = occupant;
  }
  state.co[targetCorner] = co;

  // 5. Swap edge piece into targetEdge
  const curEdgePos = findPieceIndex(state.ep, pairDef.edgeId);
  if (curEdgePos !== -1 && curEdgePos !== targetEdge) {
    const occupant = state.ep[targetEdge];
    state.ep[targetEdge] = pairDef.edgeId;
    state.ep[curEdgePos] = occupant;
  }
  state.eo[targetEdge] = eo;

  occupiedCorners.add(targetCorner);
  occupiedEdges.add(targetEdge);

  return { targetCorner, targetEdge };
}

/**
 * Spawns an initial Infinite F2L state: cross is solved, and N initial pairs
 * are directly injected into random unoccupied positions on the cube.
 */
export function spawnInfiniteF2LState(
  crossColor: CrossColor = "white",
  activeSlots: F2LSlotId[] = ["FR", "BL"],
  allowTrapped: boolean = true,
): { state: CubeState; activePairs: ActivePairState[] } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const state = new CubeState(); // Starts fully solved

  const activePairs: ActivePairState[] = activeSlots.map((slotId) => ({
    slotId,
    def: config.slots[slotId],
    spawnTime: Date.now(),
  }));

  const occupiedCorners = new Set<number>();
  const occupiedEdges = new Set<number>(config.crossEdges);

  for (const pair of activePairs) {
    injectPair(state, pair.def, config, occupiedCorners, occupiedEdges, allowTrapped);
  }

  return { state, activePairs };
}

/**
 * Check if any currently active pair is solved on the logical state.
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
 * Replaces a solved pair by injecting a NEW pair into an unoccupied location
 * on the current state. Existing active pairs stay EXACTLY where they are,
 * ensuring continuous and undisturbed lookahead.
 */
export function respawnPair(
  state: CubeState,
  crossColor: CrossColor,
  currentActive: ActivePairState[],
  solvedSlotId: F2LSlotId,
  allowedSlots: F2LSlotId[] = ["FR", "FL", "BL", "BR"],
): { nextActivePairs: ActivePairState[]; newPair: ActivePairState } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;

  // 1. Keep remaining active pairs exactly where they are
  const remaining = currentActive.filter((p) => p.slotId !== solvedSlotId);

  // 2. Mark positions of cross edges and existing in-flight pairs as occupied
  const occupiedCorners = new Set<number>();
  const occupiedEdges = new Set<number>(config.crossEdges);

  for (const p of remaining) {
    const cpPos = findPieceIndex(state.cp, p.def.cornerId);
    if (cpPos !== -1) occupiedCorners.add(cpPos);
    const epPos = findPieceIndex(state.ep, p.def.edgeId);
    if (epPos !== -1) occupiedEdges.add(epPos);
  }

  // 3. Choose a new slot
  const usedSlots = new Set(remaining.map((p) => p.slotId));
  const availableSlots = allowedSlots.filter((s) => !usedSlots.has(s));

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

  // 4. Inject the new pair into an unoccupied slot
  injectPair(state, newPairDef, config, occupiedCorners, occupiedEdges, true);

  return {
    nextActivePairs: [...remaining, newPair],
    newPair,
  };
}
