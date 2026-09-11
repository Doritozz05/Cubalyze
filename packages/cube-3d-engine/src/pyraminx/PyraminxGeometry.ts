import { Vector3, Quaternion } from 'three';

/**
 * Pyraminx canonical geometry — the single source of truth for the 3D model.
 *
 * ## Coordinate system
 *
 * A regular tetrahedron of circumradius 1, centered at the origin, with the
 * **U vertex on top** (+Z). Vertices are named after the face OPPOSITE them
 * (WCA convention): the U turn rotates the layer at the U vertex, etc.
 *
 * The 4 vertices are also the 4 rotation AXES (unit vectors from the center
 * to each vertex — the same axes as the Skewb's body diagonals: the Skewb is
 * a shape-mod of the Pyraminx with the same 4-axis mechanism).
 *
 * ## Piece anatomy (14 movable pieces)
 *
 * Each face is subdivided into 9 identical triangles (order 3), giving:
 *   • 4 TIPS   — small tetrahedra at the vertices (3 exposed faces each)
 *   • 4 CORNERS — octahedra at the vertices under the tips (3 exposed faces)
 *   • 6 EDGES  — tetrahedra on the edge midlines (2 exposed faces each)
 *
 * An edge piece at slot e is the tetrahedron { P_e, Q_e, cF1, cF2 } where
 * P_e / Q_e are the 1/3 and 2/3 points along the edge and cF1 / cF2 the
 * centers of the two faces meeting at that edge.
 *
 * A corner piece at vertex v is the octahedron
 * { P1, P2, P3, cF_a, cF_b, cF_c }: the three 1/3-points on the edges from
 * v plus the three face centers of the faces meeting at v.
 *
 * ## Move tables
 *
 * `PYRAMINX_TURNS` mirrors the move tables of the clean-room WCA scrambler
 * in `@cubeforge/solver-engine` (PyraminxSolver.FACE_TURNS). The cross-
 * validation tests in `__tests__/PyraminxModel.test.ts` prove the 3D model
 * produces the exact same PyraminxState as `applyPyraminxMove` for every
 * move, so the tables can never drift apart unnoticed.
 *
 * The model's single logical step implements the scrambler's single-step
 * cycle for that vertex (verified against the geometry: the −120° rotation
 * around U maps edge slot UL→UR→UB, exactly the scrambler's U cycle [1,3,5]).
 * Per WCA Regulation 12e2 a plain token is the CLOCKWISE turn (120° clockwise
 * when viewed from the tip — the −120° right-hand rotation around the outward
 * axis, the same handedness as the cube's R = −90°), so the engine animates
 * −120° for the plain token and commits ONE logical step; the prime animates
 * +120° and commits two steps.
 */

// ── Vertices (circumradius 1, U on top) ─────────────────────────────────────
const S2 = Math.sqrt(2);
const S3 = Math.sqrt(3);
const S6 = Math.sqrt(6);

export const PYRAMINX_VERTICES_ORDER = ['U', 'L', 'R', 'B'] as const;
/** Face/corner/tip index by name (U=0, L=1, R=2, B=3 — matches the solver). */
export type PyraminxVertex = (typeof PYRAMINX_VERTICES_ORDER)[number];

/** Vertex → vertex index (U=0, L=1, R=2, B=3). */
export const PYRAMINX_VERTEX_INDEX: Record<PyraminxVertex, number> = {
  U: 0,
  L: 1,
  R: 2,
  B: 3,
};

/** The 4 vertex positions (= unit rotation axes, outward from the center). */
export const PYRAMINX_VERTEX_POSITIONS: Record<PyraminxVertex, Vector3> = {
  U: new Vector3(0, 0, 1),
  L: new Vector3(-S2 / 3, S6 / 3, -1 / 3),
  R: new Vector3((2 * S2) / 3, 0, -1 / 3),
  B: new Vector3(-S2 / 3, -S6 / 3, -1 / 3),
};

/** Rotation axes (unit, center → vertex). */
export const PYRAMINX_AXES: Record<PyraminxVertex, Vector3> = PYRAMINX_VERTEX_POSITIONS;

