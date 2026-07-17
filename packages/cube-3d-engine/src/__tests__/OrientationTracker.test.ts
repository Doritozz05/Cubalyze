import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable } from '@cubeforge/math-core';
import type { GyroEvent, CubeOrientation, RotationEvent, FacePermutation } from '@cubeforge/types';

// Helpers

function gyroEvent(q: { x: number; y: number; z: number; w: number }): GyroEvent {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// Quaternion for a rotation about an axis (degrees)
function rotQuat(axis: 'x' | 'y' | 'z', angleDeg: number): { x: number; y: number; z: number; w: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const s = Math.sin(rad / 2);
  const c = Math.cos(rad / 2);
  const ax = axis === 'x' ? 1 : 0;
  const ay = axis === 'y' ? 1 : 0;
  const az = axis === 'z' ? 1 : 0;
  return { x: ax * s, y: ay * s, z: az * s, w: c };
}

// Quaternion multiplication: result = a * b (a applied first, then b)
function qMul(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

// Inverse (conjugate) of a unit quaternion
function qInv(q: { x: number; y: number; z: number; w: number }) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

describe('OrientationTracker', () => {
  let tracker: OrientationTracker;

  beforeEach(() => {
    tracker = new OrientationTracker({ gyroSupported: true });
  });

  describe('no IMU fallback', () => {
    it('stays at identity when gyroSupported is false', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      t.setCalibration(IDENTITY);
      t.update(gyroEvent(rotQuat('y', -90)));
      expect(t.current.id).toBe(0); // identity
    });

    it('capabilities report hasIMU=false when gyroSupported=false', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      expect(t.capabilitiesInfo.hasIMU).toBe(false);
      expect(t.capabilitiesInfo.gyroSupported).toBe(false);
    });

    it('capabilities report hasIMU=true when gyroSupported=true', () => {
      expect(tracker.capabilitiesInfo.hasIMU).toBe(true);
      expect(tracker.capabilitiesInfo.gyroSupported).toBe(true);
    });
  });

  describe('before calibration', () => {
    it('does not process gyro events before calibration', () => {
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).toBe(0); // still identity
    });

    it('calibrated is false before calibration', () => {
      expect(tracker.calibrated).toBe(false);
    });
  });

  describe('after calibration', () => {
    beforeEach(() => {
      tracker.setCalibration(IDENTITY);
    });

    it('calibrated becomes true', () => {
      expect(tracker.calibrated).toBe(true);
    });

    it('identity gyro event keeps identity orientation', () => {
      tracker.update(gyroEvent(IDENTITY));
      expect(tracker.current.id).toBe(0);
    });

    it('y rotation detected: orientation changes and rotation event emitted', () => {
      const orientations: CubeOrientation[] = [];
      const rotations: RotationEvent[] = [];
      tracker.orientation$.subscribe((o) => orientations.push(o));
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('y', -90)));

      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      expect(orientations).toHaveLength(1);
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('y');
      expect(rotations[0].direction).toBe(1); // CW
    });

    it('x rotation detected', () => {
      tracker.update(gyroEvent(rotQuat('x', -90)));
      expect(tracker.current.faceMap).toEqual({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
    });

    it("z' rotation detected", () => {
      tracker.update(gyroEvent(rotQuat('z', 90)));
      expect(tracker.current.faceMap).toEqual({
        U: 'R', D: 'L', F: 'F', B: 'B', L: 'U', R: 'D',
      });
    });

    it('y2 rotation detected with direction=2', () => {
      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('y', 180)));

      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'B', B: 'F', L: 'R', R: 'L',
      });
      expect(rotations).toHaveLength(1);
      expect(rotations[0].direction).toBe(2);
    });

    it('mid-rotation (70°) holds current orientation (no change)', () => {
      // First move to y
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });

      const orientations: CubeOrientation[] = [];
      tracker.orientation$.subscribe((o) => orientations.push(o));

      // Now send a 70° rotation (mid-rotation, low confidence)
      // 70° from y(-90°) is 20° away → |dot| = cos(10°) ≈ 0.985 vs y,
      // BUT 70° from identity(0°) is 70° away → |dot| = cos(35°) ≈ 0.819 < 0.9
      // The snap finds the CLOSEST reference; 70° is equidistant between
      // y and y' on the y-axis circle. With the canonical quaternion fix,
      // |dot| to y = cos(10°) ≈ 0.985 → snaps to y. BUT the q_raw from
      // rotQuat('y',-70) after calibration: q_rel = q_cal⁻¹ · q_raw,
      // and |dot(q_rel, q_y)| = cos(|-70-(-90)|/2) = cos(10°) ≈ 0.985 > 0.9.
      // So this DOES snap to y. We need a quaternion that's far enough from
      // ALL 24 orientations. A composite rotation (not aligned with any axis)
      // works: e.g. 45° about y combined with 30° about z.
      const qy45 = rotQuat('y', -45);
      const qz30 = rotQuat('z', 30);
      const ambiguous = qMul(qz30, qy45);
      tracker.update(gyroEvent(ambiguous));

      // Should hold at y (no new orientation emitted)
      expect(orientations).toHaveLength(0);
      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
    });

    it('sequence: y then z emits two rotation events', () => {
      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      // First: y rotation
      tracker.update(gyroEvent(rotQuat('y', -90)));

      // Second: compose(y, z) orientation.
      // IMPORTANT: The Hamilton product q_z * q_y does NOT represent the same
      // rotation as composeFaceMap(y, z). Quaternion multiplication and face-map
      // composition use different group action conventions. We must use the
      // canonical quaternion from the OrientationTable for the target face map.
      const yzFaceMap: FacePermutation = { U: 'L', D: 'R', F: 'U', B: 'D', L: 'F', R: 'B' };
      const yzEntry = OrientationTable.fromFaceMap(yzFaceMap);
      tracker.update(gyroEvent({
        x: yzEntry.quaternion.x,
        y: yzEntry.quaternion.y,
        z: yzEntry.quaternion.z,
        w: yzEntry.quaternion.w,
      }));

      expect(rotations).toHaveLength(2);
      expect(rotations[0].axis).toBe('y');
      expect(rotations[0].direction).toBe(1); // CW
      expect(rotations[1].axis).toBe('z');
      expect(rotations[1].direction).toBe(1); // CW
    });

    it('sequence: y then y back to identity emits y\' rotation', () => {
      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('y', -90))); // → y
      tracker.update(gyroEvent(IDENTITY)); // → identity

      expect(rotations).toHaveLength(2);
      expect(rotations[1].axis).toBe('y');
      expect(rotations[1].direction).toBe(-1); // CCW (y')
    });

    it('handles quaternion sign flip (q vs -q)', () => {
      const q = rotQuat('y', -90);
      tracker.update(gyroEvent({ x: -q.x, y: -q.y, z: -q.z, w: -q.w }));
      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
    });

    it('handles non-normalized quaternion', () => {
      const q = rotQuat('x', -90);
      const scale = 3.0;
      tracker.update(gyroEvent({ x: q.x * scale, y: q.y * scale, z: q.z * scale, w: q.w * scale }));
      expect(tracker.current.faceMap).toEqual({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
    });

    it('garbage data (near-zero quaternion) is ignored', () => {
      tracker.update(gyroEvent({ x: 0, y: 0, z: 0, w: 0.0001 }));
      expect(tracker.current.id).toBe(0); // unchanged
    });
  });

  describe('calibration with non-identity reference', () => {
    it('calibration at y orientation: subsequent identity gyro → identity orientation', () => {
      // Calibrate at the y orientation
      const calQuat = rotQuat('y', -90);
      tracker.setCalibration(calQuat);

      // Now send the same quaternion → relative is identity → should be identity
      tracker.update(gyroEvent(calQuat));
      expect(tracker.current.id).toBe(0);
    });

    it('calibration at y, then rotate back to identity → y\' orientation', () => {
      const calQuat = rotQuat('y', -90);
      tracker.setCalibration(calQuat);

      // q_rel = q_cal⁻¹ * q_raw = q_cal⁻¹ * identity = q_cal⁻¹ = y'
      tracker.update(gyroEvent(IDENTITY));
      // y' faceMap: F:L, B:R, L:B, R:F
      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F',
      });
    });
  });

  describe('reset', () => {
    it('reset returns to identity and clears calibration', () => {
      tracker.setCalibration(IDENTITY);
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).not.toBe(0);

      tracker.reset();
      expect(tracker.current.id).toBe(0);
      expect(tracker.calibrated).toBe(false);

      // Gyro events should be ignored after reset
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).toBe(0);
    });
  });

  describe('dispose', () => {
    it('dispose stops processing and completes observables', () => {
      tracker.setCalibration(IDENTITY);
      let completed = false;
      tracker.orientation$.subscribe({ complete: () => { completed = true; } });

      tracker.dispose();
      expect(completed).toBe(true);

      // Updates after dispose are ignored
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).toBe(0);
    });
  });

  describe('enableGyroSupport (late hardware detection)', () => {
    it('allows processing gyro events after being enabled post-construction', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      t.setCalibration(IDENTITY);

      // Should ignore gyro events before enable
      t.update(gyroEvent(rotQuat('y', -90)));
      expect(t.current.id).toBe(0); // still identity

      // Enable gyro support
      t.enableGyroSupport();
      expect(t.capabilitiesInfo.gyroSupported).toBe(true);
      expect(t.capabilitiesInfo.hasIMU).toBe(true);

      // Now should process gyro events
      t.update(gyroEvent(rotQuat('y', -90)));
      expect(t.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
    });

    it('preserves calibration state when enabling gyro', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      t.setCalibration(rotQuat('y', -90));
      expect(t.calibrated).toBe(true);

      // Enable gyro
      t.enableGyroSupport();

      // Calibration should still be valid
      expect(t.calibrated).toBe(true);

      // Send the calibration quaternion → should snap to identity
      t.update(gyroEvent(rotQuat('y', -90)));
      expect(t.current.id).toBe(0);
    });

    it('is idempotent (safe to call multiple times)', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      t.enableGyroSupport();
      t.enableGyroSupport(); // second call
      expect(t.capabilitiesInfo.gyroSupported).toBe(true);
    });

    it('emits orientation and rotation events after late enable', () => {
      const t = new OrientationTracker({ gyroSupported: false });
      t.setCalibration(IDENTITY);

      const orientations: CubeOrientation[] = [];
      const rotations: RotationEvent[] = [];
      t.orientation$.subscribe((o) => orientations.push(o));
      t.rotationEvents$.subscribe((r) => rotations.push(r));

      // Enable late
      t.enableGyroSupport();

      // Now rotate
      t.update(gyroEvent(rotQuat('x', -90)));

      expect(orientations).toHaveLength(1);
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('x');
      expect(rotations[0].direction).toBe(1);
    });
  });

  describe('rapid orientation changes', () => {
    it('handles multiple rapid changes', () => {
      tracker.setCalibration(IDENTITY);
      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('y', -90))); // y
      tracker.update(gyroEvent(rotQuat('y', 180))); // y2 (from y, +180° about y)
      tracker.update(gyroEvent(IDENTITY)); // back to identity

      expect(rotations.length).toBeGreaterThanOrEqual(2);
      expect(tracker.current.id).toBe(0); // back to identity
    });
  });
});
