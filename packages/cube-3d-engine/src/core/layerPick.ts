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
  /** The owning cubie's current grid position (-1 | 0 | 1 per axis) — the
   *  logical state, immune to float drift. Used by the drag-to-turn
   *  resolver ({@link resolveDragTurn}) to derive moves from geometry. */
  cubiePosition: { x: number; y: number; z: number };
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

// ─── Virtual-cube drag resolver (sticker geometry) ─────────────────────────
//
// Port of the drag-to-turn model used by virtual-cube.net — "drag the mouse
// on a cube layer ACROSS A SOLID BLACK LINE to rotate it". The move is NOT
// the face of the sticker you grabbed; it is derived from the geometric
// relationship between the START sticker (pointer down) and the CURRENT
// sticker under the pointer while dragging:
//
//   • same cubie, crossed to another of its faces  → the layer that rolls
//     the sticker over the cubie's own edge (a whole-face turn).
//   • same face, same row/column (2 shared axes)  → the SLICE through that
//     row/column: horizontal drags turn the row (U/E/D), vertical drags the
//     column (L/M/R) — indexed by the sticker's position on the face.
//   • 1 shared axis (diagonal / edge crossings)   → the slice at the shared
//     coordinate.
//
// Face indices (virtual-cube convention): 0=B, 1=F, 2=R, 3=L, 4=D, 5=U.
// Cubie coordinates are engine layer values (-1 | 0 | 1; X=R/L, Y=U/D,
// Z=F/B). The result composes with the existing move pipeline exactly like
// the keymap: `{ face, direction }` → `actionToMoves` → rotateLayers.

export interface CubeDragSticker {
  /** Cubie grid position (-1 | 0 | 1 per axis). */
  position: { x: number; y: number; z: number };
  /** Outward sticker face (WCA label, e.g. the sticker on the U face). */
  face: CubeFace;
}

/** A resolved drag move: a face/slice plus its WCA direction. */
export interface DragMove {
  /** Face or slice to turn (R/L/U/D/F/B/M/E/S). */
  face: CubeFace;
  /** WCA direction: +1 = the move as written, -1 = primed (counterclockwise). */
  direction: 1 | -1;
}

/** Sticker faces (drags never resolve to the M/E/S slices as the pressed face). */
type OuterCubeFace = Exclude<CubeFace, 'M' | 'E' | 'S'>;

const FACE_ID: Record<OuterCubeFace, number> = { B: 0, F: 1, R: 2, L: 3, D: 4, U: 5 };

const faceId = (face: CubeFace): number => FACE_ID[face as OuterCubeFace];

// Layer-name arrays indexed by the cubie's coordinate along the turn axis
// (layerIndex: -1 → 0, 0 → 1, 1 → 2). The primes are baked in exactly like
// virtual-cube's xaxis/yaxis/zaxis tables; `invertMove` toggles them.
const XAXIS: DragMove[] = [
  { face: 'L', direction: -1 }, // "L'"
  { face: 'M', direction: -1 }, // "M'"
  { face: 'R', direction: 1 }, // "R"
];
const YAXIS: DragMove[] = [
  { face: 'U', direction: -1 }, // "U'"
  { face: 'E', direction: 1 }, // "E"
  { face: 'D', direction: 1 }, // "D"
];
const ZAXIS: DragMove[] = [
  { face: 'B', direction: -1 }, // "B'"
  { face: 'S', direction: 1 }, // "S"
  { face: 'F', direction: 1 }, // "F"
];

const invertMove = (m: DragMove): DragMove => ({
  face: m.face,
  direction: m.direction === 1 ? -1 : 1,
});

/** Map a layer coordinate (-1 | 0 | 1) to its turn-table index (0 | 1 | 2). */
const layerIndex = (coord: number): number => Math.max(0, Math.min(2, coord + 1));

const FWD = [-1, 0, 1];
const REV = [1, 0, -1];
const GT = (x: number, y: number) => x > y;
const LT = (x: number, y: number) => x < y;

interface GridPos {
  x: number;
  y: number;
  z: number;
}

type AxisKey = keyof GridPos;

/** Last shared axis (x → y → z order), its value, and how many axes match. */
function sharedAxis(c1: GridPos, c2: GridPos): { axis: AxisKey; row: number; timeshared: number } | null {
  let obj: { axis: AxisKey; row: number; timeshared: number } | null = null;
  let timeshared = 0;
  for (const key of ['x', 'y', 'z'] as const) {
    if (c1[key] === c2[key]) {
      timeshared++;
      obj = { axis: key, row: c2[key], timeshared };
    }
  }
  return obj;
}

