"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Solve } from "@/types";
import { useBottomLayoutStats } from "./useBottomLayoutStats";
import type {
  BottomLayoutStatId,
  SlotContentConfig,
  SlotLayoutDefinition,
} from "./types";

/** Display labels: WCA shorthand is literal, the rest are i18n. */
const STAT_LABELS: Record<BottomLayoutStatId, { literal?: string; key?: string }> = {
  ao5: { literal: "Ao5" },
  ao12: { literal: "Ao12" },
  ao50: { literal: "Ao50" },
  ao100: { literal: "Ao100" },
  mo3: { literal: "Mo3" },
  best: { key: "best" },
  worst: { key: "worst" },
  mean: { key: "mean" },
  deviation: { key: "deviation" },
  count: { key: "count" },
  sessionTime: { key: "sessionTime" },
  tps: { key: "tps" },
  bpa: { literal: "BPA" },
  wpa: { literal: "WPA" },
  bestAo5: { key: "bestAo5" },
  bestAo12: { key: "bestAo12" },
};

function StatRow({ stat, value, accent }: { stat: BottomLayoutStatId; value: string; accent?: boolean }) {
  const { t } = useTranslation("stats");
  const meta = STAT_LABELS[stat];
  const label = meta.literal ?? t(meta.key as never);
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span className="shrink-0 text-[0.56rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className={cn("nums truncate text-[0.82rem] tabular-nums", accent ? "font-semibold text-ready" : "text-ink")}>{value}</span>
    </div>
  );
}

export interface SlotLayoutProps {
  template: SlotLayoutDefinition;
  solves: Solve[];
  puzzleFilter?: string;
  className?: string;
  /** Resolved per-slot content (template defaults merged with user config). */
  slotContent: Record<string, SlotContentConfig>;
  /** Injected 2D scramble net rendered by slots with a `scramble-2d` display. */
  scramble2d?: ReactNode;
  /** Force the compact mobile density (horizontal snap row). */
  compact?: boolean;
  /** Render vertical (right rail) instead of grid. */
  vertical?: boolean;
}

/**
 * Renderer for slot templates. Every piece of content lives INSIDE a named
 * slot: stats (any combination, BPA/WPA included) or display blocks.
 */
export function SlotLayout({
  template,
  solves,
  puzzleFilter,
  className,
  slotContent,
  scramble2d,
  compact = false,
  vertical = false,
}: SlotLayoutProps) {
  const { t } = useTranslation("timer");
  const values = useBottomLayoutStats(solves, puzzleFilter);
  const [minimized, setMinimized] = useState(false);

  if (template.placement === "hidden" || template.slots.length === 0) return null;

  if (minimized) {
    return (
      <div className={cn("flex w-full items-center justify-center py-1", className)}>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label={t("slotRestore")}
          className="flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink-3 shadow-xs transition-colors hover:border-ink-2/40 hover:text-ink"
        >
          <ChevronUp className="size-4" />
        </button>
      </div>
    );
  }

  const renderContent = (slotId: string) => {
    const config = slotContent[slotId];
    if (!config) return null;
    if (config.kind === "display") {
      if (!config.displays.includes("scramble-2d")) return null;
      return (
        <div className="flex min-w-0 items-center justify-center">{scramble2d}</div>
      );
    }
    if (config.stats.length === 0) return null;
    return (
      <div className="flex min-w-0 flex-col justify-center gap-1">
        {config.stats.map((s) => (
          <StatRow key={s} stat={s} value={values[s]} accent={s === "bpa"} />
        ))}
      </div>
    );
  };

  // Compact mobile: one horizontal snap row, each slot a card.
  if (compact) {
    return (
      <div className={cn("relative w-full", className)}>
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {template.slots.map((slot) => {
            const body = renderContent(slot.id);
            if (!body) return null;
            return (
              <div
                key={slot.id}
                className="min-w-[200px] flex-1 snap-start rounded-lg border border-line bg-surface px-3 py-2"
              >
                <p className="mb-1 text-[0.55rem] uppercase tracking-[0.18em] text-ink-3">
                  {slot.label}
                </p>
                {body}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label={t("slotMinimize")}
          className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    );
  }

  // Right rail: vertical stack of labeled slot cards.
  if (vertical) {
    return (
      <div className={cn("flex w-full flex-col gap-3", className)}>
        {template.slots.map((slot) => {
          const body = renderContent(slot.id);
          if (!body) return null;
          return (
            <section
              key={slot.id}
              aria-label={slot.label}
              className="rounded-lg border border-line bg-surface px-3 py-2"
            >
              <header className="mb-1 flex items-center justify-between">
                <p className="text-[0.55rem] uppercase tracking-[0.18em] text-ink-3">
                  {slot.label}
                </p>
              </header>
              {body}
            </section>
          );
        })}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label={t("slotMinimize")}
          className="mx-auto flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>
    );
  }

  const gridTemplateColumns = (
    template.weights && template.weights.length === template.slots.length
      ? template.weights
      : template.slots.map(() => 1)
  )
    .map((w) => `${w}fr`)
    .join(" ");

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="grid w-full items-stretch gap-3 rounded-lg border border-line bg-surface px-3 py-2"
        style={{ gridTemplateColumns }}
      >
        {template.slots.map((slot, i) => {
          const body = renderContent(slot.id);
          if (!body) return null;
          return (
            <div
              key={slot.id}
              className={cn(
                "flex min-w-0 flex-col justify-center gap-1",
                i > 0 && "border-l border-line pl-3",
              )}
            >
              {body}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setMinimized(true)}
        aria-label={t("slotMinimize")}
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <ChevronDown className="size-3" />
      </button>
    </div>
  );
}
