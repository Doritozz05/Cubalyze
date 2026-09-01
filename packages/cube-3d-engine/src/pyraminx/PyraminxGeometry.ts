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
 * A +120° turn around the OUTWARD axis of a vertex (right-hand rule) matches
 * the scrambler's single-step turn for that vertex (verified against the
 * geometry: e.g. +120° around U maps edge slot UL→UB→UR, exactly the
 * scrambler's U cycle [1,5,3]).
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
  { vertex: 'U', cycle: [1, 5, 3], flips: [1, 3] },
  { vertex: 'L', cycle: [0, 2, 1], flips: [0, 1] },
  { vertex: 'R', cycle: [0, 3, 4], flips: [3, 4] },
  { vertex: 'B', cycle: [2, 4, 5], flips: [4, 5] },
];

/** WCA move tokens (layer + tip turns, with primes). */
export const PYRAMINX_MOVE_TOKENS = [
  'U', "U'", 'L', "L'", 'R', "R'", 'B', "B'",
  'u', "u'", 'l', "l'", 'r', "r'", 'b', "b'",
] as const;
export type PyraminxMoveToken = (typeof PYRAMINX_MOVE_TOKENS)[number];

/**
 * Resolve a WCA token to its slice: which vertex, whether it is a full layer
 * turn or a tip-only turn, and the signed angle (a prime is −120°, which is
 * physically the 2-step turn).
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
  return { vertex: upper, scope, angleInDegrees: prime ? -120 : 120 };
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

/** WCA sticker colors per face (configurable via the factory style). */
export const DEFAULT_PYRAMINX_STICKER_COLORS: Record<PyraminxVertex, string> = {
  U: '#ffe62a', // yellow
  L: '#1abe57', // green
  R: '#3d7ce0', // blue
  B: '#eb4242', // red
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
 * Canonical C2 symmetry tilt axis in the vertical X=0 plane connecting the
 * midpoint of the top-to-rear edge and the midpoint of the front horizontal edge.
 * A 180° rotation around this axis swaps the apex with the rear base vertex,
 * preserving the canonical upright pose (flat horizontal base at y = -1/3,
 * apex at (0, 1, 0), and straight horizontal front edge).
 */
export const PYRAMINX_TILT_AXIS = new Vector3(
  0,
  1 / Math.sqrt(3),
  -Math.sqrt(2 / 3),
).normalize();

/**
 * Compute the 12 canonical pose quaternions of the Pyraminx corresponding to
 * the A₄ rotational symmetry group of the regular tetrahedron.
 *
 * Poses 0..5 correspond directly to the 6 UI poses:
 *   - Pose 0: Canonical upright (apex U on top, base flat)
 *   - Pose 1: rotatePuzzleY(1) (120° drone rotation around Y)
 *   - Pose 2: rotatePuzzleY(2) (240° drone rotation around Y)
 *   - Pose 3: rotatePuzzleX(1) from Pose 0 (180° C2 tilt: apex B on top)
 *   - Pose 4: rotatePuzzleX(1) from Pose 1 (180° C2 tilt)
 *   - Pose 5: rotatePuzzleX(1) from Pose 2 (180° C2 tilt)
 * Poses 6..11 complete the 12-element orbit (poses with apex L or R on top).
 */
export function computePyraminxGripQuaternions(): Quaternion[] {
  const qY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (120 * Math.PI) / 180);
  const qX = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, Math.PI);

  const p0 = PYRAMINX_CANONICAL_QUAT.clone();
  const p1 = qY.clone().multiply(p0).normalize();
  const p2 = qY.clone().multiply(p1).normalize();
  const p3 = qX.clone().multiply(p0).normalize();
  const p4 = qX.clone().multiply(p1).normalize();
  const p5 = qX.clone().multiply(p2).normalize();

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

/**
 * Visual key mapping per grip index (0..11).
 * Maps the on-screen key vertex (U=top, L=left, R=right, B=back)
 * to the corresponding physical vertex in the canonical model frame.
 *
 * Mapping table:
 *   Grip 0: UI canonical upright       → { U: 'U', L: 'L', R: 'R', B: 'B' }
 *   Grip 1: UI rotY(1)                 → { U: 'U', L: 'R', R: 'B', B: 'L' }
 *   Grip 2: UI rotY(2)                 → { U: 'U', L: 'B', R: 'L', B: 'R' }
 *   Grip 3: UI rotX(1) from Grip 0     → { U: 'B', L: 'R', R: 'L', B: 'U' }
 *   Grip 4: UI rotX(1) from Grip 1     → { U: 'L', L: 'B', R: 'R', B: 'U' }
 *   Grip 5: UI rotX(1) from Grip 2     → { U: 'R', L: 'L', R: 'B', B: 'U' }
 *   Grip 6: Orbit pose (B top)         → { U: 'B', L: 'L', R: 'U', B: 'R' }
 *   Grip 7: Orbit pose (L top)         → { U: 'L', L: 'R', R: 'U', B: 'B' }
 *   Grip 8: Orbit pose (R top)         → { U: 'R', L: 'B', R: 'U', B: 'L' }
 *   Grip 9: Orbit pose (B top)         → { U: 'B', L: 'U', R: 'R', B: 'L' }
 *   Grip 10: Orbit pose (R top)        → { U: 'R', L: 'U', R: 'L', B: 'B' }
 *   Grip 11: Orbit pose (L top)        → { U: 'L', L: 'U', R: 'B', B: 'R' }
 */
export const PYRAMINX_GRIP_MAPS: readonly Record<PyraminxVertex, PyraminxVertex>[] = [
  { U: 'U', L: 'L', R: 'R', B: 'B' }, // Grip 0
  { U: 'U', L: 'R', R: 'B', B: 'L' }, // Grip 1
  { U: 'U', L: 'B', R: 'L', B: 'R' }, // Grip 2
  { U: 'B', L: 'R', R: 'L', B: 'U' }, // Grip 3
  { U: 'L', L: 'B', R: 'R', B: 'U' }, // Grip 4
  { U: 'R', L: 'L', R: 'B', B: 'U' }, // Grip 5
  { U: 'B', L: 'L', R: 'U', B: 'R' }, // Grip 6
  { U: 'L', L: 'R', R: 'U', B: 'B' }, // Grip 7
  { U: 'R', L: 'B', R: 'U', B: 'L' }, // Grip 8
  { U: 'B', L: 'U', R: 'R', B: 'L' }, // Grip 9
  { U: 'R', L: 'U', R: 'L', B: 'B' }, // Grip 10
  { U: 'L', L: 'U', R: 'B', B: 'R' }, // Grip 11
];

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
 * conjugate(conjugate(t, g), g⁻¹) === t for all tokens t.
 */
export const PYRAMINX_INVERSE_GRIP: readonly number[] = [
  0, 2, 1, 3, 9, 6, 5, 10, 8, 4, 7, 11,
];


