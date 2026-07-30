"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable, type SnapRect } from "@/hooks/useDraggable";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { dockZoneState } from "@/widgets/dock/dockZoneState";
import type { WidgetId } from "@/widgets/types";

export interface FloatingWidgetWrapperProps {
  widgetId: WidgetId;
  icon: LucideIcon;
  label: string;
  pillBadge?: string;
  pillBadge2?: string;
  panelWidth?: number;
  panelMaxHeight?: number;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  defaultPosition?: { x: number; y: number };
}

export function FloatingWidgetWrapper({
  widgetId,
  icon: Icon,
  label,
  pillBadge,
  pillBadge2,
  panelWidth = 340,
  panelMaxHeight,
  headerActions,
  children,
  className,
  defaultPosition = { x: 100, y: 100 },
}: FloatingWidgetWrapperProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    return () => { dockZoneState.leave(widgetId); };
  }, [widgetId]);

  const instance = useWidgetStore((s) => s.instances[widgetId]);
  const storePosition = instance?.position ?? defaultPosition;
  const status = instance?.status;
  const minimized = status === "minimized";
  const zIndex = instance?.zIndex ?? 25;

  useEffect(() => {
    widgetStore.getState().setSize(widgetId, panelWidth);
  }, [widgetId, panelWidth]);

  const allInstances = useWidgetStore((s) => s.instances);
  const snapTargets = useMemo<SnapRect[]>(() => {
    return Object.entries(allInstances)
      .filter(([id, inst]) => {
        if (id === widgetId) return false;
        const s = inst?.status;
        return s === "floating" || s === "minimized";
      })
      .map(([, inst]) => ({
        x: inst.position.x,
        y: inst.position.y,
        w: inst.panelWidth ?? 340,
        h: Math.round((inst.panelWidth ?? 340) * 0.85),
      }));
  }, [allInstances, widgetId]);

  const DOCK_THRESHOLD = 30;

  const handlePositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      const store = widgetStore.getState();
      dockZoneState.leave(widgetId);
      if (pos.y < DOCK_THRESHOLD) {
        const index = dockZoneState.dropIndex;
        store.dockAt(widgetId, index);
        store.setPosition(widgetId, pos);
      } else {
        store.setPosition(widgetId, pos);
      }
    },
    [widgetId],
  );

  const drag = useDraggable<HTMLDivElement>(storePosition, {
    clickThreshold: 4,
    onPositionChange: handlePositionChange,
    onDrag: (pos) => {
      if (pos.y < 50) dockZoneState.enter(widgetId, pos.x);
      else dockZoneState.leave(widgetId);
    },
    snapThreshold: 8,
    snapTargets,
  });

  const handleFocus = useCallback(() => {
    widgetStore.getState().focusWidget(widgetId);
  }, [widgetId]);

  const toggleMinimized = useCallback(() => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;
    const newStatus = inst.status === "minimized" ? "floating" : "minimized";
    store.setStatus(widgetId, newStatus);
  }, [widgetId]);

  if (!mounted) return null;

  const isNearDock = drag.position.y < 50;

  // ── 1. Minimized pill ──────────────────────────────────────────────────
  //    When near dock, CSS-only switch to dock-pill style (same DOM, no unmount)
  if (minimized) {
    return createPortal(
      <motion.div
        ref={drag.elementRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{ left: drag.position.x, top: drag.position.y, zIndex }}
        onPointerDown={(e) => { handleFocus(); drag.onPointerDown(e); }}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "fixed flex touch-none select-none items-center shadow-lg",
          // Dock zone: compact pill style (same as DockPill)
          isNearDock
            ? "h-8 gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium cursor-grabbing"
            // Normal minimized: bigger pill
            : "gap-2 rounded-lg border border-line bg-surface py-2 pl-3 pr-2 cursor-grab hover:border-ink-2/40",
          drag.isDragging && !isNearDock && "shadow-2xl",
          className,
        )}
      >
        <Icon className={cn("shrink-0 text-ink-3", isNearDock ? "size-3.5" : "size-4")} />
        <span className={cn("font-medium text-ink", isNearDock ? "text-xs truncate max-w-28" : "text-xs")}>
          {label}
        </span>
        {pillBadge && !isNearDock && <span className="nums text-[0.65rem] text-ink">{pillBadge}</span>}
        {pillBadge2 && !isNearDock && <span className="nums text-[0.55rem] text-ink-3">{pillBadge2}</span>}
        {!isNearDock && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleMinimized(); }}
            className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Expand"
          >
            <ChevronUp className="size-3.5" />
          </button>
        )}
      </motion.div>,
      document.body,
    );
  }

  // ── 2. Expanded panel / dock pill ──────────────────────────────────────
  //    When near dock: hide body, shrink to h-8, same DOM (no unmount)
  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={cn("shrink-0 text-ink-3", isNearDock ? "size-3.5" : "size-3.5")} />
        <span className={cn("font-medium text-ink", isNearDock ? "text-xs truncate max-w-28" : "text-xs")}>
          {label}
        </span>
        {pillBadge && !isNearDock && <span className="nums text-[0.6rem] text-ink-3">{pillBadge}</span>}
        {pillBadge2 && !isNearDock && <span className="nums text-[0.55rem] text-ink-3">{pillBadge2}</span>}
      </div>
      {!isNearDock && (
        <div className="flex items-center gap-0.5">
          {headerActions}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleMinimized(); }}
            className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      )}
    </>
  );

  return createPortal(      <motion.div
      ref={drag.elementRef}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{
        left: drag.position.x,
        top: drag.position.y,
        width: isNearDock ? undefined : panelWidth,
        zIndex,
      }}
      onPointerDown={handleFocus}
      className={cn(
        "fixed flex touch-none select-none overflow-hidden rounded-lg border border-line bg-surface",
        // Dock zone: compact pill
        isNearDock
          ? "h-8 shadow-lg"
          // Normal: expanded panel
          : "flex-col shadow-xl",
        drag.isDragging && "shadow-2xl",
        className,
      )}
    >
      {/* Drag handle / header — becomes the whole pill in dock zone */}
      <div
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "flex items-center justify-between shrink-0",
          // Dock zone: compact, no border
          isNearDock
            ? "h-8 px-2.5 gap-1.5 rounded-md text-xs font-medium cursor-grabbing"
            // Normal: header with border
            : "border-b border-line px-3 py-2 gap-2 cursor-grab",
          drag.isDragging && !isNearDock && "cursor-grabbing",
        )}
      >
        {headerContent}
      </div>

      {/* Body — hidden when in dock zone */}
      {!isNearDock && (
        <div
          className="min-h-0 overflow-y-auto"
          style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
        >
          {children}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
