"use client";

import { Cpu, Bluetooth, BluetoothConnected, Compass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
import { Switch } from "@/components/ui/switch";
import { LockerLinkCard } from "@/components/Hardware/LockerLinkCard";
import { cn } from "@/lib/utils";

type ConnStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

const STATUS_KEY: Record<ConnStatus, ParseKeys<"settings">> = {
  connecting: "smartCube.status.connecting",
  connected: "smartCube.status.connected",
  disconnected: "smartCube.status.disconnected",
  reconnecting: "smartCube.status.reconnecting",
};

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
import i18n from "@/i18n";

export function SmartCubeSection() {
  const { t } = useTranslation("settings");

  const [status, setStatus] = useState<ConnStatus>(
    globalCubeAdapter.isConnected ? "connected" : "disconnected",
  );
  const [model, setModel] = useState<string>(globalCubeAdapter.model);
  const [isConnecting, setIsConnecting] = useState(false);

  const isGyroSupported = useStore(
    orientationStore,
    (s) => s.capabilities.gyroSupported,
  );
  const use3x3As2x2 = useStore(preferencesStore, (s) => s.use3x3As2x2);
  const setUse3x3As2x2 = useStore(preferencesStore, (s) => s.setUse3x3As2x2);

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
      toast.success(i18n.t("toast:cubeConnected"));
    } catch (err: unknown) {
      console.error(err);
      toast.error(i18n.t("toast:cubeConnectFailed"));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await globalCubeAdapter.disconnect();
      toast.success(i18n.t("toast:cubeDisconnected"));
    } catch (err: unknown) {
      console.error(err);
      toast.error(i18n.t("toast:disconnectCubeFailed"));
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
      {t(STATUS_KEY[status])}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Cpu className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          {t("smartCube.info")}
        </p>
      </div>

      {/* Read & action status panel */}
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[0.85rem] font-medium text-ink">
              {t("smartCube.connectedCube")}
            </h4>
            {statusBadge}
          </div>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            {isConnected
              ? `${globalCubeAdapter.vendor} · ${model}`
              : t("smartCube.noCube")}
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
                ? t("smartCube.gyroAvailable")
                : t("smartCube.gyroUnavailable")}
            </p>
          )}
        </div>

        <div className="shrink-0 mt-0.5">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="max-lg:h-11 h-8 border-line text-xs font-medium text-ink hover:bg-surface-2"
            >
              {t("smartCube.disconnect")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isTransitioning}
              className="max-lg:h-11 h-8 text-xs font-medium"
            >
              {isTransitioning ? t("smartCube.connecting") : t("smartCube.connect")}
            </Button>
          )}
        </div>
      </div>

      {/* Which Locker item the connected cube IS (the hardware→Locker link) */}
      <LockerLinkCard />

      {/* 3×3 as 2×2 (corners-only) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-xl border border-line bg-surface p-5">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium text-ink">
            {t("smartCube.use3x3As2x2")}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            {t("smartCube.use3x3As2x2Hint")}
          </p>
        </div>
        <div className="flex h-5 shrink-0 items-center">
          <Switch
            checked={use3x3As2x2}
            onCheckedChange={setUse3x3As2x2}
            aria-label={t("smartCube.use3x3As2x2")}
          />
        </div>
      </div>

    </div>
  );
}
