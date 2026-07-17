import { Subject, type Observable } from 'rxjs';
import type { GyroEvent } from '@cubeforge/types';
import type {
  CubeOrientation,
  OrientationCapabilities,
  RotationEvent,
} from '@cubeforge/types';
import { OrientationTable, type OrientationEntry } from '@cubeforge/math-core';

/**
 * Tracks the cube's current physical orientation by fusing IMU quaternion
 * data from the hardware gyroscope.
 *
 * Key design:
 * - Snaps the observed quaternion to the nearest of 24 discrete cube
 *   orientations (the rotation group of the cube). This is deterministic,
 *   not heuristic — no drift accumulation.
 * - Emits orientation changes and rotation events (x/y/z) for analysis.
 * - If no IMU is available, stays at identity orientation (zero behavior
 *   change vs. the current system).
 * - Calibration sets the reference frame: all subsequent quaternions are
 *   relative to the calibration orientation.
 *
 * See: docs/02-architecture/Dynamic_Notation_Orientation_System.md §4.2 Module 4
 */
export class OrientationTracker {
  // ── Configuration ──
  private readonly confidenceThreshold: number;
  private readonly capabilities: OrientationCapabilities;

  // ── State ──
  private _current: OrientationEntry;
  private calibrationQuatInverse: { x: number; y: number; z: number; w: number } | null = null;
  private isCalibrated = false;
  private disposed = false;

  // ── Observables ──
  private readonly orientationSubject = new Subject<CubeOrientation>();
  private readonly rotationEventSubject = new Subject<RotationEvent>();

  readonly orientation$: Observable<CubeOrientation> = this.orientationSubject.asObservable();
  readonly rotationEvents$: Observable<RotationEvent> = this.rotationEventSubject.asObservable();

  constructor(options: {
    gyroSupported: boolean;
    confidenceThreshold?: number;
  }) {
    this.capabilities = {
      hasIMU: options.gyroSupported,
      gyroSupported: options.gyroSupported,
    };
    this.confidenceThreshold = options.confidenceThreshold ?? 0.9;
    this._current = OrientationTable.IDENTITY;
  }

  /** The current orientation entry (read-only). */
  get current(): OrientationEntry {
    return this._current;
  }

  /** Hardware capability flags. */
  get capabilitiesInfo(): OrientationCapabilities {
    return this.capabilities;
  }

  /** Whether the tracker has been calibrated. */
  get calibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Set the calibration reference frame. The provided quaternion becomes
   * the "zero" orientation — all subsequent updates are relative to it.
   *
   * Mathematical basis:
   *   q_relative = q_cal⁻¹ · q_raw
   *
   * When q_raw == q_cal (cube hasn't moved since calibration),
   * q_relative = identity → snaps to identity orientation.
   */
  setCalibration(q: { x: number; y: number; z: number; w: number }): void {
    // Store the inverse of the calibration quaternion.
    // For a unit quaternion, the inverse is the conjugate: (-x, -y, -z, w).
    this.calibrationQuatInverse = {
      x: -q.x,
      y: -q.y,
      z: -q.z,
      w: q.w,
    };
    this.isCalibrated = true;
    // Reset to identity orientation (calibration means "we're at zero")
    if (this._current !== OrientationTable.IDENTITY) {
      const prev = this._current;
      this._current = OrientationTable.IDENTITY;
      this.emitOrientationChange(prev, this._current);
    }
  }

  /**
   * Process a gyro event from the hardware. Snaps the (calibrated) quaternion
   * to the nearest of 24 orientations and emits events if the orientation
   * changed.
   */
  update(gyro: GyroEvent): void {
    if (this.disposed || !this.capabilities.gyroSupported || !this.isCalibrated) return;

    // Compute the relative quaternion: q_rel = q_cal⁻¹ · q_raw
    const qRel = this.calibrationQuatInverse
      ? OrientationTracker.quaternionMultiply(this.calibrationQuatInverse, gyro)
      : gyro;

    // Normalize as a safety measure against noisy BLE data
    const len = Math.sqrt(qRel.x * qRel.x + qRel.y * qRel.y + qRel.z * qRel.z + qRel.w * qRel.w);
    if (len < 0.0001) return; // garbage data, skip
    const normalized = {
      x: qRel.x / len,
      y: qRel.y / len,
      z: qRel.z / len,
      w: qRel.w / len,
    };

    // Snap to nearest of 24 orientations
    const { entry, confidence } = OrientationTable.snap(normalized);

    // Only accept if confidence is high enough (cube is settled at an orientation)
    if (confidence < this.confidenceThreshold) return;

    // Check if orientation changed
    if (entry.id !== this._current.id) {
      const prev = this._current;
      this._current = entry;
      this.emitOrientationChange(prev, entry);
    }
  }

  /** Reset to identity orientation (e.g. on disconnect). */
  reset(): void {
    this.calibrationQuatInverse = null;
    this.isCalibrated = false;
    if (this._current !== OrientationTable.IDENTITY) {
      const prev = this._current;
      this._current = OrientationTable.IDENTITY;
      this.emitOrientationChange(prev, this._current);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.orientationSubject.complete();
    this.rotationEventSubject.complete();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private emitOrientationChange(from: OrientationEntry, to: OrientationEntry): void {
    // Emit the new orientation
    this.orientationSubject.next({
      quaternion: { x: to.quaternion.x, y: to.quaternion.y, z: to.quaternion.z, w: to.quaternion.w },
      faceMap: to.faceMap,
      label: to.label,
    });

    // Emit a rotation event if we can find the base rotation between from and to
    const rotation = OrientationTable.findRotationBetween(from, to);
    if (rotation) {
      this.rotationEventSubject.next({
        axis: rotation.axis,
        direction: rotation.direction,
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        fromOrientation: {
          quaternion: { x: from.quaternion.x, y: from.quaternion.y, z: from.quaternion.z, w: from.quaternion.w },
          faceMap: from.faceMap,
          label: from.label,
        },
        toOrientation: {
          quaternion: { x: to.quaternion.x, y: to.quaternion.y, z: to.quaternion.z, w: to.quaternion.w },
          faceMap: to.faceMap,
          label: to.label,
        },
      });
    }
  }

  /**
   * Hamilton quaternion multiplication: result = a * b
   * (a applied first, then b — standard rotation composition)
   */
  private static quaternionMultiply(
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
}
