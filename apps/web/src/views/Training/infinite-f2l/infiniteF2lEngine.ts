import {
  Corner,
  Edge,
  CubeState,
  FaceletStringConverter,
  cornerFacelet,
  orderPairFaces,
  type FaceLetter,
  type PhaseMask,
} from "@cubeforge/math-core";
import {
  createF2LDetector,
  D_TO_CROSS,
  CROSS_TO_D,
  type CaseDetector,
} from "@cubeforge/algorithm-db";

export type CrossColor = "white" | "yellow" | "green" | "blue" | "red" | "orange";

/**
 * How the spawner picks the next pair's configuration.
 *
 *   • normal   — random injection (byte-identical legacy behavior: any of
 *                the 383 physical pair configurations, mixing ~82% basic
 *                cases and ~18% advanced BirdF2L naturally).
 *   • basic    — the pool is the 41 Basic F2L cases only (caseNumber
 *                "F2L n"); every spawned pair is one of the 41, never a
 *                BirdF2L pattern.
 *   • advanced — the pool is the 19 distinct Advanced BirdF2L signatures
 *                only; every spawned pair is one of them, never a basic
 *                "F2L n" label.
 */
export type SpawnMode = "normal" | "basic" | "advanced";

/** The solver's frame-AUF turns (k quarter-turns of the displayed top layer). */
export type AufTurn = "U" | "U2" | "U'";

/** All AUF turns by quarter-turn count (index k-1 for k = 1..3). */
const AUF_TURNS: AufTurn[] = ["U", "U2", "U'"];

/**
 * The algorithm-db F2L probe names the 4 slots of a side cross differently
 * from the white-cross names this engine uses: for a green (F) or blue (B)
 * cross the slots are UR/UL/DR/DL, and for red (R)/orange (L) they are
 * UF/UB/DF/DB. White and yellow crosses keep FR/FL/BL/BR.
 */
const SLOT_TO_DETECTOR_SLOT: Record<CrossColor, Record<F2LSlotId, string>> = {
  white: { FR: "FR", FL: "FL", BL: "BL", BR: "BR" },
  yellow: { FR: "FR", FL: "FL", BL: "BL", BR: "BR" },
  green: { FR: "UR", FL: "UL", BL: "DL", BR: "DR" },
  blue: { FR: "UR", FL: "UL", BL: "DL", BR: "DR" },
  red: { FR: "UF", FL: "UB", BL: "DB", BR: "DF" },
  orange: { FR: "UF", FL: "UB", BL: "DB", BR: "DF" },
};

let f2lDetector: CaseDetector | undefined;

/**
 * Lazy shared F2L detector: Basic (41) + Advanced (BirdF2L) catalog, built
 * once like the analysis engine.
 */
function getF2LDetector(): CaseDetector {
  return (f2lDetector ??= createF2LDetector());
}

/**
 * Recognize the F2L case of an injected pair from the CURRENT logical state
 * (the pair's pieces settle wherever they were injected). The state is
 * already in the standard canonical colors, so no recolor step is needed.
 * Returns undefined when the injected configuration falls outside the
 * Basic + Advanced catalog — detection must never break spawning.
 *
 * @param auf — the frame-AUF folded into the injected configuration (the
 *              pair was placed at the AUF-rotated positions). The probe
 *              undoes exactly that rotation before signing, so the label
 *              is the base case's for ALL 6 cross frames (D/U crosses are
 *              absorbed by the signature's internal U-orbit; F/B/R/L
 *              crosses conjugate the AUF to a D-layer turn and need the
 *              explicit parameter — the reason it exists).
 */
export function detectPairCase(
  state: CubeState,
  crossColor: CrossColor,
  slotId: F2LSlotId,
  auf?: AufTurn,
): DetectedPairCase | undefined {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const detectorSlot =
    SLOT_TO_DETECTOR_SLOT[crossColor]?.[slotId] ?? slotId;
  const def = config.slots[slotId];
  try {
    // PIECE-ANCHORED contract: the engine injected this pair BY PIECE ID,
    // so it passes the real pieces (and the cross sticker's face letter)
    // to the detector instead of relying on the frame-color resolution.
    // The canonical states this engine builds are letter-consistent, so
    // the resolution would find the same pieces anyway — the explicit
    // contract is what makes the annotation independent of the detector's
    // color reading (see F2LPairPieces in algorithm-db).
    const result = getF2LDetector().detectWith(state, {
      probe: "f2l-slot",
      crossFace: config.face,
      slotName: detectorSlot,
      auf,
      pieces: { C: def.cornerId, E: def.edgeId, crossColor: config.face },
    });
    if (result.entry && result.confidence === "exact") {
      return {
        caseNumber: result.entry.caseNumber,
        caseName: result.entry.caseName,
      };
    }
  } catch {
    // Detection must never break pair spawning.
  }
  return undefined;
}

