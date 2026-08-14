import { Object3D, Quaternion } from 'three';

/** Monotonic clock in ms — faked in tests to exercise the interpolation. */
function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

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
 * WHY "REBASED INTERPOLATION":
 *
 * The GAN IMU streams orientation at only ~6-7 Hz (~150ms between samples),
 * so the model must bridge each gap without ever teleporting. Three previous
 * approaches failed:
 *
 *   1. EXTRAPOLATION (dead-reckoning): predicted the future from the last
 *      two samples. The target reset to the raw sample at every arrival (a
 *      sawtooth), so the model overshot and REVERSED direction at every
 *      sample boundary — a constant judder ("el cubo salta todo el rato"),
 *      plus a stop-bounce when the cube stopped.
 *   2. INTERPOLATION of the past sample pair played over the real dt: when
 *      the BLE cadence is irregular the model FREEZES between segments and
 *      SPRINTS when a late sample restarts the path — "va a tirones"; a
 *      sparse 180° (x2) rotation played over its real ~150ms as a 20°/frame
 *      blur after a freeze — reads as a teleport.
 *   3. A plain bounded chase (exponential SLERP toward the latest sample):
 *      smooth but the model's velocity still jumps at every sample arrival
 *      (the 6.5 Hz pulsing the user originally complained about).
 *
 * The chosen approach — REBASED INTERPOLATION — gives TRUE constant-velocity
 * motion with zero freezes, zero sprints and zero reversals:
 *
 *   - Every sample arrival starts a constant-velocity segment that goes
 *     from the model's CURRENT pose to the NEW corrected pose, over at least
 *     MIN_DURATION_MS (200ms). Because the segment always starts where the
 *     model already is, the path is continuous by construction: no jump, no
 *     sprint, no freeze, and a sparse x2 (0°→180°) plays at ≤15°/frame — a
 *     normal human-speed rotation, never a blur or teleport.
 *   - The 200ms minimum also bounds the worst-case segment speed
 *     (≤ 180°/200ms = 15°/frame) even for pathological single-packet jumps.
 *   - A per-frame clamp (MAX_DEG_PER_MS) is the final safety net: even when
 *     no segment is playable (first sample, >MAX_GAP_MS silent stretch) the
 *     model catches up at bounded speed — "si hay un salto, animamos el
 *     trayecto aunque sea rápido".
 *   - The model tracks ~200ms behind the physical cube — the accepted
 *     trade-off for zero jumps.
 */
export class GyroFusion {
  private target: Object3D;
  private enabled = false;

  // ── Pre-allocated quaternions (no GC in the render loop) ──
  private rawTargetQuat = new Quaternion();  // latest RAW sample (never overwritten by interpolation)
  private correctedQuat = new Quaternion();  // interpolated pose AFTER calibration offset
  private stepQuat = new Quaternion();       // scratch: model → corrected delta
  private offsetQuatInverse = new Quaternion(); // Q_offset⁻¹ — applied to every incoming quaternion

  private isCalibrated = false;
  private hasReceivedUpdate = false;
  private pendingAutoCalibrate = false;

  // ── Rebased-interpolation state ─────────────────────────────────────────
  private segmentStartQuat = new Quaternion(); // segment start (model's pose at sample arrival)
  private segmentEndQuat = new Quaternion();   // segment end (new corrected pose)
  private segmentStartTime = 0;
  private segmentDurationMs = 0;
  private hasSegment = false;
  private hasPrevSample = false;
  private lastMeasuredAt = 0;

