/**
 * Pyraminx virtual-drag resolver — the vertex-turning counterpart of the
 * cube's resolveDragMove.
 *
 * Direct manipulation model (virtual-puzzle interaction):
 * A drag on a PIECE resolves a definite FIXED ±120° turn — the layer or tip
 * under the finger.
 *
 * Mathematical Foundations:
 * 1. Tips and Corners:
 *    - A tip or corner belongs strictly to ONE vertex. There is zero layer
 *      ambiguity. The gesture's alignment with the rotation tangent in screen
 *      space determines the turn direction (+1 vs -1).
 * 2. Edges:
 *    - An edge piece sits between two vertices (V_A and V_B).
 *    - Along the edge, the 3D rotation tangents for both vertices are exactly
 *      anti-parallel (t_A = -t_B).
 *    - Which layer turns is determined by spatial proximity along the edge
 *      (where the user grabbed the piece) combined with directional heading.
 *    - The turn direction (+1 vs -1) is determined by the tangent alignment.
 *    - This guarantees 100% mathematical symmetry and invertibility:
 *      swiping +d produces move M, and swiping -d produces the inverse move M'
 *      (never switching to an unrelated layer).
 * 3. Perspective Projection:
 *    - When a Camera is provided, the resolver projects 3D rotation deltas
 *      directly using camera.project(), accounting for FOV, perspective
 *      foreshortening, parallax, and canvas aspect ratio without orthographic
 *      distortions.
 */

import { Vector3, type Camera } from "three";

/** A 3D vector (structural — accepts three.js Vector3). */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PyraminxDragCandidate {
  /** The vertex whose axis this candidate turns around. */
  vertex: "U" | "L" | "R" | "B";
  /** Whether the turn is a full layer or a tip-only turn. */
  scope: "layer" | "tip";
}

export interface PyraminxDragInput {
  /** Pointer travel in screen px since the drag started (+x = right, +y = down). */
  dx: number;
  dy: number;
  /** The picked piece's slot or hit position in the ROOT frame (puzzle frame). */
  worldPoint: Vec3;
  /** Candidate turns for the picked piece (1 for corners/tips, 2 for edges). */
  candidates: PyraminxDragCandidate[];
  /** Unit vertex axes (engine's PYRAMINX_AXES, same frame as worldPoint). */
  axes: Record<"U" | "L" | "R" | "B", Vec3>;
  /** Camera world basis: screen-right and screen-up (unit-ish vectors). */
  cameraRight: Vec3;
  cameraUp: Vec3;
  /**
   * World positions of the 4 vertices (scaled, current orientation).
   */
  vertices?: Record<"U" | "L" | "R" | "B", Vec3>;
  /**
   * Optional live three.js Camera. When provided, enables exact perspective
   * projection of the rotating point.
   */
  camera?: Camera;
  viewWidth?: number;
  viewHeight?: number;
}

/** A resolved fixed-angle turn: the token is vertex (+ "'" for the prime). */
export interface PyraminxDragMove {
  vertex: "U" | "L" | "R" | "B";
  scope: "layer" | "tip";
  direction: 1 | -1;
}

/** Minimum |alignment| between the drag and a projected tangent before a
 *  move resolves — below this the swipe is ambiguous (perpendicular)
 *  and the resolver refuses until the drag commits. */
export const MIN_TANGENT_COS = 0.3;

/**
 * Rotate a 3D vector around a unit axis by angleRad using Rodrigues' formula.
 * Pure vector math, no matrix allocation.
 */
function rotateAroundAxis(p: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const dot = axis.x * p.x + axis.y * p.y + axis.z * p.z;
  const crossX = axis.y * p.z - axis.z * p.y;
  const crossY = axis.z * p.x - axis.x * p.z;
  const crossZ = axis.x * p.y - axis.y * p.x;
  return {
    x: p.x * c + crossX * s + axis.x * dot * (1 - c),
    y: p.y * c + crossY * s + axis.y * dot * (1 - c),
    z: p.z * c + crossZ * s + axis.z * dot * (1 - c),
  };
}

/** Project a 3D point to 2D screen coordinates (+x right, +y down). */
function projectPointToScreen(
  p: Vec3,
  camera?: Camera,
  cameraRight?: Vec3,
  cameraUp?: Vec3,
  viewWidth = 400,
  viewHeight = 400,
): { x: number; y: number } {
  if (camera && (camera as unknown as { matrixWorldInverse?: { elements?: number[] } }).matrixWorldInverse?.elements) {
    try {
      const v = new Vector3(p.x, p.y, p.z).project(camera);
      return {
        x: ((v.x + 1) / 2) * viewWidth,
        y: ((1 - v.y) / 2) * viewHeight,
      };
    } catch {
      // Fallback below
    }
  }
  if (cameraRight && cameraUp) {
    return {
      x: p.x * cameraRight.x + p.y * cameraRight.y + p.z * cameraRight.z,
      y: -(p.x * cameraUp.x + p.y * cameraUp.y + p.z * cameraUp.z),
    };
  }
  return { x: p.x, y: -p.y };
}

