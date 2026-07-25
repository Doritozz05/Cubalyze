import { describe, it, expect, beforeEach } from 'vitest';
import { Object3D, Quaternion } from 'three';
import { GyroFusion } from '../hardware/GyroFusion';

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
});
