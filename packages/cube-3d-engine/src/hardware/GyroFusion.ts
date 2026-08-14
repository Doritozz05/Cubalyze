import { Object3D, Quaternion, Vector3 } from 'three';

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
 * WHY A CRITICALLY-DAMPED SPRING FOLLOWER:
 *
 * The GAN IMU streams orientation at only ~6-7 Hz (~150ms between samples),
 * so the model must bridge each gap without ever teleporting. Three earlier
 * designs each failed one of the requirements:
 *
 *   1. EXTRAPOLATION (dead-reckoning): predicted the future from the last
 *      two samples. The target reset to the raw sample at every arrival (a
 *      sawtooth), so the model overshot and REVERSED direction at every
 *      sample boundary — a constant judder ("el cubo salta todo el rato"),
 *      plus a stop-bounce when the cube stopped.
 *   2. INTERPOLATION of the past sample pair played over the real dt: on
 *      irregular BLE cadence the model FREEZES between segments and SPRINTS
 *      when a late sample restarts the path — "va a tirones"; a sparse 180°
 *      (x2) rotation played over its real ~150ms as a 20°/frame blur after a
 *      freeze — reads as a teleport.
 *   3. REBASED INTERPOLATION (each sample restarts a constant-velocity
 *      segment from the model's current pose): near-perfect during steady
 *      rotation, but the model's velocity still steps DISCONTINUOUSLY at
 *      every transition — 0 → 15°/frame the instant a turn starts, and an
 *      abrupt stop when the cube stops — the "clunk" at the end of every
 *      rotation.
 *
 * The chosen design is a CRITICALLY-DAMPED SPRING FOLLOWER: the model
 * accelerates toward the latest corrected sample with continuous angular
 * velocity (only ACCELERATION jumps, and it is bounded by ω_n²). This gives
 *
 *   - continuous velocity: no freeze, no sprint, no reversal, no stop-clunk
 *     (a real cube turn also accelerates and decelerates smoothly);
 *   - a sparse x2 animates at ≤ ~1200°/s with a smooth ease-in/ease-out —
 *     human-speed, never a teleport;
 *   - critical damping (ζ = 1) means NO overshoot and NO oscillation — the
 *     model eases into every pose;
 *   - the angular velocity is hard-clamped (MAX_ANGULAR_VEL) so even a
 *     pathological input (missed packet recovered as a huge delta, a first
 *     sample, a calibration re-reference) is ANIMATED — "si hay un salto,
 *     animamos el trayecto aunque sea rápido";
 *   - the model lags ~2·v/ω_n behind a rotation at speed v (~160ms at a
 *     400°/s rotation) — the accepted delay for zero jumps.
 */
export class GyroFusion {
  private target: Object3D;
  private enabled = false;

  // ── Pre-allocated quaternions / vectors (no GC in the render loop) ──
  private rawTargetQuat = new Quaternion();  // latest RAW sample
  private correctedQuat = new Quaternion();  // target pose AFTER calibration offset
  private stepQuat = new Quaternion();       // scratch: model → target error quaternion
  private offsetQuatInverse = new Quaternion(); // Q_offset⁻¹ — applied to every incoming quaternion
  private expQuat = new Quaternion();        // scratch: pose integration step
  private errorVec = new Vector3();          // spring error (model-local rotation vector)
  private accelVec = new Vector3();          // spring acceleration
  private axisVec = new Vector3();           // scratch: rotation axis

  private isCalibrated = false;
  private hasReceivedUpdate = false;
  private pendingAutoCalibrate = false;

  /** Body-frame angular velocity of the model (rad/s) — the spring's state. */
  private angularVel = new Vector3();

  /**
   * Natural frequency (rad/s) of the critically-damped follower. 12 rad/s
   * settles a turn in ~0.3s with ~160ms tracking lag — smooth and
   * responsive without pulsing at the 6.5 Hz sample rate.
   */
  private static readonly OMEGA_N = 12;
  /** Critical damping: no overshoot, no oscillation. */
  private static readonly ZETA = 1;
  /**
   * Hard cap on the model's angular speed: 21 rad/s ≈ 1200°/s ≈ 20°/frame
   * at 60fps. Real rotations are never limited; anomalies (a recovered
   * gap, a first sample, a calibration change) are animated at this
   * bounded rate rather than teleported.
   */
  private static readonly MAX_ANGULAR_VEL = 21;
  /** Spring integration sub-step cap (s) — keeps the semi-implicit Euler stable on frame hitches. */
  private static readonly INTEGRATION_DT_MAX = 0.05;

  /** Optional callback fired when calibration occurs (for OrientationTracker). */
  public onCalibrate?: (q: { x: number; y: number; z: number; w: number }) => void;

  constructor(targetObject: Object3D) {
    this.target = targetObject;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    // Freeze the spring state so a re-enable doesn't resume with stale
    // momentum after the cube has been idle.
    this.enabled = false;
    this.angularVel.set(0, 0, 0);
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
    // The corrected frame just changed — drop any model momentum built in
    // the OLD reference frame.
    this.angularVel.set(0, 0, 0);
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
    // Also seed the raw target with the reference itself so the very next
    // render computes corrected = offset⁻¹ · rawTarget = identity.
    // Without this, adopting the reference BEFORE the first gyro packet
    // (e.g. a panel mounting after the cube is already connected) leaves
    // rawTargetQuat at identity and the model tilted until a fresh packet.
    this.rawTargetQuat.set(q.x, q.y, q.z, q.w).normalize();
    // The corrected frame just changed — drop stale spring momentum.
    this.angularVel.set(0, 0, 0);
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
    this.angularVel.set(0, 0, 0);
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Called every frame in the render loop.
   *
   * Drives the model with a critically-damped spring toward the latest
   * corrected sample. Only the model's ACCELERATION jumps (bounded by
   * ω_n²), so the model's angular velocity is continuous: turns ease in,
   * cruise and ease out — no freeze, no sprint, no reversal, no stop-clunk.
   * The angular velocity is hard-clamped so any "jump" in the input (a
   * recovered gap, a first sample, a calibration change) is ANIMATED at
   * bounded speed instead of teleported.
   */
  public update(deltaTimeMs: number): void {
    if (!this.enabled || deltaTimeMs <= 0) return;

    // Target pose: apply the calibration offset to the latest raw sample.
    this.correctedQuat
      .copy(this.offsetQuatInverse)
      .multiply(this.rawTargetQuat);

    // Integrate with sub-stepping so a frame hitch stays stable. The spring
    // error is recomputed after every pose update (semi-implicit Euler).
    let remaining = deltaTimeMs / 1000;
    while (remaining > 0) {
      const dt = Math.min(remaining, GyroFusion.INTEGRATION_DT_MAX);
      remaining -= dt;

      // Spring error (model-local rotation vector): log(q_model⁻¹ · q_target).
      this.stepQuat.copy(this.target.quaternion).conjugate().multiply(this.correctedQuat);
      const half = Math.acos(Math.min(Math.max(this.stepQuat.w, -1), 1));
      const sinHalf = Math.sin(half);
      const scale = sinHalf > 1e-9 ? (2 * half) / sinHalf : 2;
      this.errorVec.set(
        this.stepQuat.x * scale,
        this.stepQuat.y * scale,
        this.stepQuat.z * scale,
      );

      // Critically-damped spring: a = −2·ζ·ωn·ω − ωn²·e  (ζ = 1).
      this.accelVec
        .copy(this.angularVel)
        .multiplyScalar(-2 * GyroFusion.ZETA * GyroFusion.OMEGA_N);
      this.accelVec.addScaledVector(this.errorVec, GyroFusion.OMEGA_N * GyroFusion.OMEGA_N);
      this.angularVel.addScaledVector(this.accelVec, dt);
      if (this.angularVel.length() > GyroFusion.MAX_ANGULAR_VEL) {
        this.angularVel.setLength(GyroFusion.MAX_ANGULAR_VEL);
      }

      // Pose integration: q ← q ⊗ exp(ω·dt)  (body-frame angular velocity).
      const angle = this.angularVel.length() * dt;
      if (angle > 1e-9) {
        this.axisVec.copy(this.angularVel).normalize();
        this.expQuat.setFromAxisAngle(this.axisVec, angle);
        this.target.quaternion.multiply(this.expQuat);
        this.target.quaternion.normalize();
      }
    }
  }
}
