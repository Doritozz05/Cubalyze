import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { OrientationTable } from '../OrientationTable';
import type { FacePermutation } from '@cubeforge/types';

// Helper: create a quaternion for a rotation about an axis
function rotQuat(axis: 'x' | 'y' | 'z', angleDeg: number): Quaternion {
  const axisVec = new Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0,
  );
  return new Quaternion().setFromAxisAngle(axisVec, (angleDeg * Math.PI) / 180);
}

describe('OrientationTable', () => {
  describe('table generation', () => {
    it('generates exactly 24 orientations', () => {
      expect(OrientationTable.ENTRIES).toHaveLength(24);
    });

    it('identity is entry 0', () => {
      const id = OrientationTable.IDENTITY;
      expect(id.id).toBe(0);
      expect(id.faceMap).toEqual({
        U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R',
      });
    });

    it('all face maps are unique (24 distinct permutations)', () => {
      const keys = OrientationTable.ENTRIES.map((e) =>
        ['U', 'D', 'F', 'B', 'L', 'R'].map((f) => e.faceMap[f as keyof FacePermutation]).join(''),
      );
      const unique = new Set(keys);
      expect(unique.size).toBe(24);
    });
  });

  describe('snap — base rotations', () => {
    it('snaps identity quaternion to identity', () => {
      const result = OrientationTable.snap({ x: 0, y: 0, z: 0, w: 1 });
      expect(result.entry.id).toBe(0);
      expect(result.confidence).toBeCloseTo(1.0, 5);
    });

    it('snaps x rotation (90° CW about x-axis)', () => {
      // x = same as R. In Three.js, R is angleSign: -1 about x → -90° about x
      const q = rotQuat('x', -90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
    });

    it("snaps x' rotation (90° CCW about x-axis)", () => {
      const q = rotQuat('x', 90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'B', D: 'F', F: 'U', B: 'D', L: 'L', R: 'R',
      });
    });

    it('snaps x2 rotation (180° about x-axis)', () => {
      const q = rotQuat('x', 180);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'D', D: 'U', F: 'B', B: 'F', L: 'L', R: 'R',
      });
    });

    it('snaps y rotation (90° CW about y-axis)', () => {
      // y = same as U. In Three.js, U is angleSign: -1 about y → -90° about y
      const q = rotQuat('y', -90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
    });

    it("snaps y' rotation (90° CCW about y-axis)", () => {
      const q = rotQuat('y', 90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F',
      });
    });

    it('snaps y2 rotation (180° about y-axis)', () => {
      const q = rotQuat('y', 180);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'U', D: 'D', F: 'B', B: 'F', L: 'R', R: 'L',
      });
    });

    it('snaps z rotation (90° CW about z-axis)', () => {
      // z = same as F. In Three.js, F is angleSign: -1 about z → -90° about z
      const q = rotQuat('z', -90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'L', D: 'R', F: 'F', B: 'B', L: 'D', R: 'U',
      });
    });

    it("snaps z' rotation (90° CCW about z-axis)", () => {
      const q = rotQuat('z', 90);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'R', D: 'L', F: 'F', B: 'B', L: 'U', R: 'D',
      });
    });

    it('snaps z2 rotation (180° about z-axis)', () => {
      const q = rotQuat('z', 180);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'D', D: 'U', F: 'F', B: 'B', L: 'R', R: 'L',
      });
    });
  });

  describe('snap — edge cases', () => {
    it('handles quaternion sign flip (q vs -q represent the same rotation)', () => {
      const q = rotQuat('y', -90);
      // Negate all components — same rotation
      const result = OrientationTable.snap({ x: -q.x, y: -q.y, z: -q.z, w: -q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
    });

    it('handles non-normalized quaternion (normalizes internally)', () => {
      const q = rotQuat('x', -90);
      const scale = 2.5;
      const result = OrientationTable.snap({
        x: q.x * scale, y: q.y * scale, z: q.z * scale, w: q.w * scale,
      });
      expect(result.entry.faceMap).toEqual({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
    });

    it('snaps with small noise (10° perturbation) to the correct orientation', () => {
      const q = rotQuat('y', -90);
      // Add a small rotation about a different axis (10° about z)
      const noise = rotQuat('z', 10);
      q.premultiply(noise);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      expect(result.entry.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('composed orientation: x then y has a correct quaternion (not just face map)', () => {
      // composeFaceMap(a, b) = b[a[pos]] represents "b first, then a" in physical
      // terms (due to the permutation composition convention: σ_b ∘ σ_a).
      // In Hamilton quaternion convention, q_a * q_b also means "b first, then a".
      // So composeFaceMap(x, y) corresponds to qx * qy.
      const qx = rotQuat('x', -90);
      const qy = rotQuat('y', -90);
      const qxy = qx.clone().multiply(qy); // "y first, then x" = composeFaceMap(x, y)
      // Find the table entry for compose(x, y) by face map
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const xyEntry = OrientationTable.compose(xEntry, yEntry);
      // The stored quaternion should match the manual composition
      const stored = xyEntry.quaternion;
      const dot = Math.abs(stored.x * qxy.x + stored.y * qxy.y + stored.z * qxy.z + stored.w * qxy.w);
      expect(dot).toBeGreaterThan(0.999);
    });

    it('composed orientation: y then x has a different quaternion than x then y', () => {
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const xy = OrientationTable.compose(xEntry, yEntry);
      const yx = OrientationTable.compose(yEntry, xEntry);
      // Different orientations → different quaternions (not just negated)
      const dot = Math.abs(
        xy.quaternion.x * yx.quaternion.x +
        xy.quaternion.y * yx.quaternion.y +
        xy.quaternion.z * yx.quaternion.z +
        xy.quaternion.w * yx.quaternion.w,
      );
      // If they were the same rotation, |dot| would be ~1. Since they're different, |dot| < 1.
      expect(dot).toBeLessThan(0.999);
    });

    it('returns low confidence for mid-rotation (45° about y)', () => {
      const q = rotQuat('y', -45);
      const result = OrientationTable.snap({ x: q.x, y: q.y, z: q.z, w: q.w });
      // 45° is exactly between identity and y — confidence should be low
      expect(result.confidence).toBeLessThan(0.95);
    });
  });

  describe('compose', () => {
    it('compose(identity, x) === x', () => {
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const result = OrientationTable.compose(OrientationTable.IDENTITY, xEntry);
      expect(result.faceMap).toEqual(xEntry.faceMap);
    });

    it('compose(x, y) ≠ compose(y, x) — non-commutative', () => {
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const xy = OrientationTable.compose(xEntry, yEntry);
      const yx = OrientationTable.compose(yEntry, xEntry);
      expect(xy.faceMap).not.toEqual(yx.faceMap);
    });

    it('compose(a, inverse(a)) === identity', () => {
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const yInv = OrientationTable.inverse(yEntry);
      const result = OrientationTable.compose(yEntry, yInv);
      expect(result.faceMap).toEqual(OrientationTable.IDENTITY.faceMap);
    });
  });

  describe('inverse', () => {
    it('inverse of identity is identity', () => {
      const inv = OrientationTable.inverse(OrientationTable.IDENTITY);
      expect(inv.faceMap).toEqual(OrientationTable.IDENTITY.faceMap);
    });

    it('inverse of y is y\'', () => {
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const inv = OrientationTable.inverse(yEntry);
      expect(inv.faceMap).toEqual({
        U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F',
      });
    });
  });

  describe('findRotationBetween', () => {
    it('finds x rotation from identity to x', () => {
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const result = OrientationTable.findRotationBetween(OrientationTable.IDENTITY, xEntry);
      expect(result).toEqual({ axis: 'x', direction: 1 });
    });

    it('finds y\' rotation from identity to y\'', () => {
      const ypEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F',
      });
      const result = OrientationTable.findRotationBetween(OrientationTable.IDENTITY, ypEntry);
      expect(result).toEqual({ axis: 'y', direction: -1 });
    });

    it('finds z2 rotation from identity to z2', () => {
      const z2Entry = OrientationTable.fromFaceMap({
        U: 'D', D: 'U', F: 'F', B: 'B', L: 'R', R: 'L',
      });
      const result = OrientationTable.findRotationBetween(OrientationTable.IDENTITY, z2Entry);
      expect(result).toEqual({ axis: 'z', direction: 2 });
    });

    it('returns null when orientations differ by more than one base rotation', () => {
      // Pick two orientations that are 2 steps apart
      const xEntry = OrientationTable.fromFaceMap({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      const yEntry = OrientationTable.fromFaceMap({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      const result = OrientationTable.findRotationBetween(xEntry, yEntry);
      expect(result).toBeNull();
    });
  });
});
