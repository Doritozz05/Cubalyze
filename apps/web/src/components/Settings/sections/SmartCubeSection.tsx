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
export function SmartCubeSection() {
  // Live status pulled from the shared BLE adapter. The adapter keeps a
  // stable BehaviorSubject so this stays fresh across disconnects /
  // reconnects.
  const [status, setStatus] = useState<ConnStatus>(
    globalCubeAdapter.isConnected ? "connected" : "disconnected",
  );
  const [model, setModel] = useState<string>(globalCubeAdapter.model);

  // Read gyro/IMU status from the orientation store (which gets auto-corrected
  // when real gyro data flows from the worker). This is reactive: the component
  // re-renders whenever capabilities change.
  const isGyroSupported = useStore(
    orientationStore,
    (s) => s.capabilities.gyroSupported,
  );

  const prevStatusRef = useRef<ConnStatus | null>(null);

  useEffect(() => {
    // Single source of truth for status + model refresh. Used both for
    // the initial snapshot and for every BLE status emission. The adapter
    // updates `model` synchronously on HARDWARE events but does NOT expose
    // it as an observable, so the only moment we can re-read safely is
    // when the link transitions INTO 'connected' (initial mount with an
    // already-paired cube, a reconnect, or pairing a different cube).
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

  const isConnected = status === "connected";
  const isTransitioning =
    status === "connecting" || status === "reconnecting";

  const statusBadge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-[0.7rem] font-medium uppercase tracking-[0.1em]",
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
          Bluetooth pairing, the gyroscope/IMU feed, and what to do when
          the link drops. Connect or disconnect from the sidebar&rsquo;s
          Bluetooth button.
        </p>
      </div>

      {/* Read-only status panel */}
      <div className="rounded-xl border border-line bg-surface p-5">
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
              : "No cube paired. Use the Bluetooth button in the sidebar to start a pairing scan."}
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
      </div>

    </div>
  );
}
