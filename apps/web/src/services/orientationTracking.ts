/**
 * Headless cube-orientation tracking service.
 *
 * Owns the ONLY tracker that writes to the Zustand `orientationStore`. It
 * consumes the global smart-cube adapter's raw gyro stream directly (Web
 * Bluetooth events — no 3D canvas required), so the cube's physical
 * orientation is tracked for the WHOLE time a smart cube is connected, not
 * only while a 3D panel happens to be open.
 *
 * Why this matters (replay orientation):
 *   - `useSolveSession` snapshots the current orientation for every solve
 *     move; those snapshots become the solve's `orientationTimeline`.
 *   - The ReplayEngine uses that timeline to START the replay in the grip the
 *     solver held at the first move and to rotate the cube on every real
 *     whole-cube rotation.
 *   - Without this service the store stayed identity for real solves (nobody
 *     fed it unless a 3D panel was mounted), so the stats replay never
 *     rotated — while reconstruction replays (which synthesize the timeline
 *     from the written rotation tokens) always did.
 *
 * Coordinate mapping mirrors `Cube3DEngine.updateGyro` (GAN hardware →
 * Three.js Y-up right-handed): `{ x, y: z, z: -y, w }`. The calibration
 * reference is taken from the first AT-REST gyro event after connecting
 * (angular velocity ≈ 0), matching GyroFusion's auto-calibrate semantics —
 * a mid-motion first sample would otherwise rotate the whole reference frame.
 *
 * Known limitation: the tracker accepts a snapped orientation only above a
 * 0.9 confidence, so VERY fast mid-solve rotations can be missed and
 * under-reported in the replay timeline (rotation COUNT via the moves/IMU
 * events is unaffected). Tuning this threshold is a follow-up.
 */

import { OrientationTracker, isGyroAtRest } from "@cubeforge/cube-3d-engine";
import { orientationStore } from "@cubeforge/state";
import type { GyroEvent } from "@cubeforge/types";
import type { Observable, Subscription } from "rxjs";

/** Minimal adapter surface this service needs (structural — GanCubeAdapter satisfies it). */
export interface OrientationTrackingSource {
  connectionStatus$?: Observable<"connecting" | "connected" | "disconnected" | "reconnecting">;
  gyro$?: Observable<GyroEvent>;
}

let tracker: OrientationTracker | null = null;
let gyroSub: Subscription | null = null;
let connSub: Subscription | null = null;
let started = false;

/** Last MAPPED hardware quaternion, kept so calibrate() can capture its reference. */
let lastMappedQuat: { x: number; y: number; z: number; w: number } | null = null;
/** True between connect and the first gyro event — calibrate on that event. */
let pendingAutoCalibrate = false;

/** Map a raw GAN quaternion to the Three.js convention (see Cube3DEngine.updateGyro). */
function mapQuat(q: { x: number; y: number; z: number; w: number }) {
  return { x: q.x, y: q.z, z: -q.y, w: q.w };
}

/**
 * Start the headless tracker for the given adapter (idempotent — call once at
 * app boot). The adapter's subjects are stable and survive disconnect/
 * reconnect, so the subscriptions keep working across BLE reconnects.
 */
export function startOrientationTracking(adapter: OrientationTrackingSource): void {
  if (started) return;
  started = true;

  tracker = new OrientationTracker({ gyroSupported: false });

  tracker.orientation$.subscribe((o) => {
    orientationStore.getState().setOrientation(o);
  });

  connSub =
    adapter.connectionStatus$?.subscribe((status) => {
      if (status === "connected") {
        // Calibrate on the first gyro event after connect (cube at rest).
        pendingAutoCalibrate = true;
      } else if (status === "disconnected") {
        orientationStore.getState().reset();
        pendingAutoCalibrate = false;
        lastMappedQuat = null;
      }
    }) ?? null;

  gyroSub =
    adapter.gyro$?.subscribe((q: GyroEvent) => {
      if (!tracker) return;
      const mapped = mapQuat(q);
      lastMappedQuat = mapped;

      // First gyro event confirms the cube has an IMU — flip the capability on
      // (the store was seeded with defaults until now).
      if (!tracker.capabilitiesInfo.gyroSupported) {
        tracker.enableGyroSupport();
        orientationStore.getState().setCapabilities({ hasIMU: true, gyroSupported: true });
      }

      // Auto-calibrate only when the cube is at rest. The first gyro event
      // after connect can be a mid-motion or wake-up transient sample, and
      // calibrating to it rotates the whole reference frame (an L shows as U,
      // the scramble shifts when the cube rotates). While it's moving we keep
      // waiting for the first still event.
      if (pendingAutoCalibrate && isGyroAtRest(q.velocity)) {
        tracker.setCalibration(mapped);
        pendingAutoCalibrate = false;
        // Publish the ONE calibration reference so the 3D visual (GyroFusion)
        // and every other consumer use the SAME reference instead of
        // capturing their own — otherwise the move labels and the 3D model
        // can calibrate to different poses and diverge.
        orientationStore.getState().setCalibrationQuaternion(mapped);
      }

      tracker.update(mapped);
    }) ?? null;
}

/** Re-reference the tracker to the cube's CURRENT orientation (mirrors the 3D panel Calibrate). */
export function calibrateOrientationTracking(): void {
  if (!tracker) return;
  if (lastMappedQuat) {
    tracker.setCalibration(lastMappedQuat);
    pendingAutoCalibrate = false;
    // Same single-reference rule as auto-calibrate: the visual must follow
    // the tracker's reference so labels and model never diverge.
    orientationStore.getState().setCalibrationQuaternion(lastMappedQuat);
  } else {
    pendingAutoCalibrate = true;
  }
}

/** Stop tracking + reset the store (mainly for tests / teardown). */
export function disposeOrientationTracking(): void {
  gyroSub?.unsubscribe();
  gyroSub = null;
  connSub?.unsubscribe();
  connSub = null;
  tracker?.dispose();
  tracker = null;
  started = false;
  lastMappedQuat = null;
  pendingAutoCalibrate = false;
  orientationStore.getState().reset();
}