/** Outward face normals (face F is opposite vertex F). */
export const PYRAMINX_FACE_NORMALS: Record<PyraminxVertex, Vector3> = {
  U: PYRAMINX_VERTEX_POSITIONS.U.clone().negate(),
  L: PYRAMINX_VERTEX_POSITIONS.L.clone().negate(),
  R: PYRAMINX_VERTEX_POSITIONS.R.clone().negate(),
  B: PYRAMINX_VERTEX_POSITIONS.B.clone().negate(),
};

/** Face centers (centroid of the face's 3 vertices). */
export const PYRAMINX_FACE_CENTERS: Record<PyraminxVertex, Vector3> = {
  U: new Vector3(0, 0, -1 / 3),
  L: new Vector3(S2 / 9, -S6 / 9, 1 / 9),
  R: new Vector3((-2 * S2) / 9, 0, 1 / 9),
  B: new Vector3(S2 / 9, S6 / 9, 1 / 9),
};

// ── Edge slots (indexed like the solver: 0=LR, 1=UL, 2=LB, 3=UR, 4=RB, 5=UB)
export interface PyraminxEdgeSlotDef {
  readonly index: number;
  readonly name: string;
  readonly vertices: [PyraminxVertex, PyraminxVertex];
  /** The two faces meeting at this edge (lower face index first). */
  readonly faces: [PyraminxVertex, PyraminxVertex];
}

export const PYRAMINX_EDGE_SLOTS: readonly PyraminxEdgeSlotDef[] = [
  { index: 0, name: 'LR', vertices: ['L', 'R'], faces: ['U', 'B'] },
  { index: 1, name: 'UL', vertices: ['U', 'L'], faces: ['R', 'B'] },
  { index: 2, name: 'LB', vertices: ['L', 'B'], faces: ['U', 'R'] },
  { index: 3, name: 'UR', vertices: ['U', 'R'], faces: ['L', 'B'] },
  { index: 4, name: 'RB', vertices: ['R', 'B'], faces: ['U', 'L'] },
  { index: 5, name: 'UB', vertices: ['U', 'B'], faces: ['L', 'R'] },
];

/** Edge slots incident to each vertex (the 3 edges of a layer turn). */
export const PYRAMINX_VERTEX_EDGES: Record<PyraminxVertex, readonly number[]> = {
  U: [1, 3, 5],
  L: [0, 1, 2],
  R: [0, 3, 4],
  B: [2, 4, 5],
};

// ── Move tables (mirror of PyraminxSolver.FACE_TURNS — cross-validated by
//    tests against applyPyraminxMove) ────────────────────────────────────────
export interface PyraminxTurnDef {
  readonly vertex: PyraminxVertex;
  /** Edge-slot cycle: the piece at cycle[0] moves to cycle[1], etc. */
  readonly cycle: readonly [number, number, number];
  /** Destination slots that receive a FLIPPED piece during the turn. */
  readonly flips: readonly [number, number];
}

export const PYRAMINX_TURNS: readonly PyraminxTurnDef[] = [
  { vertex: 'U', cycle: [1, 3, 5], flips: [3, 5] },
  { vertex: 'L', cycle: [0, 1, 2], flips: [1, 2] },
  { vertex: 'R', cycle: [0, 4, 3], flips: [0, 3] },
  { vertex: 'B', cycle: [2, 5, 4], flips: [2, 4] },
];

/** WCA move tokens (layer + tip turns, with primes). */
export const PYRAMINX_MOVE_TOKENS = [
  'U', "U'", 'L', "L'", 'R', "R'", 'B', "B'",
  'u', "u'", 'l', "l'", 'r', "r'", 'b', "b'",
] as const;
export type PyraminxMoveToken = (typeof PYRAMINX_MOVE_TOKENS)[number];

/**
 * Resolve a WCA token to its slice: which vertex, whether it is a full layer
 * turn or a tip-only turn, and the signed angle. The plain token is the
 * WCA CLOCKWISE turn — 120° clockwise when viewed from the vertex/tip, i.e.
 * −120° right-hand around the outward axis (WCA 12e2, same handedness as the
 * cube's R = −90°). The prime is the counter-clockwise turn (+120°), which
 * is physically the 2-step turn.
 */
