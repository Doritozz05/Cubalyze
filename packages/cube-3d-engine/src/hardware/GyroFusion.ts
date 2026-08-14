import { Object3D, Quaternion } from 'three';

/**
 * Angular-velocity magnitude below which the cube is considered at rest.
 * The GAN IMU reports a 4-bit quantized velocity per axis (−7..7): 0 means
 * still, ±7 means a fast turn. Auto-calibration must only capture the
 * reference quaternion at rest — the first gyro event after connect can be a
 * mid-motion or wake-up transient, and calibrating to it rotates the whole
 * reference frame (an L displays as U, the scramble shifts on rotation).
 *
 * A single axis at ±1 is tolerated as sensor noise; `undefined` (hardware
 * that doesn't report velocity) is treated as at-rest so the legacy
 * calibrate-on-first-event behavior is preserved.
 */
export function isGyroAtRest(
  velocity: { x: number; y: number; z: number } | undefined,
  threshold = 1,
): boolean {
  if (!velocity) return true;
  return (
    Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z) <=
    threshold
  );
}

/**
 * Smoothly fuses hardware gyroscope/IMU quaternion data with the 3D scene.
 *
 * Key features:
 * - SLERP low-pass filter to smooth Bluetooth polling jitter (~20-50Hz → 60fps)
 * - Tare/calibrate function to define the "zero" orientation
 * - Time-independent interpolation factor
 */
export class GyroFusion {
  private target: Object3D;
  private enabled = false;

  // ── Pre-allocated quaternions (no GC in the render loop) ──
  private rawTargetQuat = new Quaternion();
  private correctedQuat = new Quaternion();
  private offsetQuatInverse = new Quaternion(); // Q_offset⁻¹ — applied to every incoming quaternion

  private isCalibrated = false;
  private hasReceivedUpdate = false;
  private pendingAutoCalibrate = false;

  /** Optional callback fired when calibration occurs (for OrientationTracker). */
  public onCalibrate?: (q: { x: number; y: number; z: number; w: number }) => void;

  constructor(targetObject: Object3D) {
    this.target = targetObject;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  /**
   * True while the gyro is actively driving the scene orientation.
   * Lets the render loop know whether to keep rendering or pause (dirty-flag).
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Receives the latest raw quaternion from the hardware gyroscope.
   * Normalizes it as a safety measure against noisy BLE data.
   */
  public updateTargetQuaternion(
    x: number,
    y: number,
    z: number,
    w: number,
    velocity?: { x: number; y: number; z: number },
  ): void {
    // Specific mapping for GAN 356 i3 and similar cubes:
    // The hardware sends coordinates relative to the cube PCB.
    // To convert to Three.js (Right-Handed, Y-up):
    // 1. Swap Y and Z (to transition from Z-up to Y-up).
    // 2. Invert X (or adjust signs per sensor) to correct perceived inversion
    //    and align physical motion with the camera.
    this.rawTargetQuat.set(x, z, -y, w).normalize();

    this.hasReceivedUpdate = true;

    // Auto-calibrate only when the cube is at rest: the reference must be a
    // settled orientation, not a mid-motion snapshot. While the cube is
    // moving we keep waiting for the first still event.
    if (this.pendingAutoCalibrate && isGyroAtRest(velocity)) {
      this.calibrate();
    }
  }

  /**
   * Calibrate / "Tare" the gyroscope.
   *
   * Captures the current raw hardware quaternion as the reference "zero"
   * orientation. All subsequent updates will be relative to this position,
   * so the 3D model matches the user's current hand position.
   *
   * Mathematical basis:
   *   Q_corrected = Q_offset⁻¹ * Q_raw
   *
   * When Q_raw == Q_offset (i.e. the cube hasn't moved since calibration),
   * Q_corrected = identity, meaning the 3D model sits at its default view.
   *
   * The inverse of a unit quaternion is its conjugate:
   *   Q⁻¹ = (x, y, z, w)⁻¹ = (-x, -y, -z, w)
   */
  public calibrate(): void {
    this.isCalibrated = true;
    if (!this.hasReceivedUpdate) {
      this.pendingAutoCalibrate = true;
      return;
    }
    this.pendingAutoCalibrate = false;
    // Store the inverse of the current raw quaternion
    this.offsetQuatInverse.copy(this.rawTargetQuat).conjugate();
    // Notify the OrientationTracker with the current raw quaternion
    this.onCalibrate?.({
      x: this.rawTargetQuat.x,
      y: this.rawTargetQuat.y,
      z: this.rawTargetQuat.z,
      w: this.rawTargetQuat.w,
    });
  }

  /**
   * Apply an EXTERNAL calibration reference (the headless tracker's).
   *
   * The headless orientation service owns calibration (first at-rest sample
   * after connect, or the manual Calibrate button). Every mounted GyroFusion
   * must adopt the SAME reference quaternion so the 3D model and the move
   * labels never calibrate to different poses. `q` is in the MAPPED Three.js
   * convention (already converted from raw hardware), identical to what
   * `updateTargetQuaternion` receives.
   */
  public setCalibrationQuaternion(q: { x: number; y: number; z: number; w: number }): void {
    // Store the inverse (conjugate) of the reference; a unit quaternion's
    // inverse is its conjugate. Matches OrientationTracker.setCalibration.
    this.offsetQuatInverse.set(-q.x, -q.y, -q.z, q.w).normalize();
    this.isCalibrated = true;
    this.pendingAutoCalibrate = false;
    this.hasReceivedUpdate = true;
    this.onCalibrate?.(q);
  }

  /**
   * Resets calibration so raw quaternions are applied directly.
   */
  public resetCalibration(): void {
    this.offsetQuatInverse.identity();
    this.isCalibrated = false;
    this.hasReceivedUpdate = false;
    this.pendingAutoCalibrate = false;
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Called every frame in the render loop.
   *
   * Applies the calibration offset, then smoothly interpolates (SLERP)
   * the 3D object towards the corrected hardware quaternion.
   *
   * The SLERP factor of 0.15 at 60fps provides a good balance between
   * responsiveness and smoothness. For more precise time-based scaling:
   *   factor = 1 - e^(-speed * deltaTimeMs / 1000)
   */
  public update(deltaTimeMs: number): void {
    if (!this.enabled) return;

    // Apply calibration offset: Q_corrected = Q_offset⁻¹ * Q_raw
    // If not calibrated, offsetQuatInverse is identity, so this is a no-op multiply.
    this.correctedQuat
      .copy(this.offsetQuatInverse)
      .multiply(this.rawTargetQuat);

    // Exponential smoothing for time-independent interpolation
    const speed = 10.0; // Higher = more responsive, lower = smoother
    const factor = 1.0 - Math.exp(-speed * deltaTimeMs / 1000.0);

    this.target.quaternion.slerp(this.correctedQuat, factor);
  }
}
