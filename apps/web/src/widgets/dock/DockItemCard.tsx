"use client";

import { useCallback, useMemo } from "react";
import { Plus, Minus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { useTranslation } from "react-i18next";
import type { DockAreaDef } from "@/widgets/dock/dockAreasRegistry";

export interface DockItemCardProps {
  item: DockAreaDef;
  className?: string;
}

/**
 * A single dockable-item card inside the Dock Explorer.
 *
 * - **Non-repeatable items**: shows a professional toggle switch (on/off).
 * - **Repeatable items** (spacer, separator): shows a counter with +/- buttons.
 * - **Locked items** (widgets): shows a lock icon, always on.
 */
export function DockItemCard({ item, className }: DockItemCardProps) {
  const { t } = useTranslation("dock");
  const Icon = item.icon;

  const dockAreaOrder = useWidgetStore((s) => s.dockAreaOrder);

  // Count how many instances of this area exist in the dock
  const count = useMemo(
    () => dockAreaOrder.filter((id) => id === item.id).length,
    [dockAreaOrder, item.id],
  );

  const inDock = count > 0;
  const isLocked = item.removable === false;
  const isRepeatable = item.repeatable === true;

  const handleAdd = useCallback(() => {
    const store = widgetStore.getState();
    store.addDockArea(item.id);
  }, [item.id]);

  const handleRemove = useCallback(() => {
    const store = widgetStore.getState();
    // Remove the last occurrence
    const order = [...store.dockAreaOrder];
    const lastIdx = order.lastIndexOf(item.id);
    if (lastIdx >= 0) {
      order.splice(lastIdx, 1);
      store.setDockAreaOrder(order);
    }
  }, [item.id]);

  const handleToggle = useCallback(() => {
    if (isLocked) return;
    const store = widgetStore.getState();
    if (inDock) {
      // Remove all instances
      store.setDockAreaOrder(store.dockAreaOrder.filter((id) => id !== item.id));
    } else {
      store.addDockArea(item.id);
    }
  }, [item.id, inDock, isLocked]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={!isRepeatable && !isLocked ? handleToggle : undefined}
      onKeyDown={(e) => {
        if (!isRepeatable && !isLocked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-all duration-200",
        "hover:shadow-sm hover:border-ink-2/30",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        inDock
          ? "border-line bg-surface-2/30 shadow-xs"
          : "border-line/60 opacity-70 hover:opacity-100",
        isLocked && "opacity-100 cursor-default",
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
            {t(`kind.${item.category}`)}
          </span>
        </div>

        <p className="line-clamp-2 text-[0.75rem] leading-5 text-ink-3">
          {item.descKey ? t(item.descKey) : t(`desc.${item.category}`)}
        </p>
      </div>

      {/* Right: Toggle / Counter / Lock */}
      <div className="flex shrink-0 flex-col items-center justify-center">
        {isLocked ? (
          /* Locked indicator — always on, can't be removed */
          <div className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3">
            <Lock className="size-3.5" />
          </div>
        ) : isRepeatable ? (
          /* Counter with +/- for repeatable items */
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={count === 0}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                count > 0
                  ? "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
                  : "border-line/50 bg-surface text-ink-3/30 cursor-not-allowed",
              )}
              aria-label={`Remove ${t(item.labelKey)}`}
            >
              <Minus className="size-3" />
            </button>
            <span className="nums w-5 text-center text-[0.72rem] font-medium text-ink">
              {count}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAdd();
              }}
              className="grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={`Add ${t(item.labelKey)}`}
            >
              <Plus className="size-3" />
            </button>
          </div>
        ) : (
          /* Professional toggle switch for non-repeatable items */
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
              inDock ? "bg-ink" : "bg-line",
            )}
            role="switch"
            aria-checked={inDock}
            aria-label={`${inDock ? "Remove" : "Add"} ${t(item.labelKey)}`}
          >
            <span
              className={cn(
                "inline-block size-3.5 rounded-full bg-canvas shadow-xs transition-transform duration-200",
                inDock ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
}
