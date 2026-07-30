"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  widgetStore,
  useWidgetStore,
} from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive } from "@/widgets/dock/dockZoneState";
import type { WidgetId } from "@/widgets/types";

const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Click**: launches the widget as a floating panel just below the header.
 * - **Drag downward**: undocks (transitions to floating minimized pill).
 * - **Active state**: highlighted when the floating panel is currently visible.
 */
function DockPill({ widgetId }: { widgetId: WidgetId }) {
  const definition = getWidget(widgetId);
  const status = useWidgetStore((s) => s.instances[widgetId]?.status);

  // ── Drag-to-undock ───────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  const isFloating = status === "floating" || status === "minimized";
  const isDocked = status === "docked";

  if (!definition || !isDocked) return null;

  const Icon = definition.icon;

  const handleClick = () => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;

    // Launch: show floating panel at its defined position
    store.setStatus(widgetId, "floating");
    if (!inst.position && definition.defaultPosition) {
      store.setPosition(widgetId, definition.defaultPosition);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      pointerId: (e.nativeEvent as PointerEvent).pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(
      (e.nativeEvent as PointerEvent).pointerId,
    );
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.active && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      state.active = true;
      setIsDragging(true);
    }

    if (state.active) {
      setGhostPos({ x: e.clientX - 60, y: e.clientY - 14 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (state) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(
          state.pointerId,
        );
      } catch {
        /* ignore */
      }
    }

    if (state?.active) {
      const totalDy = e.clientY - state.startY;
      if (totalDy > 35) {
        // Undock: transition to floating minimized pill at cursor position
        const store = widgetStore.getState();
        store.setStatus(widgetId, "minimized");
        store.setPosition(widgetId, {
          x: Math.max(0, e.clientX - 80),
          y: Math.max(0, e.clientY - 14),
        });
      }
    } else {
      // Not a drag → click
      handleClick();
    }

    dragRef.current = null;
    setIsDragging(false);
    setGhostPos({ x: 0, y: 0 });
  };

  return (
    <>
      {/* The dock pill */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={cn(
              "relative flex h-8 shrink-0 touch-none select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-all duration-200 cursor-grab active:cursor-grabbing",
              isFloating
                ? "border-accent/50 bg-accent/15 text-accent font-semibold shadow-sm ring-1 ring-accent/20"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hover:border-ink/20",
            )}
            aria-label={`${definition.name} — ${isFloating ? "open" : "pinned"}`}
          >
            {isFloating && (
              <span className="size-1.5 shrink-0 rounded-full bg-accent animate-pulse" />
            )}
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate max-w-28">{definition.name}</span>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{definition.name}</span>
            <span className="text-[10px] text-ink-3">Pinned to header — Click to open · Drag down to float</span>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Ghost pill during undock drag */}
      {isDragging &&
        createPortal(
          <div
            className="pointer-events-none fixed z-60 flex h-8 items-center gap-1.5 rounded-md border border-ink/20 bg-surface px-2.5 shadow-xl"
            style={{ left: ghostPos.x, top: ghostPos.y }}
          >
            <Icon className="size-3 shrink-0" />
            <span className="text-[0.65rem] font-medium text-ink truncate">
              {definition.name}
            </span>
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
 * Shows all widgets with `status === 'docked'` as compact pills in a
 * dynamically-flowing flex row. Each pill takes its natural width
 * (icon + name) — no fixed grid.
 *
 * - **Click pill**: launches the floating panel just below the header.
 * - **Drag pill down**: undocks it to a free-floating minimized pill.
 * - **Drop floating widget on header**: docks it (detected by FloatingWidgetWrapper).
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
    .filter(([id, inst]) => inst?.status === "docked" && !orderedSet.has(id) && !EXCLUDED_FROM_DOCK.has(id))
    .map(([id]) => id);

  const dockedIds = [...orderedDocked, ...extraDocked];

  if (dockedIds.length === 0 && !isDockZoneActive) return null;

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto px-1 max-w-full"
      role="toolbar"
      aria-label="Docked widgets"
    >
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {dockedIds.map((id) => (
            <DockPill key={id} widgetId={id} />
          ))}
          {isDockZoneActive && (
            <motion.div
              key="dock-target-pill"
              initial={{ opacity: 0, width: 0, scaleX: 0.5 }}
              animate={{ opacity: 1, width: "2.5rem", scaleX: 1 }}
              exit={{ opacity: 0, width: 0, scaleX: 0.5 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="h-8 shrink-0 rounded-md border border-dashed border-ink/25 bg-ink/[0.03]"
              aria-hidden
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
