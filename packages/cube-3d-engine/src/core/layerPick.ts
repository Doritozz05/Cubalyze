import type { CubeFace } from '@cubeforge/types';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';

/**
 * Pure, WebGL-free math for "tap/swipe a face → turn that layer".
 *
 * Extracted from the engine so the whole flow is unit-testable without a
 * WebGL context (jsdom):
 *
 *   1. {@link resolveLayerHit} — turns a raycast hit (mesh-local normal +
 *      the cubie's quaternion) into the layer to turn (axis + layerValue +
 *      face label), following the engine's Kociemba grid convention
 *      (X=R/L, Y=U/D, Z=F/B; layer values −1 | 0 | 1).
 *   2. {@link swipeTurnDirection} — turns a screen-space drag into the
 *      cube-notation turn direction (+1 = the face's clockwise move) so it
 *      composes with {@link FACE_ROTATION_MAP} exactly like the smart-cube
 *      move path (`angle = direction * angleSign * 90`).
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type LayerAxis = 'x' | 'y' | 'z';

/** Result of resolving a raycast hit on the cube surface. */
export interface CubeLayerHit {
  /** Turn axis (cube-local; with the root at identity this equals world). */
  axis: LayerAxis;
  /** +1 when the +side of the axis was hit (R/U/F), −1 otherwise (L/D/B). */
  axisSign: 1 | -1;
  /** Engine layer value to pass to `rotateLayers` (−1 | 0 | 1). */
  layerValue: number;
  /** The cube face whose outward sticker was hit (WCA label). */
  face: CubeFace;
  /** Unit vector along the turn axis (world space, root at identity). */
  axisVector: Vec3Like;
}

/** {@link CubeLayerHit} plus the world-space hit point (for drag math). */
export interface CubeLayerPick extends CubeLayerHit {
  worldPoint: Vec3Like;
}

const AXIS_VECTORS: Record<LayerAxis, Vec3Like> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** Cube face for each (axis, sign) pair in WCA terms. */
const FACE_BY_AXIS: Record<`${LayerAxis}${1 | -1}`, CubeFace> = {
  'x1': 'R',
  'x-1': 'L',
  'y1': 'U',
  'y-1': 'D',
  'z1': 'F',
  'z-1': 'B',
};

/** Rotate a vector by a quaternion (three.js convention, pure math). */
export function rotateVectorByQuaternion(v: Vec3Like, q: QuatLike): Vec3Like {
  const { x, y, z, w } = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  // v' = v + w*t + cross(q.xyz, t)
  return {
    x: v.x + w * tx + (y * tz - z * ty),
    y: v.y + w * ty + (z * tx - x * tz),
    z: v.z + w * tz + (x * ty - y * tx),
  };
}

/**
 * Resolve a raycast hit on a cubie into the layer to turn.
 *
 * @param input.meshLocalNormal  The hit face normal in the CUBIE's local
 *   space. Three.js reports `hit.face.normal` in the mesh's own space — for
 *   sticker panels that is always +Z (the shared ShapeGeometry), so callers
 *   MUST first rotate it by the sticker mesh's own quaternion (see
 *   Cube3DEngine.pickLayer) to recover the sticker's outward direction
 *   (±X/±Y/±Z in cubie space). Box-core faces are axis-aligned with no
 *   rotation, so the same logic covers stickerless skins.
 * @param input.cubieQuaternion  The owning cubie Group's quaternion. Because
 *   the cube root stays at identity in the simulator, rotating the mesh-local
 *   normal by the cubie's own quaternion yields the face in CUBE frame — so
 *   face labels stay correct even after whole-cube rotations.
 */
