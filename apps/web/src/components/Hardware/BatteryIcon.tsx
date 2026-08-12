"use client";

import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from "lucide-react";

/**
 * Sleek Lucide Battery icon component changing icon state & vibrant color
 * based on charge percentage. Shared by the header battery chip and the
 * dock BatteryPiece.
 */
export function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) {
    return <Battery className="size-4 text-ink-3 opacity-60" />;
  }

  const pct = Math.max(0, Math.min(100, level));

  // Critical low battery (<= 15%): red warning icon
  if (pct <= 15) {
    return <BatteryWarning className="size-4 text-rose-500" />;
  }

  // Low battery (16% - 35%): warm amber 1-bar icon
  if (pct <= 35) {
    return <BatteryLow className="size-4 text-amber-500" />;
  }

  // Medium battery (36% - 75%): vibrant emerald 2-bar icon (shows 1/2 / middle stage)
  if (pct <= 75) {
    return <BatteryMedium className="size-4 text-emerald-500" />;
  }

  // Full battery (> 75%): vibrant emerald full icon
  return <BatteryFull className="size-4 text-emerald-500" />;
}
