/**
 * @cubeforge/cube-3d-engine — FaceletParser2x2
 *
 * Parses a 24-character 2×2 facelet string into cubie logical states
 * (current grid position + initial grid position + orientation quaternion),
 * mirroring the 3×3 {@link parseFaceletsToCubies} interface so the
 * {@link CubeModel.applyFacelets} method works for both cube orders.
 *
 * ## 2×2 Facelet layout (24 chars, 4 per face × 6 faces)
 *
 *   U: 0..3   R: 4..7   F: 8..11   D: 12..15   L: 16..19   B: 20..23
 *
 * ## Grid coordinates for 2×2
 *
 * The 2×2 has 8 corner cubies at grid coordinates (same ±1 as 3×3 outer
 * faces, no middle layer — the 2×2 root group is scaled down for visual size):
 *   (-1, +1, +1)  UFL
 *   (+1, +1, +1)  URF
 *   (-1, +1, -1)  ULB
 *   (+1, +1, -1)  UBR
 *   (-1, -1, +1)  DLF
 *   (+1, -1, +1)  DFR
 *   (-1, -1, -1)  DBL
 *   (+1, -1, -1)  DRB
 */

import { Vector3, Quaternion } from 'three';

// ── Facelet → corner position mapping ─────────────────────────────────────
//
// For each corner, the three facelet indices and the face name.
// Must match Cube2x2FaceletConverter.CORNER_FACELET_2X2.

interface CornerSpec {
  /** Grid position of this corner. */
  x: number; y: number; z: number;
  /** The three facelets for this corner: [faceLetter, faceletIndex]. */
  facelets: [string, number][];
}

const CORNER_SPECS: CornerSpec[] = [
  // URF: x=+1, y=+1, z=+1 — U3, R0, F1
  { x: 1, y: 1, z: 1, facelets: [['U', 3], ['R', 4], ['F', 9]] },
  // UFL: x=-1, y=+1, z=+1 — U2, F0, L0
  { x: -1, y: 1, z: 1, facelets: [['U', 2], ['F', 8], ['L', 16]] },
  // ULB: x=-1, y=+1, z=-1 — U0, L1, B1
  { x: -1, y: 1, z: -1, facelets: [['U', 0], ['L', 17], ['B', 21]] },
  // UBR: x=+1, y=+1, z=-1 — U1, B0, R1
  { x: 1, y: 1, z: -1, facelets: [['U', 1], ['B', 20], ['R', 5]] },
  // DFR: x=+1, y=-1, z=+1 — D1, F3, R2
  { x: 1, y: -1, z: 1, facelets: [['D', 13], ['F', 11], ['R', 6]] },
  // DLF: x=-1, y=-1, z=+1 — D0, L2, F2
  { x: -1, y: -1, z: 1, facelets: [['D', 12], ['L', 18], ['F', 10]] },
  // DBL: x=-1, y=-1, z=-1 — D2, B3, L3
  { x: -1, y: -1, z: -1, facelets: [['D', 14], ['B', 23], ['L', 19]] },
  // DRB: x=+1, y=-1, z=-1 — D3, R3, B2
  { x: 1, y: -1, z: -1, facelets: [['D', 15], ['R', 7], ['B', 22]] },
];

const faceToAxis: Record<string, Vector3> = {
  'U': new Vector3(0, 1, 0),
  'D': new Vector3(0, -1, 0),
  'F': new Vector3(0, 0, 1),
  'B': new Vector3(0, 0, -1),
  'L': new Vector3(-1, 0, 0),
  'R': new Vector3(1, 0, 0),
};

export interface ParsedCubie2x2 {
  currX: number;
  currY: number;
  currZ: number;
  initialX: number;
  initialY: number;
  initialZ: number;
  quaternion: Quaternion;
}

/**
 * Parse a 24-character 2×2 facelet string into 8 cubie logical states.
 *
 * @param facelets  24-char string using U/R/F/D/L/B color letters.
 * @returns Array of 8 ParsedCubie2x2 entries.
 * @throws if the string is not 24 characters.
 */
export function parseFaceletsToCubies2x2(facelets: string): ParsedCubie2x2[] {
  if (facelets.length !== 24) {
    throw new Error(`Invalid 2×2 facelets string length: ${facelets.length} (expected 24)`);
  }

  // Build a color → face map by reading one facelet per face.
  // For 2×2, there are no centers, so we use the first sticker of each face
  // as the representative color. This works because all stickers on a face
  // share the same "face color" in the solved state.
  const colorToFace: Record<string, string> = {};
  // U0, R0, F0, D0, L0, B0
  const faceStartIdx: Record<string, number> = { U: 0, R: 4, F: 8, D: 12, L: 16, B: 20 };
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const color = facelets[faceStartIdx[face]];
    colorToFace[color] = face;
  }

  const result: ParsedCubie2x2[] = [];

  for (const spec of CORNER_SPECS) {
    const currentAxes: Vector3[] = [];
    const originalAxes: Vector3[] = [];
    let initialX = 0, initialY = 0, initialZ = 0;

    for (const [face, idx] of spec.facelets) {
      const color = facelets[idx];
      const originalFace = colorToFace[color];
      if (!originalFace) continue;

      currentAxes.push(faceToAxis[face].clone());
      originalAxes.push(faceToAxis[originalFace].clone());

      if (originalFace === 'R') initialX = 1;
      if (originalFace === 'L') initialX = -1;
      if (originalFace === 'U') initialY = 1;
      if (originalFace === 'D') initialY = -1;
      if (originalFace === 'F') initialZ = 1;
      if (originalFace === 'B') initialZ = -1;
    }

    const q = new Quaternion();

    if (originalAxes.length >= 2) {
      const q1 = new Quaternion().setFromUnitVectors(originalAxes[0], currentAxes[0]);
      const alignedSecondOrig = originalAxes[1].clone().applyQuaternion(q1);

      const axis = currentAxes[0];
      const cross = alignedSecondOrig.clone().cross(currentAxes[1]);
      const sin = cross.dot(axis);
      const cos = alignedSecondOrig.dot(currentAxes[1]);
      const angle = Math.atan2(sin, cos);

      const q2 = new Quaternion().setFromAxisAngle(axis, angle);
      q.multiplyQuaternions(q2, q1);
    } else if (originalAxes.length === 1) {
      q.setFromUnitVectors(originalAxes[0], currentAxes[0]);
    }

    result.push({
      currX: spec.x,
      currY: spec.y,
      currZ: spec.z,
      initialX,
      initialY,
      initialZ,
      quaternion: q,
    });
  }

  return result;
}
