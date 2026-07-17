"use client";

import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import { SyncBridge } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";
import type { Subscription } from "rxjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore } from "@cubeforge/state";
import { MoveTransformer } from "@cubeforge/math-core";
import type { CubeMoveEvent, CubeOrientation, RotationEvent } from "@cubeforge/types";

export interface Cube3DPanelProps {
  className?: string;
}

interface WorkerSingleton {
  worker: Worker;
  proxy: Comlink.Remote<EngineWorkerAPI>;
  syncBridge: SyncBridge;
}

/** Survives Strict Mode unmount/remount so OffscreenCanvas isn't re-transferred */
let workerSingleton: WorkerSingleton | null = null;

export function Cube3DPanel({ className }: Cube3DPanelProps) {
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

  useEffect(() => {
    if (!canvasRef.current) return;

    // Subscribe to move history — always (survives canvas-transfer failure)
    moveSub.current?.unsubscribe();
    if (globalCubeAdapter.moves$) {
      moveSub.current = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
        // Use display notation (remapped by current orientation)
        const orientation = orientationStore.getState().orientation;
        const notation = MoveTransformer.toDisplayNotation(ev, orientation);
        setRecentMoves(prev => {
          const next = [...prev, notation];
          return next.slice(-15);
        });
      });
    }

    const faceletSub = globalCubeAdapter.facelets$
      ? globalCubeAdapter.facelets$.subscribe((facelets: string) => {
          if (syncBridge.current && syncBridge.current.pendingMoves === 0) {
            workerProxy.current?.syncFacelets(facelets).catch(console.error);
          }
        })
      : undefined;

    if (workerSingleton) {
      // Re-mount: canvas still in DOM, OffscreenCanvas still linked.
      // Just resize — no new WebGL context.
      workerInstance.current = workerSingleton.worker;
      workerProxy.current = workerSingleton.proxy;
      syncBridge.current = workerSingleton.syncBridge;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
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
              // When orientation updates flow, gyro is confirmed working
              const caps = orientationStore.getState().capabilities;
              if (!caps.gyroSupported) {
                orientationStore.getState().setCapabilities({
                  hasIMU: true,
                  gyroSupported: true,
                });
              }
            }),
          );
          workerProxy.current.onRotationEvent(
            Comlink.proxy((e: RotationEvent) => {
              const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
              setRecentMoves(prev => {
                const next = [...prev, notation];
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
              // When orientation updates flow, gyro is confirmed working
              const caps = orientationStore.getState().capabilities;
              if (!caps.gyroSupported) {
                orientationStore.getState().setCapabilities({
                  hasIMU: true,
                  gyroSupported: true,
                });
              }
            }),
          );
          workerProxy.current.onRotationEvent(
            Comlink.proxy((e: RotationEvent) => {
              const notation = MoveTransformer.rotationToNotation(e.axis, e.direction);
              setRecentMoves(prev => {
                const next = [...prev, notation];
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

        workerSingleton = {
          worker: workerInstance.current,
          proxy: workerProxy.current,
          syncBridge: syncBridge.current,
        };
        setIs3DReady(true);
      } catch {
        console.warn("Canvas already transferred — 3D rendering unavailable");
      }
    }

    if (globalCubeAdapter.isConnected) {
      globalCubeAdapter.requestFacelets().catch(console.error);
    }

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;
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
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCube}
            disabled={!is3DReady}
            className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
            title="Reset cube pieces to solved state"
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={calibrateGyro}
            disabled={!is3DReady}
            className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
            title="Calibrate gyroscope orientation"
          >
            <RefreshCw className="size-3" />
            Calibrate
          </Button>
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
