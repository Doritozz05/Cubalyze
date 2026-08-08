import { Quaternion } from '../math3d';
import type { CubeFace, FacePermutation, OuterFace } from '@cubeforge/types';

/**
 * A single entry in the 24-orientation table.
 *
 * The rotation group of the cube (octahedral group O ≅ S₄) has exactly 24
 * elements. Each element corresponds to a permutation of the body axes that
 * preserves orientation (determinant +1).
 *
 * See: docs/02-architecture/Dynamic_Notation_Orientation_System.md
 */
export interface OrientationEntry {
  /** Numeric ID (0–23). ID 0 is always the identity. */
  id: number;
  /** Unit quaternion in Three.js convention (Y-up, right-handed). */
  quaternion: Quaternion;
  /** Position → original face permutation. Used for move remapping. */
  faceMap: FacePermutation;
  /** Human-readable label for debugging. */
  label: string;
}

// ─── Face utilities ──────────────────────────────────────────────────────────

const ALL_FACES: OuterFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];

function invertFaceMap(map: FacePermutation): FacePermutation {
  const inv: Partial<Record<OuterFace, OuterFace>> = {};
  for (const pos of ALL_FACES) {
    inv[pos] = 'U'; // placeholder
  }
  // map[position] = original → inv[original] = position
  for (const pos of ALL_FACES) {
    inv[map[pos]] = pos;
  }
  return inv as FacePermutation;
}

function composeFaceMap(a: FacePermutation, b: FacePermutation): FacePermutation {
  // Apply a first, then b: result(pos) = b(a(pos))
  const result: Partial<Record<OuterFace, OuterFace>> = {};
  for (const pos of ALL_FACES) {
    result[pos] = b[a[pos]];
  }
  return result as FacePermutation;
}

function faceMapLabel(map: FacePermutation): string {
  return `F:${map.F} U:${map.U} R:${map.R}`;
}

// ─── Base rotation definitions ───────────────────────────────────────────────
//
// These face maps are VERIFIED against the project's own CubeState.ts edge
// permutations (baseU.ep, baseR.ep, baseF.ep). They answer:
//   "After rotation X, which original face now occupies each position?"
//
// x = same as R:   F→U, U→B, B→D, D→F  (cycle F→U→B→D→F)
// y = same as U:   B→R, R→F, F→L, L→B  (cycle B→R→F→L→B)
// z = same as F:   L→U, U→R, R→D, D→L  (cycle L→U→R→D→L)