export function resolvePyraminxMoveToken(
  token: string,
): { vertex: PyraminxVertex; scope: 'layer' | 'tip'; angleInDegrees: number } | null {
  const prime = token.endsWith("'");
  const base = prime ? token.slice(0, -1) : token;
  if (base.length !== 1) return null;
  const upper = base.toUpperCase();
  if (upper !== 'U' && upper !== 'L' && upper !== 'R' && upper !== 'B') return null;
  const scope = base === upper ? 'layer' : 'tip';
  return { vertex: upper, scope, angleInDegrees: prime ? 120 : -120 };
}

/** Whether a string is a syntactically valid WCA Pyraminx scramble. */
export function isValidPyraminxMoveString(scramble: string): boolean {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => resolvePyraminxMoveToken(t) !== null);
}

// ── Piece geometry helpers ──────────────────────────────────────────────────

/** The 1/3-point along the edge from → to (the "P" point). */
function thirdPoint(from: PyraminxVertex, to: PyraminxVertex): Vector3 {
  const a = PYRAMINX_VERTEX_POSITIONS[from];
  const b = PYRAMINX_VERTEX_POSITIONS[to];
  return a.clone().add(b.clone().sub(a).multiplyScalar(1 / 3));
}

/** The 2/3-point along the edge from → to (the "Q" point). */
function twoThirdsPoint(from: PyraminxVertex, to: PyraminxVertex): Vector3 {
  const a = PYRAMINX_VERTEX_POSITIONS[from];
  const b = PYRAMINX_VERTEX_POSITIONS[to];
  return a.clone().add(b.clone().sub(a).multiplyScalar(2 / 3));
}

/** Vertices of an edge piece in world space: {P, Q, cF1, cF2}. */
export function pyraminxEdgePieceVertices(slot: number): Vector3[] {
  const def = PYRAMINX_EDGE_SLOTS[slot];
  if (!def) throw new Error(`Unknown pyraminx edge slot ${slot}`);
  const [a, b] = def.vertices;
  return [
    thirdPoint(a, b),
    twoThirdsPoint(a, b),
    PYRAMINX_FACE_CENTERS[def.faces[0]].clone(),
    PYRAMINX_FACE_CENTERS[def.faces[1]].clone(),
  ];
}

/** Vertices of a corner piece in world space: {P1, P2, P3, cFa, cFb, cFc}. */
export function pyraminxCornerPieceVertices(vertex: PyraminxVertex): Vector3[] {
  const neighbors = PYRAMINX_VERTICES_ORDER.filter((v) => v !== vertex);
  const ps = neighbors.map((n) => thirdPoint(vertex, n));
  const faceCenters = PYRAMINX_VERTICES_ORDER.filter((f) => f !== vertex).map(
    (f) => PYRAMINX_FACE_CENTERS[f].clone(),
  );
  return [...ps, ...faceCenters];
}

/** Vertices of a tip piece in world space: {V, P1, P2, P3}. */
export function pyraminxTipPieceVertices(vertex: PyraminxVertex): Vector3[] {
  const neighbors = PYRAMINX_VERTICES_ORDER.filter((v) => v !== vertex);
  return [
    PYRAMINX_VERTEX_POSITIONS[vertex].clone(),
    ...neighbors.map((n) => thirdPoint(vertex, n)),
  ];
}

// ── Slot positions (piece group positions; used to snap positions exactly) ─

/** World position of an edge slot = centroid of the edge piece tetrahedron. */
export function pyraminxEdgeSlotPosition(slot: number): Vector3 {
  const vertices = pyraminxEdgePieceVertices(slot);
  return vertices
    .reduce((acc, v) => acc.add(v), new Vector3())
    .multiplyScalar(1 / vertices.length);
}

/** World position of a corner slot = centroid of the corner octahedron. */
export function pyraminxCornerSlotPosition(vertex: PyraminxVertex): Vector3 {
  const vertices = pyraminxCornerPieceVertices(vertex);
  return vertices
    .reduce((acc, v) => acc.add(v), new Vector3())
    .multiplyScalar(1 / vertices.length);
}

/** World position of a tip slot = centroid of the tip tetrahedron. */
export function pyraminxTipSlotPosition(vertex: PyraminxVertex): Vector3 {
  const vertices = pyraminxTipPieceVertices(vertex);
  return vertices
    .reduce((acc, v) => acc.add(v), new Vector3())
    .multiplyScalar(1 / vertices.length);
}

