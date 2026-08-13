"use client";

import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatteryIconProps {
  level: number | null;
  isConnected?: boolean;
  className?: string;
}

/**
 * Sleek Lucide Battery icon component changing icon state & vibrant color
 * based on charge percentage. Shared by the header battery chip and the
 * dock BatteryPiece.
 */
export function BatteryIcon({ level, isConnected = true, className }: BatteryIconProps) {
  // Disconnected state: empty gray battery with a diagonal line slash across it
  if (!isConnected) {
    return (
      <div className={cn("relative inline-flex items-center justify-center shrink-0", className)}>
        <Battery className="size-4 text-ink-3 opacity-40" />
        <svg
          className="absolute inset-0 size-4 text-ink-3 opacity-70 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="21" x2="21" y2="3" />
        </svg>
      </div>
    );
  }

  // Connected state with unknown level (level === null)
  if (level === null) {
    return <Battery className={cn("size-4 text-ink-3 opacity-60 shrink-0", className)} />;
  }

  const pct = Math.max(0, Math.min(100, level));

  // Critical low battery (<= 15%): red warning icon
  if (pct <= 15) {
    return <BatteryWarning className={cn("size-4 text-rose-500 shrink-0", className)} />;
  }

  // Low battery (16% - 35%): warm amber 1-bar icon
  if (pct <= 35) {
    return <BatteryLow className={cn("size-4 text-amber-500 shrink-0", className)} />;
  }

  // Medium battery (36% - 75%): vibrant emerald 2-bar icon (shows 1/2 / middle stage)
  if (pct <= 75) {
    return <BatteryMedium className={cn("size-4 text-emerald-500 shrink-0", className)} />;
  }

  // Full battery (> 75%): vibrant emerald full icon
  return <BatteryFull className={cn("size-4 text-emerald-500 shrink-0", className)} />;
}
