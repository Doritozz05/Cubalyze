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
 * reference is captured when the cube is OBSERVABLY SETTLED after connect —
 * not from a single possibly-mid-motion sample.
 *
 * Known limitation: the tracker accepts a snapped orientation only above a
 * 0.9 confidence, so VERY fast mid-solve rotations can be missed and
 * under-reported in the replay timeline (rotation COUNT via the moves/IMU
 * events is unaffected). Tuning this threshold is a follow-up.
 */

import { OrientationTracker } from "@cubeforge/cube-3d-engine";
import { orientationStore } from "@cubeforge/state";
import type { GyroEvent } from "@cubeforge/types";
import type { Observable, Subscription } from "rxjs";

/** Minimal adapter surface this service needs (structural — GanCubeAdapter satisfies it). */
export interface OrientationTrackingSource {
  connectionStatus$?: Observable<"connecting" | "connected" | "disconnected" | "reconnecting">;
  gyro$?: Observable<GyroEvent>;
}

type Quat = { x: number; y: number; z: number; w: number };

// ── Diagnostic logging (opt-in) ────────────────────────────────────────────
// `?orientation_debug=1` or `localStorage.cubeforge:orientation-debug = "1"`
// enables the calibration trace so the connect flow can be verified on real
// hardware without touching production consoles.
function orientationDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("orientation_debug")) return true;
    if (window.localStorage.getItem("cubeforge:orientation-debug") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function debugLog(msg: string, ...args: unknown[]): void {
  if (!orientationDebugEnabled()) return;
  // console.log (not console.debug) so it is visible without "Verbose".
  console.log(`%c[Orientation]%c ${msg}`, "color:#22d3ee;font-weight:bold", "color:inherit", ...args);
}

let tracker: OrientationTracker | null = null;
let gyroSub: Subscription | null = null;
let connSub: Subscription | null = null;
let started = false;

/** Last MAPPED hardware quaternion, kept so calibrate() can capture its reference. */
let lastMappedQuat: Quat | null = null;
/** True between connect and calibration — calibrate when the cube settles. */
let pendingAutoCalibrate = false;

// ── Auto-calibration state ──────────────────────────────────────────────────
//
// The reference quaternion MUST be captured while the cube is still in the
// user's grip (white up / green front). The velocity field alone is not a
// reliable "still" signal — it is 4-bit quantised and hand tremor reads
// non-zero even when the cube looks still, which intermittently blocked
// calibration. Quaternion stability is the authoritative signal: if the
// reported orientation is not changing between samples, the cube is not
// turning, no matter what the velocity byte says.
//
// We therefore require a short window of samples that all agree on the
// orientation (quaternion stability) and commit on that. A timer guarantees
// we never stay uncalibrated forever if the cube never settles.
const AUTO_CALIB_SAMPLES = 3;
/** ~14° — tolerates hand tremor, still rejects a real turn between samples. */
const AUTO_CALIB_SETTLED_DOT = 0.97;
/** Fallback: calibrate to the latest sample after this long even if unsettled. */
const AUTO_CALIB_TIMEOUT_MS = 2000;

let pendingCalibSamples: Quat[] = [];
let pendingCalibTimer: ReturnType<typeof setTimeout> | null = null;

/** Map a raw GAN quaternion to the Three.js convention (see Cube3DEngine.updateGyro). */
function mapQuat(q: { x: number; y: number; z: number; w: number }): Quat {
  return { x: q.x, y: q.z, z: -q.y, w: q.w };
}

/** |dot| of two unit quaternions: 1 = same orientation (q ≡ −q). */
function quaternionSimilarity(a: Quat, b: Quat): number {
  return Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
}

/** True when the buffered samples all agree with the most recent one. */
function isSettledWindow(): boolean {
  if (pendingCalibSamples.length < AUTO_CALIB_SAMPLES) return false;
  const last = pendingCalibSamples[pendingCalibSamples.length - 1];
  return pendingCalibSamples.every(
    (s) => quaternionSimilarity(s, last) >= AUTO_CALIB_SETTLED_DOT,
  );
}

function clearCalibTimer(): void {
  if (pendingCalibTimer !== null) {
    clearTimeout(pendingCalibTimer);
    pendingCalibTimer = null;
  }
}

/**
 * Schedule (or re-schedule) the fallback watchdog.
 *
 * Its only job is to guarantee auto-calibration TERMINATES: if the cube
 * never produces a settled window, adopt the latest sample. Crucially it
 * re-arms while NO sample has arrived yet — the cube can take a moment to
 * wake up (or not stream gyro while held perfectly still), and the previous
 * one-shot timer silently gave up here, leaving the visual stuck on the raw
 * quaternion until Calibrate was pressed.
 */
function scheduleCalibWatchdog(): void {
  clearCalibTimer();
  pendingCalibTimer = setTimeout(() => {
    pendingCalibTimer = null;
    if (!pendingAutoCalibrate) return;
    if (lastMappedQuat) {
      debugLog("timeout fallback — adopting latest sample");
      commitCalibration(lastMappedQuat, "timeout");
    } else {
      debugLog("watchdog — no gyro sample yet, keep waiting");
      scheduleCalibWatchdog();
    }
  }, AUTO_CALIB_TIMEOUT_MS);
}

/** Arm auto-calibration: start buffering samples and schedule the fallback. */
function armCalibration(): void {
  pendingAutoCalibrate = true;
  pendingCalibSamples = [];
  debugLog("connect — auto-calibration armed");
  scheduleCalibWatchdog();
}

/** Commit `q` as the single calibration reference (headless tracker + store). */
function commitCalibration(q: Quat, via: "settled" | "timeout" | "manual" = "manual"): void {
  tracker?.setCalibration(q);
  pendingAutoCalibrate = false;
  pendingCalibSamples = [];
  clearCalibTimer();
  debugLog(`calibrated (${via})`, { x: q.x, y: q.y, z: q.z, w: q.w });
  orientationStore.getState().setCalibrationQuaternion(q);
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
        armCalibration();
      } else if (status === "reconnecting") {
        // Drop any pending auto-calibration + watchdog — the fresh "connected"
        // re-arms it. Keep the store orientation (a solve may still be in
        // flight); only the pending calibration state is reset.
        pendingAutoCalibrate = false;
        pendingCalibSamples = [];
        clearCalibTimer();
        lastMappedQuat = null;
      } else if (status === "disconnected") {
        debugLog("disconnect — reset");
        orientationStore.getState().reset();
        pendingAutoCalibrate = false;
        pendingCalibSamples = [];
        clearCalibTimer();
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

      if (pendingAutoCalibrate) {
        // Buffer a small window of samples; calibrate once the cube is
        // observably settled (same orientation for N samples AND at rest).
        pendingCalibSamples.push(mapped);
        if (pendingCalibSamples.length > AUTO_CALIB_SAMPLES) {
          pendingCalibSamples.shift();
        }
        if (isSettledWindow()) {
          commitCalibration(mapped, "settled");
        } else {
          debugLog("sample while pending", {
            samples: pendingCalibSamples.length,
            settled: isSettledWindow(),
            vx: q.velocity?.x,
            vy: q.velocity?.y,
            vz: q.velocity?.z,
          });
        }
      }

      tracker.update(mapped);
    }) ?? null;
}

/** Re-reference the tracker to the cube's CURRENT orientation (mirrors the 3D panel Calibrate). */
export function calibrateOrientationTracking(): void {
  if (!tracker) return;
  if (lastMappedQuat) {
    commitCalibration(lastMappedQuat);
  } else {
    armCalibration();
  }
}

/** Stop tracking + reset the store (mainly for tests / teardown). */
export function disposeOrientationTracking(): void {
  gyroSub?.unsubscribe();
  gyroSub = null;
  connSub?.unsubscribe();
  connSub = null;
  clearCalibTimer();
  tracker?.dispose();
  tracker = null;
  started = false;
  lastMappedQuat = null;
  pendingAutoCalibrate = false;
  pendingCalibSamples = [];
  orientationStore.getState().reset();
}
