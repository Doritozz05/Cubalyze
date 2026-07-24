"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "zustand";
import { Cube3DEngine, getSkinStyle } from "@cubeforge/cube-3d-engine";
import type { Subscription } from "rxjs";

import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
import { MoveTransformer, compactMoveNotation } from "@cubeforge/math-core";
import type {
  CubeMoveEvent,
  CubeOrientation,
  RotationEvent,
} from "@cubeforge/types";

export interface UseCube3DOptions {
  /** Max number of recent moves to keep. Default 15. */
  maxRecentMoves?: number;
}

export interface UseCube3DResult {
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
  /** Direct ref to the underlying Cube3DEngine instance. */
  engineRef: React.RefObject<Cube3DEngine | null>;
}

/**
 * Isolated, deterministic React hook that manages a 3D Cube rendering engine.
 *
 * Each component invoking this hook gets its OWN independent `Cube3DEngine`
 * instance bound directly to its `<canvas>` element. When the component
 * unmounts, the WebGLRenderer and GPU resources are disposed completely.
 *
 * Supports multiple simultaneous 3D cubes (e.g. sidebar 3D panel + mini drill cube)
 * and dynamic mount/unmount cycles without WebGL context loss or blank screen bugs.
 */
export function useCube3D(options: UseCube3DOptions = {}): UseCube3DResult {
  const { maxRecentMoves = 15 } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Cube3DEngine | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [recentMoves, setRecentMoves] = useState<string[]>([]);

  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);

  // Helper to push move notation to state
  const appendRecentMove = useCallback((notation: string) => {
    setRecentMoves((prev) => {
      const next = compactMoveNotation([...prev, notation]);
      return next.slice(-maxRecentMoves);
    });
  }, [maxRecentMoves]);

  // ── Reactive skin style update ─────────────────────────────────────────
  useEffect(() => {
    if (!engineRef.current) return;
    const style = getSkinStyle(appearance3d);
    engineRef.current.updateStyle(style);
  }, [appearance3d]);

  // ── Main initialization & lifecycle effect ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let movesSub: Subscription | null = null;
    let gyroSub: Subscription | null = null;
    let faceletsSub: Subscription | null = null;
    let connSub: Subscription | null = null;

    const initEngineIfNeeded = (w: number, h: number) => {
      if (engineRef.current || w <= 0 || h <= 0) return;

      const engine = new Cube3DEngine({
        canvas,
        width: w,
        height: h,
        pixelRatio: window.devicePixelRatio || 1,
        gyroSupported: globalCubeAdapter.gyroSupported,
      });

      engineRef.current = engine;

      // Apply current skin style
      const skin = getSkinStyle(preferencesStore.getState().appearance3d);
      engine.updateStyle(skin);

      // Register callbacks to feed orientationStore
      engine.onOrientationChange((o: CubeOrientation) => {
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
      });

      engine.onRotationEvent((e: RotationEvent) => {
        const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
        appendRecentMove(notation);
      });

      // Update orientation store capabilities
      orientationStore.getState().setCapabilities({
        hasIMU: globalCubeAdapter.gyroSupported,
        gyroSupported: globalCubeAdapter.gyroSupported,
      });

      // Bind Bluetooth / Hardware streams
      if (globalCubeAdapter.moves$) {
        movesSub = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
          const orientation = orientationStore.getState().orientation;
          const notation = MoveTransformer.toDisplayNotation(ev, orientation);
          appendRecentMove(notation);
        });
      }

      if (globalCubeAdapter.gyro$) {
        gyroSub = globalCubeAdapter.gyro$.subscribe((q) => {
          engine.updateGyro(q.x, q.y, q.z, q.w);
        });
      }

      if (globalCubeAdapter.facelets$) {
        faceletsSub = globalCubeAdapter.facelets$.subscribe((facelets: string) => {
          engine.syncFacelets(facelets);
        });
      }

      connSub = globalCubeAdapter.connectionStatus$?.subscribe((status) => {
        if (status === "connected") {
          globalCubeAdapter.requestFacelets().catch(console.error);
          engine.calibrateGyro();
        }
      });

      if (globalCubeAdapter.isConnected) {
        globalCubeAdapter.requestFacelets().catch(console.error);
        engine.calibrateGyro();
      }

      setIsReady(true);
    };

    // Initial check on mount
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      initEngineIfNeeded(rect.width, rect.height);
    }

    // ResizeObserver guards against 0x0 container size
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!engineRef.current) {
            initEngineIfNeeded(width, height);
          } else {
            engineRef.current.resize(width, height);
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      movesSub?.unsubscribe();
      gyroSub?.unsubscribe();
      faceletsSub?.unsubscribe();
      connSub?.unsubscribe();

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      setIsReady(false);
    };
  }, [appendRecentMove]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const calibrate = useCallback(() => {
    engineRef.current?.calibrateGyro();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.resetCube();
    setRecentMoves([]);
  }, []);

  const rotateCamera = useCallback((dx: number, dy: number) => {
    engineRef.current?.rotateCamera(dx, dy);
  }, []);

  return {
    canvasRef,
    containerRef,
    isReady,
    recentMoves,
    calibrate,
    reset,
    rotateCamera,
    engineRef,
  };
}