// Same cubie: crossing between two faces of the SAME cubie. The dirs cycles
// list the faces around each world axis (in virtual-cube face-index order);
// the turn is the layer through the cubie indexed by the remaining axis.
const SAME_CUBIE_TURNS: { dirs: number[]; vec: AxisKey; turn: DragMove[] }[] = [
  { dirs: [5, 2, 4, 3, 5], vec: 'z', turn: XAXIS }, // U-R-D-L around Z
  { dirs: [5, 1, 4, 0, 5], vec: 'x', turn: YAXIS }, // U-F-D-B around X
  { dirs: [2, 1, 3, 0, 2], vec: 'y', turn: ZAXIS }, // R-F-L-B around Y
];

function sameCubieTurn(pos: GridPos, face1: CubeFace, face2: CubeFace): DragMove | null {
  const f1 = faceId(face1);
  const f2 = faceId(face2);
  for (const turn of SAME_CUBIE_TURNS) {
    const i1 = turn.dirs.indexOf(f1);
    const i2 = turn.dirs.indexOf(f2);
    if (i1 !== -1 && i2 !== -1 && (turn.dirs[i1 + 1] === f2 || turn.dirs[i2 + 1] === f1)) {
      let move = turn.turn[layerIndex(pos[turn.vec])];
      if (turn.dirs[i2 + 1] === f1) move = invertMove(move);
      return move;
    }
  }
  return null;
}

// Same face, adjacent in a row/column: the turn is the slice perpendicular to
// the drag, indexed by the shared axis coordinate.
const SAME_FACE_TURNS: {
  axis: AxisKey;
  turn: DragMove[];
  faces: { face: number; order: number[]; upaxis: AxisKey; lastaxis: AxisKey }[];
}[] = [
  {
    axis: 'z',
    turn: XAXIS,
    faces: [
      { face: 5, order: REV, upaxis: 'x', lastaxis: 'y' },
      { face: 2, order: REV, upaxis: 'y', lastaxis: 'x' },
      { face: 4, order: FWD, upaxis: 'x', lastaxis: 'y' },
      { face: 3, order: FWD, upaxis: 'y', lastaxis: 'x' },
    ],
  },
  {
    axis: 'x',
    turn: YAXIS,
    faces: [
      { face: 5, order: REV, upaxis: 'z', lastaxis: 'y' },
      { face: 1, order: REV, upaxis: 'y', lastaxis: 'z' },
      { face: 4, order: REV, upaxis: 'z', lastaxis: 'y' },
      { face: 0, order: FWD, upaxis: 'y', lastaxis: 'z' },
    ],
  },
  {
    axis: 'y',
    turn: ZAXIS,
    faces: [
      { face: 2, order: FWD, upaxis: 'z', lastaxis: 'x' },
      { face: 1, order: FWD, upaxis: 'x', lastaxis: 'z' },
      { face: 3, order: REV, upaxis: 'z', lastaxis: 'x' },
      { face: 0, order: REV, upaxis: 'x', lastaxis: 'z' },
    ],
  },
];

function sameFaceTurn(c1: GridPos, c2: GridPos, face: CubeFace): DragMove | null {
  const fid = faceId(face);
  for (const entry of SAME_FACE_TURNS) {
    if (c1[entry.axis] !== c2[entry.axis]) continue;
    for (const f of entry.faces) {
      if (fid === f.face && c1[f.lastaxis] === c2[f.lastaxis]) {
        let move = entry.turn[layerIndex(c1[entry.axis])];
        const i1 = f.order.indexOf(c1[f.upaxis]);
        const i2 = f.order.indexOf(c2[f.upaxis]);
        if (i1 > i2) move = invertMove(move);
        return move;
      }
    }
  }
  return null;
}

// Diagonal / single-shared-axis: turn the slice at the shared coordinate.
const DIAGONAL_TURNS: Record<AxisKey, { compare: AxisKey[]; turn: DragMove[] }> = {
  z: { compare: ['x', 'y'], turn: XAXIS },
  x: { compare: ['y', 'z'], turn: YAXIS },
  y: { compare: ['z', 'x'], turn: ZAXIS },
};

