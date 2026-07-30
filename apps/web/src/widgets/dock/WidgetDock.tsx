"use client";

import { useRef, useCallback, useLayoutEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive, useDropX, useDraggingWidgetId, dockZoneState } from "@/widgets/dock/dockZoneState";
import type { WidgetId } from "@/widgets/types";

const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Horizontal drag**: reorders within the dock (macOS‑style).
 * - **Vertical drag down**: undocks to a free‑floating minimized pill.
 * - **Click**: launches the widget as a floating panel at a smart position.
 */
function DockPill({
  widgetId,
  onPillRef,
}: {
  widgetId: WidgetId;
  onPillRef?: (id: string, el: HTMLElement | null) => void;
}) {
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

    // Compute a smart launch position if the stored position is unreasonable
    // (behind sidebar, off-screen, under header, etc.)
    const pos = inst.position;
    const panelW = definition.panelWidth ?? 340;
    const isReasonable =
      pos &&
      pos.x >= 72 && // right of left sidebar
      pos.y >= 60 && // below header
      pos.x + panelW < window.innerWidth - 16 &&
      pos.y < window.innerHeight - 60;

    if (!isReasonable) {
      // Count currently-open floating widgets for a cascade offset
      const floatingCount = Object.values(store.instances).filter(
        (i) => i.status === "floating" || i.status === "minimized",
      ).length;
      store.setPosition(widgetId, {
        x: Math.max(72, Math.round((window.innerWidth - panelW) / 2)),
        y: 72 + floatingCount * 30,
      });
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
          ref={(el: HTMLElement | null) => onPillRef?.(widgetId, el)}
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
 * undock, click to launch. When dragging a floating widget over the dock,
 * a thin accent bar shows where it will be inserted.
 */
export function WidgetDock() {
  const dockOrder = useWidgetStore((s) => s.dockOrder);
  const instances = useWidgetStore((s) => s.instances);
  const isDockZoneActive = useDockZoneActive();
  const dropX = useDropX();
  const draggingId = useDraggingWidgetId();

  // ── Pill refs for position calculation ─────────────────────────────────
  const pillRefs = useRef<Map<string, HTMLElement>>(new Map());

  const onPillRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) pillRefs.current.set(id, el);
    else pillRefs.current.delete(id);
  }, []);

  // ── Insertion index calculation ───────────────────────────────────────
  const [insertIndex, setInsertIndex] = useState(-1);

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

  useLayoutEffect(() => {
    if (!isDockZoneActive || dockedIds.length === 0) {
      setInsertIndex(-1);
      dockZoneState.setDropIndex(-1);
      return;
    }

    // Sort pill elements by their DOM position (left to right)
    const sorted = [...pillRefs.current.entries()]
      .filter(([id]) => dockedIds.includes(id))
      .sort((a, b) => {
        const ra = a[1].getBoundingClientRect();
        const rb = b[1].getBoundingClientRect();
        return ra.left - rb.left;
      });

    if (sorted.length === 0) {
      setInsertIndex(0);
      dockZoneState.setDropIndex(0);
      return;
    }

    // Find where dropX falls among pills: insert before the first pill whose
    // center is to the right of dropX
    let idx = sorted.length; // default: append to end
    for (let i = 0; i < sorted.length; i++) {
      const rect = sorted[i][1].getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (dropX < midX) {
        idx = i;
        break;
      }
    }

    setInsertIndex(idx);
    dockZoneState.setDropIndex(idx);
  }, [dropX, isDockZoneActive, dockedIds]);

  // ── Build display list with ghost pill ─────────────────────────────────
  const draggingDef = draggingId ? getWidget(draggingId) : undefined;
  const GHOST_ID = "__ghost__";

  const displayIds = useMemo(() => {
    if (!isDockZoneActive || insertIndex < 0) return dockedIds;
    const ids = [...dockedIds];
    const idx = Math.min(insertIndex, ids.length);
    ids.splice(idx, 0, GHOST_ID);
    return ids;
  }, [dockedIds, isDockZoneActive, insertIndex]);

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
    <div className="flex flex-1 items-center justify-center px-1">
      <Reorder.Group
        as="div"
        axis="x"
        values={dockedIds}
        onReorder={handleReorder}
        className="flex items-center gap-1.5"
        role="toolbar"
        aria-label="Docked widgets"
      >
        <AnimatePresence mode="popLayout">
          {displayIds.map((id) => {
            if (id === GHOST_ID) {
              const GhostIcon = draggingDef?.icon;
              return (
                <motion.div
                  key={GHOST_ID}
                  layout
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-accent/50 bg-accent/5 px-2.5 text-xs font-medium"
                  aria-hidden
                >
                  {GhostIcon && <GhostIcon className="size-3.5 shrink-0 text-accent/60" />}
                  <span className="truncate max-w-28 text-accent/60">
                    {draggingDef?.name ?? ""}
                  </span>
                </motion.div>
              );
            }
            return <DockPill key={id} widgetId={id} onPillRef={onPillRef} />;
          })}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}
