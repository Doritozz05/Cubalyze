"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "zustand";
import { Cube3DEngine, getSkinStyle } from "@cubeforge/cube-3d-engine";
import type { Subscription } from "rxjs";

import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
import {
  MoveTransformer,
  compactMoveNotation,
  CubeState,
  FaceletStringConverter,
  Cube2x2State,
  Cube2x2FaceletConverter,
} from "@cubeforge/math-core";
import type {
  CubeMoveEvent,
  CubeOrientation,
  RotationEvent,
} from "@cubeforge/types";

export interface UseCube3DOptions {
  /** Max number of recent moves to keep. Default 15. */
  maxRecentMoves?: number;
  /** Cube order: 2 (2×2×2) or 3 (3×3×3). Default 3. */
  order?: number;
  /** Optional active scramble sequence. */
  scramble?: string;
}

export interface UseCube3DResult {
  /** Ref to attach to a <canvas> element. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Ref to attach to the container <div> (for ResizeObserver). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the 3D engine is fully initialized. */
  isReady: boolean;
  /**
   * True when WebGL context creation failed (e.g. browser context limit
   * reached on iOS Safari). The panel should show a graceful fallback
   * instead of an infinite "Initializing 3D Cube..." spinner.
   */
  initFailed: boolean;
  /**
   * True when the global context manager force-evicted this engine's WebGL
   * context after init (browser hit the context limit). Same fallback UI.
   */
  contextEvicted: boolean;
  /** Display-notation moves + rotation notation (compact). */
  recentMoves: string[];
  /** Calibrate the gyroscope (sets current orientation as white-top / green-front). */
  calibrate: () => void;
  /** Reset cube pieces to solved state. */
  reset: () => void;
  /** Apply a scramble string to the 3D cube model (animated when possible). */
  applyScramble: (scrambleString?: string) => void;
  /** Zoom the camera by a wheel-delta-like amount (positive = zoom out). */
  zoomCamera: (delta: number) => void;
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
  const { maxRecentMoves = 15, order = 3 } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Cube3DEngine | null>(null);
  // Prevents the ResizeObserver from hammering initEngineIfNeeded in an infinite
  // loop after a WebGL failure. Reset on unmount so a fresh mount can retry.
  const initFailedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [contextEvicted, setContextEvicted] = useState(false);
  const [recentMoves, setRecentMoves] = useState<string[]>([]);

  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const customStickerColors = useStore(preferencesStore, (s) => s.customStickerColors);

  // Debounced engine resize: ResizeObserver fires on every layout frame during
  // drag-resize; throttling the WebGL viewport re-render keeps the UI smooth.
  const debouncedResize = useDebouncedCallback(
    (width: number, height: number) => {
      engineRef.current?.resize(width, height);
    },
    80,
  );

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
    // Override with custom sticker colors when 'custom' skin is active
    if (appearance3d === 'custom') {
      style.stickerColors = { ...customStickerColors };
    }
    engineRef.current.updateStyle(style);
  }, [appearance3d, customStickerColors]);

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
      if (engineRef.current || initFailedRef.current || w <= 0 || h <= 0) return;

      try {
        const engine = new Cube3DEngine({
          canvas,
          width: w,
          height: h,
          pixelRatio: window.devicePixelRatio || 1,
          gyroSupported: globalCubeAdapter.gyroSupported,
          order,
          // Surface context eviction (iOS Safari context limit) so the panel
          // can show a graceful fallback instead of a frozen canvas.
          onContextEvicted: () => {
            setContextEvicted(true);
            setIsReady(false);
            initFailedRef.current = true;
          },
        });

        // The engine may have been evicted immediately on registration (budget
        // exhausted with no evictable victims). Treat it as init failure and
        // fully dispose so no subscriptions/GPU resources leak.
        if (engine.isContextEvicted()) {
          engine.dispose();
          initFailedRef.current = true;
          setInitFailed(true);
          return;
        }

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
      } catch (err) {
        // WebGL context creation failed (e.g. browser context limit reached).
        // Set initFailedRef so the ResizeObserver stops retrying — the panel
        // shows a graceful "3D unavailable" fallback instead of an infinite
        // 'Initializing 3D Cube...' error loop.
        initFailedRef.current = true;
        setInitFailed(true);
        console.warn("[useCube3D] Failed to initialize WebGL engine:", err);
      }
    };

    // Initial check on mount
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      initEngineIfNeeded(rect.width, rect.height);
    }

    // ResizeObserver guards against tiny or 0x0 container size during collapse.
    // `engine.resize()` is a WebGL viewport re-render — debouncing avoids
    // hammering it during continuous drag-resizes (floating panels, splitters).
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width >= 40 && height >= 40) {
          if (!engineRef.current) {
            initEngineIfNeeded(width, height);
          } else {
            debouncedResize(width, height);
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      debouncedResize.cancel();
      movesSub?.unsubscribe();
      gyroSub?.unsubscribe();
      faceletsSub?.unsubscribe();
      connSub?.unsubscribe();

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      // Reset so the next mount (e.g. re-opening the panel) can try again.
      initFailedRef.current = false;
      setIsReady(false);
      setInitFailed(false);
      setContextEvicted(false);
    };
  }, [appendRecentMove, order, debouncedResize]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const calibrate = useCallback(() => {
    engineRef.current?.calibrateGyro();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.resetCube();
    setRecentMoves([]);
  }, []);

  const applyScramble = useCallback(async (scrambleString?: string) => {
    const targetScramble = scrambleString || options.scramble;
    if (!engineRef.current || !targetScramble || !targetScramble.trim()) return;

    const engine = engineRef.current;
    const trimmed = targetScramble.trim();

    // Preferred path: play the scramble as animated moves (adaptive duration
    // per angle) for a premium feel. Falls back to instant facelet sync when
    // the scramble has unsupported tokens (wide moves, rotations) or errors.
    try {
      const animated = await engine.applyScrambleAnimated(trimmed);
      if (animated) {
        setRecentMoves([]);
        return;
      }
    } catch (e) {
      console.warn("[useCube3D] Animated scramble failed, falling back:", e);
    }

    try {
      if (order === 2) {
        const state = new Cube2x2State();
        state.applySequence(trimmed);
        const facelets = Cube2x2FaceletConverter.toFaceletString(state);
        engine.syncFacelets(facelets);
      } else {
        const state = new CubeState();
        state.applySequence(trimmed);
        const facelets = FaceletStringConverter.toFaceletString(state);
        engine.syncFacelets(facelets);
      }
      setRecentMoves([]);
    } catch (e) {
      console.warn("[useCube3D] Error applying scramble to 3D cube:", e);
    }
  }, [order, options.scramble]);

  const rotateCamera = useCallback((dx: number, dy: number) => {
    engineRef.current?.rotateCamera(dx, dy);
  }, []);

  const zoomCamera = useCallback((delta: number) => {
    engineRef.current?.zoomCamera(delta);
  }, []);

  return {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    recentMoves,
    calibrate,
    reset,
    applyScramble,
    rotateCamera,
    zoomCamera,
    engineRef,
  };
}
