"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "zustand";
import {
  Cube3DEngine,
  createPuzzle3DEngine,
  FACE_ROTATION_MAP,
  getSkinStyle,
  scrambleMoveDurationMs,
  type Puzzle3DSpec,
  type PyraminxEngine as PyraminxEngineT,
} from "@cubalyze/cube-3d-engine";
import type { Subscription } from "rxjs";

import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { calibrateOrientationTracking } from "@/services/orientationTracking";
import { orientationStore, preferencesStore } from "@cubalyze/state";
import {
  MoveTransformer,
  compactMoveNotation,
  CubeState,
  FaceletStringConverter,
  Cube2x2State,
  Cube2x2FaceletConverter,
} from "@cubalyze/math-core";
import type { CubeMoveEvent, RotationEvent } from "@cubalyze/types";

export interface UseCube3DOptions {
  /** Max number of recent moves to keep. Default 15. */
  maxRecentMoves?: number;
  /** Cube order: 2 (2×2×2) or 3 (3×3×3). Default 3. */
  order?: number;
  /**
   * Puzzle to build via the puzzle registry (multi-puzzle terrain). When
   * provided it wins over `order`; when absent the legacy order path runs
   * (identical behavior to before). Only kinds with a registered builder are
   * constructible (nxn-cube today — others throw a clear error).
   */
  puzzle?: Puzzle3DSpec;
  /** Optional active scramble sequence. */
  scramble?: string;
  /**
   * Whether to connect this 3D engine instance to live physical Smart Cube hardware
   * events (Bluetooth move animations, gyro orientation tracking, facelet sync).
   *
   * ONLY designated live 3D cube panels (e.g. Cube3DPanel, MiniCube3DPanel) should set this
   * to true. Replay views, algorithm DB case diagrams, drill previews, etc. must remain false.
   * Default: false.
   */
  connectSmartCube?: boolean;
  /**
   * Whether to sync raw static physical cube facelets via Bluetooth into the 3D model.
   * Default: true (when connectSmartCube is true). Set to false for virtual training modes (like Infinite F2L)
   * where gyro and move events are tracked, but the virtual cube manages its own generated piece state.
   */
  syncFacelets?: boolean;
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
  /** Apply a scramble string to the 3D cube model (animated when possible; `durationMs: 0` applies instantly). */
  applyScramble: (scrambleString?: string, durationMs?: number) => Promise<void>;
  /** Zoom the camera by a wheel-delta-like amount (positive = zoom out). */
  zoomCamera: (delta: number) => void;
  /** Rotate camera view by delta X and delta Y (for orbit controls). */
  rotateCamera: (dx: number, dy: number) => void;
  /** Reset camera view angle (smooth optional). */
  resetCameraView: (smooth?: boolean) => void;
  /** Set isometric viewing angle (smooth optional, custom distance radius optional). */
  setIsometricView: (smooth?: boolean, radius?: number) => void;
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
  const { maxRecentMoves = 15, order = 3, connectSmartCube = false, syncFacelets = true, puzzle } = options;

  /**
   * Whether this instance builds the Pyraminx family. The Pyraminx engine has
   * its own move API (rotateVertex / applyMove), its own move-event hook for
   * the moves strip, and no smart-cube hardware path — every cube-specific
   * call below branches on this flag. Only Cube3DPanel passes `puzzle` today,
   * so the cube consumers of engineRef never see a Pyraminx.
   */
  const isPyraminx = puzzle?.kind === "pyraminx";

  /**
   * STABLE key for the init effect. Callers pass `puzzle` specs as inline
   * object literals (`{ kind: "pyraminx" }`), so the spec REFERENCE changes
   * on every render of the host — using it directly as an effect dep would
   * dispose and recreate the WebGL engine on every keystroke/tick (moves
   * would appear to "not work" — only the turn sound plays). The key is a
   * primitive derived from every field that can change the built engine, so
   * the effect only re-runs when the puzzle ACTUALLY changes.
   */
  const puzzleKey = puzzle
    ? puzzle.kind === "nxn-cube"
      ? `nxn-cube:${puzzle.order}`
      : puzzle.kind
    : null;

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
    let calibSub: (() => void) | null = null;

