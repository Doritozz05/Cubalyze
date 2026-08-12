import { FACE_ROTATION_MAP } from "@cubeforge/cube-3d-engine";
import type { CubeFace } from "@cubeforge/types";

/** WCA face for a layer (axis, value) pair. */
const FACE_BY_LAYER: Record<string, CubeFace> = {
  "x1": "R",
  "x0": "M",
  "x-1": "L",
  "y1": "U",
  "y0": "E",
  "y-1": "D",
};

/**
 * Resolve the layer a face drag turns, from the pointer movement in PURE
 * SCREEN SPACE (csTimer model — camera-independent, so it cannot be fooled
 * by the isometric view angle):
 *
 *   • |dy| > |dx| (vertical drag) → the COLUMN layer at the grabbed sticker:
 *     x-axis, R/M/L by the cubie's x grid position.
 *   • |dx| > |dy| (horizontal drag) → the ROW layer at the grabbed sticker:
 *     y-axis, U/E/D by the cubie's y grid position.
 *
 * "Dragging the right column up turns R, the middle column M, the bottom
 * row right D, a right-swipe on the U face U" — the layer you grab always
 * turns, exactly like csTimer's virtual cube.
 */
export function resolveDragLayer(input: {
  /** Pointer travel in screen px since the drag started (+x = right, +y = down). */
  dx: number;
  dy: number;
  /** Grabbed cubie's current grid position (R=+x/L=-x, U=+y/D=-y). */
  cubieX: number;
  cubieY: number;
}): { axis: "x" | "y"; layerValue: number; face: CubeFace } | null {
  const { dx, dy, cubieX, cubieY } = input;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) < 1e-3) return null;

  const horizontal = Math.abs(dx) > Math.abs(dy);
  const axis: "x" | "y" = horizontal ? "y" : "x";
  const layerValue = horizontal ? cubieY : cubieX;
  const face = FACE_BY_LAYER[`${axis}${layerValue}`];
  if (!face) return null;
  return { axis, layerValue, face };
}

/**
 * Resolve the FULL drag move: the layer (see {@link resolveDragLayer}) plus
 * its WCA direction (+1 = the move as written, −1 = primed).
 *
 * The direction is decided in PURE SCREEN SPACE from the dominant drag axis
 * and the move's own angle sign, so it is camera-independent and cannot be
 * fooled by the isometric view:
 *
 *   direction = sign(dominant screen delta) / angleSign(face)
 *
 * This is the physical "the stickers of the dragged layer follow the finger"
 * rule, verified against the simulator's real gestures: dragging the right
 * column UP turns R (and down turns R'), the middle column UP turns M'
 * (down turns M — M is the mirror of L, not R), the left column DOWN turns
 * L, a right-swipe on the U face turns U' (left turns U), right on the
 * bottom row turns D. The horizontal moves keep their previously-validated
 * behaviour; the verticals are corrected (they used to commit inverted).
 */
export function resolveDragMove(input: {
  /** Pointer travel in screen px since the drag started (+x = right, +y = down). */
  dx: number;
  dy: number;
  /** Grabbed cubie's current grid position (R=+x/L=-x, U=+y/D=-y). */
  cubieX: number;
  cubieY: number;
}): { face: CubeFace; direction: 1 | -1 } | null {
  const layer = resolveDragLayer(input);
  if (!layer) return null;

  const angleSign = FACE_ROTATION_MAP[layer.face].angleSign;
  // Dominant screen delta (+1 = right or down, −1 = left or up).
  const screenSign = Math.abs(input.dx) > Math.abs(input.dy) ? Math.sign(input.dx) : Math.sign(input.dy);
  // ±1 / ±1 is always exactly ±1 — no rounding error possible.
  const direction = (screenSign / angleSign) as 1 | -1;
  return { face: layer.face, direction };
}
