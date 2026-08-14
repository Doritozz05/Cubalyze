import { describe, it, expect, beforeEach } from 'vitest';
import { Object3D, Quaternion } from 'three';
import { GyroFusion, isGyroAtRest } from '../hardware/GyroFusion';

describe('GyroFusion', () => {
  let target: Object3D;
  let gyro: GyroFusion;

  beforeEach(() => {
    target = new Object3D();
    gyro = new GyroFusion(target);
  });

  it('initializes with identity quaternion on target', () => {
    expect(target.quaternion.x).toBe(0);
    expect(target.quaternion.y).toBe(0);
    expect(target.quaternion.z).toBe(0);
    expect(target.quaternion.w).toBe(1);
  });

  it('apply quaternion mapping (x, z, -y) to raw input (x, y, z, w)', () => {
    gyro.enable();
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5);
    gyro.update(16); // one frame at 60fps

    // rawTargetQuat should have been set to (0.5, 0.5, -0.5, 0.5) normalized
    // After SLERP with identity, target quaternion should be close to rawTargetQuat
    const q = target.quaternion;
    expect(q.x).not.toBe(0);
    expect(q.z).not.toBe(0);
    // Y should be positive because raw y=0.5 maps to z=0.5
    expect(Math.abs(q.y)).toBeGreaterThan(0);
  });

  it('calibrate sets offset and corrected quaternion becomes identity at same orientation', () => {
    gyro.enable();
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5);
    gyro.calibrate();

    // After calibration, calling updateTargetQuaternion again with the same values
    // should result in the identity quaternion (since Q_offset = Q_raw, Q_corrected = Q_offset^-1 * Q_raw = identity)
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5);
    gyro.update(16);

    const q = target.quaternion;
    // Should be close to identity after calibration
    expect(Math.abs(q.w)).toBeGreaterThan(0.9);
    expect(Math.abs(q.x)).toBeLessThan(0.1);
  });

  it('resetCalibration removes offset', () => {
    gyro.enable();
    gyro.updateTargetQuaternion(1, 0, 0, 0);
    gyro.calibrate();
    gyro.resetCalibration();

    expect(gyro.getIsCalibrated()).toBe(false);
  });

  it('disable prevents quaternion updates', () => {
    gyro.enable();
    gyro.updateTargetQuaternion(1, 0, 0, 0);
    gyro.update(16);
    const qBefore = target.quaternion.clone();

    gyro.disable();
    gyro.updateTargetQuaternion(0, 1, 0, 0);
    gyro.update(16);

    // Target should not have changed
    expect(target.quaternion.equals(qBefore)).toBe(true);
  });

  it('getIsCalibrated returns correct state', () => {
    expect(gyro.getIsCalibrated()).toBe(false);
    gyro.calibrate();
    expect(gyro.getIsCalibrated()).toBe(true);
    gyro.resetCalibration();
    expect(gyro.getIsCalibrated()).toBe(false);
  });

  it('calibrates automatically to the first incoming hardware packet when calibrate() is called beforehand', () => {
    gyro.enable();
    // Calibrate BEFORE any hardware packet arrives
    gyro.calibrate();

    // First hardware packet arrives
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5);
    gyro.update(100);

    // Target should remain close to identity (Green face front) because it auto-calibrated to this packet
    const q = target.quaternion;
    expect(Math.abs(q.w)).toBeGreaterThan(0.9);
    expect(Math.abs(q.x)).toBeLessThan(0.1);
  });

  it('auto-calibrates only at rest: skips a moving packet, captures the still one', () => {
    gyro.enable();
    let calibrated: { x: number; y: number; z: number; w: number } | null = null;
    gyro.onCalibrate = (q) => { calibrated = q; };
    // Calibrate BEFORE any packet → auto-calibrate armed
    gyro.calibrate();

    // A moving packet must NOT be captured as the reference
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5, { x: 7, y: 0, z: 0 });
    expect(calibrated).toBeNull();

    // The first still packet IS captured as the reference
    gyro.updateTargetQuaternion(0.5, 0.5, 0.5, 0.5, { x: 0, y: 0, z: 0 });
    expect(calibrated).not.toBeNull();
  });

  it('adopts an external calibration reference via setCalibrationQuaternion', () => {
    gyro.enable();
    let notified: { x: number; y: number; z: number; w: number } | null = null;
    gyro.onCalibrate = (q) => { notified = q; };

    // Reference = 90° around Y (MAPPED Three.js convention: y=+0.7071).
    gyro.setCalibrationQuaternion({ x: 0, y: 0.70710678, z: 0, w: 0.70710678 });
    expect(gyro.getIsCalibrated()).toBe(true);
    expect(notified).toEqual({ x: 0, y: 0.70710678, z: 0, w: 0.70710678 });

    // Feeding back the SAME physical orientation (raw {0,0,0.7071,0.7071}
    // maps to that reference) → corrected quaternion is identity.
    gyro.updateTargetQuaternion(0, 0, 0.70710678, 0.70710678);
    gyro.update(100);
    expect(Math.abs(target.quaternion.w)).toBeGreaterThan(0.9);
    expect(Math.abs(target.quaternion.x)).toBeLessThan(0.1);
    expect(Math.abs(target.quaternion.y)).toBeLessThan(0.1);
    expect(Math.abs(target.quaternion.z)).toBeLessThan(0.1);
  });

  it('setCalibrationQuaternion alone lands on identity (no fresh packet needed)', () => {
    gyro.enable();
    // Adopt the external reference BEFORE any updateTargetQuaternion — the
    // panel-mounted-after-connect case. The model must not slerp toward
    // conjugate(q); it must sit at identity immediately.
    gyro.setCalibrationQuaternion({ x: 0, y: 0.70710678, z: 0, w: 0.70710678 });
    gyro.update(100);

    expect(Math.abs(target.quaternion.w)).toBeGreaterThan(0.9);
    expect(Math.abs(target.quaternion.x)).toBeLessThan(0.1);
    expect(Math.abs(target.quaternion.y)).toBeLessThan(0.1);
    expect(Math.abs(target.quaternion.z)).toBeLessThan(0.1);
  });
});

describe('isGyroAtRest', () => {
  it('classifies rest vs motion from the quantized velocity', () => {
    expect(isGyroAtRest(undefined)).toBe(true);
    expect(isGyroAtRest({ x: 0, y: 0, z: 0 })).toBe(true);
    // A single ±1 tick is sensor noise, still "at rest"
    expect(isGyroAtRest({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(isGyroAtRest({ x: 0, y: -1, z: 0 })).toBe(true);
    // Any real turn (magnitude > 1, or two moving axes) is motion
    expect(isGyroAtRest({ x: 2, y: 0, z: 0 })).toBe(false);
    expect(isGyroAtRest({ x: 1, y: 1, z: 0 })).toBe(false);
    expect(isGyroAtRest({ x: 0, y: 0, z: 7 })).toBe(false);
  });
});