    const initEngineIfNeeded = (w: number, h: number) => {
      if (engineRef.current || initFailedRef.current || w <= 0 || h <= 0) return;

      try {
        const onContextEvicted = () => {
          setContextEvicted(true);
          setIsReady(false);
          initFailedRef.current = true;
        };

        // Puzzle-registry path (multi-puzzle terrain): a spec makes the
        // registry build the right engine for the kind (nxn-cube wraps the
        // very same Cube3DEngine with the spec's order; pyraminx builds a
        // PyraminxEngine). Otherwise the legacy order path runs — identical
        // to the previous behavior. The registry returns the common
        // `Puzzle3DEngine` surface; cube-specific calls below branch on
        // `isPyraminx` and route to each engine's own API.
        const engine = puzzle
          ? (createPuzzle3DEngine(puzzle, {
              canvas,
              width: w,
              height: h,
              pixelRatio: window.devicePixelRatio || 1,
              gyroSupported: connectSmartCube ? globalCubeAdapter.gyroSupported : false,
              onContextEvicted,
            }) as Cube3DEngine)
          : new Cube3DEngine({
              canvas,
              width: w,
              height: h,
              pixelRatio: window.devicePixelRatio || 1,
              gyroSupported: connectSmartCube ? globalCubeAdapter.gyroSupported : false,
              order,
              onContextEvicted,
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

        // Recent-moves strip: the cube fires RotationEvents; the Pyraminx has
        // its own committed-turn hook with WCA tokens (U, U', l, …).
        if (isPyraminx) {
          (engine as unknown as PyraminxEngineT).onMoveEvent((notation) => {
            appendRecentMove(notation);
          });
        } else {
          engine.onRotationEvent((e: RotationEvent) => {
            const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
            appendRecentMove(notation);
          });
        }

        // Bind Bluetooth / Hardware streams ONLY when explicitly connected to
        // Smart Cube — and only for the cube family (the Pyraminx has no
        // smart-cube hardware path today).
        if (connectSmartCube && !isPyraminx) {
          // NOTE: the cube's PHYSICAL orientation is tracked headlessly by
          // services/orientationTracking (started in CubeConnector) — it is
          // the single writer of orientationStore, so it works even with no
          // panel mounted. This panel only drives the visual (GyroFusion)
          // and records rotation events for the moves strip.

          if (globalCubeAdapter.moves$) {
            movesSub = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
              const orientation = orientationStore.getState().orientation;
              const notation = MoveTransformer.toDisplayNotation(ev, orientation);
              appendRecentMove(notation);

              // Animate the physical move on the 3D cube so the model follows
              // the real cube in near-real-time. Fire-and-forget on purpose.
              const mapping = FACE_ROTATION_MAP[ev.face];
              if (mapping) {
                const angle = ev.direction * mapping.angleSign * 90;
                void engine.rotateLayers(
                  mapping.axis,
                  [mapping.layerValue],
                  angle,
                  scrambleMoveDurationMs(angle, 130),
                  undefined,
                  "smooth",
                );
              }
            });
          }

          if (globalCubeAdapter.gyro$) {
            gyroSub = globalCubeAdapter.gyro$.subscribe((q) => {
              engine.updateGyro(q.x, q.y, q.z, q.w, q.velocity);
            });
          }

          if (syncFacelets) {
            if (globalCubeAdapter.facelets$) {
              faceletsSub = globalCubeAdapter.facelets$.subscribe((facelets: string) => {
                engine.syncFacelets(facelets);
              });
            }

            connSub = globalCubeAdapter.connectionStatus$?.subscribe((status) => {
              if (status === "connected") {
                globalCubeAdapter.requestFacelets().catch(console.error);
              }
            });

            if (globalCubeAdapter.isConnected) {
              globalCubeAdapter.requestFacelets().catch(console.error);
            }
          }

          // ── Single calibration authority ──────────────────────────────
          // The headless orientation service (services/orientationTracking)
          // owns calibration: it publishes the settled reference to the
          // store. This engine must adopt THAT reference — NOT capture its
          // own on connect (which could be a mid-motion or differently-posed
          // sample and would diverge from the move labels). Manual Calibrate
          // re-runs both (calibrateOrientationTracking re-publishes, and
          // calibrateGyro below re-captures from the same latest sample).
          //
          // Only re-adopt when a NEW reference is published. The vanilla
          // store subscribe fires on EVERY state change (orientation,
          // capabilities…), so re-applying on each tick would reset the
          // visual + engine tracker to identity mid-solve.
          let lastCalibRef: { x: number; y: number; z: number; w: number } | null = null;
          const adoptCalibration = (q: { x: number; y: number; z: number; w: number }) => {
            if (q !== lastCalibRef) {
              lastCalibRef = q;
              engine.setGyroCalibration(q);
            }
          };
          calibSub = orientationStore.subscribe((state) => {
            if (state.calibrationQuaternion) {
              adoptCalibration(state.calibrationQuaternion);
            }
          });
          const existingCalib = orientationStore.getState().calibrationQuaternion;
          if (existingCalib) {
            adoptCalibration(existingCalib);
          }
        }

        setIsReady(true);
      } catch (err) {
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
      calibSub?.();
      calibSub = null;

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
    // puzzleKey is the STABLE change proxy for puzzle/isPyraminx: callers
    // pass inline puzzle specs, so the object identity churns on every render
    // and listing `puzzle`/`isPyraminx` here would tear down and re-init the
    // WebGL engine each render. syncFacelets is a mount-time option (init only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendRecentMove, order, puzzleKey, debouncedResize, connectSmartCube]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const calibrate = useCallback(() => {
    // Re-reference the visual (GyroFusion) AND the headless tracker that
    // feeds the store, so the replay / dynamic notation shares the same
    // calibration reference as the on-screen cube. The Pyraminx has no gyro
    // path — calibration is a cube/smart-cube concern.
    if (isPyraminx) return;
    engineRef.current?.calibrateGyro();
    calibrateOrientationTracking();
  }, [isPyraminx]);