  /**
   * Every segment plays for at least this long, which bounds the worst-case
   * segment speed (≤ 180°/200ms = 15°/frame) and gives a sparse 180° (x2)
   * rotation a human-speed duration instead of a blur.
   */
  private static readonly MIN_DURATION_MS = 200;
  /** Long segments are capped so a slow stream doesn't crawl after the cube. */
  private static readonly MAX_DURATION_MS = 350;
  /**
   * Above this inter-sample gap the interval is stale — the cube may have
   * moved a lot during a silent stretch, so we fall back to direct tracking
   * (the per-frame clamp still animates the catch-up instead of teleporting).
   */
  private static readonly MAX_GAP_MS = 600;
  /**
   * Hard cap on the model's angular speed: 1.2°/ms ≈ 1200°/s ≈ 20°/frame at
   * 60fps. Real turns (≤ ~15°/frame through the rebased segments) are never
   * limited; anomalies (gaps, first sample, calibration changes) are
   * animated at this bounded rate rather than teleported.
   */
  private static readonly MAX_DEG_PER_MS = 1.2;

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

    const now = nowMs();

    if (this.hasPrevSample) {
      const dt = now - this.lastMeasuredAt;
      if (dt <= GyroFusion.MAX_GAP_MS) {
        // REBASE: a constant-velocity segment from where the model IS right
        // now to the new corrected pose. Starting from the model's own pose
        // (not the previous sample) keeps the path continuous no matter how
        // irregular the BLE cadence is — no jumps, no sprints, no freezes.
        this.segmentStartQuat.copy(this.target.quaternion);
        this.correctedQuat
          .copy(this.offsetQuatInverse)
          .multiply(this.rawTargetQuat);
        this.segmentEndQuat.copy(this.correctedQuat);
        this.segmentStartTime = now;
        this.segmentDurationMs = Math.max(
          GyroFusion.MIN_DURATION_MS,
          Math.min(dt, GyroFusion.MAX_DURATION_MS),
        );
        this.hasSegment = true;
      } else {
        // Stale gap: track the latest sample directly (clamped in update()).
        this.hasSegment = false;
      }
    } else {
      // First sample: no previous segment to rebase from — track directly.
      this.hasSegment = false;
    }

    this.lastMeasuredAt = now;
    this.hasPrevSample = true;
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
    // The corrected frame just changed — a stale segment (built in the OLD
    // corrected frame) must not keep playing on top of the new reference.
    this.hasSegment = false;
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
    // The corrected frame just changed: no stale segment may survive it.
    this.hasSegment = false;
    this.hasPrevSample = true;
    this.lastMeasuredAt = nowMs();
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
    this.hasPrevSample = false;
    this.segmentStartQuat.identity();
    this.segmentEndQuat.identity();
    this.hasSegment = false;
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Called every frame in the render loop.
   *
   * Advances the rebased interpolation segment (constant angular velocity)
   * or falls back to the latest corrected sample, then moves the model
   * toward it with a per-frame speed clamp that makes any "jump" (first
   * sample, recovered gap, calibration change) an ANIMATED catch-up instead
   * of a teleport.
   */
  public update(deltaTimeMs: number): void {
    if (!this.enabled || deltaTimeMs <= 0) return;

    if (this.hasSegment) {
      const elapsed = nowMs() - this.segmentStartTime;
      const frac = Math.min(Math.max(elapsed / this.segmentDurationMs, 0), 1);
      // slerp handles q ≡ −q (sign flips) by taking the short path.
      this.correctedQuat.slerpQuaternions(
        this.segmentStartQuat,
        this.segmentEndQuat,
        frac,
      );
    } else {
      // No playable segment: hold/track the latest corrected sample.
      this.correctedQuat
        .copy(this.offsetQuatInverse)
        .multiply(this.rawTargetQuat);
    }

    // Move the model toward the corrected pose, bounded per frame.
    const maxDeg = GyroFusion.MAX_DEG_PER_MS * deltaTimeMs;
    this.stepQuat.copy(this.target.quaternion).conjugate().multiply(this.correctedQuat);
    const half = Math.acos(Math.min(Math.max(this.stepQuat.w, -1), 1));
    const deg = 2 * half * 180 / Math.PI;
    const factor = deg > maxDeg ? maxDeg / deg : 1;
    this.target.quaternion.slerp(this.correctedQuat, factor);
  }
}
