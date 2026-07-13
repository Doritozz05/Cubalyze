"use client";

import { useEffect, useRef } from "react";
import * as Comlink from "comlink";
import { SyncBridge } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";

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
    };
  }, []);

  const calibrateGyro = () => {
    if (workerProxy.current) {
      workerProxy.current.calibrateGyro();
    }
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
            onClick={calibrateGyro}
            className="h-7 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink"
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
          className="absolute inset-0 h-full w-full outline-none"
        />
      </div>
    </div>
  );
}
