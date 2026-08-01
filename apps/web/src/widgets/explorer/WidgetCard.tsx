"use client";

import { useCallback } from "react";
import { PanelTop } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useWidgetStore, widgetStore } from "@/widgets/widgetStore";
import { CATEGORY_LABEL } from "@/widgets/registry";
import { WidgetPreview } from "@/widgets/explorer/WidgetPreviews";
import type { WidgetDefinition } from "@/widgets/types";

export interface WidgetCardProps {
  widget: WidgetDefinition;
  className?: string;
}

/**
 * A single widget card shown inside the Widgets explorer.
 *
 * Layout (left-to-right):
 *   [Icon + Name + Tag] [Preview thumbnail] [Toggle switch]
 *
 * The card is clickable for quick toggle.
 * Enabling a widget pins it to the header dock bar automatically.
 */
export function WidgetCard({ widget, className }: WidgetCardProps) {
  const status = useWidgetStore((s) => s.instances[widget.id]?.status);
  const active = status !== "inactive";

  const handleToggle = useCallback(() => {
    widgetStore.getState().toggleWidget(widget.id);
  }, [widget.id]);

  const Icon = widget.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-all duration-200",
        "hover:shadow-sm hover:border-ink-2/30",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active
          ? "border-line bg-surface-2/30 shadow-xs"
          : "border-line/60 opacity-70 hover:opacity-100",
        className,
      )}
    >
      {/* Left: Icon + info */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200",
              active
                ? "border-line-2 bg-surface-2 text-ink"
                : "border-line bg-surface text-ink-3",
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                "truncate text-[0.85rem] font-medium transition-colors duration-200",
                active ? "text-ink" : "text-ink-2",
              )}
            >
              {widget.name}
            </h4>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-ink-3">
            {CATEGORY_LABEL[widget.category]}
          </span>
        </div>

        <p className="line-clamp-2 text-[0.75rem] leading-relaxed text-ink-3">
          {widget.description}
        </p>

        {/* Author + version + dock hint */}
        <div className="flex items-center gap-2 text-[0.62rem] text-ink-3/60">
          <span>{widget.author}</span>
          <span>·</span>
          <span>v{widget.version}</span>
          {widget.source !== "built-in" && (
            <>
              <span>·</span>
              <span className="capitalize">{widget.source}</span>
            </>
          )}
          {active && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-ink-2 font-medium">
                <PanelTop className="size-2.5" />
                Pinned to header
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Preview + toggle */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <WidgetPreview
          widgetId={widget.id}
          className="size-16 sm:size-18"
        />

        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Switch
            checked={active}
            onCheckedChange={handleToggle}
            aria-label={`Toggle ${widget.name}`}
          />
        </div>
      </div>
    </div>
  );
}
