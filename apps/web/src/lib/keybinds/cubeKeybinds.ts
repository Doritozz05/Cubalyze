import { FACE_ROTATION_MAP, type LayerAxis } from "@cubeforge/cube-3d-engine";
import type { CubeFace } from "@cubeforge/types";

/**
 * Virtual-cube keyboard layout — an exact mirror of the professional standard
 * used by csTimer (src/js/twisty/qcubennn.js + twistyskb.js).
 *
 * Ergonomics ("as if holding the cube"): the index fingers rest on U —
 * `F` (left index) = U', `J` (right index) = U. The middle fingers do R/L,
 * the ring fingers B/D, and the pinkies the rotations + wide/slice moves.
 *
 * Clockwise and counterclockwise are SEPARATE keys (csTimer does not use
 * Shift) so the mapping is pure muscle memory.
 */

export type CubeKeyAction =
  /** A single-layer face turn (U/D/L/R/F/B) or slice move (M/E/S). CubeFace
   *  already includes M/E/S. */
  | { kind: "turn"; face: CubeFace; direction: 1 | -1 }
  /** A wide move: face layer + opposite slice (r = R M', l = L M, …). */
  | { kind: "wide"; face: "R" | "L" | "U" | "D"; direction: 1 | -1 }
  /** A whole-cube rotation around an axis (x/y/z). */
  | { kind: "rotate"; axis: LayerAxis; direction: 1 | -1 };

/** The slice layer paired with each wide-move face (standard notation). */
const WIDE_SLICE: Record<"R" | "L" | "U" | "D", "M" | "E"> = {
  R: "M",
  L: "M",
  U: "E",
  D: "E",
};

/** The face whose rotation direction defines each whole-cube rotation. */
const ROTATION_FACE: Record<LayerAxis, CubeFace> = {
  x: "R",
  y: "U",
  z: "F",
};

/**
 * csTimer keymap (keyboard `event.code` values — physical keys, layout
 * independent). Keys with duplicate entries mirror csTimer exactly
 * (e.g. both T and Y do x, both N and B do x').
 */
export const CUBE_KEYMAP: Readonly<Record<string, CubeKeyAction>> = {
  // ── Face turns ─────────────────────────────────────────────────────────
  KeyJ: { kind: "turn", face: "U", direction: 1 }, // J = U
  KeyF: { kind: "turn", face: "U", direction: -1 }, // F = U'
  KeyH: { kind: "turn", face: "F", direction: 1 }, // H = F
  KeyG: { kind: "turn", face: "F", direction: -1 }, // G = F'
  KeyI: { kind: "turn", face: "R", direction: 1 }, // I = R
  KeyK: { kind: "turn", face: "R", direction: -1 }, // K = R'
  KeyD: { kind: "turn", face: "L", direction: 1 }, // D = L
  KeyE: { kind: "turn", face: "L", direction: -1 }, // E = L'
  KeyW: { kind: "turn", face: "B", direction: 1 }, // W = B
  KeyO: { kind: "turn", face: "B", direction: -1 }, // O = B'
  KeyS: { kind: "turn", face: "D", direction: 1 }, // S = D
  KeyL: { kind: "turn", face: "D", direction: -1 }, // L = D'

  // ── Slice moves ────────────────────────────────────────────────────────
  Digit5: { kind: "turn", face: "M", direction: 1 }, // 5 = M
  Digit6: { kind: "turn", face: "M", direction: -1 }, // 6 = M'
  Period: { kind: "turn", face: "M", direction: -1 }, // . = M'
  KeyX: { kind: "turn", face: "M", direction: -1 }, // X = M'
  Digit2: { kind: "turn", face: "E", direction: 1 }, // 2 = E
  Digit9: { kind: "turn", face: "E", direction: -1 }, // 9 = E'
  Digit1: { kind: "turn", face: "S", direction: -1 }, // 1 = S'
  Digit0: { kind: "turn", face: "S", direction: 1 }, // 0 = S

  // ── Wide moves ─────────────────────────────────────────────────────────
  KeyU: { kind: "wide", face: "R", direction: 1 }, // U = r
  KeyM: { kind: "wide", face: "R", direction: -1 }, // M = r'
  KeyR: { kind: "wide", face: "L", direction: -1 }, // R = l'
  KeyV: { kind: "wide", face: "L", direction: 1 }, // V = l
  KeyC: { kind: "wide", face: "U", direction: -1 }, // C = u'
  Comma: { kind: "wide", face: "U", direction: 1 }, // , = u
  KeyZ: { kind: "wide", face: "D", direction: 1 }, // Z = d
  Slash: { kind: "wide", face: "D", direction: -1 }, // / = d'

  // ── Whole-cube rotations ───────────────────────────────────────────────
  KeyT: { kind: "rotate", axis: "x", direction: 1 }, // T = x
  KeyY: { kind: "rotate", axis: "x", direction: 1 }, // Y = x
  KeyN: { kind: "rotate", axis: "x", direction: -1 }, // N = x'
  KeyB: { kind: "rotate", axis: "x", direction: -1 }, // B = x'
  KeyA: { kind: "rotate", axis: "y", direction: -1 }, // A = y'
  Semicolon: { kind: "rotate", axis: "y", direction: 1 }, // ; = y
  KeyQ: { kind: "rotate", axis: "z", direction: -1 }, // Q = z'
  KeyP: { kind: "rotate", axis: "z", direction: 1 }, // P = z
};

