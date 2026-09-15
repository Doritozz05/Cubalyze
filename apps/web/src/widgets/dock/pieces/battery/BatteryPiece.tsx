"use client";

import { useStore } from "zustand";
import { connectionStore } from "@cubalyze/state";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BatteryIcon } from "@/components/Hardware/BatteryIcon";
import { cn } from "@/lib/utils";

/** Smart-cube battery pill — always visible in the dock. Shows a muted
 *  "Disconnected"/"Connecting" state when no cube is linked, and the
 *  color-coded battery icon + percentage (same look as the header chip)
 *  when connected. Updates live via the connection store. */
export function BatteryPiece() {
  const { t } = useTranslation("shell");
  const status = useStore(connectionStore, (s) => s.status);
  const batteryLevel = useStore(connectionStore, (s) => s.batteryLevel);
  const deviceName = useStore(connectionStore, (s) => s.deviceName);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const tooltip = isConnected
    ? batteryLevel !== null
      ? t("batteryLevel", { device: deviceName ?? t("connected"), level: batteryLevel })
      : t("smartCubeWithDevice", { device: deviceName ?? t("connected") })
    : t(isConnecting ? "statusConnecting" : "statusDisconnected");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex h-8 cursor-default select-none items-center justify-center rounded-full text-xs font-medium leading-none text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink py-0",
            isConnected ? "gap-1.5 px-2.5" : "size-8 shrink-0",
          )}
        >
          <BatteryIcon
            level={batteryLevel}
            isConnected={isConnected}
            className={isConnecting ? "animate-pulse" : undefined}
          />
          {isConnected && (
            <span className="nums font-medium leading-none text-ink">
              {batteryLevel !== null ? `${batteryLevel}%` : "--%"}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
