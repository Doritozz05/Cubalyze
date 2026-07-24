"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "zustand";
import * as Comlink from "comlink";
import { SyncBridge, getSkinStyle } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";
import type { Subscription } from "rxjs";

import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
import { MoveTransformer, compactMoveNotation } from "@cubeforge/math-core";
import type {
  CubeMoveEvent,
  CubeOrientation,
  RotationEvent,
} from "@cubeforge/types";
import {
  getWorkerSingleton,
  setWorkerSingleton,
} from "@/lib/cube3DWorkerSingleton";

// ── Hook options ─────────────────────────────────────────────────────────

export interface UseCube3DWorkerOptions {
  /** Max number of recent moves to keep. Default 15. */
  maxRecentMoves?: number;
}

export interface UseCube3DWorkerResult {
  /** Ref to attach to a <canvas> element. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Ref to attach to the container <div> (for ResizeObserver). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the 3D engine is fully initialized. */
  isReady: boolean;
  /** Display-notation moves + rotation notation (compact). */
  recentMoves: string[];
  /** Calibrate the gyroscope (sets current orientation as white-top / green-front). */
  calibrate: () => void;
  /** Reset cube pieces to solved state. */
  reset: () => void;
  /** Rotate camera view by delta X and delta Y (for orbit controls). */
  rotateCamera: (dx: number, dy: number) => void;
}

/**
 * Shared hook that manages the 3D worker singleton lifecycle.
 *
 * Used by both `Cube3DPanel` (full-size) and `MiniCube3DPanel` (compact).
 * When mounted, it starts the worker, binds to the smart cube's move/gyro
 * streams, wires orientation tracking to the Zustand orientationStore,
 * and syncs the 3D model with the real cube via facelet events.
 *
 * The worker is a module-level singleton shared via
 * `lib/cube3DWorkerSingleton.ts` — it survives Strict Mode remounts
 * and component unmount/remount cycles (e.g. navigating between
 * the timer page and the drill page).
 */
