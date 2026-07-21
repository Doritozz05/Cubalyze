"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  widgetStore,
  useWidgetStore,
} from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import type { WidgetId } from "@/widgets/types";

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Click**: toggles the widget's floating panel visible/invisible.
 *   If activating, positions the panel just below the header.
 * - **Drag downward**: undocks (transitions back to floating mode).
 * - **Active state**: highlighted when the floating panel is currently visible.
 */
function DockPill({ widgetId }: { widgetId: WidgetId }) {
  const definition = getWidget(widgetId);
  const instance = useWidgetStore(
    useCallback((s) => s.instances[widgetId], [widgetId]),
  );

  // ── Drag-to-undock ───────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  const isVisible = instance?.dockMode === "floating";
  const isDocked = instance?.dockMode === "docked";

  if (!definition || !isDocked) return null;

  const Icon = definition.icon;

  const handleClick = () => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;

    // Launch: undock and show floating panel below header
    store.setDockMode(widgetId, "floating");
    store.setMinimized(widgetId, false);
    const fresh = widgetStore.getState();
    if (!fresh.instances[widgetId]?.visible) {
      fresh.toggleWidget(widgetId);
    }
    // Only set default position on first launch
    const hasCustomPosition =
      inst.position &&
      (inst.position.x > 10 || inst.position.y > 80);
    if (!hasCustomPosition) {
      store.setPosition(widgetId, {
        x: Math.max(50, (window.innerWidth - 360) / 2),
        y: 68,
      });
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
        // Undock: transition to floating at cursor position, show as pill
        const store = widgetStore.getState();
        store.setDockMode(widgetId, "floating");
        store.setPosition(widgetId, {
          x: Math.max(0, e.clientX - 80),
          y: Math.max(0, e.clientY - 14),
        });
        store.setMinimized(widgetId, true);
        const fresh = widgetStore.getState();
        if (!fresh.instances[widgetId]?.visible) {
          fresh.toggleWidget(widgetId);
        }
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
          "relative flex h-8 shrink-0 touch-none select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-all duration-150",
          isVisible
            ? "border-ink/15 bg-ink/5 text-ink"
            : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
        )}
        title={`${definition.name} — ${isVisible ? "visible" : "hidden"}. Drag down to undock.`}
        aria-label={`${definition.name} — ${isVisible ? "visible" : "hidden"}`}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate max-w-28">{definition.name}</span>
      </motion.button>

      {/* Ghost pill during undock drag */}
      {isDragging &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[60] flex h-8 items-center gap-1.5 rounded-md border border-ink/20 bg-surface px-2.5 shadow-xl"
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
 * Shows all widgets with `dockMode === 'docked'` as compact pills in a
 * dynamically-flowing flex row. Each pill takes its natural width
 * (icon + name) — no fixed grid.
 *
 * - **Click pill**: toggles the floating panel on/off just below the header.
 * - **Drag pill down**: undocks it back to free-floating mode.
 * - **Drop floating widget on header**: docks it (detected by FloatingWidgetWrapper).
 */
export function WidgetDock() {
  const dockOrder = useWidgetStore((s) => s.dockOrder);
  const instances = useWidgetStore((s) => s.instances);

  // Filter to docked widgets that are also active (not toggled off in WidgetExplorer)
  const dockedIds = dockOrder.filter((id) => {
    const inst = instances[id];
    return inst && inst.dockMode === "docked" && inst.visible;
  });

  if (dockedIds.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto px-1"
      role="toolbar"
      aria-label="Docked widgets"
    >
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {dockedIds.map((id) => (
            <DockPill key={id} widgetId={id} />
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