  const reset = useCallback(() => {
    if (isPyraminx) {
      (engineRef.current as unknown as PyraminxEngineT | null)?.reset();
    } else {
      engineRef.current?.resetCube();
    }
    setRecentMoves([]);
  }, [isPyraminx]);

  const applyScramble = useCallback(async (scrambleString?: string, durationMs?: number) => {
    const targetScramble = scrambleString || options.scramble;
    if (!engineRef.current || !targetScramble || !targetScramble.trim()) return;

    const engine = engineRef.current;
    const trimmed = targetScramble.trim();

    // Preferred path: play the scramble as animated moves (adaptive duration
    // per angle) for a premium feel. Falls back to instant facelet sync when
    // the scramble has unsupported tokens (wide moves, rotations) or errors.
    // durationMs 0 (displays) skips the animation entirely.
    if ((durationMs ?? 0) > 0) {
      try {
        const animated = isPyraminx
          ? await (engine as unknown as PyraminxEngineT).applyScrambleAnimated(trimmed, durationMs)
          : await engine.applyScrambleAnimated(trimmed, durationMs);
        if (animated) {
          setRecentMoves([]);
          return;
        }
      } catch (e) {
        console.warn("[useCube3D] Animated scramble failed, falling back:", e);
      }
    }

    // The Pyraminx has no facelet encoding — its applyMove path is the only
    // one, so instant application walks the tokens directly.
    if (isPyraminx) {
      const pyraminx = engine as unknown as PyraminxEngineT;
      pyraminx.reset();
      for (const token of trimmed.split(/\s+/).filter(Boolean)) {
        await pyraminx.applyMove(token, 0);
      }
      setRecentMoves([]);
      return;
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
  }, [order, options.scramble, isPyraminx]);

  const rotateCamera = useCallback((dx: number, dy: number) => {
    engineRef.current?.rotateCamera(dx, dy);
  }, []);

  const resetCameraView = useCallback((smooth = true) => {
    engineRef.current?.resetCamera(smooth);
  }, []);

  const setIsometricView = useCallback((smooth = true, radius?: number) => {
    engineRef.current?.setIsometricView(smooth, radius);
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
    resetCameraView,
    setIsometricView,
    zoomCamera,
    engineRef,
  };
}