export interface CubeEngineMove {
  axis: LayerAxis;
  /** Engine layer values (−1 | 0 | 1 for 3×3, −1 | 1 for 2×2). */
  layerValues: number[];
  /** Rotation angle in degrees (already signed, `direction × angleSign × 90`). */
  angle: number;
}

/**
 * Expand a key action into engine moves. Directions follow the same
 * convention as the smart-cube path (`angle = direction × angleSign × 90`):
 * +1 = the face's clockwise move in cube notation.
 *
 * - `turn`   → one move on the face's layer (or the slice layer for M/E/S).
 * - `wide`   → two concurrent moves: the face layer + the paired slice. A
 *              wide move rotates BOTH layers as one rigid block, so the
 *              slice gets the SAME physical angle as the face layer around
 *              the shared axis. The notation primes (r = R M', u = U E',
 *              d = D E) only describe the slice's own WCA convention in the
 *              identity string — they never flip the physical direction
 *              (matches math-core's `expandWideMoves`, so visual and state
 *              stay in lockstep).
 * - `rotate` → all layers of the axis at once (a whole-cube rotation).
 */
export function actionToMoves(action: CubeKeyAction, order: number = 3): CubeEngineMove[] {
  switch (action.kind) {
    case "turn": {
      const m = FACE_ROTATION_MAP[action.face];
      return [
        {
          axis: m.axis,
          layerValues: [m.layerValue],
          angle: action.direction * m.angleSign * 90,
        },
      ];
    }
    case "wide": {
      const faceM = FACE_ROTATION_MAP[action.face];
      const slice = WIDE_SLICE[action.face];
      const sliceM = FACE_ROTATION_MAP[slice];
      return [
        {
          axis: faceM.axis,
          layerValues: [faceM.layerValue],
          angle: action.direction * faceM.angleSign * 90,
        },
        {
          axis: sliceM.axis,
          layerValues: [sliceM.layerValue],
          // Rigid block: same physical angle as the face layer (NOT multiplied
          // by the slice's own angleSign — the prime lives in the notation,
          // not in the rotation direction).
          angle: action.direction * faceM.angleSign * 90,
        },
      ];
    }
    case "rotate": {
      const face = ROTATION_FACE[action.axis];
      const m = FACE_ROTATION_MAP[face];
      const layers = order === 2 ? [-1, 1] : [-1, 0, 1];
      return [
        {
          axis: action.axis,
          layerValues: layers,
          angle: action.direction * m.angleSign * 90,
        },
      ];
    }
  }
}

/** Human-readable move notation for a key action ("R", "U'", "M", "r", "x"). */
export function actionToNotation(action: CubeKeyAction): string {
  switch (action.kind) {
    case "turn":
      return `${action.face}${action.direction < 0 ? "'" : ""}`;
    case "wide":
      return `${action.face.toLowerCase()}${action.direction < 0 ? "'" : ""}`;
    case "rotate":
      return `${action.axis}${action.direction < 0 ? "'" : ""}`;
  }
}
