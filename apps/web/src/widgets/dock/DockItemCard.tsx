"use client";

import { useCallback } from "react";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetStore } from "@/widgets/widgetStore";
import { useTranslation } from "react-i18next";
import type { DockItemDef } from "@/widgets/dock/dockRegistry";

export interface DockItemCardProps {
  item: DockItemDef;
  /** Whether this item is currently in the dock. */
  inDock: boolean;
  className?: string;
}

/**
 * A single dockable-item card inside the Dock Explorer.
 *
 * Visually matches WidgetCard: same border, padding, icon style.
 * Instead of a toggle, shows a round "add" or "in-dock" indicator.
 */
export function DockItemCard({ item, inDock, className }: DockItemCardProps) {
  const { t } = useTranslation("dock");
  const Icon = item.icon;

  const handleClick = useCallback(() => {
    const store = widgetStore.getState();
    if (inDock) {
      store.removeDockItem(item.id);
    } else {
      // For widgets, also make sure the widget is active (not inactive)
      if (item.widgetId) {
        const inst = store.instances[item.widgetId];
        if (inst?.status === "inactive") {
          store.toggleWidget(item.widgetId);
        }
      }
      store.addDockItem(item.id);
    }
  }, [item.id, item.widgetId, inDock]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-all duration-200",
        "hover:shadow-sm hover:border-ink-2/30",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        inDock
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
              inDock
                ? "border-line-2 bg-surface-2 text-ink"
                : "border-line bg-surface text-ink-3",
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                "truncate text-[0.85rem] font-medium leading-5 transition-colors duration-200",
                inDock ? "text-ink" : "text-ink-2",
              )}
            >
              {t(item.labelKey)}
            </h4>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-ink-3">
            {t(`kind.${item.kind}`)}
          </span>
        </div>

        <p className="line-clamp-2 text-[0.75rem] leading-5 text-ink-3">
          {t(`desc.${item.kind}`)}
        </p>
      </div>

      {/* Right: Add/Check indicator */}
      <div className="flex shrink-0 flex-col items-center justify-center">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full border transition-all duration-200",
            inDock
              ? "border-ink-2 bg-ink-2 text-canvas"
              : "border-line bg-surface text-ink-3 group-hover:border-ink-2/50 group-hover:text-ink-2",
          )}
        >
          {inDock ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
        </div>
      </div>
    </div>
  );
}
