"use client";

import type { Comlink } from "comlink";
import type { SyncBridge, EngineWorkerAPI } from "@cubeforge/cube-3d-engine";

/**
 * Shared 3D worker singleton — THE single source of truth.
 *
 * Both `Cube3DPanel` and `MiniCube3DPanel` (via `useCube3DWorker`)
 * reference this module-level variable. This guarantees only ONE
 * WebGL context / OffscreenCanvas / worker exists at any time,
 * preventing GPU memory leaks when navigating between views.
 */
export interface WorkerSingleton {
  worker: Worker;
  proxy: Comlink.Remote<EngineWorkerAPI>;
  syncBridge: SyncBridge;
}

let _singleton: WorkerSingleton | null = null;

export function getWorkerSingleton(): WorkerSingleton | null {
  return _singleton;
}

export function setWorkerSingleton(s: WorkerSingleton): void {
  _singleton = s;
}
