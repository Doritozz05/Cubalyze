"use client";

import { useEffect, useState } from "react";
import { Trophy, X, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/utils/formatTime";
import { cn } from "@/lib/utils";

export interface PbCelebrationBannerProps {
  types: ("Single" | "Ao5" | "Ao12")[];
  singleTime?: number | null;
  ao5Time?: number | null;
  ao12Time?: number | null;
  prevSingleTime?: number | null;
  prevAo5Time?: number | null;
  prevAo12Time?: number | null;
  onClose?: () => void;
  className?: string;
}

export function PbCelebrationBanner({
  types,
  singleTime,
  ao5Time,
  ao12Time,
  prevSingleTime,
  prevAo5Time,
  prevAo12Time,
  onClose,
  className,
}: PbCelebrationBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 4500);

    return () => clearTimeout(timer);
  }, [types, singleTime, ao5Time, ao12Time, onClose]);

  if (!visible || types.length === 0) return null;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2.5 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 shrink-0">
            <Trophy className="size-3.5 text-ink-3" />
          </div>
          <span className="text-xs font-semibold text-ink tracking-tight">
            New Personal Best
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
          className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          aria-label="Close celebration banner"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Monochromatic badges for achieved categories */}
      <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-0.5">
        {types.includes("Single") && singleTime != null && (
          <Badge
            variant="outline"
            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none"
          >
            <span className="font-semibold text-[0.62rem] tracking-wider uppercase text-ink-3 font-sans">Single</span>
            <span className="text-ink">{formatTime(singleTime)}</span>
            {prevSingleTime != null && prevSingleTime > singleTime && (
              <span className="flex items-center text-[0.62rem] text-ink-3 font-normal">
                <TrendingDown className="size-3 mr-0.5 text-ink-3" />
                -{formatTime(prevSingleTime - singleTime)}
              </span>
            )}
          </Badge>
        )}

        {types.includes("Ao5") && ao5Time != null && (
          <Badge
            variant="outline"
            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none"
          >
            <span className="font-semibold text-[0.62rem] tracking-wider uppercase text-ink-3 font-sans">Ao5</span>
            <span className="text-ink">{formatTime(ao5Time)}</span>
            {prevAo5Time != null && prevAo5Time > ao5Time && (
              <span className="flex items-center text-[0.62rem] text-ink-3 font-normal">
                <TrendingDown className="size-3 mr-0.5 text-ink-3" />
                -{formatTime(prevAo5Time - ao5Time)}
              </span>
            )}
          </Badge>
        )}

        {types.includes("Ao12") && ao12Time != null && (
          <Badge
            variant="outline"
            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none"
          >
            <span className="font-semibold text-[0.62rem] tracking-wider uppercase text-ink-3 font-sans">Ao12</span>
            <span className="text-ink">{formatTime(ao12Time)}</span>
            {prevAo12Time != null && prevAo12Time > ao12Time && (
              <span className="flex items-center text-[0.62rem] text-ink-3 font-normal">
                <TrendingDown className="size-3 mr-0.5 text-ink-3" />
                -{formatTime(prevAo12Time - ao12Time)}
              </span>
            )}
          </Badge>
        )}
      </div>
    </div>
  );
}

