import { describe, it, expect, beforeEach } from 'vitest';
import { OrientationTracker } from '../hardware/OrientationTracker';
import { OrientationTable, MoveTransformer } from '@cubalyze/math-core';
import type {
  GyroEvent,
  CubeOrientation,
  RotationEvent,
  CubeFace,
  CubeMoveEvent,
  CubeMoveDirection,
  DisplayMove,
} from '@cubalyze/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gyroEvent(q: { x: number; y: number; z: number; w: number }): GyroEvent {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

function rotQuat(axis: 'x' | 'y' | 'z', angleDeg: number): { x: number; y: number; z: number; w: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const s = Math.sin(rad / 2);
  const c = Math.cos(rad / 2);
  const ax = axis === 'x' ? 1 : 0;
  const ay = axis === 'y' ? 1 : 0;
  const az = axis === 'z' ? 1 : 0;
  return { x: ax * s, y: ay * s, z: az * s, w: c };
}

function rawMove(face: string, direction: CubeMoveDirection): CubeMoveEvent {
  return {
    face: face as CubeFace,
    direction,
    cubeTimestamp: 1000,
    hostTimestamp: 2000,
  };
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Orientation Pipeline Integration', () => {
  /**
   * Full pipeline test:
   * 1. Tracker created with gyroSupported=false (simulating pre-HARDWARE state)
   * 2. Gyro support is enabled late (simulating HARDWARE event arrival)
   * 3. Calibration is performed
   * 4. Cube is rotated physically (y rotation)
   * 5. Orientation changes → rotation event emitted
   * 6. Face moves are remapped according to new orientation
   */
  describe('full pipeline: late enable → calibrate → rotate → remap moves', () => {
    let tracker: OrientationTracker;
    let orientations: CubeOrientation[];
    let rotations: RotationEvent[];

    beforeEach(() => {
      // Step 1: Create with gyroSupported=false (mimics pre-HARDWARE state)
      tracker = new OrientationTracker({ gyroSupported: false });
      orientations = [];
      rotations = [];
      tracker.orientation$.subscribe((o) => orientations.push(o));
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));
    });

    it('late enable + calibrate + y rotation → correct faceMap + rotation event + move remapping', () => {
      // Step 2: Enable gyro support (mimics HARDWARE event arriving)
      tracker.enableGyroSupport();
      expect(tracker.capabilitiesInfo.gyroSupported).toBe(true);

      // Gyro events should still be ignored before calibration
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).toBe(0); // still identity — not calibrated yet

      // Step 3: Calibrate (user clicks "Calibrate")
      tracker.setCalibration(IDENTITY);
      expect(tracker.calibrated).toBe(true);

      // Step 4: Rotate cube physically (y rotation)
      tracker.update(gyroEvent(rotQuat('y', -90)));

      // Step 5: Verify orientation and rotation event
      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B',
      });
      expect(orientations).toHaveLength(1);
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('y');
      expect(rotations[0].direction).toBe(1);

      // Step 6: Verify move remapping with the new orientation
      const orientation = orientations[0];

      // After y rotation, raw R should display as F
      const display = MoveTransformer.toDisplay(rawMove('R', 1), orientation);
      expect(display.face).toBe('F');
      expect(display.direction).toBe(1);

      // After y rotation, raw F should display as L
      const display2 = MoveTransformer.toDisplay(rawMove('F', -1), orientation);
      expect(display2.face).toBe('L');
      expect(display2.direction).toBe(-1);

      // After y rotation, raw U should display as U (unchanged)
      const display3 = MoveTransformer.toDisplayNotation(rawMove('U', 2), orientation);
      expect(display3).toBe('U2');
    });

    it('x rotation after late enable → correct remapping', () => {
      tracker.enableGyroSupport();
      tracker.setCalibration(IDENTITY);
      tracker.update(gyroEvent(rotQuat('x', -90)));

      expect(tracker.current.faceMap).toEqual({
        U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R',
      });
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('x');

      const orientation = orientations[0];
      // After x, raw U should display as B
      expect(MoveTransformer.toDisplayNotation(rawMove('U', 1), orientation)).toBe('B');
      // After x, raw F should display as U
      expect(MoveTransformer.toDisplayNotation(rawMove('F', 1), orientation)).toBe('U');
    });

    it('z2 rotation after late enable → correct remapping', () => {
      tracker.enableGyroSupport();
      tracker.setCalibration(IDENTITY);
      tracker.update(gyroEvent(rotQuat('z', 180)));

      expect(tracker.current.faceMap).toEqual({
        U: 'D', D: 'U', F: 'F', B: 'B', L: 'R', R: 'L',
      });
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('z');
      expect(rotations[0].direction).toBe(2);

      const orientation = orientations[0];
      // After z2, raw U should display as D
      expect(MoveTransformer.toDisplayNotation(rawMove('U', 1), orientation)).toBe('D');
      // After z2, raw L should display as R
      expect(MoveTransformer.toDisplayNotation(rawMove('L', 2), orientation)).toBe('R2');
    });
  });

  describe('y2 → back face becomes front', () => {
    it('reproduces the reported bug scenario: Blue(B) at front → turns should show F', () => {
      const tracker = new OrientationTracker({ gyroSupported: false });
      tracker.enableGyroSupport();
      tracker.setCalibration(IDENTITY);

      // Physical rotation: y2 (two right turns → blue/original-B is now front)
      tracker.update(gyroEvent(rotQuat('y', 180)));

      expect(tracker.current.faceMap).toEqual({
        U: 'U', D: 'D', F: 'B', B: 'F', L: 'R', R: 'L',
      });

      const orientation: CubeOrientation = {
        quaternion: { x: tracker.current.quaternion.x, y: tracker.current.quaternion.y, z: tracker.current.quaternion.z, w: tracker.current.quaternion.w },
        faceMap: tracker.current.faceMap,
        label: tracker.current.label,
      };

      // User turns the face that is physically at the front (original Blue/B)
      // Cube sends raw move "B"
      // Display should show "F" because Blue is now at the front position
      const displayNotation = MoveTransformer.toDisplayNotation(rawMove('B', 1), orientation);
      expect(displayNotation).toBe('F');

      // User turns the face that is physically at the right (original Orange/L)
      // Cube sends raw move "L"
      // Display should show "R" because Orange is now at the right position
      const displayNotation2 = MoveTransformer.toDisplayNotation(rawMove('L', -1), orientation);
      expect(displayNotation2).toBe("R'");
    });
  });

  describe('rotation events cover all 9 base rotations', () => {
    // All 9 base rotations should produce the correct rotation events
    const cases: { name: string; axis: 'x' | 'y' | 'z'; angleDeg: number; dir: CubeMoveDirection; expectedFaceMap: Record<string, string> }[] = [
      { name: 'x',  axis: 'x', angleDeg: -90, dir: 1,  expectedFaceMap: { U:'F', D:'B', F:'D', B:'U', L:'L', R:'R' } },
      { name: "x'", axis: 'x', angleDeg: 90, dir: -1,  expectedFaceMap: { U:'B', D:'F', F:'U', B:'D', L:'L', R:'R' } },
      { name: 'x2', axis: 'x', angleDeg: 180, dir: 2,  expectedFaceMap: { U:'D', D:'U', F:'B', B:'F', L:'L', R:'R' } },
      { name: 'y',  axis: 'y', angleDeg: -90, dir: 1,  expectedFaceMap: { U:'U', D:'D', F:'R', B:'L', L:'F', R:'B' } },
      { name: "y'", axis: 'y', angleDeg: 90, dir: -1,  expectedFaceMap: { U:'U', D:'D', F:'L', B:'R', L:'B', R:'F' } },
      { name: 'y2', axis: 'y', angleDeg: 180, dir: 2,  expectedFaceMap: { U:'U', D:'D', F:'B', B:'F', L:'R', R:'L' } },
      { name: 'z',  axis: 'z', angleDeg: -90, dir: 1,  expectedFaceMap: { U:'L', D:'R', F:'F', B:'B', L:'D', R:'U' } },
      { name: "z'", axis: 'z', angleDeg: 90, dir: -1,  expectedFaceMap: { U:'R', D:'L', F:'F', B:'B', L:'U', R:'D' } },
      { name: 'z2', axis: 'z', angleDeg: 180, dir: 2,  expectedFaceMap: { U:'D', D:'U', F:'F', B:'B', L:'R', R:'L' } },
    ];

    for (const { name, axis, angleDeg, dir, expectedFaceMap } of cases) {
      it(`${name} rotation: axis=${axis}, direction=${dir}`, () => {
        const tracker = new OrientationTracker({ gyroSupported: false });
        tracker.enableGyroSupport();
        tracker.setCalibration(IDENTITY);

        const rotations: RotationEvent[] = [];
        tracker.rotationEvents$.subscribe((r) => rotations.push(r));

        tracker.update(gyroEvent(rotQuat(axis, angleDeg)));

        // Verify face map
        expect(tracker.current.faceMap).toEqual(expectedFaceMap);

        // Verify rotation event
        expect(rotations).toHaveLength(1);
        expect(rotations[0].axis).toBe(axis);
        expect(rotations[0].direction).toBe(dir);

        // Verify notation
        const notation = MoveTransformer.rotationToNotation(axis, dir);
        expect(notation).toBe(name);
      });
    }
  });

  describe('sequence of rotations', () => {
    it('y then x: produces correct sequence of rotation events', () => {
      const tracker = new OrientationTracker({ gyroSupported: false });
      tracker.enableGyroSupport();
      tracker.setCalibration(IDENTITY);

      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      // y rotation
      tracker.update(gyroEvent(rotQuat('y', -90)));
      // compose(y, x) — first y then x
      const yxFaceMap = OrientationTable.compose(
        OrientationTable.fromFaceMap({ U:'U', D:'D', F:'R', B:'L', L:'F', R:'B' }),
        OrientationTable.fromFaceMap({ U:'F', D:'B', F:'D', B:'U', L:'L', R:'R' }),
      );
      tracker.update(gyroEvent({
        x: yxFaceMap.quaternion.x,
        y: yxFaceMap.quaternion.y,
        z: yxFaceMap.quaternion.z,
        w: yxFaceMap.quaternion.w,
      }));

      expect(rotations).toHaveLength(2);
      expect(rotations[0].axis).toBe('y');
      expect(rotations[0].direction).toBe(1);
      expect(rotations[1].axis).toBe('x');
      expect(rotations[1].direction).toBe(1);

      // Verify notation strings for UI display
      expect(MoveTransformer.rotationToNotation(rotations[0].axis, rotations[0].direction)).toBe('y');
      expect(MoveTransformer.rotationToNotation(rotations[1].axis, rotations[1].direction)).toBe('x');
    });

    it('y then back to identity: produces y and y\' events', () => {
      const tracker = new OrientationTracker({ gyroSupported: false });
      tracker.enableGyroSupport();
      tracker.setCalibration(IDENTITY);

      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('y', -90))); // → y
      tracker.update(gyroEvent(IDENTITY));            // → identity

      expect(rotations).toHaveLength(2);
      expect(rotations[0].axis).toBe('y');
      expect(rotations[0].direction).toBe(1);
      expect(rotations[1].axis).toBe('y');
      expect(rotations[1].direction).toBe(-1); // y'

      expect(MoveTransformer.rotationToNotation(rotations[0].axis, rotations[0].direction)).toBe('y');
      expect(MoveTransformer.rotationToNotation(rotations[1].axis, rotations[1].direction)).toBe("y'");
    });
  });

  describe('gyroSupported dynamic change', () => {
    it('ignores gyro events until enabled, then processes them', () => {
      const tracker = new OrientationTracker({ gyroSupported: false });
      tracker.setCalibration(IDENTITY);

      // Before enable: no processing
      tracker.update(gyroEvent(rotQuat('y', -90)));
      expect(tracker.current.id).toBe(0);

      // Enable
      tracker.enableGyroSupport();

      // After enable: processes
      const rotations: RotationEvent[] = [];
      tracker.rotationEvents$.subscribe((r) => rotations.push(r));

      tracker.update(gyroEvent(rotQuat('z', -90)));
      expect(tracker.current.faceMap).toEqual({
        U: 'L', D: 'R', F: 'F', B: 'B', L: 'D', R: 'U',
      });
      expect(rotations).toHaveLength(1);
      expect(rotations[0].axis).toBe('z');
    });

    it('preserves calibration across enable (does not reset)', () => {
      const tracker = new OrientationTracker({ gyroSupported: false });
      tracker.setCalibration(rotQuat('x', -90)); // calibrate at x orientation
      expect(tracker.calibrated).toBe(true);

      tracker.enableGyroSupport();
      expect(tracker.calibrated).toBe(true);

      // Sending calibration quaternion should return to identity
      tracker.update(gyroEvent(rotQuat('x', -90)));
      expect(tracker.current.id).toBe(0);
    });
  });
});
