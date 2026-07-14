"use client";

import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import { SyncBridge } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import type { CubeMoveEvent } from "@cubeforge/types";

export interface Cube3DPanelProps {
  className?: string;
}

export function Cube3DPanel({ className }: Cube3DPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const workerProxy = useRef<Comlink.Remote<EngineWorkerAPI> | null>(null);
  const syncBridge = useRef<SyncBridge | null>(null);
  const workerInstance = useRef<Worker | null>(null);
  const isInitialized = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [recentMoves, setRecentMoves] = useState<string[]>([]);

  useEffect(() => {
    if (!canvasRef.current || isInitialized.current) return;
    isInitialized.current = true;
    
    // Setup Worker
    workerInstance.current = new EngineWorker();
    workerProxy.current = Comlink.wrap<EngineWorkerAPI>(workerInstance.current!);
    syncBridge.current = new SyncBridge(workerProxy.current);

    // Setup OffscreenCanvas robustly for HMR
    let offscreen: OffscreenCanvas;
    try {
      offscreen = canvasRef.current.transferControlToOffscreen();
    } catch {
      console.warn("Canvas already transferred by previous render");
      return; 
    }
    
    // Init Engine
    workerProxy.current.init(
      Comlink.transfer(offscreen, [offscreen]), 
      canvasRef.current.clientWidth, 
      canvasRef.current.clientHeight, 
      window.devicePixelRatio
    );

    // Bind to the global adapter streams
    if (globalCubeAdapter.moves$ && globalCubeAdapter.gyro$) {
      syncBridge.current.bindCube(globalCubeAdapter.moves$, globalCubeAdapter.gyro$);
    }
    
    if (globalCubeAdapter.moves$) {
      const subMoves = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
        const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");
        setRecentMoves(prev => {
          const next = [...prev, notation];
          return next.slice(-15);
        });
      });
      // Need a way to unsubscribe in cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (workerProxy.current as any)._subMoves = subMoves;
    }
    
    // Bind facelets callback
    globalCubeAdapter.onFacelets = (facelets: string) => {
      workerProxy.current?.syncFacelets(facelets).catch(console.error);
    };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (workerProxy.current && (workerProxy.current as any)._subMoves) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workerProxy.current as any)._subMoves.unsubscribe();
      }
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
          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            live
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCube}
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
      </div>

      {/* Recent Moves History */}
      {recentMoves.length > 0 && (
        <div className="flex h-8 items-center justify-end overflow-hidden border-t border-line/50 px-2">
          <div className="flex gap-1.5 font-mono text-[0.65rem] font-medium text-ink-3">
            {recentMoves.map((m, i) => (
              <span key={i} className="animate-in fade-in slide-in-from-right-2">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
