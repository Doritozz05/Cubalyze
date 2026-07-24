"use client";

import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import { useStore } from "zustand";
import { SyncBridge, getSkinStyle } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";
import type { Subscription } from "rxjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
import { MoveTransformer, compactMoveNotation } from "@cubeforge/math-core";
import type { CubeMoveEvent, CubeOrientation, RotationEvent } from "@cubeforge/types";
import {
  getWorkerSingleton,
  setWorkerSingleton,
} from "@/lib/cube3DWorkerSingleton";

export interface Cube3DPanelProps {
  className?: string;
  onClose?: () => void;
}

export function Cube3DPanel({ className, onClose }: Cube3DPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const workerProxy = useRef<Comlink.Remote<EngineWorkerAPI> | null>(null);
  const syncBridge = useRef<SyncBridge | null>(null);
  const workerInstance = useRef<Worker | null>(null);
  const moveSub = useRef<Subscription | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [recentMoves, setRecentMoves] = useState<string[]>([]);
  const [is3DReady, setIs3DReady] = useState(false);
  // Tracks whether orientation+rotation callbacks have been registered on the singleton worker.
  // Prevents duplicate registrations across Strict Mode remounts.
  const callbacksRegistered = useRef(false);
  // Force the first facelet sync after mount/remount to happen
  // regardless of pendingMoves. When the panel is hidden, the SyncBridge
  // is unbound (losing track of cube moves); on remount, the model may be
  // desynchronized. This flag ensures the first facelet event corrects it.
  const needsInitialSyncRef = useRef(true);

  // ── Reactive appearance (skin) ───────────────────────────────────────
  // Watch the user's appearance3d preference and push the corresponding
  // style to the worker whenever it changes. This also covers the initial
  // render (the store defaults to 'default').
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);

  useEffect(() => {
    if (!workerProxy.current) return;
    const style = getSkinStyle(appearance3d);
    workerProxy.current
      .updateStyle(style)
      .catch((err: unknown) => console.error('[Cube3DPanel] updateStyle failed', err));
  }, [appearance3d]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Reset the initial-sync flag so the first facelet event after
    // mount/remount corrects any desync from the panel being hidden.
    needsInitialSyncRef.current = true;
    moveSub.current?.unsubscribe();
    if (globalCubeAdapter.moves$) {
      moveSub.current = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
        // Use display notation (remapped by current orientation)
        const orientation = orientationStore.getState().orientation;
        const notation = MoveTransformer.toDisplayNotation(ev, orientation);
        setRecentMoves(prev => {
          const next = compactMoveNotation([...prev, notation]);
          return next.slice(-15);
        });
      });
    }

    const existingSingleton = getWorkerSingleton();

    if (existingSingleton) {
      // Re-mount: canvas still in DOM, OffscreenCanvas still linked.
      // Just resize — no new WebGL context.
      workerInstance.current = existingSingleton.worker;
      workerProxy.current = existingSingleton.proxy;
      syncBridge.current = existingSingleton.syncBridge;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        workerProxy.current.resize(rect.width, rect.height);
      }        if (globalCubeAdapter.moves$ && globalCubeAdapter.gyro$) {
          syncBridge.current.bindCube(globalCubeAdapter.moves$, globalCubeAdapter.gyro$);
        }

        // Wire orientation tracker: worker → orientation store
        workerProxy.current.setGyroSupported(globalCubeAdapter.gyroSupported);

        // Register callbacks once (worker is a singleton, survives Strict Mode remounts)
        if (!callbacksRegistered.current) {
          callbacksRegistered.current = true;
          workerProxy.current.onOrientationChange(
            Comlink.proxy((o: CubeOrientation) => {
              orientationStore.getState().setOrientation(o);
              // When orientation updates flow, gyro is confirmed working.
              // Update BOTH the orientation store AND the adapter so every
              // consumer (SmartCubeSection, etc.) sees the correct state.
              const caps = orientationStore.getState().capabilities;
              if (!caps.gyroSupported) {
                orientationStore.getState().setCapabilities({
                  hasIMU: true,
                  gyroSupported: true,
                });
              }
              // Sync the adapter's gyroSupported flag so direct reads
              // (e.g. requestFacelets guard, SmartCubeSection) also see it.
              if (!globalCubeAdapter.gyroSupported) {
                globalCubeAdapter.gyroSupported = true;
              }
            }),
          );
          workerProxy.current.onRotationEvent(
            Comlink.proxy((e: RotationEvent) => {
              const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
              setRecentMoves(prev => {
                const next = compactMoveNotation([...prev, notation]);
                return next.slice(-15);
              });
            }),
          );
        }
        // Set initial capabilities from current adapter state
        orientationStore.getState().setCapabilities({
          hasIMU: globalCubeAdapter.gyroSupported,
          gyroSupported: globalCubeAdapter.gyroSupported,
        });

        // Apply initial skin style after worker is ready on re-mount.
        // Read directly from the store to avoid closure dependency on
        // `appearance3d` — the separate reactive effect handles changes.
        const reSkin = getSkinStyle(preferencesStore.getState().appearance3d);
        workerProxy.current.updateStyle(reSkin).catch(console.error);

        setIs3DReady(true);
      } else {
        // First mount: create worker, transfer canvas, init
        workerInstance.current = new EngineWorker();
      workerProxy.current = Comlink.wrap<EngineWorkerAPI>(workerInstance.current!);
      syncBridge.current = new SyncBridge(workerProxy.current);

      try {
        const offscreen = canvasRef.current.transferControlToOffscreen();
        workerProxy.current.init(
          Comlink.transfer(offscreen, [offscreen]),
          canvasRef.current.clientWidth,
          canvasRef.current.clientHeight,
          window.devicePixelRatio
        );

        if (globalCubeAdapter.moves$ && globalCubeAdapter.gyro$) {
          syncBridge.current.bindCube(globalCubeAdapter.moves$, globalCubeAdapter.gyro$);
        }

        // Wire orientation tracker: worker → orientation store
        workerProxy.current.setGyroSupported(globalCubeAdapter.gyroSupported);

        // Register callbacks once (worker is a singleton, survives Strict Mode remounts)
        if (!callbacksRegistered.current) {
          callbacksRegistered.current = true;
          workerProxy.current.onOrientationChange(
            Comlink.proxy((o: CubeOrientation) => {
              orientationStore.getState().setOrientation(o);
              // When orientation updates flow, gyro is confirmed working.
              // Update BOTH the orientation store AND the adapter so every
              // consumer (SmartCubeSection, etc.) sees the correct state.
              const caps = orientationStore.getState().capabilities;
              if (!caps.gyroSupported) {
                orientationStore.getState().setCapabilities({
                  hasIMU: true,
                  gyroSupported: true,
                });
              }
              // Sync the adapter's gyroSupported flag so direct reads
              // (e.g. requestFacelets guard, SmartCubeSection) also see it.
              if (!globalCubeAdapter.gyroSupported) {
                globalCubeAdapter.gyroSupported = true;
              }
            }),
          );
          workerProxy.current.onRotationEvent(
            Comlink.proxy((e: RotationEvent) => {
              const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
              setRecentMoves(prev => {
                const next = compactMoveNotation([...prev, notation]);
                return next.slice(-15);
              });
            }),
          );
        }
        // Set initial capabilities from current adapter state
        orientationStore.getState().setCapabilities({
          hasIMU: globalCubeAdapter.gyroSupported,
          gyroSupported: globalCubeAdapter.gyroSupported,
        });

        // Apply initial skin style immediately after worker init.
        // Read directly from the store to avoid closure dependency.
        const initSkin = getSkinStyle(preferencesStore.getState().appearance3d);
        workerProxy.current.updateStyle(initSkin).catch(console.error);

        setWorkerSingleton({
          worker: workerInstance.current,
          proxy: workerProxy.current,
          syncBridge: syncBridge.current,
        });
        setIs3DReady(true);
      } catch {
        console.warn("Canvas already transferred — 3D rendering unavailable");
      }
    }

    // ── Facelet subscription (AFTER bindCube, so clearPendingMoves
    // catches stale moves replayed by the ReplaySubject buffer) ────────
    const faceletSub = globalCubeAdapter.facelets$
      ? globalCubeAdapter.facelets$.subscribe((facelets: string) => {
          if (!syncBridge.current) return;
          // On mount/remount, force-sync the 3D model from the
          // real cube state regardless of pending moves. The model may
          // be desynchronized from being hidden (SyncBridge unbound).
          // After the first sync, resume the normal guard.
          if (needsInitialSyncRef.current) {
            needsInitialSyncRef.current = false;
            workerProxy.current?.syncFacelets(facelets).catch(console.error);
            // Clear any stale moves replayed by the ReplaySubject buffer —
            // otherwise they would animate on top of the freshly-synced state
            // and cause a visual desync ("one row off").
            syncBridge.current?.clearPendingMoves();
          } else if (syncBridge.current.pendingMoves === 0) {
            workerProxy.current?.syncFacelets(facelets).catch(console.error);
          }
        })
      : undefined;

    const connSub = globalCubeAdapter.connectionStatus$?.subscribe((status) => {
      if (status === 'connected') {
        globalCubeAdapter.requestFacelets().catch(console.error);
        if (workerProxy.current) {
          workerProxy.current.calibrateGyro();
        }
      }
    });

    if (globalCubeAdapter.isConnected) {
      globalCubeAdapter.requestFacelets().catch(console.error);
      if (workerProxy.current) {
        workerProxy.current.calibrateGyro();
      }
    }

    // Resize Observer — guard against 0×0 (panel collapsed) to prevent
    // the WebGL context being destroyed when the aside animates to width 0.
    // Without this, reopening the panel leaves the cube invisible because
    // the context was lost at 0×0 and never recovers.
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
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
      // DON'T null out workerSingleton
    };
  }, []);

  const calibrateGyro = () => {
    if (workerProxy.current) {
      workerProxy.current.calibrateGyro();
    }
  };

  const resetCube = () => {
    if (workerProxy.current) {
      workerProxy.current.resetCube();
    }
    setRecentMoves([]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !workerProxy.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    workerProxy.current.rotateCamera(dx, dy).catch(console.error);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className={cn("flex flex-1 h-full min-h-0 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-1 pb-2.5">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-ink">Cube</h3>

        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetCube}
                disabled={!is3DReady}
                className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset cube pieces to solved state</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={calibrateGyro}
                disabled={!is3DReady}
                className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
              >
                <RefreshCw className="size-3" />
                Calibrate
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Calibrate gyroscope orientation</TooltipContent>
          </Tooltip>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
                  aria-label="Close 3D view"
                >
                  <X className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close 3D view</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Moves overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/60 backdrop-blur-sm px-3 py-2">
          {recentMoves.length === 0 ? (
            <p className="text-center text-[0.7rem] text-ink-3 italic">Waiting for cube...</p>
          ) : (
            <div className="flex justify-center gap-2 font-mono text-[0.8rem] font-semibold text-ink">
              {recentMoves.map((m, i) => (
                <span key={i} className="animate-in fade-in slide-in-from-right-2">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
