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

// ── Props ────────────────────────────────────────────────────────────────

export interface FloatingWidgetWrapperProps {
  /** Widget id for reading/writing state to widgetStore. */
  widgetId: WidgetId;
  /** Icon shown in the header and minimized pill. */
  icon: LucideIcon;
  /** Label shown in the header and minimized pill. */
  label: string;
  /** Optional badge text (e.g. solve count, PB time). Shown after the label. */
  pillBadge?: string;
  /** Optional second badge. */
  pillBadge2?: string;
  /** Width of the expanded panel (px). Default 340. */
  panelWidth?: number;
  /** Max-height of the expanded body for scroll overflow. */
  panelMaxHeight?: number;
  /** Extra actions rendered in the header (e.g. "Clear" button). */
  headerActions?: ReactNode;
  /** Body content when expanded. */
  children: ReactNode;
  /** Optional className applied to both pill and panel containers. */
  className?: string;
  /** Fallback default position if widgetStore has no entry. */
  defaultPosition?: { x: number; y: number };
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Shared wrapper for all floating widgets.
 *
 * Handles: portal, drag, minimize/expand pill+panel, header, animations,
 * soft snap to viewport and other widgets.
 *
 * Reads `status` from the store:
 *   - `"minimized"` → renders a small draggable pill
 *   - `"floating"` → renders the expanded panel with header+body
 */
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

  // Clean up dock zone state on unmount (idempotent per widget id)
  useEffect(() => {
    return () => {
      dockZoneState.leave(widgetId);
    };
  }, [widgetId]);

  // ── Read runtime state from widgetStore ────────────────────────────────
  const instance = useWidgetStore((s) => s.instances[widgetId]);

  const storePosition = instance?.position ?? defaultPosition;
  const status = instance?.status;
  const minimized = status === "minimized";
  const zIndex = instance?.zIndex ?? 25;

  // ── Snap targets: other floating/minimized widgets ────────────────────
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
        w: 280, // approximate; real sizes vary but this gives good snap results
        h: 200,
      }));
  }, [allInstances, widgetId]);

  // ── Drag: sync position back to store on change ────────────────────────
  const DOCK_THRESHOLD = 30; // px from top of viewport

  const handlePositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      const store = widgetStore.getState();
      dockZoneState.leave(widgetId);
      if (pos.y < DOCK_THRESHOLD) {
        store.setStatus(widgetId, "docked");
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
      if (pos.y < 50) dockZoneState.enter(widgetId);
      else dockZoneState.leave(widgetId);
    },
    snapThreshold: 8,
    snapTargets,
  });

  // Focus handler — brings this widget to the top of the z-stack
  const handleFocus = useCallback(() => {
    widgetStore.getState().focusWidget(widgetId);
  }, [widgetId]);

  // ── Minimize/expand toggle ─────────────────────────────────────────────
  const toggleMinimized = useCallback(() => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;
    const newStatus = inst.status === "minimized" ? "floating" : "minimized";
    store.setStatus(widgetId, newStatus);
  }, [widgetId]);

  if (!mounted) return null;

  // ── Shared header content ──────────────────────────────────────────────
  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-ink-3" />
        <span className="text-xs font-medium text-ink">{label}</span>
        {pillBadge && (
          <span className="nums text-[0.6rem] text-ink-3">{pillBadge}</span>
        )}
        {pillBadge2 && (
          <span className="nums text-[0.55rem] text-ink-3">{pillBadge2}</span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {headerActions}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleMinimized();
          }}
          className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>
    </>
  );

  // ── Minimized pill ─────────────────────────────────────────────────────
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
          "fixed flex touch-none select-none items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-3 pr-2 shadow-lg",
          drag.isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
          "transition-colors hover:border-ink-2/40",
          className,
        )}
      >
        <Icon className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">{label}</span>
        {pillBadge && (
          <span className="nums text-[0.65rem] text-ink">{pillBadge}</span>
        )}
        {pillBadge2 && (
          <span className="nums text-[0.55rem] text-ink-3">{pillBadge2}</span>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleMinimized();
          }}
          className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Expand"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────
  return createPortal(
    <motion.div
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{ left: drag.position.x, top: drag.position.y, width: panelWidth, zIndex }}
      onPointerDown={handleFocus}
      className={cn(
        "fixed flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
        drag.isDragging && "shadow-2xl",
        className,
      )}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "flex items-center justify-between border-b border-line px-3 py-2",
          drag.isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {headerContent}
      </div>

      {/* Body */}
      <div
        className="min-h-0 overflow-y-auto"
        style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
      >
        {children}
      </div>
    </motion.div>,
    document.body,
  );
}
