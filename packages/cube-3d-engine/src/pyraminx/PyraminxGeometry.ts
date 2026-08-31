import { Vector3 } from 'three';

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