// ─── Case-pool spawning (basic / advanced modes) ────────────────────────────
//
// The exhaustive-config theorem (see f2lDetectionCoverage.test.ts) proves
// the combined Basic + Advanced catalog covers EVERY one of the 383
// physical pair configurations per (cross color, slot). That makes a
// CONFIG→CASE table possible: precompute which case each injected config
// lands on, then spawn a TARGETED case by sampling configs of that case
// whose positions are free.
//
// The AUF is FOLDED, never animated: instead of injecting the pair and
// then visibly turning a layer, the sampler picks the configuration whose
// positions are already the AUF-rotated ones (the conjugate rotation
// `r auf r⁻¹` with r = D_TO_CROSS — exactly the inverse of the probe's
// undoCubeAuf). Only the pair's own two positions change; no other piece
// of the cube ever moves, and no animation is involved. piece-anchored
// detection receives `auf` so the label stays exact in all 6 frames.

/** A physical pair configuration on a fresh solved cube. */
interface PairSpawnConfig {
  cPos: number; // corner position 0-7
  co: number; // corner orientation 0-2
  ePos: number; // edge position 0-11 (never a cross edge)
  eo: number; // edge orientation 0-1
}

/** A spawn target: a config plus the AUF folded into its positions. */
export interface PairSpawnTarget extends PairSpawnConfig {
  /** The frame-AUF folded in (undefined = canonical angle). */
  auf?: AufTurn;
}

/** Config→case table for one (cross color, slot): caseNumber → configs. */
export interface PairCaseTable {
  byCase: Map<string, PairSpawnConfig[]>;
}

/** Basic labels are "F2L n"; Advanced BirdF2L codes are anything else. */
function isBasicCaseNumber(caseNumber: string): boolean {
  return caseNumber.startsWith("F2L ");
}

/** Lazy config→case tables, memoized per (crossColor, slotId) for the app lifetime. */
const pairCaseTableCache = new Map<string, PairCaseTable>();

/**
 * Build (or fetch) the config→case table for a (cross color, slot).
 *
 * Enumerates all 383 injectable configurations (skipping the injector's
 * solved-in-own-slot guard) and classifies each by the detected case. The
 * signature depends only on the pair's own two pieces, so the table
 * transfers to any concurrent state unchanged. One-time cost per slot
 * (~0.3s); memoized for the rest of the app lifetime.
 */
export function getPairCaseTable(
  crossColor: CrossColor,
  slotId: F2LSlotId,
): PairCaseTable {
  const key = `${crossColor}/${slotId}`;
  const hit = pairCaseTableCache.get(key);
  if (hit) return hit;

  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const def = config.slots[slotId];
  const eligibleEdges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(
    (e) => !config.crossEdges.includes(e as never),
  );
  const byCase = new Map<string, PairSpawnConfig[]>();

  for (let cPos = 0; cPos < 8; cPos++) {
    for (let co = 0; co < 3; co++) {
      for (const ePos of eligibleEdges) {
        for (let eo = 0; eo < 2; eo++) {
          // Skip the solved-in-own-slot guard the injector applies.
          if (cPos === def.cornerId && co === 0 && ePos === def.edgeId && eo === 0) {
            continue;
          }
          const state = new CubeState();
          const curC = findPieceIndex(state.cp, def.cornerId);
          if (curC !== -1 && curC !== cPos) {
            const occupant = state.cp[cPos];
            state.cp[cPos] = def.cornerId;
            state.cp[curC] = occupant;
          }
          state.co[cPos] = co;
          const curE = findPieceIndex(state.ep, def.edgeId);
          if (curE !== -1 && curE !== ePos) {
            const occupant = state.ep[ePos];
            state.ep[ePos] = def.edgeId;
            state.ep[curE] = occupant;
          }
          state.eo[ePos] = eo;

          const detected = detectPairCase(state, crossColor, slotId);
          if (!detected) continue;
          let list = byCase.get(detected.caseNumber);
          if (!list) byCase.set(detected.caseNumber, (list = []));
          list.push({ cPos, co, ePos, eo });
        }
      }
    }
  }

  const table: PairCaseTable = { byCase };
  pairCaseTableCache.set(key, table);
  return table;
}

