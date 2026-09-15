import { describe, it, expect, afterEach, vi } from "vitest";
import { BehaviorSubject, Subject } from "rxjs";
import { orientationStore } from "@cubalyze/state";
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

interface FakeGyroEvent {
  x: number;
  y: number;
  z: number;
  w: number;
  velocity?: { x: number; y: number; z: number };
}

function makeFakeAdapter() {
  return {
    connectionStatus$: new BehaviorSubject<
      "connecting" | "connected" | "disconnected" | "reconnecting"
    >("disconnected"),
    gyro$: new Subject<FakeGyroEvent>(),
  };
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const Y_ROTATION = { x: 0, y: 0, z: -0.70710678, w: 0.70710678 };

/** Emit N identical samples — enough to satisfy the settled-window detector. */
function settle(adapter: ReturnType<typeof makeFakeAdapter>, sample = IDENTITY, count = 3) {
  for (let i = 0; i < count; i++) {
    adapter.gyro$.next({ ...sample });
  }
}

describe("orientationTracking (headless)", () => {
  afterEach(() => {
    disposeOrientationTracking();
    vi.useRealTimers();
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

  it("calibrates once the cube is observably settled, then tracks a real rotation", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");

    // A single sample is NOT enough — it could be a wake-up transient.
    adapter.gyro$.next({ ...IDENTITY });
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // Three identical samples = settled → calibrate (identity reference).
    settle(adapter);
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
    // First gyro event also confirms IMU capability.
    expect(orientationStore.getState().capabilities.gyroSupported).toBe(true);

    // A 90° rotation around Y relative to the calibration → snapped to the y
    // orientation (confidence 1.0 — exact table match).
    adapter.gyro$.next({ ...Y_ROTATION });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");
  });

  it("does NOT calibrate on mid-motion samples — waits for the cube to settle", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");

    // Three samples with HIGH velocity and different orientations: not settled.
    adapter.gyro$.next({ x: 0, y: 0, z: 0, w: 1, velocity: { x: 7, y: 0, z: 0 } });
    adapter.gyro$.next({ x: 0, y: 0, z: -0.5, w: 0.866, velocity: { x: 0, y: 7, z: 0 } });
    adapter.gyro$.next({ x: 0, y: 0, z: -0.7071, w: 0.7071, velocity: { x: 0, y: 0, z: 5 } });
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // Now the cube settles on the same orientation with zero velocity.
    adapter.gyro$.next({ x: 0, y: 0, z: -0.7071, w: 0.7071, velocity: { x: 0, y: 0, z: 0 } });
    adapter.gyro$.next({ x: 0, y: 0, z: -0.7071, w: 0.7071, velocity: { x: 0, y: 0, z: 0 } });
    adapter.gyro$.next({ x: 0, y: 0, z: -0.7071, w: 0.7071, velocity: { x: 0, y: 0, z: 0 } });
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();
    // The settled pose becomes identity.
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("falls back to the latest sample after the timeout if the cube never settles", () => {
    vi.useFakeTimers();
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");

    // One sample only (cube went quiet, or keeps moving). No calibration yet.
    adapter.gyro$.next({ ...IDENTITY });
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // Timeout elapses → fallback calibrates to the latest sample.
    vi.advanceTimersByTime(2000);
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("does NOT give up when the cube is silent at connect — re-arms until a sample arrives", () => {
    vi.useFakeTimers();
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");

    // The cube is waking up / not streaming while held still: the watchdog
    // elapses with NO sample. The old one-shot timer silently gave up here,
    // leaving auto-calibration armed but dead — the visual stayed on the raw
    // quaternion until the user pressed Calibrate.
    vi.advanceTimersByTime(2000);
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // A single sample finally arrives (a nudge). It does not settle.
    adapter.gyro$.next({ ...IDENTITY });
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();

    // The re-armed watchdog adopts it on the next tick.
    vi.advanceTimersByTime(2000);
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
  });

  it("resets the store when the cube disconnects", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    settle(adapter);
    adapter.gyro$.next({ ...Y_ROTATION });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");

    adapter.connectionStatus$.next("disconnected");
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");
    expect(orientationStore.getState().capabilities.gyroSupported).toBe(false);
  });

  it("can be disposed and restarted (idempotent teardown)", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    settle(adapter);

    disposeOrientationTracking();
    expect(orientationStore.getState().orientation.label).toBe("F:F U:U R:R");

    // A fresh start (e.g. after HMR / teardown) tracks again.
    const adapter2 = makeFakeAdapter();
    startOrientationTracking(adapter2);
    adapter2.connectionStatus$.next("connected");
    settle(adapter2);
    adapter2.gyro$.next({ ...Y_ROTATION });
    expect(orientationStore.getState().orientation.label).toBe("F:R U:U R:B");
  });

  it("calibrate() re-references the tracker to the current pose", () => {
    const adapter = makeFakeAdapter();
    startOrientationTracking(adapter);
    adapter.connectionStatus$.next("connected");
    settle(adapter); // calib = identity
    adapter.gyro$.next({ ...Y_ROTATION }); // y pose
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

    settle(adapter);
    // Normalize -0 (the mapping produces z = -q.y, which is -0 when y is 0).
    const norm = (q: { x: number; y: number; z: number; w: number }) => ({
      x: q.x || 0, y: q.y || 0, z: q.z || 0, w: q.w || 0,
    });
    expect(norm(orientationStore.getState().calibrationQuaternion!)).toEqual({
      x: 0, y: 0, z: 0, w: 1,
    });

    // Manual calibrate re-references and re-publishes the new reference.
    adapter.gyro$.next({ ...Y_ROTATION }); // y pose
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
    settle(adapter);
    expect(orientationStore.getState().calibrationQuaternion).not.toBeNull();

    adapter.connectionStatus$.next("disconnected");
    expect(orientationStore.getState().calibrationQuaternion).toBeNull();
  });
});
