"use client";

import { useEffect, useRef } from "react";

/**
 * perfDiag — opt-in main-thread performance diagnostics for the 3D-lag
 * investigation ("timer + cube at once stutters, idle is smooth").
 *
 * Enable with `?perf_debug=1` or `localStorage["cubeforge:perf-debug"] = "1"`.
 * When disabled every function is a near-zero-cost no-op (single cached flag
 * check), so production behavior is untouched.
 *
 * What it records (all in-memory, dumped as copy-pasteable console lines):
 *   - engine tick events (TimerEngine.tick$ → React setState rate)
 *   - React renders per labeled component (who re-renders while running)
 *   - main-thread rAF fps (own sampler: avg fps, worst 1s window, jank frames)
 *   - longtasks (PerformanceObserver, top durations)
 *   - BLE move events, gyro events, orientation-store writes
 *
 * Dump triggers: solve stop (automatic) + `window.__cubeforgePerfDump()`.
 */

const FLAG_KEY = "cubeforge:perf-debug";

let enabledCache: boolean | null = null;

export function isPerfDebugEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  try {
    if (typeof window !== "undefined") {
      const url = new URLSearchParams(window.location.search);
      if (url.get("perf_debug") === "1") {
        enabledCache = true;
        return true;
      }
      if (window.localStorage?.getItem(FLAG_KEY) === "1") {
        enabledCache = true;
        return true;
      }
    }
  } catch {
    /* storage/URL unavailable — stay disabled */
  }
  enabledCache = false;
  return false;
}

/** Test-only escape hatch (vitest has no URL/localStorage flag set). */
export function __setPerfDebugForTests(value: boolean | null): void {
  enabledCache = value;
}

interface RenderStat {
  count: number;
  /** Accumulated render→commit ms (measured render-start to passive effect). */
  totalMs: number;
  maxMs: number;
}

interface LongTask {
  /** Seconds since window start. */
  t: number;
  duration: number;
}

interface Mark {
  t: number;
  label: string;
}

interface FpsWindow {
  start: number;
  frames: number;
}

const stats = {
  startTime: 0,
  ticks: 0,
  moves: 0,
  gyroEvents: 0,
  orientationWrites: 0,
  faceletsEvents: 0,
  renders: new Map<string, RenderStat>(),
  longtasks: [] as LongTask[],
  marks: [] as Mark[],
  // Main-thread rAF sampler state
  fpsStarted: false,
  fpsFrames: 0,
  fpsFirstTs: 0,
  fpsLastTs: 0,
  jankFrames: 0, // gaps > 34ms (≈2 missed frames at 60fps)
  worstGap: 0,
  windows: [] as FpsWindow[],
  currentWindow: null as FpsWindow | null,
};

function ensureStarted(): void {
  if (stats.startTime !== 0) return;
  stats.startTime = performance.now();
  startFpsSampler();
  startLongtaskObserver();
}

let longtaskStarted = false;

function startLongtaskObserver(): void {
  if (longtaskStarted) return;
  longtaskStarted = true;
  try {
    if (typeof PerformanceObserver === "undefined") return;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        stats.longtasks.push({
          t: (performance.now() - stats.startTime) / 1000,
          duration: entry.duration,
        });
        if (stats.longtasks.length > 300) stats.longtasks.shift();
      }
    });
    obs.observe({ entryTypes: ["longtask"] });
  } catch {
    /* longtask unsupported — fps sampler still works */
  }
}

function startFpsSampler(): void {
  if (stats.fpsStarted) return;
  if (typeof requestAnimationFrame === "undefined") return;
  stats.fpsStarted = true;
  let last = performance.now();
  stats.fpsFirstTs = last;
  stats.currentWindow = { start: last, frames: 0 };
  const step = (now: number) => {
    const gap = now - last;
    last = now;
    stats.fpsFrames++;
    stats.fpsLastTs = now;
    if (gap > 34) stats.jankFrames++;
    if (gap > stats.worstGap) stats.worstGap = gap;
    // resetPerfDiag() can null the window mid-flight (IDLE transition) —
    // recreate instead of crashing the sampler.
    let w = stats.currentWindow;
    if (!w) {
      w = { start: now, frames: 0 };
      stats.currentWindow = w;
    }
    w.frames++;
    if (now - w.start >= 1000) {
      stats.windows.push(w);
      if (stats.windows.length > 120) stats.windows.shift();
      stats.currentWindow = { start: now, frames: 0 };
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Engine tick event (one per rAF while inspection/running). */
export function perfTick(): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.ticks++;
}

/** One React render of a labeled component. Call unconditionally at top. */
export function perfRender(label: string): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  const s = stats.renders.get(label);
  if (s) s.count++;
  else stats.renders.set(label, { count: 1, totalMs: 0, maxMs: 0 });
}

/**
 * Render count + render→commit duration for a labeled component. Drop-in
 * replacement for perfRender: call unconditionally at the top of the
 * component body. Duration is measured from render start to the passive
 * effect (covers render + commit for that component's subtree position).
 */
export function usePerfRenderTiming(label: string): void {
  const t0 = useRef(0);
  const on = isPerfDebugEnabled();
  if (on) t0.current = performance.now();
  useEffect(() => {
    if (!on) return;
    const dt = performance.now() - t0.current;
    ensureStarted();
    const s = stats.renders.get(label);
    if (s) {
      s.count++;
      s.totalMs += dt;
      if (dt > s.maxMs) s.maxMs = dt;
    } else {
      stats.renders.set(label, { count: 1, totalMs: dt, maxMs: dt });
    }
  });
}

/** BLE move event received. */
export function perfMove(): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.moves++;
}

