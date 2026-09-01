import { Corner, Edge, CubeState, StringToMove, type PhaseMask } from "@cubeforge/math-core";

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

/**
 * Canonical F2L setup algorithms (scramble algorithms) that preserve the cross.
 */
export const F2L_CANONICAL_SETUPS: string[] = [
  "F R' F' R",
  "R' F R F'",
  "U' R U' R' U2 R U' R'",
  "R U' R'",
  "U' R U R' U2 R U' R'",
  "U' R U2 R' U2 R U' R'",
  "U' R U2 R' U F' U' F",
  "R U2 R' U' R U R'",
  "U R U2 R' U R U' R'",
  "U' R U R' U R U R'",
  "R U R' U' R U R' U' R U R'",
  "U' R U' R' U R U R'",
  "R U' R' U R U' R'",
  "R U R' U2 R U' R'",
  "U R U2 R' U R U2 R'",
  "R U' R' U2 R U R'",
  "R U R' U R U' R'",
  "U' R U' R' U2 R U R'",
  "R U' R' U' R U R'",
  "R U2 R' U R U' R'",
  "R U' R' U R U2 R'",
  "R U R' U' R U2 R' U' R U R'",
  "R U R' U' R U' R' U2 R U' R'",
  "R U' R' U R U R' U2 R U' R'",
  "R U R' U2 R U R' U R U' R'",
  "R U R' U' R U' R' U F' U' F",
  "R U R' U2 R U' R' U R U' R'",
  "R U R' U' R U R' U2 R U' R'",
  "R U' R' U' R U2 R' U' R U R'",
];

const SLOT_MOVE_MAP: Record<F2LSlotId, Record<string, string>> = {
  FR: { R: "R", L: "L", F: "F", B: "B", U: "U", D: "D" },
  FL: { R: "F", F: "L", L: "B", B: "R", U: "U", D: "D" },
  BL: { R: "L", L: "R", F: "B", B: "F", U: "U", D: "D" },
  BR: { R: "B", B: "L", L: "F", F: "R", U: "U", D: "D" },
};

/**
 * Adapts a standard FR setup algorithm to any slot (FL, BL, BR) and cross orientation.
 */
export function generateSlotScramble(slotId: F2LSlotId, crossColor: CrossColor = "white"): string[] {
  const baseSetup = F2L_CANONICAL_SETUPS[Math.floor(Math.random() * F2L_CANONICAL_SETUPS.length)];

  // For white cross (on U), the frame is inverted by x2 (F<->B, U<->D), so FR->BR, FL->BL, BL->FL, BR->FR
  let targetSlot = slotId;
  if (crossColor === "white") {
    if (slotId === "FR") targetSlot = "BR";
    else if (slotId === "FL") targetSlot = "BL";
    else if (slotId === "BL") targetSlot = "FL";
    else if (slotId === "BR") targetSlot = "FR";
  }

  const slotMap = SLOT_MOVE_MAP[targetSlot] ?? SLOT_MOVE_MAP.FR;
  const rawMoves = baseSetup.trim().split(/\s+/);

  const slotMoves = rawMoves.map((tok) => {
    const face = tok[0];
    const modifier = tok.slice(1);
    const mappedFace = slotMap[face] ?? face;
    return `${mappedFace}${modifier}`;
  });

  // Random AUF rotations
  const aufOptions = ["", "U", "U'", "U2"];
  const preAuf = aufOptions[Math.floor(Math.random() * aufOptions.length)];
  const postAuf = aufOptions[Math.floor(Math.random() * aufOptions.length)];

  const finalMoves: string[] = [];
  if (preAuf) finalMoves.push(preAuf);
  finalMoves.push(...slotMoves);
  if (postAuf) finalMoves.push(postAuf);

  // If cross is on U (White cross), map U<->D and F<->B (x2 inversion)
  if (crossColor === "white") {
    return finalMoves.map((tok) => {
      let face = tok[0];
      const modifier = tok.slice(1);
      if (face === "U") face = "D";
      else if (face === "D") face = "U";
      else if (face === "F") face = "B";
      else if (face === "B") face = "F";
      return `${face}${modifier}`;
    });
  }

  return finalMoves;
}

/**
 * Applies move tokens to a CubeState.
 */
export function applyMovesToState(state: CubeState, moves: string[]): void {
  for (const moveStr of moves) {
    if (!moveStr) continue;
    const moveEnum = StringToMove[moveStr.trim()];
    if (moveEnum !== undefined) {
      state.applyMove(moveEnum);
    }
  }
}

/**
 * Scramble setup generator: creates a CubeState with the cross solved and
 * active pairs placed in non-solved positions.
 */
export function spawnInfiniteF2LState(
  crossColor: CrossColor = "white",
  activeSlots: F2LSlotId[] = ["FR", "BL"],
  _allowTrapped: boolean = true,
): { state: CubeState; activePairs: ActivePairState[] } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const state = new CubeState(); // Starts fully solved

  const activePairs: ActivePairState[] = activeSlots.map((slotId) => ({
    slotId,
    def: config.slots[slotId],
    spawnTime: Date.now(),
  }));

  // Apply a cross-preserving scramble for each active slot
  for (const pair of activePairs) {
    let attempts = 0;
    while (attempts < 10) {
      attempts++;
      const moves = generateSlotScramble(pair.slotId, crossColor);
      applyMovesToState(state, moves);
      // Ensure the pair is not accidentally solved
      if (!isF2LSlotSolved(state, pair.def)) {
        break;
      }
    }
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

  // Scramble the new pair into position
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const moves = generateSlotScramble(nextSlotId, crossColor);
    applyMovesToState(state, moves);
    if (!isF2LSlotSolved(state, newPairDef)) {
      break;
    }
  }

  return {
    nextActivePairs: [...remaining, newPair],
    newPair,
  };
}
