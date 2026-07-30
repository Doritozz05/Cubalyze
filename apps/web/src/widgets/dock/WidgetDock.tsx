"use client";

import { useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive } from "@/widgets/dock/dockZoneState";
import type { WidgetId } from "@/widgets/types";

const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Horizontal drag**: reorders within the dock (macOS‑style).
 * - **Vertical drag down**: undocks to a free‑floating minimized pill.
 * - **Click**: launches the widget as a floating panel.
 */
function DockPill({ widgetId }: { widgetId: WidgetId }) {
  const definition = getWidget(widgetId);
  const status = useWidgetStore((s) => s.instances[widgetId]?.status);
  const isDocked = status === "docked";

  // Guard: suppress onClick after a drag so micro-drags don't trigger launch
  const draggedRef = useRef(false);

  if (!definition || !isDocked) return null;

  const Icon = definition.icon;

  const handleClick = () => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;

    store.setStatus(widgetId, "floating");
    if (!inst.position && definition.defaultPosition) {
      store.setPosition(widgetId, definition.defaultPosition);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Reorder.Item
          as="button"
          value={widgetId}
          drag
          layout
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          whileDrag={{ scale: 1.08, boxShadow: "0 8px 25px rgba(0,0,0,0.15)", zIndex: 60 }}
          onDragStart={() => { draggedRef.current = true; }}
          onClick={() => {
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            handleClick();
          }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 35) {
              // Vertical drag down → undock
              const store = widgetStore.getState();
              store.setStatus(widgetId, "minimized");
              store.setPosition(widgetId, {
                x: Math.max(0, info.point.x - 80),
                y: Math.max(0, info.point.y - 14),
              });
            }
            draggedRef.current = false;
          }}
          className={cn(
            "relative flex h-8 shrink-0 touch-none select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-200",
            "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hover:border-ink/20",
            "cursor-grab active:cursor-grabbing",
          )}
          aria-label={`${definition.name} — pinned`}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate max-w-28">{definition.name}</span>
        </Reorder.Item>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{definition.name}</span>
          <span className="text-[10px] text-ink-3">
            Drag sideways to reorder · Drag down to float · Click to open
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Widget Dock ──────────────────────────────────────────────────────────

/**
 * The widget dock — rendered in the header center area.
 *
 * Shows all widgets with `status === 'docked'` as compact pills in an
 * Apple‑style draggable row. Drag horizontally to reorder, drag down to
 * undock, click to launch.
 */
export function WidgetDock() {
  const dockOrder = useWidgetStore((s) => s.dockOrder);
  const instances = useWidgetStore((s) => s.instances);
  const isDockZoneActive = useDockZoneActive();

  // Filter to docked widgets (exclude special widgets like cube-button)
  const orderedDocked = dockOrder.filter((id) => {
    if (EXCLUDED_FROM_DOCK.has(id)) return false;
    const inst = instances[id];
    return inst && inst.status === "docked";
  });
  const orderedSet = new Set(orderedDocked);
  const extraDocked = Object.entries(instances)
    .filter(
      ([id, inst]) =>
        inst?.status === "docked" &&
        !orderedSet.has(id) &&
        !EXCLUDED_FROM_DOCK.has(id),
    )
    .map(([id]) => id);

  const dockedIds = [...orderedDocked, ...extraDocked];

  const handleReorder = (newOrder: WidgetId[]) => {
    // Merge reordered visible pills with invisible (floating) items
    // that were in dockOrder — so they keep their position when re-docked.
    const current = widgetStore.getState().dockOrder;
    const visibleSet = new Set(newOrder);
    const invisible = current.filter((id) => !visibleSet.has(id));
    widgetStore.getState().setDockOrder([...newOrder, ...invisible]);
  };

  if (dockedIds.length === 0 && !isDockZoneActive) return null;

  return (
    <Reorder.Group
      as="div"
      axis="x"
      values={dockedIds}
      onReorder={handleReorder}
      className="flex flex-1 items-center justify-center gap-1.5 px-1"
      role="toolbar"
      aria-label="Docked widgets"
    >
      <AnimatePresence mode="popLayout">
        {dockedIds.map((id) => (
          <DockPill key={id} widgetId={id} />
        ))}

        {/* Drop-target indicator: shown when any widget is being dragged near the dock */}
        {isDockZoneActive && (
          <motion.div
            layout
            key="dock-target-pill"
            initial={{ opacity: 0, width: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, width: "2.5rem", scaleX: 1 }}
            exit={{ opacity: 0, width: 0, scaleX: 0.5 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="h-8 shrink-0 rounded-md border border-dashed border-ink/25 bg-ink/3"
            aria-hidden
          />
        )}
      </AnimatePresence>
    </Reorder.Group>
  );
}