/**
 * WCA sticker colors per face (configurable via the factory style).
 *
 * A face is named after the vertex OPPOSITE it, so in the canonical upright
 * pose `U` is the BASE/BOTTOM face (opposite the apex) and `B` is the FRONT
 * face (opposite the back vertex).
 *
 * Reference hold — WCA Regulation 4d2: the scramble is applied with the
 * **yellow face on the bottom** and the **green face on the front**, which
 * puts **red on the left and blue on the right**:
 *
 *     U = yellow  (bottom face, opposite the apex)
 *     B = green   (FRONT face — faces the camera in the canonical pose)
 *     L = red     (left face)
 *     R = blue    (right face)
 *
 * The canonical upright pose therefore IS the WCA scramble hold, so the
 * virtual view and the reconstruction replay both seed the scramble with
 * GREEN in front, exactly as Regulation 4d2 requires.
 *
 * The arrangement has a HANDEDNESS: with red toward you and yellow down, the
 * green face must land on the RIGHT and blue on the LEFT. Swapping green and
 * red (the old `L: green / B: red`) mirrors the whole puzzle, so every
 * color-referenced scramble/algorithm/tutorial appears reversed.
 */
export const DEFAULT_PYRAMINX_STICKER_COLORS: Record<PyraminxVertex, string> = {
  U: '#ffe62a', // yellow — bottom
  L: '#eb4242', // red    — left
  R: '#3d7ce0', // blue   — right
  B: '#1abe57', // green  — front
};

// ── Whole-Puzzle Poses & A₄ Grip Conjugation Tables ─────────────────────────

/**
 * Canonical standing upright orientation for the Pyraminx:
 * Apex U points straight UP (+Y), base (L, R, B) is horizontal in y = -1/3,
 * and the front edge is horizontal parallel to the X axis ("base recta").
 */
export const PYRAMINX_CANONICAL_QUAT = new Quaternion(
  0.18301270189221933,
  0.6830127018922193,
  0.6830127018922193,
  -0.18301270189221933,
).normalize();

/** Dihedral turning angle between faces of a regular tetrahedron (arccos(-1/3) ≈ 109.47°). */
export const TETRAHEDRAL_TILT_ANGLE = Math.acos(-1 / 3);

/**
 * Canonical tilt axis: horizontal X axis (1, 0, 0).
 * A 180° rotation around this axis inverts the Pyraminx downward so the apex
 * points down (y = -1) and the flat base sits on top (y = +1/3), clearly
 * exposing the bottom face to the camera in a clean, canonical orientation.
 */
export const PYRAMINX_TILT_AXIS = new Vector3(1, 0, 0);

/**
 * Compute the 6 canonical pose quaternions of the Pyraminx corresponding to
 * the 3 upright poses (apex on top, base flat at y = -1/3) and 3 inverted poses
 * (base on top at y = +1/3, apex pointing down at y = -1).
 *
 * Poses:
 *   - Pose 0: Canonical upright (apex U on top, base flat)
 *   - Pose 1: rotatePuzzleY(1) (120° drone rotation around Y)
 *   - Pose 2: rotatePuzzleY(2) (240° drone rotation around Y)
 *   - Pose 3: rotatePuzzleX(1) from Pose 0 (180° X tilt: base on top, apex down)
 *   - Pose 4: rotatePuzzleY(1) from Pose 3 (120° drone rotation around Y)
 *   - Pose 5: rotatePuzzleY(2) from Pose 3 (240° drone rotation around Y)
 */
export function computePyraminxGripQuaternions(): Quaternion[] {
  const qY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (120 * Math.PI) / 180);
  const qX = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, Math.PI);

  const p0 = PYRAMINX_CANONICAL_QUAT.clone();
  const p1 = qY.clone().multiply(p0).normalize();
  const p2 = qY.clone().multiply(p1).normalize();
  const p3 = qX.clone().multiply(p0).normalize();
  const p4 = qY.clone().multiply(p3).normalize();
  const p5 = qY.clone().multiply(p4).normalize();

  const poses = [p0, p1, p2, p3, p4, p5];

  function isKnown(q: Quaternion): boolean {
    for (const v of poses) {
      const dot = Math.abs(q.x * v.x + q.y * v.y + q.z * v.z + q.w * v.w);
      if (dot > 0.999) return true;
    }
    return false;
  }

  const queue = [...poses];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const op of [qY, qX]) {
      const next = op.clone().multiply(curr).normalize();
      if (!isKnown(next)) {
        poses.push(next);
        queue.push(next);
      }
    }
  }

  return poses;
}

