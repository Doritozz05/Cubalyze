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

import { SlotSparkline } from "./displays/SlotSparkline";
import { SlotHistogram } from "./displays/SlotHistogram";
import { SlotTpsCurve } from "./displays/SlotTpsCurve";
import { SlotPhaseDistribution } from "./displays/SlotPhaseDistribution";
import { SlotActivityHeatmap } from "./displays/SlotActivityHeatmap";
import { SlotImageViewer } from "./displays/SlotImageViewer";
import { CrossSolverSlot } from "./tools/CrossSolverSlot";

/** Display labels: WCA shorthand is literal, the rest are i18n. */
const STAT_LABELS: Record<BottomLayoutStatId, { literal?: string; key?: string }> = {
  ao5: { literal: "Ao5" },
  ao12: { literal: "Ao12" },
  ao50: { literal: "Ao50" },
  ao100: { literal: "Ao100" },
  ao500: { literal: "Ao500" },
  ao1000: { literal: "Ao1000" },
  mo3: { literal: "Mo3" },
  best: { key: "best" },
  worst: { key: "worst" },
  mean: { key: "mean" },
  median: { key: "median" },
  deviation: { key: "deviation" },
  iqr: { literal: "IQR" },
  dnfRate: { key: "dnfRate" },
  count: { key: "count" },
  sessionTime: { key: "sessionTime" },
  tps: { key: "tps" },
  bpa: { literal: "BPA" },
  wpa: { literal: "WPA" },
  bestAo5: { key: "bestAo5" },
  bestAo12: { key: "bestAo12" },
  subX: { key: "subX" },
};

function StatRow({ stat, value, accent, subXThreshold }: { stat: BottomLayoutStatId; value: string; accent?: boolean; subXThreshold?: number }) {
  const { t } = useTranslation("stats");
  const meta = STAT_LABELS[stat];
  const rawLabel = meta.literal ?? t(meta.key as never);
  const label = stat === "subX" ? `Sub-${subXThreshold ?? 20}` : rawLabel;
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
  /** Injected 3D scramble rendered by slots with a `scramble-3d` display. */
  scramble3d?: ReactNode;
  /** Raw scramble string used by solvers (e.g. cross solver). */
  currentScramble?: string;
  /** Force the compact mobile density (horizontal snap row). */
  compact?: boolean;
  /** Render vertical (right rail) instead of grid. */
  vertical?: boolean;
}

/**
 * Renderer for slot templates. Every piece of content lives INSIDE a named
 * slot: stats (any combination, BPA/WPA included), display blocks, or tools.
 */
export function SlotLayout({
  template,
  solves,
  puzzleFilter,
  className,
  slotContent,
  scramble2d,
  scramble3d,
  currentScramble,
  compact = false,
  vertical = false,
}: SlotLayoutProps) {
  const { t } = useTranslation("timer");
  
  // Find subX threshold if configured on any slot
  const subXConfig = Object.values(slotContent).find(
    (c): c is Extract<SlotContentConfig, { kind: "stats" }> =>
      c?.kind === "stats" && typeof c.subXThreshold === "number",
  );
  const subXThreshold = subXConfig?.subXThreshold ?? 20;

  const values = useBottomLayoutStats(solves, puzzleFilter, subXThreshold);

  if (template.slots.length === 0) return null;

  const renderContent = (slotId: string) => {
    const config = slotContent[slotId];
    if (!config) return null;

    if (config.kind === "tools") {
      if (config.tool === "cross-solver") {
        return (
          <CrossSolverSlot
            scramble={currentScramble}
            defaultFace={config.crossFace ?? "U"}
          />
        );
      }
      return null;
    }

    if (config.kind === "display") {
      const displayType = config.displays[0] ?? "scramble-2d";
      switch (displayType) {
        case "scramble-2d":
          return (
            <div className="flex min-w-0 flex-1 items-center justify-center py-1">
              {scramble2d}
            </div>
          );
        case "scramble-3d":
          // Full-bleed 3D canvas — the host wrapper provides the surface.
          return <div className="relative min-h-22 min-w-0 flex-1">{scramble3d}</div>;
        case "sparkline":
          return <SlotSparkline solves={solves} />;
        case "histogram":
          return <SlotHistogram solves={solves} />;
        case "tps-curve":
          return <SlotTpsCurve solves={solves} />;
        case "phase-distribution":
          return <SlotPhaseDistribution solves={solves} />;
        case "activity-heatmap":
          return <SlotActivityHeatmap solves={solves} />;
        case "image":
          return <SlotImageViewer config={config.imageConfig} />;
        default:
          return null;
      }
    }

    if (config.stats.length === 0) return null;
    return (
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 overflow-y-auto max-h-36 pr-1 scrollbar-thin">
        {config.stats.map((s) => (
          <StatRow
            key={s}
            stat={s}
            value={values[s]}
            accent={s === "bpa"}
            subXThreshold={config.subXThreshold ?? 20}
          />
        ))}
      </div>
    );
  };

  const isImageSlot = (config?: SlotContentConfig) =>
    config?.kind === "display" && config.displays[0] === "image";

  // Compact mobile: one horizontal snap row, each slot a card.
  if (compact) {
    return (
      <div data-context-zone="bottom-layout" className={cn("relative w-full", className)}>
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {template.slots.map((slot) => {
            const body = renderContent(slot.id);
            if (!body) return null;
            const isImage = isImageSlot(slotContent[slot.id]);
            const label = slot.labelKey ? t(slot.labelKey as never, { defaultValue: slot.label ?? slot.id }) : (slot.label ?? slot.id);
            return (
              <div
                key={slot.id}
                className={cn(
                  "min-w-50 flex-1 snap-start rounded-lg border border-line bg-surface min-h-0 flex flex-col justify-between overflow-hidden",
                  isImage ? "p-0" : "px-3 py-2.5",
                )}
              >
                {!isImage && (
                  <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-ink-3">
                    {label}
                  </p>
                )}
                <div className={cn("min-h-0 flex-1 overflow-y-auto max-h-36 scrollbar-thin", !isImage && "pr-0.5")}>
                  {body}
                </div>
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
      <div data-context-zone="bottom-layout" className={cn("flex size-full flex-col gap-3 min-h-0", className)}>
        {template.slots.map((slot, i) => {
          const body = renderContent(slot.id);
          if (!body) return null;
          const isImage = isImageSlot(slotContent[slot.id]);
          const label = slot.labelKey ? t(slot.labelKey as never, { defaultValue: slot.label ?? slot.id }) : (slot.label ?? slot.id);
          return (
            <section
              key={slot.id}
              aria-label={label}
              style={{ flexGrow: weights[i] }}
              className={cn(
                "flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-line bg-surface shadow-2xs overflow-hidden",
                isImage ? "p-0" : "p-3.5",
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto scrollbar-thin size-full">
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
    <div data-context-zone="bottom-layout" className={cn("relative w-full min-h-0", className)}>
      <div
        className="grid w-full items-stretch rounded-xl border border-line bg-surface shadow-2xs min-h-0 overflow-hidden"
        style={{ gridTemplateColumns }}
      >
        {template.slots.map((slot, i) => {
          const body = renderContent(slot.id);
          if (!body) return null;
          const isImage = isImageSlot(slotContent[slot.id]);
          return (
            <div
              key={slot.id}
              className={cn(
                "flex min-w-0 flex-col justify-center min-h-0 overflow-hidden",
                isImage ? "p-0" : "gap-1 max-h-40 overflow-y-auto scrollbar-thin px-4 py-3",
                i > 0 && "border-l border-line",
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
