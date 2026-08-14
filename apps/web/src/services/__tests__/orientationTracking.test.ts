import { describe, it, expect, afterEach } from "vitest";
import { BehaviorSubject, Subject } from "rxjs";
import { orientationStore } from "@cubeforge/state";
import {
  startOrientationTracking,
  disposeOrientationTracking,
  calibrateOrientationTracking,
} from "../orientationTracking";

/**
 * Headless orientation tracking — feeds the orientationStore from the raw
 * gyro stream with NO 3D panel mounted. This is what makes real smart-cube
 * solves carry an orientationTimeline (and therefore the replay's starting
 * grip + mid-solve rotations).
 *
 * Quaternions are in the GAN hardware convention; the service maps them to
 * the Three.js convention ({x, y: z, z: -y, w}) exactly like
 * Cube3DEngine.updateGyro:
 *   - identity:        raw {0, 0, 0, 1}      → mapped {0, 0, 0, 1}
 *   - 90° around Y:    raw {0, 0, -0.7071, 0.7071} → mapped {0, -0.7071, 0, 0.7071}
 */

function makeFakeAdapter() {
  return {
    connectionStatus$: new BehaviorSubject<
      "connecting" | "connected" | "disconnected" | "reconnecting"
    >("disconnected"),
    gyro$: new Subject<{ x: number; y: number; z: number; w: number }>(),
  };
}

describe("orientationTracking (headless)", () => {
  afterEach(() => {
    disposeOrientationTracking();
  });

  it("stays identity until a cube connects and streams gyro data", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);

    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
    expect(orientationStore.getState().capabilities.gyroSupported).toBe(false);

    adapter.connectionStatus$.next("connected");
    // Connected but no gyro event yet → still identity, capabilities off.
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("calibrates on the first gyro event and tracks a real rotation", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");

    // First event: becomes the calibration reference (cube at rest) → identity.
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
    // First gyro event also confirms IMU capability.
    expect(orientationStore.getState().capabilities.gyroSupported).toBe(true);

    // A 90° rotation around Y relative to the calibration → snapped to the y
    // orientation (confidence 1.0 — exact table match).
    adapter.gyro$.next({ x: 0, y: 0, z: -0.70710678, w: 0.70710678 });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");
  });

  it("resets the store when the cube disconnects", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });
    adapter.gyro$.next({ x: 0, y: 0, z: -0.70710678, w: 0.70710678 });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");

    adapter.connectionStatus$.next("disconnected");
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
    expect(orientationStore.getState().capabilities.gyroSupported).toBe(false);
  });

  it("can be disposed and restarted (idempotent teardown)", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });

    disposeOrientationTracking();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");

    // A fresh start (e.g. after HMR / teardown) tracks again.
    const adapter2 = makeFakeAdapter();
    startOrientationTracking(adapter2);
    adapter2.connectionStatus$.next("connected");
    adapter2.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });
    adapter2.gyro$.next({ x: 0, y: 0, z: -0.70710678, w: 0.70710678 });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");
  });

  it("calibrate() re-references the tracker to the current pose", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 }); // calib = identity
    adapter.gyro$.next({ x: 0, y: 0, z: -0.70710678, w: 0.70710678 }); // y pose
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");

    // Re-reference to the current pose → the y pose becomes identity.
    calibrateOrientationTracking();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("publishes the single calibration reference to the store on auto-calibrate", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // First at-rest sample becomes the reference AND is published (mapped
    // convention) so the 3D visual adopts the SAME reference.
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });
    // Normalize -0 (the mapping produces z = -q.y, which is -0 when y is 0).
    const norm = (q: { x: number; y: number; z: number; w: number }) => ({
      x: q.x || 0, y: q.y || 0, z: q.z || 0, w: q.w || 0,
    });
    expect(norm(orientationStore.getState().calibrationQuaternion!)).toEqual({
      x: 0, y: 0, z: 0, w: 1,
    });

    // Manual calibrate re-references and re-publishes the new reference.
    adapter.gyro$.next({ x: 0, y: 0, z: -0.70710678, w: 0.70710678 }); // y pose
    calibrateOrientationTracking();
    expect(norm(orientationStore.getState().calibrationQuaternion!)).toEqual({
      x: 0, y: -0.70710678, z: 0, w: 0.70710678,
    });
    // Re-referenced: the y pose is now identity.
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("clears the calibration reference on disconnect", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1 });
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();

    adapter.connectionStatus$.next("disconnected");
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();
  });
});