/**
 * Fold maps for a frame-AUF: where each piece position lands AND how the
 * orientation values change under the conjugate rotation `r auf r⁻¹`
 * (r = D_TO_CROSS[crossFace]).
 *
 * The probe's undoCubeAuf applies exactly the inverse of this conjugate
 * (as REAL moves), so for the fold to be exact the orientation values must
 * follow the cubie model's conventions: `new_co[dst] = old_co[src] +
 * twist[dst]` — a per-piece LINEAR delta that depends only on the path,
 * never on the other pieces. Reading the deltas from the sequence applied
 * to a solved cube gives the exact per-position deltas; folding a config
 * through (position map, twist/flip delta) and passing `auf` to
 * detectPairCase always yields the base case's label in all 6 frames.
 * Memoized per (crossFace, auf).
 */
const aufFoldCache = new Map<
  string,
  { corners: number[]; edges: number[]; cornerTwist: number[]; edgeFlip: number[] }
>();

export function getAufPositionMaps(crossFace: string, auf: AufTurn): {
  corners: number[];
  edges: number[];
  cornerTwist: number[];
  edgeFlip: number[];
} {
  const key = `${crossFace}/${auf}`;
  const hit = aufFoldCache.get(key);
  if (hit) return hit;
  const state = new CubeState();
  const seq = [D_TO_CROSS[crossFace], auf, CROSS_TO_D[crossFace]]
    .filter((m): m is string => Boolean(m))
    .join(" ");
  if (seq) state.applySequence(seq);
  const corners = new Array<number>(8);
  const edges = new Array<number>(12);
  const cornerTwist = new Array<number>(8).fill(0);
  const edgeFlip = new Array<number>(12).fill(0);
  for (let p = 0; p < 8; p++) {
    corners[p] = findPieceIndex(state.cp, p);
    cornerTwist[p] = state.co[corners[p]];
  }
  for (let p = 0; p < 12; p++) {
    edges[p] = findPieceIndex(state.ep, p);
    edgeFlip[p] = state.eo[edges[p]];
  }
  const result = { corners, edges, cornerTwist, edgeFlip };
  aufFoldCache.set(key, result);
  return result;
}

/**
 * Fold a base config through a frame-AUF: apply the conjugate rotation's
 * position map AND the model-exact orientation deltas to the pair's own
 * two pieces only. Nothing else on the cube ever changes; the probe's
 * undo restores the base config exactly, so detection with `auf` returns
 * the base case's label.
 */
export function foldSpawnConfig(
  crossFace: string,
  cfg: PairSpawnConfig,
  auf: AufTurn,
): PairSpawnTarget {
  const maps = getAufPositionMaps(crossFace, auf);
  return {
    cPos: maps.corners[cfg.cPos],
    co: (cfg.co + maps.cornerTwist[cfg.cPos]) % 3,
    ePos: maps.edges[cfg.ePos],
    eo: (cfg.eo + maps.edgeFlip[cfg.ePos]) % 2,
    auf,
  };
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sample a spawn target for the given case pool.
 *
 * Ladder: any case of the pool (uniform) → any config of that case → any
 * AUF amount (k = 0..3, only when aufEnabled) → first fit wins. Returns
 * null when EVERY config of EVERY pool case collides with the occupied
 * positions — the caller defers to the next pair-completion event (the
 * spawner never leaves the pool and never blocks the session).
 */
export function sampleSpawnConfig(
  crossColor: CrossColor,
  slotId: F2LSlotId,
  mode: Exclude<SpawnMode, "normal">,
  aufEnabled: boolean,
  occupiedCorners: Set<number>,
  occupiedEdges: Set<number>,
): PairSpawnTarget | null {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const table = getPairCaseTable(crossColor, slotId);
  const poolKeys = [...table.byCase.keys()].filter((k) =>
    mode === "basic" ? isBasicCaseNumber(k) : !isBasicCaseNumber(k),
  );
  const kChoices = aufEnabled ? [0, 1, 2, 3] : [0];

  for (const key of shuffled(poolKeys)) {
    for (const cfg of shuffled(table.byCase.get(key)!)) {
      for (const k of shuffled(kChoices)) {
        if (k === 0) {
          if (occupiedCorners.has(cfg.cPos) || occupiedEdges.has(cfg.ePos)) continue;
          return { cPos: cfg.cPos, co: cfg.co, ePos: cfg.ePos, eo: cfg.eo };
        }
        const target = foldSpawnConfig(config.face, cfg, AUF_TURNS[k - 1]);
        if (occupiedCorners.has(target.cPos) || occupiedEdges.has(target.ePos)) continue;
        return target;
      }
    }
  }
  return null;
}

/**
 * Shuffle a set of available slots — pick order for the spawn ladder.
 */
function shuffledSlots(slots: readonly F2LSlotId[]): F2LSlotId[] {
  return shuffled(slots);
}

/**
 * The pair's two side colors in the order the canonical FR mini-case renders
 * them (left goes on the render's F face, right on its R face) — same
 * convention as the analysis engine's per-pair mini cases.
 */
export function pairSideFaceColors(
  crossColor: CrossColor,
  slotId: F2LSlotId,
): { left: FaceLetter; right: FaceLetter } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const def = config.slots[slotId];
  const faces = cornerFacelet[def.cornerId].map((i) =>
    ("URFDLB"[Math.floor(i / 9)] as FaceLetter),
  );
  const side = faces.filter((f) => f !== config.face);
  const [left, right] = orderPairFaces(config.face, side[0], side[1]);
  return { left, right };
}
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
  targetPairs?: number; // 0 = Infinite, > 0 = stop after N pairs
  allowedSlots?: F2LSlotId[]; // default all 4 slots
  allowTrapped?: boolean; // allow spawning in non-home F2L slots vs U layer (normal mode only)
  enableSound?: boolean;
  /** Case pool for spawning: random (normal) | 41 Basic | 19 Advanced. Default normal. */
  spawnMode?: SpawnMode;
  /** Fold a random frame-AUF (0-2 turns, either direction) into basic/advanced spawns. Default ON. */
  aufEnabled?: boolean;
}

