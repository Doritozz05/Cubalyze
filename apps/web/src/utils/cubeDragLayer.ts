import { FACE_ROTATION_MAP, layerTwistAngleDelta } from "@cubeforge/cube-3d-engine";
import type { CubeFace } from "@cubeforge/types";

/** A 3D vector (structural — matches the engine's Vec3Like). */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

type TurnAxis = "x" | "y" | "z";

/** WCA face for a (axis, layer value) pair — includes the slices. */
const FACE_BY_LAYER: Record<string, CubeFace> = {
  "x1": "R",
  "x0": "M",
  "x-1": "L",
  "y1": "U",
  "y0": "E",
  "y-1": "D",
  "z1": "F",
  "z0": "S",
  "z-1": "B",
};

/** Outward normal axis of each sticker face (slices are never picked). */
const FACE_NORMAL: Record<CubeFace, TurnAxis> = {
  R: "x",
  L: "x",
  U: "y",
  D: "y",
  F: "z",
  B: "z",
  M: "x",
  E: "y",
  S: "z",
};

/** The two in-plane axes of a face, given its outward normal axis. */
const PLANE_AXES: Record<TurnAxis, [TurnAxis, TurnAxis]> = {
  x: ["y", "z"],
  y: ["x", "z"],
  z: ["x", "y"],
};

const AXIS_VECTOR: Record<TurnAxis, Vec3> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/**
 * Resolve the move for a face drag — the virtual-cube interaction.
 *
 * The gesture is interpreted in the GRABBED FACE's own orientation, as if
 * that face were rotated to face you (the front-face rule generalized to
 * every face):
 *
 *   • the drag is projected to world space and read against the face's two
 *     IN-PLANE axes (the face's outward normal is known exactly from the
 *     pick, so this is camera-robust): the dominant axis is the drag axis
 *     and the OTHER in-plane axis is the turn axis.
 *   • the layer is the sticker's row/column on that turn axis (R/M/L for x,
 *     U/E/D for y, F/S/B for z), so:
 *       - front face: vertical → columns R/M/L, horizontal → rows U/E/D
 *         (unchanged — the interaction you liked);
 *       - top/bottom face: horizontal drag → F/S/B by front-back row
 *         (front row → F, middle → S, back → B), front-back drag → R/M/L;
 *       - side faces: vertical drag → F/S/B by front-back column (front
 *         column → F, middle → S, back → B), front-back drag → U/E/D.
 *   • the direction makes the grabbed stickers follow the finger: the drag
 *     is signed against the rotation tangent t = turnAxis × grabPoint (the
 *     engine's arc-length math), and `direction = sign / angleSign` composes
 *     with the move pipeline exactly like the smart-cube path
 *     (angle = direction × angleSign × 90).
 *
 * So right-swipe on the top face's front row turns F (left → F'), DOWN-swipe
 * on the right face's front column turns F (up → F'), up-swipe on the front
 * face's right column turns R (down → R'), a right-swipe on the front face's
 * top row turns U' — always the layer under the sticker you grabbed.
 *
 * IMPORTANT sign detail: screen Y grows DOWNWARD while `cameraUp` is the
 * world direction of screen-TOP, so the world drag is `dx·cameraRight −
 * dy·cameraUp`. Using `+dy·cameraUp` (as a naive port would) inverts every
 * vertical gesture — that was the original "R up → R'" bug.
 */
export function resolveDragMove(input: {
  /** Pointer travel in screen px since the drag started (+x = right, +y = down). */
  dx: number;
  dy: number;
  /** The grabbed sticker's outward face (F/B/U/D/R/L). */
  face: CubeFace;
  /** Grabbed cubie's current grid position (−1 | 0 | 1 per axis, logical). */
  cubiePosition: { x: number; y: number; z: number };
  /** The sticker's world-space hit point (cube centered at origin). */
  worldPoint: Vec3;
  /** Camera world basis: screen-right and screen-up (unit-ish vectors). */
  cameraRight: Vec3;
  cameraUp: Vec3;
}): { face: CubeFace; direction: 1 | -1 } | null {
  const { dx, dy, face, cubiePosition, worldPoint, cameraRight, cameraUp } = input;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) < 1e-3) return null;

  // Screen drag → world drag (see the sign note above).
  const worldDrag: Vec3 = {
    x: dx * cameraRight.x - dy * cameraUp.x,
    y: dx * cameraRight.y - dy * cameraUp.y,
    z: dx * cameraRight.z - dy * cameraUp.z,
  };

  const normal = FACE_NORMAL[face];
  const [axisA, axisB] = PLANE_AXES[normal];
  const compA = Math.abs(worldDrag[axisA]);
  const compB = Math.abs(worldDrag[axisB]);
  // Dead zone for diagonal drags: when the two in-plane components are nearly
  // equal (ratio within 1.35:1) the drag is ambiguous — a tiny change in the
  // drag angle flips which axis wins, producing the wrong move. Rather than
  // guessing (the ~10% error rate), refuse to resolve until the drag
  // clearly commits to one axis. The caller's dead zone (14px) already
  // ensures this only delays the resolution by a few px for truly diagonal
  // gestures — straight drags (which are the vast majority) pass through.
  const total = compA + compB;
  if (total > 0) {
    const ratio = Math.max(compA, compB) / Math.min(compA, compB);
    if (ratio < 1.35) return null;
  }
  // The dominant in-plane component is the drag axis; the turn axis is the
  // OTHER one (same rule as the front face: vertical → columns, horizontal →
  // rows — applied to the face's own orientation).
  const turnAxis: TurnAxis = compA >= compB ? axisB : axisA;

  const layerValue = cubiePosition[turnAxis];
  const layerFace = FACE_BY_LAYER[`${turnAxis}${layerValue}`];
  if (!layerFace) return null;

  // "Stickers follow the finger": positive rotation around the turn axis
  // moves the grab point along t = turnAxis × point; sign the drag against
  // it (engine-tested arc-length math, reused as-is).
  const dTheta = layerTwistAngleDelta({
    axisVector: AXIS_VECTOR[turnAxis],
    worldPoint,
    worldDrag,
  });
  const angleSign = FACE_ROTATION_MAP[layerFace].angleSign;
  const sign = dTheta > 0 ? 1 : dTheta < 0 ? -1 : 1;
  // ±1 / ±1 is always exactly ±1.
  const direction = (sign / angleSign) as 1 | -1;
  return { face: layerFace, direction };
}
