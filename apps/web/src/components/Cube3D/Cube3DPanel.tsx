"use client";

import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import { GanCubeAdapter } from "@cubeforge/hardware-hal";
import { SyncBridge } from "@cubeforge/cube-3d-engine";
import type { EngineWorkerAPI } from "@cubeforge/cube-3d-engine";
import EngineWorker from "@cubeforge/cube-3d-engine/worker?worker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bluetooth, RefreshCw, AlertCircle } from "lucide-react";

export interface Cube3DPanelProps {
  className?: string;
}

export function Cube3DPanel({ className }: Cube3DPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Disconnected");
  const [showMacInput, setShowMacInput] = useState(false);
  const [manualMac, setManualMac] = useState("");

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

    return () => {
      // In strict mode dev, React unmounts and remounts.
    };
  }, []);

  const connectCube = async () => {
    try {
      setStatus("Connecting...");
      const adapter = new GanCubeAdapter();
      await adapter.connect(showMacInput ? manualMac : undefined);
      setStatus("Connected!");
      setShowMacInput(false);
      
      if (syncBridge.current && adapter.moves$) {
        syncBridge.current.bindCube(adapter.moves$, adapter.gyro$);
      }

      adapter.requestFacelets().catch(() => {});
      adapter.onFacelets = (facelets) => {
        console.log("[Sync] Initial facelets received:", facelets);
      };
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      const requiresExperimental = errMsg === "MAC_REQUIRED" || errMsg.includes("requestDevice") || errMsg.includes("bluetooth") || !("bluetooth" in navigator);
      
      if (requiresExperimental) {
        setStatus("Auto MAC reading blocked.");
        setShowMacInput(true);
      } else {
        setStatus("Failed: " + errMsg);
      }
    }
  };

  const calibrateGyro = () => {
    if (workerProxy.current) {
      workerProxy.current.calibrateGyro();
    }
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={connectCube}
            className={cn(
              "h-7 gap-1.5 px-2 text-xs",
              status === "Connected!"
                ? "text-green-500 hover:text-green-400"
                : "text-blue-500 hover:text-blue-400"
            )}
          >
            <Bluetooth className="size-3" />
            {status === "Connected!" ? "Connected" : "Connect"}
          </Button>
        </div>
      </div>

      {showMacInput && (
        <div className="m-2 rounded bg-surface-2 p-3 text-xs text-ink-2">
          <div className="flex items-center gap-2 font-medium text-ink">
            <AlertCircle className="size-4 text-amber-500" />
            Manual MAC Required
          </div>
          <p className="mt-1">
            Browser blocks automatic reading. Enter MAC manually:
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={manualMac}
              onChange={(e) => setManualMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="flex-1 rounded border border-line bg-surface px-2 py-1 outline-none focus:border-ink-3"
            />
            <Button size="sm" onClick={connectCube} className="h-7 px-3">
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Canvas Wrapper */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full outline-none"
        />
      </div>
    </div>
  );
}