export interface DetectedPairCase {
  caseNumber: string;
  caseName: string;
}

export interface ActivePairState {
  slotId: F2LSlotId;
  def: F2LSlotDef;
  spawnTime: number;
  /** Facelet string (54 chars) of the cube state immediately after this pair was injected. */
  startFacelets: string;
  /**
   * Frame-AUF folded into this pair's injected configuration (basic /
   * advanced spawn modes only). Re-detecting from startFacelets with this
   * auf reproduces detectedCase in all 6 cross frames.
   */
  auf?: AufTurn;
  /**
   * Recognized F2L case (Basic 41 + Advanced BirdF2L catalog) at injection
   * time, when the injected configuration matches one of the catalog
   * signatures.
   */
  detectedCase?: DetectedPairCase;
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
 *
 * @param target — explicit (position, orientation, auf) config from the
 *                 case-pool sampler (basic/advanced modes). Random
 *                 injection when omitted (normal mode — byte-identical
 *                 legacy behavior). The AUF is FOLDED: the pair is placed
 *                 at the already-rotated positions, so nothing else on the
 *                 cube ever moves and no animation exists.
 */
export function injectPair(
  state: CubeState,
  pairDef: F2LSlotDef,
  config: CrossColorDef,
  occupiedCorners: Set<number>,
  occupiedEdges: Set<number>,
  allowTrapped: boolean = true,
  target?: PairSpawnTarget,
): { targetCorner: number; targetEdge: number; auf?: AufTurn } {
  if (target) {
    // Case-pool mode: use the sampled config verbatim (SWAP semantics —
    // the occupant of the target position is displaced to wherever the
    // pair's piece was, keeping cp/ep a true permutation). Defensive: if
    // the sampled positions somehow got taken in the meantime (they
    // can't — sampling filters against the same occupied sets), fall back
    // to random injection rather than corrupting the state.
    if (occupiedCorners.has(target.cPos) || occupiedEdges.has(target.ePos)) {
      return injectPair(state, pairDef, config, occupiedCorners, occupiedEdges, allowTrapped);
    }
    const curCornerPos = findPieceIndex(state.cp, pairDef.cornerId);
    if (curCornerPos !== -1 && curCornerPos !== target.cPos) {
      const occupant = state.cp[target.cPos];
      state.cp[target.cPos] = pairDef.cornerId;
      state.cp[curCornerPos] = occupant;
    }
    state.co[target.cPos] = target.co;
    const curEdgePos = findPieceIndex(state.ep, pairDef.edgeId);
    if (curEdgePos !== -1 && curEdgePos !== target.ePos) {
      const occupant = state.ep[target.ePos];
      state.ep[target.ePos] = pairDef.edgeId;
      state.ep[curEdgePos] = occupant;
    }
    state.eo[target.ePos] = target.eo;
    occupiedCorners.add(target.cPos);
    occupiedEdges.add(target.ePos);
    return { targetCorner: target.cPos, targetEdge: target.ePos, auf: target.auf };
  }

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

export interface SpawnOptions {
  spawnMode?: SpawnMode;
  aufEnabled?: boolean;
}

/**
 * Spawns an initial Infinite F2L state: cross is solved, and N initial pairs
 * are directly injected into random unoccupied positions on the cube.
 *
 * With spawnMode basic/advanced each pair is sampled from the case pool
 * (with a folded AUF when aufEnabled) instead of injected randomly. The
 * initial spawn can never defer: every position is free, so any pool case
 * fits.
 */
export function spawnInfiniteF2LState(
  crossColor: CrossColor = "white",
  activeSlots: F2LSlotId[] = ["FR", "BL"],
  allowTrapped: boolean = true,
  options: SpawnOptions = {},
): { state: CubeState; activePairs: ActivePairState[] } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const state = new CubeState(); // Starts fully solved
  const spawnMode = options.spawnMode ?? "normal";
  const aufEnabled = options.aufEnabled ?? true;

  const occupiedCorners = new Set<number>();
  const occupiedEdges = new Set<number>(config.crossEdges);

  const activePairs: ActivePairState[] = activeSlots.map((slotId) => {
    const def = config.slots[slotId];
    const target =
      spawnMode === "normal"
        ? undefined
        : sampleSpawnConfig(
            crossColor,
            slotId,
            spawnMode,
            aufEnabled,
            occupiedCorners,
            occupiedEdges,
          );
    const injected = injectPair(
      state,
      def,
      config,
      occupiedCorners,
      occupiedEdges,
      allowTrapped,
      target ?? undefined,
    );
    return {
      slotId,
      def,
      spawnTime: Date.now(),
      startFacelets: FaceletStringConverter.toFaceletString(state),
      auf: injected.auf,
    };
  });

  // Recognize each pair's case on the FINAL spawned state (auf folded in).
  for (const p of activePairs) {
    p.detectedCase = detectPairCase(state, crossColor, p.slotId, p.auf);
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
 *
 * With spawnMode basic/advanced the new pair is sampled from the case pool
 * (with a folded AUF when aufEnabled). If every config of every pool case
 * collides with the positions currently occupied by the other in-flight
 * pairs, the spawn is DEFERRED: newPair is undefined and the session
 * retries on the next pair-completion event (positions free up then). The
 * spawner never leaves the pool and never blocks the session.
 */
export function respawnPair(
  state: CubeState,
  crossColor: CrossColor,
  currentActive: ActivePairState[],
  solvedSlotId: F2LSlotId,
  allowedSlots: F2LSlotId[] = ["FR", "FL", "BL", "BR"],
  options: SpawnOptions = {},
): { nextActivePairs: ActivePairState[]; newPair?: ActivePairState } {
  const config = CROSS_COLOR_CONFIGS[crossColor] ?? CROSS_COLOR_CONFIGS.white;
  const spawnMode = options.spawnMode ?? "normal";
  const aufEnabled = options.aufEnabled ?? true;

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

  // 3b. Case-pool ladder: try the chosen slot, then the other free slots.
  let target: PairSpawnTarget | null | undefined;
  let targetSlot = nextSlotId;
  if (spawnMode !== "normal") {
    const slotCandidates = shuffledSlots([
      nextSlotId,
      ...availableSlots.filter((s) => s !== nextSlotId),
    ]);
    for (const slot of slotCandidates) {
      const t = sampleSpawnConfig(
        crossColor,
        slot,
        spawnMode,
        aufEnabled,
        occupiedCorners,
        occupiedEdges,
      );
      if (t) {
        target = t;
        targetSlot = slot;
        break;
      }
    }
    if (!target) {
      // Pool exhausted by occupancy — defer to the next completion event.
      return { nextActivePairs: remaining };
    }
  }

  const newPairDef = config.slots[targetSlot];

  // 4. Inject the new pair into an unoccupied slot
  const injected = injectPair(
    state,
    newPairDef,
    config,
    occupiedCorners,
    occupiedEdges,
    true,
    target ?? undefined,
  );

  const newPair: ActivePairState = {
    slotId: targetSlot,
    def: newPairDef,
    spawnTime: Date.now(),
    startFacelets: FaceletStringConverter.toFaceletString(state),
    auf: injected.auf,
    detectedCase: detectPairCase(state, crossColor, targetSlot, injected.auf),
  };

  return {
    nextActivePairs: [...remaining, newPair],
    newPair,
  };
}