export const PYRAMINX_GRIP_QUATERNIONS: readonly Quaternion[] = computePyraminxGripQuaternions();

/**
 * Snap a puzzle orientation quaternion against the 12 canonical A₄ grips
 * using the maximum absolute quaternion inner product (mirroring math-core's OrientationTable.snap).
 */
export function snapPyraminxGrip(quat: Quaternion): { grip: number; confidence: number } {
  const qLen = Math.sqrt(quat.x * quat.x + quat.y * quat.y + quat.z * quat.z + quat.w * quat.w);
  const nx = qLen > 0 ? quat.x / qLen : 0;
  const ny = qLen > 0 ? quat.y / qLen : 0;
  const nz = qLen > 0 ? quat.z / qLen : 0;
  const nw = qLen > 0 ? quat.w / qLen : 1;

  let bestIdx = 0;
  let bestDot = -1;

  for (let i = 0; i < PYRAMINX_GRIP_QUATERNIONS.length; i++) {
    const p = PYRAMINX_GRIP_QUATERNIONS[i];
    const dot = Math.abs(nx * p.x + ny * p.y + nz * p.z + nw * p.w);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }

  return { grip: bestIdx, confidence: bestDot };
}

// ── Canonical isometric camera (the virtual view's locked camera) ───────────
// The A₄ grip maps below describe SCREEN positions, so they depend on the
// view direction. The virtual pyraminx locks the camera to this canonical
// isometric view — the SAME angles the engine applies through
// SceneManager.setOrbitAngles (PyraminxEngine.CANONICAL_ISOMETRIC_VIEW
// references these constants, so the maps and the camera can never drift
// apart).
export const PYRAMINX_ISOMETRIC_THETA_RAD = (39 * Math.PI) / 180;
export const PYRAMINX_ISOMETRIC_PHI_RAD = (22 * Math.PI) / 180;

/**
 * The camera basis (forward / right / up) of the canonical isometric view —
 * the exact spherical-orbit convention of SceneManager.setOrbitAngles:
 * camPos = (cos φ·sin θ, sin φ, cos φ·cos θ), camera up = world +Y.
 */
export function computePyraminxIsometricBasis(): {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
} {
  const theta = PYRAMINX_ISOMETRIC_THETA_RAD;
  const phi = PYRAMINX_ISOMETRIC_PHI_RAD;
  const camPos = new Vector3(
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(theta),
  );
  const forward = camPos.clone().negate().normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();
  return { forward, right, up };
}

/**
 * Derive the 12 visual grip maps DIRECTLY from the actual A₄ pose geometry
 * and the canonical isometric camera — the single source of truth for
 * "which canonical vertex sits at which on-screen position".
 *
 * Position naming (the keymap/display grid, same convention as the cube):
 *   - U (top)  = the vertex with the greatest screen-up coordinate
 *   - B (back) = the base vertex farthest from the camera (max depth)
 *   - L / R    = the two front base vertices split by screen-right
 *                (min screen-right = L, max screen-right = R)
 *
 * This makes the tables WYSIWYG-consistent with the actual view: the letter
 * shown for a layer is the position where the layer sits on screen, and the
 * key for that position turns exactly that layer. The earlier hand-authored
 * table assumed the canonical view mirrors the WCA hold (L left / R right),
 * but the actual pose puts the L vertex at the bottom-right and the R vertex
 * at the left of the screen — which inverted every displayed/keyboard letter
 * ("I turn the right red layer and it says L'").
 */
