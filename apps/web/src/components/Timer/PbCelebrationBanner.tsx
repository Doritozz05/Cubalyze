"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { Trophy, X, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/utils/formatTime";
import { cn } from "@/lib/utils";
import { useAnnounce } from "@/lib/announce";

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
  const { t } = useTranslation("timer");
  const [visible, setVisible] = useState(true);

  // Announce the new PB to screen readers (the banner itself is visual/transient).
  useAnnounce(
    types.length > 0
      ? [
          t("pbAnnounce"),
          types.includes("Single") && singleTime != null
            ? t("pbAnnounceSingle", { time: formatTime(singleTime) })
            : "",
          types.includes("Ao5") && ao5Time != null
            ? t("pbAnnounceAo5", { time: formatTime(ao5Time) })
            : "",
          types.includes("Ao12") && ao12Time != null
            ? t("pbAnnounceAo12", { time: formatTime(ao12Time) })
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : null,
  );

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 4500);

    return () => clearTimeout(timer);
  }, [types, singleTime, ao5Time, ao12Time, onClose]);

  // Celebrate a new PB with confetti, once per banner mount. Respects the
  // user's reduced-motion preference and auto-cleans its canvas after the
  // burst so it never leaks DOM nodes.
  useEffect(() => {
    if (types.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const end = Date.now() + 1200;
    const colors = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
    let rafId = 0;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 60,
        startVelocity: 55,
        origin: { x: 0, y: 0.75 },
        colors,
        zIndex: 60,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 60,
        startVelocity: 55,
        origin: { x: 1, y: 0.75 },
        colors,
        zIndex: 60,
      });
      if (Date.now() < end) rafId = requestAnimationFrame(frame);
    };

    // Small initial pop + sustained side cannons for ~1.2s.
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors, zIndex: 60 });
    frame();

    return () => {
      // Stop the loop on unmount; existing particles fade out naturally.
      cancelAnimationFrame(rafId);
    };
  }, [types]);

  if (!visible || types.length === 0) return null;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-top-2",
        // Touch: tighter gutters so 3 badges fit the narrow stage width.
        "max-lg:gap-2 max-lg:px-3 max-lg:py-2.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 shrink-0">
            <Trophy className="size-3.5 text-ink-3" />
          </div>
          <span className="text-xs font-semibold text-ink tracking-tight">
            {t("newPersonalBest")}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            onClose?.();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
          aria-label={t("closeCelebration")}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Monochromatic badges for achieved categories */}          <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-0.5 max-lg:gap-1.5">
        {types.includes("Single") && singleTime != null && (
          <Badge
            variant="outline"            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none max-lg:px-2 max-lg:py-0.5 max-lg:text-[0.7rem]">
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
            variant="outline"            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none max-lg:px-2 max-lg:py-0.5 max-lg:text-[0.7rem]">
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
            variant="outline"            className="border-line bg-surface-2 text-ink px-2.5 py-1 text-xs font-mono font-medium gap-1.5 shadow-none max-lg:px-2 max-lg:py-0.5 max-lg:text-[0.7rem]">
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