const DIRECTION_FACE: Record<number, { compare: AxisKey[]; x?: number[]; y?: number[]; z?: number[] }> = {
  0: { compare: ['x', 'y'], x: [4, 5], y: [2, 3] },
  1: { compare: ['x', 'y'], x: [4, 5], y: [2, 3] },
  2: { compare: ['y', 'z'], y: [0, 1], z: [4, 5] },
  3: { compare: ['y', 'z'], y: [0, 1], z: [4, 5] },
  4: { compare: ['x', 'z'], x: [0, 1], z: [2, 3] },
  5: { compare: ['x', 'z'], x: [0, 1], z: [2, 3] },
};

const DIAGONAL_FUNC: Record<number, Partial<Record<AxisKey, (x: number, y: number) => boolean>>> = {
  0: { x: GT, y: LT },
  1: { x: GT, y: LT },
  2: { y: LT, z: GT },
  3: { y: GT, z: LT },
  4: { x: GT, z: LT },
  5: { x: LT, z: GT },
};

const BANNED_AXIS: Record<number, AxisKey> = { 0: 'z', 1: 'z', 2: 'x', 3: 'x', 4: 'y', 5: 'y' };

function diagonalTurn(
  c1: GridPos,
  c2: GridPos,
  face1: CubeFace,
  face2: CubeFace,
  shared: { axis: AxisKey; row: number },
): DragMove | null {
  const entry = DIAGONAL_TURNS[shared.axis];
  let move = entry.turn[layerIndex(shared.row)];
  const compare = entry.compare;
  const x1 = c1[compare[1]];
  const y1 = c1[compare[0]];
  const x2 = c2[compare[1]];
  const y2 = c2[compare[0]];
  const dot = x1 * y2 - y1 * x2;

  if (dot === 0) {
    // Axis-aligned in the shared plane (at least one coordinate is 0):
    // disambiguate using the END sticker's face and the difference along the
    // two in-plane axes.
    let c1a: GridPos = c1;
    let c2a: GridPos = c2;
    let fid1 = faceId(face1);
    let fid2 = faceId(face2);
    let willInverse = false;
    const numZero = +(c1.x === 0) + +(c1.y === 0) + +(c1.z === 0);
    if (numZero > 1) {
      [c1a, c2a] = [c2a, c1a];
      [fid1, fid2] = [fid2, fid1];
      willInverse = true;
    }
    const dirobj = DIRECTION_FACE[fid2];
    const axis1 = dirobj.compare[0];
    const axis2 = dirobj.compare[1];
    const da = c1a[axis1] - c2a[axis1];
    const db = c1a[axis2] - c2a[axis2];
    let realAxis: AxisKey;
    let realD: number;
    if (da !== 0) {
      realAxis = axis1;
      realD = da;
    } else if (db !== 0) {
      realAxis = axis2;
      realD = db;
    } else {
      return null;
    }
    if (fid1 === fid2 && c1a[BANNED_AXIS[fid1]] === c2a[BANNED_AXIS[fid1]]) {
      return null;
    }
    const func = DIAGONAL_FUNC[fid2][realAxis];
    if (func?.(realD, 0)) move = invertMove(move);
    if (willInverse) move = invertMove(move);
  } else if (dot > 0) {
    move = invertMove(move);
  }
  return move;
}

/**
 * Resolve the cube move for a sticker drag (virtual-cube.net model).
 *
 * @param start The sticker pressed at pointer-down.
 * @param end   The sticker currently under the pointer.
 * @returns The face/slice move + WCA direction, or `null` when the two
 *   stickers have no turning relationship (same sticker, non-adjacent, …).
 *
 * The result feeds the standard move pipeline (`actionToMoves`) so the
 * visual and the logical CubeState stay in lockstep.
 */
export function resolveDragTurn(start: CubeDragSticker, end: CubeDragSticker): DragMove | null {
  const c1 = start.position;
  const c2 = end.position;

  // Same sticker (or a drag that never left it): nothing to turn.
  if (c1.x === c2.x && c1.y === c2.y && c1.z === c2.z) {
    return start.face === end.face ? null : sameCubieTurn(c1, start.face, end.face);
  }

  const shared = sharedAxis(c1, c2);
  if (!shared) return null;

  if (start.face === end.face && shared.timeshared > 1) {
    return sameFaceTurn(c1, c2, start.face);
  }

  if (shared.timeshared === 1) {
    return diagonalTurn(c1, c2, start.face, end.face, shared);
  }

  return null;
}