export function computePyraminxGripMaps(): Record<PyraminxVertex, PyraminxVertex>[] {
  const { forward, right, up } = computePyraminxIsometricBasis();
  const sU = (p: Vector3) => p.dot(up);
  const sR = (p: Vector3) => p.dot(right);
  const depth = (p: Vector3) => p.dot(forward);

  return PYRAMINX_GRIP_QUATERNIONS.map((gq) => {
    const world = (v: PyraminxVertex) =>
      PYRAMINX_VERTEX_POSITIONS[v].clone().applyQuaternion(gq);
    const tips = (PYRAMINX_VERTICES_ORDER as readonly PyraminxVertex[]).map((v) => ({
      v,
      p: world(v),
    }));

    const topByY = tips.reduce((a, b) => (a.p.y > b.p.y ? a : b));
    const isUpright = topByY.p.y > 0.5;

    if (isUpright) {
      const top = topByY.v;
      const base = tips.filter((t) => t.v !== top);
      const back = base.reduce((a, b) => (depth(a.p) > depth(b.p) ? a : b)).v;
      const front = base.filter((t) => t.v !== back);
      const left = front.reduce((a, b) => (sR(a.p) < sR(b.p) ? a : b)).v;
      const rightVertex = front.reduce((a, b) => (sR(a.p) > sR(b.p) ? a : b)).v;
      return { U: top, L: left, R: rightVertex, B: back };
    } else {
      // Inverted pose: apex is at the bottom (y ≈ -1), base is on top (y ≈ +1/3)
      const bottom = tips.reduce((a, b) => (a.p.y < b.p.y ? a : b)).v;
      const topBase = tips.filter((t) => t.v !== bottom);
      const back = topBase.reduce((a, b) => (depth(a.p) > depth(b.p) ? a : b)).v;
      const front = topBase.filter((t) => t.v !== back);
      const left = front.reduce((a, b) => (sR(a.p) < sR(b.p) ? a : b)).v;
      const rightVertex = front.reduce((a, b) => (sR(a.p) > sR(b.p) ? a : b)).v;
      return { U: bottom, L: left, R: rightVertex, B: back };
    }
  });
}

/**
 * The 6 visual grip maps (see {@link computePyraminxGripMaps}) — computed
 * once at module load from the pose quaternions and the canonical camera.
 */
export const PYRAMINX_GRIP_MAPS: readonly Record<PyraminxVertex, PyraminxVertex>[] =
  computePyraminxGripMaps();

/**
 * Conjugate an input key token (e.g. "U", "L'", "r") by the given grip index (0..11).
 * Translates the view-relative key action into the canonical physical move.
 */
export function conjugatePyraminxToken(token: string, grip: number): string {
  const isPrime = token.endsWith("'");
  const base = isPrime ? token.slice(0, -1) : token;
  const isTip = base === base.toLowerCase();
  const upper = base.toUpperCase() as PyraminxVertex;

  const gripMap = PYRAMINX_GRIP_MAPS[grip];
  if (!gripMap || !(upper in gripMap)) return token;

  const targetVertex = gripMap[upper];
  const targetBase = isTip ? targetVertex.toLowerCase() : targetVertex;
  return isPrime ? targetBase + "'" : targetBase;
}

/**
 * Inverse grip lookup table: PYRAMINX_INVERSE_GRIP[g] is the grip g⁻¹ such that
 * conjugate(conjugate(t, g), g⁻¹) === t for all tokens t. Computed from the
 * derived maps: the inverse permutation of each map is guaranteed to exist
 * inside the A₄ orbit of 12 poses.
 */
export function computePyraminxInverseGrips(): number[] {
  return PYRAMINX_GRIP_MAPS.map((map) => {
    const inv: Record<PyraminxVertex, PyraminxVertex> = {
      U: 'U',
      L: 'L',
      R: 'R',
      B: 'B',
    };
    for (const pos of PYRAMINX_VERTICES_ORDER) {
      inv[map[pos]] = pos;
    }
    const idx = PYRAMINX_GRIP_MAPS.findIndex(
      (m) => m.U === inv.U && m.L === inv.L && m.R === inv.R && m.B === inv.B,
    );
    if (idx < 0) {
      throw new Error(`No inverse grip found for grip map ${JSON.stringify(map)}`);
    }
    return idx;
  });
}

export const PYRAMINX_INVERSE_GRIP: readonly number[] = computePyraminxInverseGrips();

/**
 * The discrete whole-puzzle rotations the virtual view exposes (the UI's
 * lateral 120° drone steps and the 180° C2 tilt). `x1` and `x-1` produce
 * the SAME pose (a 180° rotation is its own inverse around the tilt axis).
 */
export const PYRAMINX_ROTATION_OPS = ['y1', 'y-1', 'x1', 'x-1'] as const;
export type PyraminxRotationOp = (typeof PYRAMINX_ROTATION_OPS)[number];

