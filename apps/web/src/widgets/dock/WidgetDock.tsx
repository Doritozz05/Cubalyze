"use client";

import { useRef, useCallback, useLayoutEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive, useDropX, useDraggingWidgetId, dockZoneState } from "@/widgets/dock/dockZoneState";
import type { WidgetId } from "@/widgets/types";

const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Click**: launches the widget as a floating panel at a smart position.
 * - **Vertical drag down**: undocks to a free‑floating minimized pill with ghost preview.
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

  const [isUndocking, setIsUndocking] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  const draggedRef = useRef(false);

  if (!definition || !isDocked) return null;

  const Icon = definition.icon;

  const handleClick = () => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;

    store.setStatus(widgetId, "floating");

    // Compute a smart launch position if the stored position is unreasonable
    const pos = inst.position;
    const panelW = inst.panelWidth ?? 340;
    const isReasonable =
      pos &&
      pos.x >= 72 &&
      pos.y >= 60 &&
      pos.x + panelW < window.innerWidth - 16 &&
      pos.y < window.innerHeight - 60;

    if (!isReasonable) {
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
    <>
      <Reorder.Item
        as="button"
        value={widgetId}
        drag
        layout
        ref={(el: HTMLElement | null) => onPillRef?.(widgetId, el)}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: isUndocking ? 0 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        whileDrag={{ scale: 1.08, boxShadow: "0 8px 25px rgba(0,0,0,0.15)", zIndex: 60 }}
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          handleClick();
        }}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDrag={(_e, info) => {
          if (info.offset.y > 28) {
            if (!isUndocking) setIsUndocking(true);
            setGhostPos({
              x: Math.max(0, Math.min(window.innerWidth - 120, info.point.x - 60)),
              y: Math.max(64, Math.min(window.innerHeight - 40, info.point.y - 16)),
            });
          } else if (isUndocking) {
            setIsUndocking(false);
          }
        }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 35) {
            const store = widgetStore.getState();
            store.setStatus(widgetId, "minimized");
            store.setPosition(widgetId, {
              x: Math.max(0, Math.min(window.innerWidth - 120, info.point.x - 60)),
              y: Math.max(64, Math.min(window.innerHeight - 40, info.point.y - 16)),
            });
          }
          draggedRef.current = false;
          setIsUndocking(false);
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

      {/* Ghost pill portal during undock drag */}
      {isUndocking &&
        createPortal(
          <div
            className="pointer-events-none fixed z-60 flex h-8 items-center gap-1.5 rounded-md border border-ink/20 bg-surface px-2.5 shadow-xl text-xs font-medium text-ink"
            style={{ left: ghostPos.x, top: ghostPos.y }}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate max-w-28">{definition.name}</span>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Widget Dock ──────────────────────────────────────────────────────────

/**
 * The widget dock — rendered in the header center area.
 *
 * Shows all widgets with `status === 'docked'` as compact pills.
 * Click to launch, drag down to undock. When dragging a floating widget over
 * the dock, a gap spacer is rendered at the target drop position.
 */
export function WidgetDock() {
  const dockOrder = useWidgetStore((s) => s.dockOrder);
  const instances = useWidgetStore((s) => s.instances);
  const isDockZoneActive = useDockZoneActive();
  const dropX = useDropX();
  const draggingWidgetId = useDraggingWidgetId();

  // ── Pill refs for position calculation ─────────────────────────────────
  const pillRefs = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const onPillRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) pillRefs.current.set(id, el);
    else pillRefs.current.delete(id);
  }, []);

  // ── Ghost index for dock-from-floating pill shifting ────────────────────
  const [ghostIndex, setGhostIndex] = useState(-1);
  const GHOST_ID = "__dock_ghost__";

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

  // ── Memoize so the array identity is stable across renders ───────────────
  // Without this, `dockedIds` is a new reference on every render, which makes
  // useLayoutEffect/useMemo that depend on it fire on every render.
  const dockedIds = useMemo(
    () => [...orderedDocked, ...extraDocked],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dockOrder, instances],
  );

  // ── Ghost position from CONTAINER (stable — ghost doesn't create feedback) ─
  // Using the container width as reference (not pill positions that shift with
  // the ghost) breaks the feedback loop that plagued the grey-spacer approach.
  useLayoutEffect(() => {
    if (!isDockZoneActive || dockedIds.length === 0 || !draggingWidgetId) {
      setGhostIndex(-1);
      dockZoneState.setDropIndex(-1);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeX = dropX - rect.left;
    const proportion = Math.max(0, Math.min(1, relativeX / rect.width));
    const idx = Math.round(proportion * dockedIds.length);

    setGhostIndex(idx);
    dockZoneState.setDropIndex(idx);
  }, [dropX, isDockZoneActive, dockedIds, draggingWidgetId]);

  // ── Display list: insert invisible ghost at calculated index ──────────
  const displayIds = useMemo(() => {
    if (!isDockZoneActive || ghostIndex < 0 || !draggingWidgetId) return dockedIds;
    const ids = [...dockedIds];
    ids.splice(Math.min(ghostIndex, ids.length), 0, GHOST_ID);
    return ids;
  }, [dockedIds, isDockZoneActive, ghostIndex, draggingWidgetId]);

  const handleReorder = (newOrder: WidgetId[]) => {
    const current = widgetStore.getState().dockOrder;
    const visibleSet = new Set(newOrder);
    const invisible = current.filter((id) => !visibleSet.has(id));
    widgetStore.getState().setDockOrder([...newOrder, ...invisible]);
  };

  if (dockedIds.length === 0 && !isDockZoneActive) return null;

  return (
    <div
      ref={containerRef}
      className="flex flex-1 items-center justify-center px-1"
      role="toolbar"
      aria-label="Docked widgets"
    >
      <Reorder.Group
        as="div"
        axis="x"
        values={dockedIds}
        onReorder={handleReorder}
        className="flex items-center gap-1.5"
      >
        <AnimatePresence mode="popLayout">
          {displayIds.map((id) => {
            if (id === GHOST_ID) {
              return (
                <motion.div
                  key={GHOST_ID}
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 0, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="h-8 shrink-0"
                  aria-hidden
                />
              );
            }
            return <DockPill key={id} widgetId={id} onPillRef={onPillRef} />;
          })}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}

