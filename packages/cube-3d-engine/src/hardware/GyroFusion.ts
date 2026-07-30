import { Object3D, Quaternion } from 'three';

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
   * Receives the latest raw quaternion from the hardware gyroscope.
   * Normalizes it as a safety measure against noisy BLE data.
   */
  public updateTargetQuaternion(x: number, y: number, z: number, w: number): void {
    // Specific mapping for GAN 356 i3 and similar cubes:
    // The hardware sends coordinates relative to the cube PCB.
    // To convert to Three.js (Right-Handed, Y-up):
    // 1. Swap Y and Z (to transition from Z-up to Y-up).
    // 2. Invert X (or adjust signs per sensor) to correct perceived inversion
    //    and align physical motion with the camera.
    this.rawTargetQuat.set(x, z, -y, w).normalize();

    this.hasReceivedUpdate = true;

    if (this.pendingAutoCalibrate) {
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