/**
 * Compute the unit screen displacement vector resulting from a small positive
 * rotation (+0.01 rad) around a candidate vertex axis.
 */
function computeCandidateScreenVector(
  vertex: "U" | "L" | "R" | "B",
  p: Vec3,
  axes: Record<"U" | "L" | "R" | "B", Vec3>,
  camera?: Camera,
  cameraRight?: Vec3,
  cameraUp?: Vec3,
  viewWidth = 400,
  viewHeight = 400,
): { unitX: number; unitY: number; len: number } | null {
  const axis = axes[vertex];
  const delta = 0.01; // rad (~0.57 deg)

  if (camera && (camera as unknown as { matrixWorldInverse?: { elements?: number[] } }).matrixWorldInverse?.elements) {
    try {
      const pRot = rotateAroundAxis(p, axis, delta);
      const s0 = projectPointToScreen(p, camera, undefined, undefined, viewWidth, viewHeight);
      const s1 = projectPointToScreen(pRot, camera, undefined, undefined, viewWidth, viewHeight);
      const dx = s1.x - s0.x;
      const dy = s1.y - s0.y;
      const len = Math.hypot(dx, dy);
      if (len >= 1e-5) {
        return { unitX: dx / len, unitY: dy / len, len };
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback using analytical 3D tangent and camera basis:
  let tx = axis.y * p.z - axis.z * p.y;
  let ty = axis.z * p.x - axis.x * p.z;
  let tz = axis.x * p.y - axis.y * p.x;
  let tLen = Math.hypot(tx, ty, tz);

  if (tLen < 1e-4) {
    // Apex on-axis fallback (clicked directly at the tip vertex):
    // Rotation moves perpendicular to axis in view plane.
    if (cameraRight && cameraUp) {
      const cfx = cameraRight.y * cameraUp.z - cameraRight.z * cameraUp.y;
      const cfy = cameraRight.z * cameraUp.x - cameraRight.x * cameraUp.z;
      const cfz = cameraRight.x * cameraUp.y - cameraRight.y * cameraUp.x;
      tx = axis.y * cfz - axis.z * cfy;
      ty = axis.z * cfx - axis.x * cfz;
      tz = axis.x * cfy - axis.y * cfx;
      tLen = Math.hypot(tx, ty, tz);
      if (tLen < 1e-4) {
        tx = cameraRight.x;
        ty = cameraRight.y;
        tz = cameraRight.z;
        tLen = 1;
      }
    } else {
      return null;
    }
  }

  const cR = cameraRight ?? { x: 1, y: 0, z: 0 };
  const cU = cameraUp ?? { x: 0, y: 1, z: 0 };
  const sx = (tx * cR.x + ty * cR.y + tz * cR.z) / tLen;
  const sy = -(tx * cU.x + ty * cU.y + tz * cU.z) / tLen;
  const sLen = Math.hypot(sx, sy);
  if (sLen < 1e-5) return null;
  return { unitX: sx / sLen, unitY: sy / sLen, len: sLen };
}

/**
 * Resolve WHICH fixed ±120° turn a piece drag fires, or null while the drag
 * is still ambiguous (below the tangent alignment threshold).
 */
export function resolvePyraminxDragMove(input: PyraminxDragInput): PyraminxDragMove | null {
  const { dx, dy, worldPoint: p, candidates, axes, cameraRight, cameraUp, camera, viewWidth, viewHeight } = input;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const dragLen = Math.hypot(dx, dy);
  if (dragLen < 1e-3) return null;
  const dUnitX = dx / dragLen;
  const dUnitY = dy / dragLen;
  const verts = input.vertices;

  // ── Single-candidate pieces (tips and corners) ──
  // A corner or tip belongs to exactly ONE vertex. The layer is fixed.
  // We only determine direction from tangent alignment, with radial fallback.
  if (candidates.length <= 1) {
    const c = candidates[0];
    if (!c) return null;
    const tan = computeCandidateScreenVector(c.vertex, p, axes, camera, cameraRight, cameraUp, viewWidth, viewHeight);
    if (tan) {
      const tanDot = dUnitX * tan.unitX + dUnitY * tan.unitY;
      if (Math.abs(tanDot) >= MIN_TANGENT_COS) {
        // Positive rotation (+delta) is CCW / prime (direction = -1). Plain WCA is CW (direction = +1).
        const direction = tanDot > 0 ? -1 : 1;
        return { vertex: c.vertex, scope: c.scope, direction };
      }
    }
    // Tangent-ambiguous (radial drag toward/away from vertex):
    if (verts && verts[c.vertex]) {
      const vPos = verts[c.vertex];
      const sHit = projectPointToScreen(p, camera, cameraRight, cameraUp, viewWidth, viewHeight);
      const sV = projectPointToScreen(vPos, camera, cameraRight, cameraUp, viewWidth, viewHeight);
      const rLen = Math.hypot(sV.x - sHit.x, sV.y - sHit.y);
      if (rLen >= 1e-4) {
        const headDot = (dUnitX * (sV.x - sHit.x) + dUnitY * (sV.y - sHit.y)) / rLen;
        if (Math.abs(headDot) >= MIN_TANGENT_COS) {
          const direction = headDot > 0 ? 1 : -1;
          return { vertex: c.vertex, scope: c.scope, direction };
        }
      }
    }
    return null;
  }

  // ── Multi-candidate pieces (edges) ──
  // An edge piece sits between two vertices (e.g. V_A and V_B).
  // Step 1: Disambiguate which vertex the user intended based on spatial proximity + heading.
  // Step 2: Determine turn direction from that vertex's tangent (or radial heading fallback).
  const getVertexPos = (v: "U" | "L" | "R" | "B"): Vec3 => {
    if (verts && verts[v]) return verts[v];
    return axes[v];
  };

  const dist3D = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  const [c0, c1] = candidates;
  const v0Pos = getVertexPos(c0.vertex);
  const v1Pos = getVertexPos(c1.vertex);
  const d0 = dist3D(p, v0Pos);
  const d1 = dist3D(p, v1Pos);
  const totalDist = d0 + d1 || 1;
  // Spatial weights based on where the piece was grabbed along the edge (closer = higher)
  const w0 = 1 - d0 / totalDist;
  const w1 = 1 - d1 / totalDist;

  // Heading bias: screen direction from grab point towards each vertex
  const sHit = projectPointToScreen(p, camera, cameraRight, cameraUp, viewWidth, viewHeight);
  const sV0 = projectPointToScreen(v0Pos, camera, cameraRight, cameraUp, viewWidth, viewHeight);
  const sV1 = projectPointToScreen(v1Pos, camera, cameraRight, cameraUp, viewWidth, viewHeight);
  const r0Len = Math.hypot(sV0.x - sHit.x, sV0.y - sHit.y) || 1;
  const r1Len = Math.hypot(sV1.x - sHit.x, sV1.y - sHit.y) || 1;
  const head0 = (dUnitX * (sV0.x - sHit.x) + dUnitY * (sV0.y - sHit.y)) / r0Len;
  const head1 = (dUnitX * (sV1.x - sHit.x) + dUnitY * (sV1.y - sHit.y)) / r1Len;

  // Compute rotation tangents for BOTH candidate layers:
  const tan0 = computeCandidateScreenVector(c0.vertex, p, axes, camera, cameraRight, cameraUp, viewWidth, viewHeight);
  const tan1 = computeCandidateScreenVector(c1.vertex, p, axes, camera, cameraRight, cameraUp, viewWidth, viewHeight);

  const tanDot0 = tan0 ? dUnitX * tan0.unitX + dUnitY * tan0.unitY : 0;
  const tanDot1 = tan1 ? dUnitX * tan1.unitX + dUnitY * tan1.unitY : 0;

  const align0 = Math.abs(tanDot0);
  const align1 = Math.abs(tanDot1);

  // Composite score: tangential alignment (primary intention) + spatial position along the edge
  // Using |tanDot| guarantees strict invertibility: reversing drag vector (-dx, -dy) produces the exact same score.
  const score0 = align0 + 0.35 * (w0 - 0.5);
  const score1 = align1 + 0.35 * (w1 - 0.5);

  const winner = score0 >= score1 ? c0 : c1;
  const winDot = winner === c0 ? tanDot0 : tanDot1;

  if (Math.abs(winDot) >= MIN_TANGENT_COS) {
    const direction = winDot > 0 ? -1 : 1;
    return { vertex: winner.vertex, scope: winner.scope, direction };
  }

  // Radial heading fallback for the winning vertex (when swipe is radial toward/away from that vertex):
  const winHead = winner === c0 ? head0 : head1;
  if (Math.abs(winHead) >= MIN_TANGENT_COS) {
    const direction = winHead > 0 ? 1 : -1;
    return { vertex: winner.vertex, scope: winner.scope, direction };
  }

  return null;
}

/** The WCA token a resolved drag performs ("U", "L'", "u", …). */
export function pyraminxDragToken(move: PyraminxDragMove): string {
  const base = move.scope === "tip" ? move.vertex.toLowerCase() : move.vertex;
  return move.direction < 0 ? `${base}'` : base;
}
