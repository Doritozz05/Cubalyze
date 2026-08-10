"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bluetooth, BluetoothConnected, Info } from "lucide-react";
import { GanCubeAdapter } from "@cubeforge/hardware-hal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsTouch } from "@/hooks/use-mobile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIDEBAR_MOTION } from "@/components/Layout/sidebar.constants";
import { orientationStore, connectionStore } from "@cubeforge/state";
import { startOrientationTracking } from "@/services/orientationTracking";

// Global singleton adapter to keep connection alive across re-renders.
// Imported by useSolveSession, useScrambleValidator and Cube3DPanel —
// DO NOT remove this export.
export const globalCubeAdapter = new GanCubeAdapter();

// Headless orientation tracking — feeds the orientationStore for the WHOLE
// connection lifetime (solve capture + replay grip + dynamic notation),
// independent of whether any 3D panel is mounted.
startOrientationTracking(globalCubeAdapter);

// Wire hardware info events to the orientation store so the UI (e.g.
// SmartCubeSection) shows the correct gyro status immediately after
// connecting, regardless of whether the 3D panel is open.
globalCubeAdapter.onHardwareInfo = ({ gyroSupported }) => {
  if (gyroSupported) {
    const caps = orientationStore.getState().capabilities;
    if (!caps.gyroSupported) {
      orientationStore.getState().setCapabilities({
        hasIMU: true,
        gyroSupported: true,
      });
    }
  }
};

// Sync global connectionStore with BLE adapter observables
globalCubeAdapter.connectionStatus$?.subscribe((status) => {
  if (status === "connected") {
    connectionStore.getState().setConnected(globalCubeAdapter.vendor, globalCubeAdapter.model);
    globalCubeAdapter.requestBattery().catch(() => {});
  } else if (status === "connecting") {
    connectionStore.getState().setConnecting();
  } else if (status === "reconnecting") {
    connectionStore.getState().setReconnecting();
  } else if (status === "disconnected") {
    connectionStore.getState().setDisconnected();
  }
});

globalCubeAdapter.battery$?.subscribe((level) => {
  connectionStore.getState().setBatteryLevel(level);
});

export interface CubeConnectorProps {
  className?: string;
  /**
   * "header" — bordered icon button (legacy, hidden on small screens).
   * "rail"   — full-width footer item for the LeftSidebar (icon + animated label).
   */
  variant?: "header" | "rail";
  /** When variant="rail", toggles the text label visibility (sidebar expanded). */
  expanded?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Callback fired when the dialog opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Render only the Drawer/Dialog, skipping the trigger button.
   * Used by the touch-regime LeftSidebar where the standalone trigger
   * (a `hidden sm:flex` button) used to leak into the layout top-left.
   */
  hideTrigger?: boolean;
  /**
   * Render only the trigger, skipping the Drawer/Dialog.
   * Used by the rail variant inside the touch Sheet so the single,
   * always-mounted standalone Drawer remains the only dialog.
   */
  hideDialog?: boolean;
}

