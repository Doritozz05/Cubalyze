"use client";

import { Cpu, Bluetooth, BluetoothConnected, Compass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { orientationStore, preferencesStore } from "@cubeforge/state";
// Import from the side-effect-free "/skins" subpath: the engine's main entry
// pulls in three.js (~545 kB), which would otherwise land in the initial
// bundle just for this settings list.
import { CUBE_SKINS } from "@cubeforge/cube-3d-engine/skins";
import { ColorPicker } from "@/components/Settings/components/ColorPicker";
import { SettingRow } from "@/components/Settings/components/SettingRow";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConnStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
type FaceLetter = "U" | "D" | "F" | "B" | "R" | "L";

const STATUS_KEY: Record<ConnStatus, ParseKeys<"settings">> = {
  connecting: "smartCube.status.connecting",
  connected: "smartCube.status.connected",
  disconnected: "smartCube.status.disconnected",
  reconnecting: "smartCube.status.reconnecting",
};

const FACE_LABEL_KEY: Record<FaceLetter, ParseKeys<"settings">> = {
  U: "smartCube.faceU",
  D: "smartCube.faceD",
  F: "smartCube.faceF",
  B: "smartCube.faceB",
  R: "smartCube.faceR",
  L: "smartCube.faceL",
};

const SKIN_LABEL_KEY: Record<string, ParseKeys<"settings">> = {
  default: "smartCube.skinDefault",
  stickerless: "smartCube.skinStickerless",
  coreless: "smartCube.skinCoreless",
  translucent: "smartCube.skinTranslucent",
  custom: "smartCube.skinCustom",
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

  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);
  const customStickerColors = useStore(preferencesStore, (s) => s.customStickerColors);
  const setCustomStickerColors = useStore(preferencesStore, (s) => s.setCustomStickerColors);

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
      <div className="rounded-xl border border-line bg-surface p-5 flex items-start justify-between gap-4">
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

      {/* Skin selector — the 3D cube visual style for the paired cube */}
      <SettingRow
        title={t("smartCube.appearance3d")}
        description={t("smartCube.appearance3dHint")}
        control={
          <Select value={appearance3d} onValueChange={setAppearance3d}>
            <SelectTrigger className="w-40 max-lg:w-full">
              <SelectValue placeholder={t("smartCube.selectAppearance")} />
            </SelectTrigger>
            <SelectContent>
              {CUBE_SKINS.map((skin) => (
                <SelectItem key={skin.id} value={skin.id}>
                  {t(SKIN_LABEL_KEY[skin.id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Custom sticker colors — only visible when 'custom' skin is selected */}
      {appearance3d === "custom" && (
        <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="mb-4">
            <h4 className="text-[0.85rem] font-medium text-ink">{t("smartCube.customStickers")}</h4>
            <p className="mt-1 text-[0.72rem] text-ink-3">
              {t("smartCube.customStickersHint")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(FACE_LABEL_KEY) as FaceLetter[]).map((face) => (
              <ColorPicker
                key={face}
                label={t(FACE_LABEL_KEY[face])}
                value={customStickerColors[face]}
                onChange={(color) => setCustomStickerColors({ [face]: color })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