export function useCube3DWorker(
  options: UseCube3DWorkerOptions = {},
): UseCube3DWorkerResult {
  const { maxRecentMoves = 15 } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Internal refs (not exposed)
  const workerProxy = useRef<Comlink.Remote<EngineWorkerAPI> | null>(null);
  const syncBridge = useRef<SyncBridge | null>(null);
  const workerInstance = useRef<Worker | null>(null);
  const moveSub = useRef<Subscription | null>(null);
  const callbacksRegistered = useRef(false);
  const needsInitialSyncRef = useRef(true);

  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);

  const [isReady, setIsReady] = useState(false);
  const [recentMoves, setRecentMoves] = useState<string[]>([]);

  // ── Apply skin style reactively ──────────────────────────────────────
  useEffect(() => {
    if (!workerProxy.current) return;
    const style = getSkinStyle(appearance3d);
    workerProxy.current
      .updateStyle(style)
      .catch((err: unknown) =>
        console.error("[useCube3DWorker] updateStyle failed", err),
      );
  }, [appearance3d]);

  // ── Main init effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    // Reset the initial-sync flag so the first facelet event after
    // mount/remount corrects any desync from the panel being hidden.
    needsInitialSyncRef.current = true;
    moveSub.current?.unsubscribe();

    // ── BLE move → recentMoves (display notation) ─────────────────────
    if (globalCubeAdapter.moves$) {
      moveSub.current = globalCubeAdapter.moves$.subscribe(
        (ev: CubeMoveEvent) => {
          const orientation = orientationStore.getState().orientation;
          const notation = MoveTransformer.toDisplayNotation(ev, orientation);
          appendRecentMove(notation);
        },
      );
    }

    // Helper to push a move/rotation notation into the recent moves list
    function appendRecentMove(notation: string) {
      setRecentMoves((prev) => {
        const next = compactMoveNotation([...prev, notation]);
        return next.slice(-maxRecentMoves);
      });
    }

    const existingSingleton = getWorkerSingleton();

    if (existingSingleton) {
      // ── Re-mount: reconnect canvas rendering to existing worker ──
      workerInstance.current = existingSingleton.worker;
      workerProxy.current = existingSingleton.proxy;
      syncBridge.current = existingSingleton.syncBridge;

      if (canvasRef.current && workerProxy.current) {
        try {
          const offscreen = canvasRef.current.transferControlToOffscreen();
          const width = canvasRef.current.clientWidth || 300;
          const height = canvasRef.current.clientHeight || 300;
          workerProxy.current.reconnect(
            Comlink.transfer(offscreen, [offscreen]),
            width,
            height,
            window.devicePixelRatio,
          );
        } catch {
          // Canvas already transferred for this DOM element (e.g. Strict Mode remount)
        }
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        workerProxy.current?.resize(rect.width, rect.height);
      }

      if (globalCubeAdapter.moves$ && globalCubeAdapter.gyro$) {
        syncBridge.current.bindCube(
          globalCubeAdapter.moves$,
          globalCubeAdapter.gyro$,
        );
      }

      workerProxy.current?.setGyroSupported(globalCubeAdapter.gyroSupported);

      if (!callbacksRegistered.current && workerProxy.current) {
        callbacksRegistered.current = true;
        registerOrientationCallbacks(
          workerProxy.current,
          appendRecentMove,
        );
      }

      orientationStore.getState().setCapabilities({
        hasIMU: globalCubeAdapter.gyroSupported,
        gyroSupported: globalCubeAdapter.gyroSupported,
      });

      const reSkin = getSkinStyle(
        preferencesStore.getState().appearance3d,
      );
      workerProxy.current?.updateStyle(reSkin).catch(console.error);

      setIsReady(true);
    } else {
      // ── First mount: create worker, transfer canvas, init ────────────
      workerInstance.current = new EngineWorker();
      workerProxy.current = Comlink.wrap<EngineWorkerAPI>(
        workerInstance.current!,
      );
      syncBridge.current = new SyncBridge(workerProxy.current);

      try {
        const offscreen = canvasRef.current.transferControlToOffscreen();
        workerProxy.current.init(
          Comlink.transfer(offscreen, [offscreen]),
          canvasRef.current.clientWidth,
          canvasRef.current.clientHeight,
          window.devicePixelRatio,
        );

        if (globalCubeAdapter.moves$ && globalCubeAdapter.gyro$) {
          syncBridge.current.bindCube(
            globalCubeAdapter.moves$,
            globalCubeAdapter.gyro$,
          );
        }

        workerProxy.current.setGyroSupported(globalCubeAdapter.gyroSupported);

        if (!callbacksRegistered.current) {
          callbacksRegistered.current = true;
          registerOrientationCallbacks(
            workerProxy.current,
            appendRecentMove,
          );
        }

        orientationStore.getState().setCapabilities({
          hasIMU: globalCubeAdapter.gyroSupported,
          gyroSupported: globalCubeAdapter.gyroSupported,
        });

        const initSkin = getSkinStyle(
          preferencesStore.getState().appearance3d,
        );
        workerProxy.current.updateStyle(initSkin).catch(console.error);

        setWorkerSingleton({
          worker: workerInstance.current,
          proxy: workerProxy.current,
          syncBridge: syncBridge.current,
        });
        setIsReady(true);
      } catch {
        console.warn(
          "Canvas already transferred — 3D rendering unavailable",
        );
      }
    }

    // ── Facelet subscription ──────────────────────────────────────────
    const faceletSub = globalCubeAdapter.facelets$
      ? globalCubeAdapter.facelets$.subscribe((facelets: string) => {
          if (!syncBridge.current) return;
          if (needsInitialSyncRef.current) {
            needsInitialSyncRef.current = false;
            workerProxy.current
              ?.syncFacelets(facelets)
              .catch(console.error);
            syncBridge.current?.clearPendingMoves();
          } else if (syncBridge.current.pendingMoves === 0) {
            workerProxy.current
              ?.syncFacelets(facelets)
              .catch(console.error);
          }
        })
      : undefined;

    // ── Connection handler: request facelets + calibrate on connect ───
    const connSub = globalCubeAdapter.connectionStatus$?.subscribe(
      (status) => {
        if (status === "connected") {
          globalCubeAdapter.requestFacelets().catch(console.error);
          if (workerProxy.current) {
            workerProxy.current.calibrateGyro();
          }
        }
      },
    );

    if (globalCubeAdapter.isConnected) {
      globalCubeAdapter.requestFacelets().catch(console.error);
      if (workerProxy.current) {
        workerProxy.current.calibrateGyro();
      }
    }

    // ── Resize Observer ───────────────────────────────────────────────
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          workerProxy.current?.resize(width, height);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      moveSub.current?.unsubscribe();
      faceletSub?.unsubscribe();
      connSub?.unsubscribe();
      syncBridge.current?.unbind();
      // DON'T terminate worker — singleton survives for next mount
      // DON'T null out the singleton via setWorkerSingleton
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Control functions ───────────────────────────────────────────────
  const calibrate = useCallback(() => {
    workerProxy.current?.calibrateGyro();
  }, []);

  const reset = useCallback(() => {
    workerProxy.current?.resetCube();
    setRecentMoves([]);
  }, []);

  const rotateCamera = useCallback((dx: number, dy: number) => {
    workerProxy.current?.rotateCamera(dx, dy);
  }, []);

  return {
    canvasRef,
    containerRef,
    isReady,
    recentMoves,
    calibrate,
    reset,
    rotateCamera,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────

/**
 * Register orientation-change and rotation-event callbacks on the worker.
 * These push data into the Zustand orientationStore so every consumer
 * (useOrientation, ScrambleDisplay, SmartCubeSection, etc.) sees current
 * orientation without needing their own worker reference.
 *
 * Callbacks are registered ONCE (worker is a singleton, survives Strict
 * Mode remounts). The `callbacksRegistered` ref guards against duplicates.
 */
function registerOrientationCallbacks(
  proxy: Comlink.Remote<EngineWorkerAPI>,
  onRotation: (notation: string) => void,
): void {
  proxy.onOrientationChange(
    Comlink.proxy((o: CubeOrientation) => {
      orientationStore.getState().setOrientation(o);
      const caps = orientationStore.getState().capabilities;
      if (!caps.gyroSupported) {
        orientationStore.getState().setCapabilities({
          hasIMU: true,
          gyroSupported: true,
        });
      }
      if (!globalCubeAdapter.gyroSupported) {
        globalCubeAdapter.gyroSupported = true;
      }
    }),
  );

  proxy.onRotationEvent(
    Comlink.proxy((e: RotationEvent) => {
      const notation = MoveTransformer.rotationToNotation(
        e.axis,
        e.direction,
      );
      onRotation(notation);
    }),
  );
}