const IDENTITY_MAP: FacePermutation = { U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R' };

const BASE_ROTATIONS: { name: string; faceMap: FacePermutation; axis: 'x' | 'y' | 'z'; angle: number }[] = [
  // x = same direction as R (clockwise looking from +X)
  // F→U, U→B, B→D, D→F. Position→original: U:F, D:B, F:D, B:U, L:L, R:R
  { name: 'x',  faceMap: { U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R' }, axis: 'x', angle: -Math.PI / 2 },
  { name: "x'", faceMap: { U: 'B', D: 'F', F: 'U', B: 'D', L: 'L', R: 'R' }, axis: 'x', angle:  Math.PI / 2 },
  { name: 'x2', faceMap: { U: 'D', D: 'U', F: 'B', B: 'F', L: 'L', R: 'R' }, axis: 'x', angle:  Math.PI },
  // y = same direction as U (clockwise looking from +Y / above)
  // B→R, R→F, F→L, L→B. Position→original: U:U, D:D, F:R, B:L, L:F, R:B
  { name: 'y',  faceMap: { U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B' }, axis: 'y', angle: -Math.PI / 2 },
  { name: "y'", faceMap: { U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F' }, axis: 'y', angle:  Math.PI / 2 },
  { name: 'y2', faceMap: { U: 'U', D: 'D', F: 'B', B: 'F', L: 'R', R: 'L' }, axis: 'y', angle:  Math.PI },
  // z = same direction as F (clockwise looking from +Z / front)
  // L→U, U→R, R→D, D→L. Position→original: U:L, D:R, F:F, B:B, L:D, R:U
  { name: 'z',  faceMap: { U: 'L', D: 'R', F: 'F', B: 'B', L: 'D', R: 'U' }, axis: 'z', angle: -Math.PI / 2 },
  { name: "z'", faceMap: { U: 'R', D: 'L', F: 'F', B: 'B', L: 'U', R: 'D' }, axis: 'z', angle:  Math.PI / 2 },
  { name: 'z2', faceMap: { U: 'D', D: 'U', F: 'F', B: 'B', L: 'R', R: 'L' }, axis: 'z', angle:  Math.PI },
];

// ─── Build the 24-orientation table ──────────────────────────────────────────
//
// We BFS from identity, applying each of the 9 base rotations. Since the
// group has only 24 elements, this terminates quickly. We deduplicate by
// face-map equality (which is equivalent to quaternion equivalence up to
// the q ≡ -q double cover).

function faceMapKey(map: FacePermutation): string {
  return ALL_FACES.map((f) => map[f]).join('');
}

// ─── Canonical quaternion from face map ──────────────────────────────────────
//
// The BFS builds quaternions by composing base rotation quaternions. Due to
// quaternion commutativity for certain rotation pairs (e.g. q_x*q_y = q_x'*q_y
// for 90° rotations about orthogonal axes), different BFS paths can produce
// the same quaternion for DIFFERENT face maps. This causes snap() to match the
// wrong orientation entry.
//
// Fix: after BFS, recompute each quaternion directly from its face map using
// the rotation matrix method. This guarantees a 1:1 mapping from face map to
// quaternion, independent of BFS path.

const FACE_NORMALS: Record<OuterFace, [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  L: [-1, 0, 0],
  R: [1, 0, 0],
};

/**
 * Compute the canonical quaternion for a face permutation by deriving the
 * rotation matrix from how the face normals transform, then converting to
 * a quaternion using Shepperd's method.
 *
 * Face map: position → original face. So faceMap['F'] = 'R' means the original
 * R face is now at position F, i.e. the R normal (1,0,0) has been rotated to
 * the F normal direction (0,0,1). Thus the rotation matrix column for F is
 * FACE_NORMALS['R'].
 */
function canonicalQuaternion(map: FacePermutation): { x: number; y: number; z: number; w: number } {
  // Build rotation matrix columns from the face normal mapping.
  // R = [col_right | col_up | col_front] where each column is the original
  // face normal that now occupies that position.
  const r = FACE_NORMALS[map.R]; // column 0 (right axis)
  const u = FACE_NORMALS[map.U]; // column 1 (up axis)
  const f = FACE_NORMALS[map.F]; // column 2 (front axis)

  // The rotation matrix R satisfies: R * FACE_NORMALS[map[pos]] = FACE_NORMALS[pos]
  // Let A = [r | u | f] (columns). Then R * A = I, so R = A^T.
  // Therefore the rows of R are r, u, f:
  const m00 = r[0], m01 = r[1], m02 = r[2];
  const m10 = u[0], m11 = u[1], m12 = u[2];
  const m20 = f[0], m21 = f[1], m22 = f[2];

  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m21 - m12) * s;
    qy = (m02 - m20) * s;
    qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }

  // Normalize
  const len = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  qx /= len;
  qy /= len;
  qz /= len;
  qw /= len;

  // Canonical sign: ensure w > 0, or if w == 0, ensure first non-zero
  // component is positive. This ensures q and -q map to the same entry.
  if (qw < 0 || (qw === 0 && (qx < 0 || (qx === 0 && (qy < 0 || (qy === 0 && qz < 0)))))) {
    qx = -qx;
    qy = -qy;
    qz = -qz;
    qw = -qw;
  }

  return { x: qx, y: qy, z: qz, w: qw };
}

function buildTable(): OrientationEntry[] {
  // Phase 1: BFS to discover all 24 unique face maps.
  // We only track face maps here (not quaternions) because different BFS paths
  // can produce the same face map with different quaternions due to quaternion
  // commutativity for certain rotation pairs.
  const faceMaps: FacePermutation[] = [IDENTITY_MAP];
  const seen = new Set<string>();
  seen.add(faceMapKey(IDENTITY_MAP));

  const queue: FacePermutation[] = [IDENTITY_MAP];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const rot of BASE_ROTATIONS) {
      const newMap = composeFaceMap(current, rot.faceMap);
      const key = faceMapKey(newMap);

      if (!seen.has(key)) {
        seen.add(key);
        faceMaps.push(newMap);
        queue.push(newMap);
      }
    }
  }

  // Phase 2: Compute canonical quaternions directly from face maps.
  // This guarantees each orientation has the uniquely correct quaternion,
  // independent of which BFS path discovered it first.
  const entries: OrientationEntry[] = faceMaps.map((map, i) => {
    const q = canonicalQuaternion(map);
    return {
      id: i,
      quaternion: new Quaternion(q.x, q.y, q.z, q.w),
      faceMap: map,
      label: faceMapLabel(map),
    };
  });

  return entries;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export class OrientationTable {
  /** All 24 cube orientations, pre-computed at module load. */
  static readonly ENTRIES: OrientationEntry[] = buildTable();

  /** The identity orientation (no rotation). */
  static readonly IDENTITY: OrientationEntry = OrientationTable.ENTRIES[0];

  /**
   * Snap an observed quaternion to the nearest of the 24 cube orientations.
   *
   * Uses the absolute dot product (because q and -q represent the same
   * rotation in 3D space). Returns the best match and a confidence value
   * (0–1, where 1.0 means an exact match).
   *
   * @param q The observed quaternion (must be in the same convention as the
   *          table entries: Three.js right-handed, Y-up, calibrated).
   * @returns The nearest orientation entry and the |dot product| confidence.
   */
  static snap(q: { x: number; y: number; z: number; w: number }): {
    entry: OrientationEntry;
    confidence: number;
  } {
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const qLen = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
    // Guard against zero / non-normalized input
    const nx = qLen > 0 ? qx / qLen : 0;
    const ny = qLen > 0 ? qy / qLen : 0;
    const nz = qLen > 0 ? qz / qLen : 0;
    const nw = qLen > 0 ? qw / qLen : 1;

    let bestEntry = OrientationTable.IDENTITY;
    let bestDot = -1;

    for (const entry of OrientationTable.ENTRIES) {
      const e = entry.quaternion;
      const dot = Math.abs(nx * e.x + ny * e.y + nz * e.z + nw * e.w);
      if (dot > bestDot) {
        bestDot = dot;
        bestEntry = entry;
      }
    }

    return { entry: bestEntry, confidence: bestDot };
  }

  /**
   * Find an orientation entry by its face map.
   * Returns the identity if no match is found (should not happen for valid maps).
   */
  static fromFaceMap(map: FacePermutation): OrientationEntry {
    const key = faceMapKey(map);
    for (const entry of OrientationTable.ENTRIES) {
      if (faceMapKey(entry.faceMap) === key) {
        return entry;
      }
    }
    return OrientationTable.IDENTITY;
  }

  /**
   * Look up a base whole-cube rotation (x, x', x2, y, y', y2, z, z', z2) by
   * its notation token. Returns null for anything else (face moves, wide
   * moves, slices, malformed tokens).
   *
   * Used to fold solver-frame rotations into a running grip (conjugation)
   * when replaying text reconstructions on a fixed cube.
   */
  static rotationEntryFor(token: string): OrientationEntry | null {
    const rot = BASE_ROTATIONS.find((r) => r.name === token);
    if (!rot) return null;
    return OrientationTable.fromFaceMap(rot.faceMap);
  }

  /**
   * Compose two orientations: apply `a` first, then `b`.
   * The resulting face map is `b(a(pos))` and the quaternion is `q_b * q_a`.
   */
  static compose(a: OrientationEntry, b: OrientationEntry): OrientationEntry {
    const newMap = composeFaceMap(a.faceMap, b.faceMap);
    return OrientationTable.fromFaceMap(newMap);
  }

  /**
   * Get the inverse of an orientation (the orientation that, when composed,
   * returns to identity).
   */
  static inverse(entry: OrientationEntry): OrientationEntry {
    return OrientationTable.fromFaceMap(invertFaceMap(entry.faceMap));
  }

  /**
   * Find the base rotation (one of x, x', x2, y, y', y2, z, z', z2) that
   * transforms `from` into `to`. Returns null if no single base rotation
   * connects them (they differ by more than one step).
   *
   * Used to emit RotationEvent metadata.
   */
  static findRotationBetween(
    from: OrientationEntry,
    to: OrientationEntry
  ): { axis: 'x' | 'y' | 'z'; direction: 1 | -1 | 2 } | null {
    for (const rot of BASE_ROTATIONS) {
      const candidate = OrientationTable.compose(from, {
        id: -1,
        quaternion: new Quaternion(),
        faceMap: rot.faceMap,
        label: rot.name,
      });
      if (faceMapKey(candidate.faceMap) === faceMapKey(to.faceMap)) {
        const direction: 1 | -1 | 2 =
          rot.name.endsWith("'") ? -1 : rot.name.endsWith('2') ? 2 : 1;
        return { axis: rot.axis, direction };
      }
    }
    return null;
  }
}