export function resolveLayerHit(input: {
  meshLocalNormal: Vec3Like;
  cubieQuaternion: QuatLike;
}): CubeLayerHit {
  const normal = rotateVectorByQuaternion(input.meshLocalNormal, input.cubieQuaternion);

  // Dominant world-axis component → the visible face's axis + side.
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  let axis: LayerAxis = 'x';
  if (ay >= ax && ay >= az) axis = 'y';
  else if (az >= ax && az >= ay) axis = 'z';

  const axisSign: 1 | -1 = normal[axis] >= 0 ? 1 : -1;
  const face = FACE_BY_AXIS[`${axis}${axisSign}`];
  const mapping = FACE_ROTATION_MAP[face];

  return {
    axis,
    axisSign,
    layerValue: mapping.layerValue,
    face,
    axisVector: AXIS_VECTORS[axis],
  };
}

/**
 * Convert a screen-space drag into the cube-notation turn direction.
 *
 * The touched point rotates around the layer axis like a rigid body: an
 * incremental positive rotation around `axisVector` moves the surface point
 * along `axisVector × worldPoint`. Signing the drag against that tangent
 * yields the direction with the SAME convention as the smart-cube move path:
 * +1 = the hit face's clockwise move (e.g. "U", "R"), −1 = counterclockwise
 * ("U'", "R'"). The engine call is then:
 *
 *   rotateLayers(axis, [layerValue], direction * angleSign * 90)
 *
 * @param input.axisVector  Unit turn axis in world space (from the pick).
 * @param input.worldPoint  Hit point in world space (cube centered at origin).
 * @param input.worldDrag   Screen drag mapped to world space
 *   (≈ dx·cameraRight + dy·cameraUp).
 */
export function swipeTurnDirection(input: {
  axisVector: Vec3Like;
  worldPoint: Vec3Like;
  worldDrag: Vec3Like;
}): 1 | -1 {
  const { axisVector: a, worldPoint: r, worldDrag: d } = input;
  // Tangent of the surface point for a positive rotation around the axis.
  const t = {
    x: a.y * r.z - a.z * r.y,
    y: a.z * r.x - a.x * r.z,
    z: a.x * r.y - a.y * r.x,
  };
  const dot = t.x * d.x + t.y * d.y + t.z * d.z;
  if (dot === 0) return 1;
  return dot > 0 ? -1 : 1;
}

/**
 * Continuous drag-follow math for the virtual-cube touch model.
 *
 * Instead of resolving a direction from a single swipe (see
 * {@link swipeTurnDirection}), this returns the ANGLE DELTA (degrees, engine
 * convention: positive = positive rotation around `axisVector`) for ONE
 * pointer move, so the layer can track the finger live and then snap.
 *
 * A surface point at `worldPoint` moves along the tangent t = axis × point
 * under a positive rotation. Arc-length tracking makes the grabbed sticker
 * follow the pointer 1:1:
 *
 *   dθ = dot(worldDrag, t̂) / |t|    (radians)
 *
 * where |t| = |axis × point| is the grabbed point's distance from the axis.
 * Points grabbed directly ON the axis (the face center) have |t| ≈ 0 and no
 * reliable tangent — the delta is 0 and the caller keeps the previous angle
 * (a small dead zone), which prevents jitter on center grabs.
 *
 * The returned sign composes with the move pipeline exactly like
 * {@link swipeTurnDirection}: a drag along t̂ gives a positive angle, and the
 * committed direction for a finished twist target (±90°) is
 * `round(target / (90 · angleSign))`.
 */
export function layerTwistAngleDelta(input: {
  axisVector: Vec3Like;
  worldPoint: Vec3Like;
  worldDrag: Vec3Like;
}): number {
  const { axisVector: a, worldPoint: r, worldDrag: d } = input;
  // Tangent of the surface point for a positive rotation around the axis.
  const tx = a.y * r.z - a.z * r.y;
  const ty = a.z * r.x - a.x * r.z;
  const tz = a.x * r.y - a.y * r.x;
  const len = Math.hypot(tx, ty, tz);
  if (len < 1e-4) return 0;
  // Signed arc length along the unit tangent (world units).
  const arc = (tx * d.x + ty * d.y + tz * d.z) / len;
  // dθ = arc / |t| — radians → degrees.
  return (arc / len) * (180 / Math.PI);
}