/**
 * Grip transition table: PYRAMINX_GRIP_TRANSITIONS[op][g] is the A₄ grip
 * index the puzzle lands on after applying the discrete rotation `op` to
 * pose g (computed from the actual pose quaternions — exact, not snapped
 * by inspection). Pure and precomputed once at module load.
 *
 * This is what lets the VIEW update its grip state DETERMINISTICALLY at
 * rotation START (no waiting for the animation to settle, no reading a
 * mid-SLERP quaternion), so the scramble display and the keyboard
 * conjugation always agree on the same frame.
 */
export function computePyraminxGripTransitions(): Record<
  PyraminxRotationOp,
  readonly number[]
> {
  const qY1 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (120 * Math.PI) / 180);
  const qY_1 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (-120 * Math.PI) / 180);
  const qX1 = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, Math.PI);
  const qX_1 = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, -Math.PI);
  const ops: Record<PyraminxRotationOp, Quaternion> = { y1: qY1, 'y-1': qY_1, x1: qX1, 'x-1': qX_1 };

  const table: Record<PyraminxRotationOp, number[]> = {
    y1: [],
    'y-1': [],
    x1: [],
    'x-1': [],
  };
  for (let g = 0; g < PYRAMINX_GRIP_QUATERNIONS.length; g++) {
    for (const op of PYRAMINX_ROTATION_OPS) {
      const target = ops[op].clone().multiply(PYRAMINX_GRIP_QUATERNIONS[g]).normalize();
      table[op][g] = snapPyraminxGrip(target).grip;
    }
  }
  return table;
}

/** The precomputed 12×4 grip transition table (see {@link computePyraminxGripTransitions}). */
export const PYRAMINX_GRIP_TRANSITIONS: Record<
  PyraminxRotationOp,
  readonly number[]
> = computePyraminxGripTransitions();

/**
 * The grip index the puzzle lands on after the discrete rotation `op` is
 * applied to the current pose `grip`. Falls back to `grip` for unknown ops.
 */
export function transitionPyraminxGrip(grip: number, op: PyraminxRotationOp): number {
  return PYRAMINX_GRIP_TRANSITIONS[op]?.[grip] ?? grip;
}

/**
 * Map a CANONICAL WCA token to its VIEW-frame display under a grip index
 * (0..11) — the Pyraminx analog of the cube's `MoveTransformer.remapScrambleString`:
 *
 * The scramble is written in the canonical model frame ("turn the U vertex",
 * …). After a whole-puzzle A₄ rotation, the canonical vertices sit at
 * different screen positions; a WYSIWYG display renames each token to the
 * position where its vertex now sits — e.g. the canonical L vertex sits at
 * the bottom-right of the canonical view, so it displays as "R". This is
 * exactly the INVERSE of the key conjugation: pressing the displayed
 * position key performs the canonical move the display names (grip 0:
 * display "R" → press the R key → canonical L, the layer under the finger).
 * Primes and tip/layer case are preserved; unknown tokens pass through.
 */
export function displayPyraminxTokenThroughGrip(token: string, grip: number): string {
  const isPrime = token.endsWith("'");
  const base = isPrime ? token.slice(0, -1) : token;
  const isTip = base === base.toLowerCase();
  const upper = base.toUpperCase() as PyraminxVertex;

  // gripMap[g] maps VIEW position → canonical vertex (conjugation). The
  // display needs canonical → view position, i.e. the inverse grip's map.
  const inverseGrip = PYRAMINX_INVERSE_GRIP[grip];
  const invMap = PYRAMINX_GRIP_MAPS[inverseGrip];
  if (!invMap || !(upper in invMap)) return token;

  const viewVertex = invMap[upper];
  const viewBase = isTip ? viewVertex.toLowerCase() : viewVertex;
  return isPrime ? viewBase + "'" : viewBase;
}

/**
 * Remap a whole scramble string (space-delimited WCA tokens) into the
 * view frame for display under a grip. The canonical scramble is NEVER
 * modified — only the displayed notation changes (same contract as
 * `MoveTransformer.remapScrambleString`). The token count is preserved.
 */
export function remapPyraminxScrambleString(scramble: string, grip: number): string {
  return scramble
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => displayPyraminxTokenThroughGrip(t, grip))
    .join(" ");
}


