"use client";

import { Cpu, Bluetooth, BluetoothConnected, Compass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore } from "@cubeforge/state";
import { cn } from "@/lib/utils";

type ConnStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

/**
 * Smart Cube section (read-only status panel).
 *
 * Live status pulled from `globalCubeAdapter`: connection state, vendor
 * and model of the paired cube, gyro/IMU availability. Connect /
 * disconnect actions live in the sidebar's Bluetooth button — this
 * section is purely informational.
 *
 * Gyro/IMU status is read from the reactive `orientationStore` rather than
 * from `globalCubeAdapter.gyroSupported` directly, because the store is
 * auto-corrected when real gyro data starts flowing (even if the HARDWARE
 * event hasn't arrived yet or reports a false negative).
 */
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SmartCubeSection() {
  const [status, setStatus] = useState<ConnStatus>(
    globalCubeAdapter.isConnected ? "connected" : "disconnected",
  );
  const [model, setModel] = useState<string>(globalCubeAdapter.model);
  const [isConnecting, setIsConnecting] = useState(false);

  const isGyroSupported = useStore(
    orientationStore,
    (s) => s.capabilities.gyroSupported,
  );

  const prevStatusRef = useRef<ConnStatus | null>(null);

  useEffect(() => {
    const applyStatus = (next: ConnStatus) => {
      setStatus(next);
      if (next === "connected" && prevStatusRef.current !== "connected") {
        setModel(globalCubeAdapter.model);
      }
      prevStatusRef.current = next;
    };

    applyStatus(
      globalCubeAdapter.isConnected ? "connected" : "disconnected",
    );
    const sub = globalCubeAdapter.connectionStatus$?.subscribe(applyStatus);
    return () => sub?.unsubscribe();
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await globalCubeAdapter.connect();
      toast.success("Cube connected!");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to connect cube");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await globalCubeAdapter.disconnect();
      toast.success("Cube disconnected");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to disconnect cube");
    }
  };

  const isConnected = status === "connected";
  const isTransitioning =
    status === "connecting" || status === "reconnecting" || isConnecting;

  const statusBadge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-[0.7rem] font-medium uppercase tracking-widest",
        isConnected && "border-line/60 bg-surface text-ink-2",
        !isConnected && !isTransitioning && "border-line/40 bg-surface-2/60 text-ink-3",
        isTransitioning && "border-line/60 bg-surface text-ink-2",
      )}
    >
      {isConnected ? (
        <BluetoothConnected className="size-3" />
      ) : (
        <Bluetooth className="size-3" />
      )}
      {status}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Cpu className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Bluetooth pairing, the gyroscope/IMU feed, and connection management for your Smart Cube.
        </p>
      </div>

      {/* Read & action status panel */}
      <div className="rounded-xl border border-line bg-surface p-5 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[0.85rem] font-medium text-ink">
              Connected cube
            </h4>
            {statusBadge}
          </div>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            {isConnected
              ? `${globalCubeAdapter.vendor} · ${model}`
              : "No cube paired. Click Connect to search for your Smart Cube."}
          </p>
          {isConnected && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.74rem] text-ink-3">
              <Compass
                className={cn(
                  "size-3",
                  isGyroSupported
                    ? "text-ink-2"
                    : "text-ink-3/60",
                )}
              />
              {isGyroSupported
                ? "Gyroscope/IMU available on this cube"
                : "No gyroscope/IMU on this cube"}
            </p>
          )}
        </div>

        <div className="shrink-0 mt-0.5">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="h-8 border-line text-xs font-medium text-ink hover:bg-surface-2"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isTransitioning}
              className="h-8 text-xs font-medium"
            >
              {isTransitioning ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
