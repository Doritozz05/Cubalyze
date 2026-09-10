"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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

  if (template.slots.length === 0) return null;

  const renderContent = (slotId: string) => {
    const config = slotContent[slotId];
    if (!config) return null;
    if (config.kind === "display") {
      if (!config.displays.includes("scramble-2d")) return null;
      return (
        <div className="flex min-w-0 flex-1 items-center justify-center py-1">{scramble2d}</div>
      );
    }
    if (config.stats.length === 0) return null;
    return (
      <div className="flex min-w-0 flex-col justify-center gap-1.5">
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
            const label = slot.labelKey ? t(slot.labelKey as never, { defaultValue: slot.label ?? slot.id }) : (slot.label ?? slot.id);
            return (
              <div
                key={slot.id}
                className="min-w-50 flex-1 snap-start rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-ink-3">
                  {label}
                </p>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Right rail: vertical stack of labeled slot cards that fills the stage height.
  if (vertical) {
    const weights =
      template.weights && template.weights.length === template.slots.length
        ? template.weights
        : template.slots.map(() => 1);

    return (
      <div className={cn("flex size-full flex-col gap-3", className)}>
        {template.slots.map((slot, i) => {
          const body = renderContent(slot.id);
          if (!body) return null;
          const label = slot.labelKey ? t(slot.labelKey as never, { defaultValue: slot.label ?? slot.id }) : (slot.label ?? slot.id);
          return (
            <section
              key={slot.id}
              aria-label={label}
              style={{ flexGrow: weights[i] }}
              className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-line bg-surface p-3.5 shadow-2xs"
            >
              <div className="flex min-h-0 flex-1 flex-col justify-center">
                {body}
              </div>
            </section>
          );
        })}
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
        className="grid w-full items-stretch gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-2xs"
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
                i > 0 && "border-l border-line pl-4",
              )}
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
