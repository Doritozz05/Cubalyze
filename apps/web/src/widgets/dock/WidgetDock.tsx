"use client";

import { useRef, useCallback, useLayoutEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive, useDropX, dockZoneState } from "@/widgets/dock/dockZoneState";
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

  const dragState = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const movedRef = useRef(false);
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

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
    movedRef.current = false;
    draggedRef.current = false;
    setIsUndocking(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture may fail on motion.button + asChild; drag still works.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state || e.pointerId !== state.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!movedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      movedRef.current = true;
    }

    if (!movedRef.current) return;

    // Trigger undock mode when dragging downwards
    if (dy > 28) {
      if (!isUndocking) setIsUndocking(true);
      setGhostPos({
        x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - 60)),
        y: Math.max(64, Math.min(window.innerHeight - 40, e.clientY - 16)),
      });
    } else if (isUndocking) {
      setIsUndocking(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;

    // Safety net: pointercancel may have cleared dragState mid-drag.
    // Rarely reached (pointercancel usually suppresses pointerup),
    // but harmless and catches edge cases across browsers.
    if (!state && movedRef.current && isUndocking) {
      draggedRef.current = true;
      widgetStore.getState().setPosition(widgetId, ghostPos);
      widgetStore.getState().setStatus(widgetId, "minimized");
      dragState.current = null;
      setIsUndocking(false);
      return;
    }

    if (!state || e.pointerId !== state.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(state.pointerId);
    } catch {
      /* ignore */
    }

    const dy = e.clientY - state.startY;

    if (movedRef.current && dy > 28) {
      draggedRef.current = true;
      const finalX = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - 60));
      const finalY = Math.max(64, Math.min(window.innerHeight - 40, e.clientY - 16));

      const store = widgetStore.getState();
      store.setPosition(widgetId, { x: finalX, y: finalY });
      store.setStatus(widgetId, "minimized");
    }

    dragState.current = null;
    setIsUndocking(false);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    // If we were dragging to undock, complete the undock with the last ghost position.
    if (movedRef.current && isUndocking) {
      draggedRef.current = true;
      widgetStore.getState().setPosition(widgetId, ghostPos);
      widgetStore.getState().setStatus(widgetId, "minimized");
    }

    if (dragState.current) {
      try {
        e.currentTarget.releasePointerCapture(dragState.current.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragState.current = null;
    setIsUndocking(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            layout
            ref={(el: HTMLButtonElement | null) => onPillRef?.(widgetId, el)}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: isUndocking ? 0.3 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => {
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              handleClick();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className={cn(
              "relative flex h-8 shrink-0 touch-none select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-200",
              "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hover:border-ink/20",
              "cursor-grab active:cursor-grabbing",
            )}
            aria-label={`${definition.name} — pinned`}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate max-w-28">{definition.name}</span>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{definition.name}</span>
            <span className="text-[10px] text-ink-3">
              Click to open · Drag down to float
            </span>
          </div>
        </TooltipContent>
      </Tooltip>

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

    // Find where dropX falls among pills
    let idx = sorted.length;
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

  // ── Build display list with gap spacer ────────────────────────────────
  const GAP_ID = "__gap__";

  const displayIds = useMemo(() => {
    if (!isDockZoneActive || insertIndex < 0) return dockedIds;
    const ids = [...dockedIds];
    const idx = Math.min(insertIndex, ids.length);
    ids.splice(idx, 0, GAP_ID);
    return ids;
  }, [dockedIds, isDockZoneActive, insertIndex]);

  if (dockedIds.length === 0 && !isDockZoneActive) return null;

  return (
    <div
      className="flex flex-1 items-center justify-center gap-1.5 px-1"
      role="toolbar"
      aria-label="Docked widgets"
    >
      <AnimatePresence mode="popLayout">
        {displayIds.map((id) => {
          if (id === GAP_ID) {
            return (
              <motion.div
                key={GAP_ID}
                layout
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "3rem" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className="h-8 shrink-0 rounded-md border border-dashed border-ink/25 bg-ink/3"
                aria-hidden
              />
            );
          }
          return <DockPill key={id} widgetId={id} onPillRef={onPillRef} />;
        })}
      </AnimatePresence>
    </div>
  );
}

