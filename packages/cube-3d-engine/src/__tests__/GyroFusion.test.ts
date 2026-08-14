import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Object3D, Quaternion } from 'three';
import { GyroFusion, isGyroAtRest } from '../hardware/GyroFusion';

/** Signed rotation (deg) about X that takes a -> b (all tests rotate about X). */
function signedAngleDegX(a: Quaternion, b: Quaternion): number {
  const d = a.clone().conjugate().multiply(b);
  const half = Math.acos(Math.min(Math.max(d.w, -1), 1));
  const s = Math.sin(half);
  if (s < 1e-9) return 0;
  return Math.sign(d.x / s) * 2 * half * 180 / Math.PI;
}

/** Rotation about X by `deg` (mapped axis == raw X axis, so identity mapping). */
function rotX(deg: number): { x: number; y: number; z: number; w: number } {
  const rad = deg * Math.PI / 180;
  return { x: Math.sin(rad / 2), y: 0, z: 0, w: Math.cos(rad / 2) };
}

describe('GyroFusion', () => {
  let target: Object3D;
  let gyro: GyroFusion;

  beforeEach(() => {
    target = new Object3D();
    gyro = new GyroFusion(target);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  // ── Rebased-interpolation behavior ─────────────────────────────────────

  it('moves at constant velocity and never reverses during a 360° turn (the "salta" regression)', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    gyro.enable();

    const deltas: number[] = [];
    let prev = target.quaternion.clone();
    const frame = () => {
      vi.advanceTimersByTime(16);
      gyro.update(16);
      deltas.push(signedAngleDegX(prev, target.quaternion));
      prev = target.quaternion.clone();
    };

    // Rest at identity, then a regular 360° turn: samples 60° apart @150ms.
    gyro.updateTargetQuaternion(0, 0, 0, 1, { x: 0, y: 0, z: 0 });
    for (let i = 0; i < 10; i++) frame();
    for (let deg = 60; deg <= 360; deg += 60) {
      gyro.updateTargetQuaternion(rotX(deg).x, rotX(deg).y, rotX(deg).z, rotX(deg).w, { x: 7, y: 0, z: 0 });
      for (let i = 0; i < 10; i++) frame();
    }
    // Stop (velocity 0) and hold — the old dead-reckoning bounced here.
    gyro.updateTargetQuaternion(0, 0, 0, -1, { x: 0, y: 0, z: 0 });
    for (let i = 0; i < 16; i++) frame();

    // NEVER backward while turning or after stopping.
    const backward = deltas.filter((d) => d < -0.3);
    expect(backward).toEqual([]);

    // Lands exactly on the final pose (360° ≡ identity as -q, same pose).
    const angle = (2 * Math.atan2(target.quaternion.x, target.quaternion.w)) * 180 / Math.PI;
    expect(Math.abs(angle - 360) % 360).toBeLessThan(1);

    // Constant velocity during steady rotation: the per-frame deltas while
    // the cube is turning are all roughly equal (60°/150ms ≈ 6.7°/frame).
    const duringTurn = deltas.filter((d) => d > 1);
    expect(duringTurn.length).toBeGreaterThan(20);
    const max = Math.max(...duringTurn);
    const min = Math.min(...duringTurn);
    // Steady cadence → near-constant velocity; the small spread is the
    // gentle warm-up of the first rebased segment (5.0 → 6.7°/frame).
    expect(max - min).toBeLessThan(6);
  });

  it('animates a sparse 180° (x2) rotation at bounded speed instead of teleporting', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    gyro.enable();

    // The x2 happens entirely between two samples (identity → 180° @150ms).
    gyro.updateTargetQuaternion(0, 0, 0, 1, { x: 0, y: 0, z: 0 });
    vi.advanceTimersByTime(150);
    gyro.updateTargetQuaternion(1, 0, 0, 0, { x: 0, y: 7, z: 0 }); // 180° about X

    let maxFrameDelta = 0;
    let prev = target.quaternion.clone();
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(16);
      gyro.update(16);
      maxFrameDelta = Math.max(maxFrameDelta, Math.abs(signedAngleDegX(prev, target.quaternion)));
      prev = target.quaternion.clone();
    }

    // Bounded: the 180° jump is ANIMATED (≤ ~20°/frame), never a teleport.
    expect(maxFrameDelta).toBeLessThanOrEqual(20.5);
    expect(maxFrameDelta).toBeGreaterThan(5); // and it DOES move (no freeze)

    const angle = (2 * Math.atan2(target.quaternion.x, target.quaternion.w)) * 180 / Math.PI;
    expect(Math.abs(angle - 180)).toBeLessThan(1);
  });

  it('animates a stale gap (huge delta) at bounded speed instead of teleporting', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    gyro.enable();

    // Rest at identity, then 60°, then a >600ms silent gap while the cube
    // turns another 120° (missed packets recovered as one big delta).
    gyro.updateTargetQuaternion(0, 0, 0, 1, { x: 0, y: 0, z: 0 });
    vi.advanceTimersByTime(150);
    gyro.updateTargetQuaternion(0.5, 0, 0, 0.8660254, { x: 0, y: 0, z: 0 });
    vi.advanceTimersByTime(800); // gap → no segment, direct tracking
    gyro.updateTargetQuaternion(1, 0, 0, 0, { x: 0, y: 0, z: 0 }); // 180°

    let maxFrameDelta = 0;
    let prev = target.quaternion.clone();
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(16);
      gyro.update(16);
      maxFrameDelta = Math.max(maxFrameDelta, Math.abs(signedAngleDegX(prev, target.quaternion)));
      prev = target.quaternion.clone();
    }
    expect(maxFrameDelta).toBeLessThanOrEqual(20.5);

    // And it converges to the recovered sample.
    const angle = (2 * Math.atan2(target.quaternion.x, target.quaternion.w)) * 180 / Math.PI;
    expect(Math.abs(angle - 180)).toBeLessThan(1);
  });

  it('does not drift when the cube is still (identical samples)', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    gyro.enable();

    // Two identical samples 150ms apart = the cube is at rest.
    gyro.updateTargetQuaternion(0.5, 0, 0, 0.8660254, { x: 0, y: 0, z: 0 });
    vi.advanceTimersByTime(150);
    gyro.updateTargetQuaternion(0.5, 0, 0, 0.8660254, { x: 0, y: 0, z: 0 });

    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(16);
      gyro.update(16);
    }

    const angle = (2 * Math.atan2(target.quaternion.x, target.quaternion.w)) * 180 / Math.PI;
    // Still → no drift; stays at the measured 60°.
    expect(Math.abs(angle - 60)).toBeLessThan(2);
  });

  it('handles samples >90° apart without throwing (Three.js r185 has no Quaternion.negate)', () => {
    gyro.enable();

    // A fast long rotation: consecutive samples 100° apart → dot < 0.
    expect(() => {
      gyro.updateTargetQuaternion(0, 0, 0, 1, { x: 7, y: 0, z: 0 });
      gyro.updateTargetQuaternion(0.7660444, 0, 0, 0.6427876, { x: 7, y: 0, z: 0 }); // 100° around X
      gyro.update(16);
    }).not.toThrow();
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