export function CubeConnector({
  className,
  variant = "header",
  expanded = false,
  open: externalOpen,
  onOpenChange,
  hideTrigger = false,
  hideDialog = false,
}: CubeConnectorProps) {
  const isTouch = useIsTouch();
  const { t } = useTranslation("shell");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;

  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">(
    globalCubeAdapter.isConnected ? "connected" : "disconnected"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [showMacInput, setShowMacInput] = useState(false);
  const [manualMac, setManualMac] = useState("");

  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
    if (newOpen) {
      setStatus(globalCubeAdapter.isConnected ? "connected" : "disconnected");
      setErrorMsg("");
      setShowMacInput(false);
      setManualMac("");
    }
  };

  const connectCube = async () => {
    try {
      setStatus("connecting");
      setErrorMsg("");

      await globalCubeAdapter.connect(showMacInput ? manualMac : undefined);

      setStatus("connected");
      setShowMacInput(false);
      toast.success("Cube connected!");

      // Request initial facelets just to verify connection
      globalCubeAdapter.requestFacelets().catch(() => {});

      handleOpenChange(false); // Close dialog on success
      onOpenChange?.(false);
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);

      setStatus("disconnected");

      const notSecure = !window.isSecureContext;
      const bluetoothMissing = !("bluetooth" in navigator);

      if (notSecure) {
        setErrorMsg(t("httpsRequired"));
        setShowMacInput(false);
      } else if (bluetoothMissing || errMsg.includes("globally disabled")) {
        setErrorMsg(t("bluetoothDisabled"));
        setShowMacInput(false);
      } else if (
        errMsg === "MAC_REQUIRED" ||
        errMsg.includes("requestDevice")
      ) {
        setErrorMsg(t("macBlockedError"));
        setShowMacInput(true);
      } else {
        setErrorMsg(t("connectionFailed", { error: errMsg }));
      }
    }
  };

  const disconnectCube = async () => {
    try {
      await globalCubeAdapter.disconnect();
      setStatus("disconnected");
      toast.success("Cube disconnected");
      handleOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to disconnect");
    }
  };

  const instructions = /Edg\//i.test(navigator.userAgent)
    ? "edge://flags/#enable-experimental-web-platform-features"
    : "chrome://flags/#enable-experimental-web-platform-features";

  const railButton = (
    <button
      type="button"
      onClick={() => handleOpenChange(true)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md text-sm px-2 py-2 transition-colors cursor-pointer",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        status === "connected" && "text-phase-blue-500",
        className,
      )}
      aria-label={t("connectSmartCube")}
    >
      <div className="flex size-5 shrink-0 items-center justify-center">
        {status === "connected" ? (
          <BluetoothConnected className="size-4" />
        ) : (
          <Bluetooth className="size-4" />
        )}
      </div>
      <motion.span
        initial={false}
        animate={{ width: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={SIDEBAR_MOTION.label}
        className="overflow-hidden whitespace-nowrap"
      >
        {t("smartCube")}
      </motion.span>
    </button>
  );

  const headerTrigger = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleOpenChange(true)}
          className={cn(
            "size-8 rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hidden sm:flex",
            status === "connected" && "text-phase-blue-500 border-phase-blue-500/20 bg-phase-blue-500/5 hover:bg-phase-blue-500/10 hover:text-phase-blue-600",
            className,
          )}
          aria-label={t("connectSmartCube")}
        >
          {status === "connected" ? (
            <BluetoothConnected className="size-4" />
          ) : (
            <Bluetooth className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("connectSmartCube")}</TooltipContent>
    </Tooltip>
  );

  const trigger = variant === "rail" ? railButton : headerTrigger;

  // Localized status label — resolved at render time so it follows the
  // active language (the state value itself stays an enum).
  const statusLabel: Record<typeof status, string> = {
    disconnected: t("statusDisconnected"),
    connecting: t("statusConnecting"),
    connected: t("statusConnected"),
  };

  const innerContent = (
    <div className="flex flex-col gap-4 py-4 max-lg:py-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("status")}</span>
        <span className={cn(
          "text-sm",
          status === "connected" ? "text-phase-blue-500" : "text-ink-3"
        )}>
          {statusLabel[status]}
        </span>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="py-2">
          <Info className="size-4" />
          <AlertTitle>{t("connectionError")}</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}

      {showMacInput && status !== "connected" && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
          <p className="text-ink-2">
            {t("macBlocked")}
          </p>
          <div className="relative group">
            <code className="rounded bg-ink/5 p-1.5 pr-8 font-mono text-xs text-ink break-all cursor-text select-all">
              {instructions}
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(instructions); toast.success("Copied!"); }}
                  className="absolute top-1.5 right-1.5 size-5 flex items-center justify-center rounded hover:bg-ink/10 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{t("copy")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-1.5 mt-2">
            <p className="text-ink-2 text-xs">{t("macManualEntry")}</p>
            <Input
              value={manualMac}
              onChange={(e) => setManualMac(e.target.value)}
              placeholder={t("macAddress")}
              className="h-8"
            />
          </div>
        </div>
      )}

      {status === "connected" ? (
        <Button
          onClick={disconnectCube}
          variant="destructive"
          className="w-full mt-2"
        >
          {t("disconnectCube")}
        </Button>
      ) : (
        <Button
          onClick={connectCube}
          disabled={status === "connecting" || (showMacInput && !manualMac)}
          className="w-full mt-2"
        >
          {status === "connecting" ? t("connecting") : t("connectCube")}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {!hideTrigger && trigger}
      {!hideDialog && (isTouch ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] p-0 pb-safe focus:outline-none">
            <DrawerHeader className="border-b border-line px-5 py-3.5 text-left">
              <DrawerTitle className="text-sm font-semibold text-ink">{t("connectSmartCube")}</DrawerTitle>
              <DrawerDescription className="text-xs text-ink-3 mt-1">
                {t("connectSmartCubeDescription")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-5 overflow-y-auto">
              {innerContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className={`sm:max-w-md bg-surface text-ink border-line ${TOUCH_FULL_BLEED} max-lg:max-h-[85vh] max-lg:overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{t("connectSmartCube")}</DialogTitle>
              <DialogDescription>
                {t("connectSmartCubeDescription")}
              </DialogDescription>
            </DialogHeader>
            {innerContent}
          </DialogContent>
        </Dialog>
      ))}
    </>
  );
}