/** Gyro event received from hardware. */
export function perfGyro(): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.gyroEvents++;
}

/** orientationStore.setOrientation call (React re-render trigger). */
export function perfOrientationWrite(): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.orientationWrites++;
}

/** Facelets snapshot received (BLE or virtual). */
export function perfFacelets(): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.faceletsEvents++;
}

/** Timestamped phase marker (inspection/running/stopped, preload steps…). */
export function perfMark(label: string): void {
  if (!isPerfDebugEnabled()) return;
  ensureStarted();
  stats.marks.push({
    t: (performance.now() - stats.startTime) / 1000,
    label,
  });
  if (stats.marks.length > 100) stats.marks.shift();
}

/** Reset all counters (e.g. when the engine returns to IDLE). */
export function resetPerfDiag(): void {
  stats.startTime = 0;
  stats.ticks = 0;
  stats.moves = 0;
  stats.gyroEvents = 0;
  stats.orientationWrites = 0;
  stats.faceletsEvents = 0;
  stats.renders.clear();
  stats.longtasks = [];
  stats.marks = [];
  stats.fpsFrames = 0;
  stats.jankFrames = 0;
  stats.worstGap = 0;
  stats.windows = [];
  stats.currentWindow = null;
  // fpsStarted/longtaskStarted stay true: samplers keep running, cheap.
}

/**
 * Print a copy-pasteable summary. Called automatically on solve stop and
 * manually via `window.__cubeforgePerfDump()`.
 */
export function dumpPerfDiag(reason: string): void {
  if (!isPerfDebugEnabled()) return;
  if (stats.startTime === 0) {
    // eslint-disable-next-line no-console
    console.log(`[perfDiag] ${reason}: no samples collected`);
    return;
  }
  const secs = Math.max(0.001, (performance.now() - stats.startTime) / 1000);
  const fpsSecs = Math.max(0.001, (stats.fpsLastTs - stats.fpsFirstTs) / 1000);
  const avgFps = stats.fpsFrames / fpsSecs;
  const worstWindowFps =
    stats.windows.length > 0
      ? Math.min(...stats.windows.map((w) => w.frames))
      : null;
  const sortedLong = [...stats.longtasks].sort((a, b) => b.duration - a.duration);
  const topLong = sortedLong
    .slice(0, 10)
    .map((e) => `${Math.round(e.duration)}ms@${e.t.toFixed(1)}s`);

  // eslint-disable-next-line no-console
  console.log(
    `[perfDiag] ${reason} — window ${secs.toFixed(1)}s | ` +
      `ticks ${stats.ticks} (${(stats.ticks / secs).toFixed(1)}/s) | ` +
      `main-thread ${avgFps.toFixed(1)}fps avg` +
      (worstWindowFps !== null ? `, worst-1s ${worstWindowFps}fps` : "") +
      `, jank-frames(>34ms) ${stats.jankFrames}, worst-gap ${Math.round(stats.worstGap)}ms | ` +
      `longtasks ${stats.longtasks.length}${topLong.length > 0 ? ` top [${topLong.join(" ")}]` : ""} | ` +
      `moves ${stats.moves} facelets ${stats.faceletsEvents} gyro ${stats.gyroEvents} orientation-writes ${stats.orientationWrites}`,
  );
  if (stats.marks.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[perfDiag]   marks: ${stats.marks.map((m) => `${m.label}@${m.t.toFixed(1)}s`).join(" ")}`,
    );
  }
  for (const [label, s] of [...stats.renders.entries()].sort((a, b) => b[1].count - a[1].count)) {
    // eslint-disable-next-line no-console
    console.log(
      `[perfDiag]   render ${label}: ${s.count} (${(s.count / secs).toFixed(1)}/s` +
        (s.totalMs > 0
          ? `, avg ${(s.totalMs / s.count).toFixed(1)}ms max ${s.maxMs.toFixed(1)}ms)`
          : `)`),
    );
  }
}

try {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__cubeforgePerfDump = () =>
      dumpPerfDiag("manual");
  }
} catch {
  /* non-DOM env */
}
