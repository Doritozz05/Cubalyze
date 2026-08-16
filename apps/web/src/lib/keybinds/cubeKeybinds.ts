import { FACE_ROTATION_MAP, type LayerAxis } from "@cubeforge/cube-3d-engine";
import {
  conjugateTokenThroughGrip,
  expandWideMoves,
  type OrientationEntry,
} from "@cubeforge/math-core";
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

  // ── Arrow keys (mirror the background-drag / virtual-cube rotation) ────
  ArrowLeft: { kind: "rotate", axis: "y", direction: 1 }, // ← = y
  ArrowRight: { kind: "rotate", axis: "y", direction: -1 }, // → = y'
  ArrowUp: { kind: "rotate", axis: "x", direction: 1 }, // ↑ = x
  ArrowDown: { kind: "rotate", axis: "x", direction: -1 }, // ↓ = x'
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

/**
 * A single user action fed to the scramble validator. Each USER ACTION maps
 * to exactly ONE validator event so a wide move counts as one deviation
 * (not two face turns) and its inverse undoes it in one move.
 */
export type ValidatorEvent =
  | { kind: "face"; face: CubeFace; direction: 1 | -1 }
  | { kind: "token"; notation: string };

/**
 * Canonical wide-move tokens (inverse of math-core's `expandWideMoves`):
 * used to re-pack a conjugated face+slice pair back into a single wide
 * token (e.g. "B S'" under a y grip → "b"). Under any whole-cube rotation
 * a wide pair always maps onto another canonical wide pair (the slice stays
 * on the same axis as its face), so the pack lookup covers every case.
 */
const WIDE_PACK: Record<string, string> = {
  "R M'": "r", "R' M": "r'", "R2 M2": "r2",
  "L M": "l", "L' M'": "l'", "L2 M2": "l2",
  "F S": "f", "F' S'": "f'", "F2 S2": "f2",
  "U E'": "u", "U' E": "u'", "U2 E2": "u2",
  "D E": "d", "D' E'": "d'", "D2 E2": "d2",
  "B S'": "b", "B' S": "b'", "B2 S2": "b2",
};

/**
 * Conjugate a WIDE token through the grip, keeping it a single token.
 * `conjugateTokenThroughGrip` passes wide moves through unchanged (they must
 * be pre-expanded), so: expand → conjugate each part → re-pack into the
 * canonical wide token. Falls back to the space-joined parts when the
 * conjugated pair is not a canonical wide move (should not happen for pure
 * rotations — the pair stays on one axis).
 */
function conjugateWideToBase(token: string, grip: OrientationEntry): string {
  const fixed = expandWideMoves(token).map((p) => conjugateTokenThroughGrip(p, grip));
  return WIDE_PACK[fixed.join(" ")] ?? fixed.join(" ");
}

/**
 * Decompose a key action into ONE validator event per user action, in the
 * CUBE-fixed frame.
 *
 * The virtual cube resolves drags/keys in the CURRENT (possibly rotated)
 * view frame — "the layer the user sees" — but the scramble validator
 * compares against the scramble in the CUBE-fixed frame (the same frame a
 * physical smart cube reports raw moves in, where the gyro only remaps the
 * DISPLAY). Each position-frame token is conjugated through the current
 * grip back to the cube frame, so a drag on the front face after a y
 * rotation validates as the original R move, exactly like the real timer.
 *
 * Wide moves stay a SINGLE token ("r" → conjugated "b"), emitted on the
 * adapter's token stream so the validator compares one user action against
 * one scramble token (matching math-core's `expandWideMoves` semantics for
 * the CubeState mirror, while avoiding a phantom second error from the
 * slice half of the pair). Whole-cube rotations emit nothing (they are not
 * moves).
 */
export function actionToValidatorEvents(
  action: CubeKeyAction,
  grip: OrientationEntry,
): ValidatorEvent[] {
  if (action.kind === "rotate") return [];
  if (action.kind === "wide") {
    // The fallback (conjugated pair not repackable) yields two tokens — the
    // view emits them separately, which is the same as two independent
    // deviations (rare; pure rotations always repack).
    return conjugateWideToBase(actionToNotation(action), grip)
      .split(" ")
      .map((notation) => ({ kind: "token", notation }));
  }
  const fixed = conjugateTokenThroughGrip(actionToNotation(action), grip);
  return [
    {
      kind: "face",
      face: fixed[0] as CubeFace,
      direction: (fixed.endsWith("'") ? -1 : 1) as 1 | -1,
    },
  ];
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

/**
 * Whether a key action is meaningful for the given cube order.
 *
 * The 2×2 has no middle layer, so slice moves (M/E/S) and wide moves
 * (r/l/u/d/f/b) do not exist; face turns and whole-cube rotations (x/y/z)
 * remain valid. Orders > 2 keep the full keymap. Used by the Cube tab to
 * ignore meaningless keys and to filter the on-screen keyboard help.
 */
export function isActionAllowedForOrder(
  action: CubeKeyAction,
  order: number,
): boolean {
  if (order !== 2) return true;
  if (action.kind === "wide") return false;
  if (
    action.kind === "turn" &&
    (action.face === "M" || action.face === "E" || action.face === "S")
  ) {
    return false;
  }
  return true;
}
