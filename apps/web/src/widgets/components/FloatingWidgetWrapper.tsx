"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";
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

/** Threshold (px from top) for entering the dock zone. */
const DOCK_THRESHOLD = 30;

/**
 * Floating widget with professional, deterministic drag behavior.
 *
 * PERFORMANCE DESIGN:
 *
 * 1. **Transform-based positioning** — uses GPU-composited `translate3d()`
 *    instead of layout-triggering `left`/`top`. Zero layout thrashing.
 *
 * 2. **Minimal React re-renders during drag** — position is tracked via refs
 *    and applied directly to the DOM. React state is only updated at drag end
 *    or when the dock zone cross-threshold state changes.
 *
 * 3. **RAF-batched dock zone detection** — the `onDrag` callback is called
 *    at most once per animation frame, preventing cascading state updates
 *    on every pixel of movement.
 *
 * 4. **CSS animations for mount effects** — instead of framer-motion's
 *    complex animation system (which can interfere with pointer events and
 *    transform updates), we use simple CSS `@keyframes` animations.
 *
 * 5. **No framer-motion `motion.div`** — framer-motion's `motion` components
 *    add their own event handling layer that can conflict with our direct
 *    DOM manipulation and pointer capture logic. Using plain `<div>` ensures
 *    pointer events are delivered correctly.
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

  // ── Widget store subscriptions ─────────────────────────────────────────
  const instance = useWidgetStore((s) => s.instances[widgetId]);
  const storePosition = instance?.position ?? defaultPosition;
  const status = instance?.status;
  const minimized = status === "minimized";
  const zIndex = instance?.zIndex ?? 25;

  // Clean up dock zone state on unmount
  useEffect(() => {
    return () => {
      dockZoneState.leave(widgetId);
    };
  }, [widgetId]);

  // Register panel width for snap calculations
  useEffect(() => {
    widgetStore.getState().setSize(widgetId, panelWidth);
  }, [widgetId, panelWidth]);

  // ── Snap targets (other floating widgets) ────────────────────────────
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

  // ── Dock zone visual state (throttled — only updated on threshold cross) ──
  const [isNearDock, setIsNearDock] = useState(false);
  const isNearDockRef = useRef(false);

  // ── Position commit handler (at drag end) ────────────────────────────
  const handlePositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      const store = widgetStore.getState();

      // IMPORTANT: Read dropIndex BEFORE calling dockZoneState.leave(),
      // because leave() clears _dropIndex when _nearIds becomes empty.
      const index = dockZoneState.dropIndex;
      const shouldDock = pos.y < DOCK_THRESHOLD;

      dockZoneState.leave(widgetId);

      if (shouldDock) {
        store.dockAt(widgetId, index);
        store.setPosition(widgetId, pos);
      } else {
        store.setPosition(widgetId, pos);
      }
    },
    [widgetId],
  );

  // ── Drag hook ─────────────────────────────────────────────────────────
  const drag = useDraggable<HTMLDivElement>(storePosition, {
    clickThreshold: 4,
    onPositionChange: handlePositionChange,
    onDrag: useCallback(
      (pos) => {
        // ── Throttled dock zone state: only update React state when the
        //    threshold is actually crossed, not on every frame.
        const nearDock = pos.y < DOCK_THRESHOLD;
        if (nearDock !== isNearDockRef.current) {
          isNearDockRef.current = nearDock;
          setIsNearDock(nearDock);
        }

        // ── Dock zone enter/leave (idempotent per widget id) ────────────
        if (nearDock) {
          dockZoneState.enter(widgetId, pos.x);
        } else {
          dockZoneState.leave(widgetId);
        }
      },
      [widgetId],
    ),
    snapThreshold: 8,
    snapTargets,
  });

  // ── Focus handler ─────────────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    widgetStore.getState().focusWidget(widgetId);
  }, [widgetId]);

  // ── Toggle minimize ───────────────────────────────────────────────────
  const toggleMinimized = useCallback(() => {
    const store = widgetStore.getState();
    const inst = store.instances[widgetId];
    if (!inst) return;
    const newStatus = inst.status === "minimized" ? "floating" : "minimized";
    store.setStatus(widgetId, newStatus);
  }, [widgetId]);

  if (!mounted) return null;

  // ── Positioning: transform for GPU-composited + left/top to anchor ────
  //     position:fixed with ONLY transform and no left/top can place the
  //     element at its static-flow position (potentially off-screen when
  //     portaled to document.body). Adding left:0;top:0 ensures transform
  //     offsets from (0,0) of the viewport — same semantics as left/top.  
  const positionStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    transform: `translate3d(${drag.position.x}px, ${drag.position.y}px, 0)`,
    transformOrigin: "0 0",
    zIndex,
    willChange: drag.isDragging ? "transform" : undefined,
  };

  // ── Unified Animated Floating Widget ─────────────────────────────────
  const showBody = !minimized && !isNearDock;

  // Calculate a comfortable pill width based on label length so text never wraps
  const pillWidth = Math.max(175, Math.min(230, label.length * 9 + 85));

  return createPortal(
    <div
      ref={drag.elementRef}
      data-widget-id={widgetId}
      style={{
        ...positionStyle,
        width: isNearDock ? undefined : minimized ? pillWidth : panelWidth,
      }}
      onPointerDown={handleFocus}
      className={cn(
        "fixed flex flex-col touch-none select-none overflow-hidden border border-line bg-surface/95 backdrop-blur-md shadow-xl transition-[width,border-radius,box-shadow,background-color] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] animate-widget-mount",
        isNearDock
          ? "h-8 rounded-md px-2.5 text-xs font-medium cursor-grabbing"
          : minimized
            ? "rounded-lg cursor-grab"
            : "rounded-xl",
        drag.isDragging && !isNearDock && "shadow-2xl cursor-grabbing",
        className,
      )}
    >
      {/* Top Header / Drag Bar */}
      <div
        onPointerDown={(e) => {
          handleFocus();
          drag.onPointerDown(e);
        }}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        className={cn(
          "flex items-center justify-between shrink-0 transition-colors duration-200 select-none h-9 px-3 gap-2 border-b border-line/60",
          isNearDock
            ? "h-8 px-2.5 border-b-0 cursor-grabbing"
            : drag.isDragging
              ? "cursor-grabbing"
              : "cursor-grab",
        )}
      >
        <div className="flex items-center gap-2 min-w-0 shrink whitespace-nowrap">
          <Icon
            className={cn(
              "shrink-0 text-ink-3 transition-transform duration-200",
              isNearDock ? "size-3.5" : "size-4",
            )}
          />
          <span
            className={cn(
              "font-medium text-ink truncate text-xs",
              isNearDock && "max-w-28",
            )}
          >
            {label}
          </span>
          {pillBadge && !isNearDock && (
            <span className="nums text-[0.65rem] text-ink-3 shrink-0">
              {pillBadge}
            </span>
          )}
          {pillBadge2 && !isNearDock && (
            <span className="nums text-[0.55rem] text-ink-3 shrink-0">
              {pillBadge2}
            </span>
          )}
        </div>

        {!isNearDock && (
          <div className="flex items-center gap-1 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-200",
                showBody ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none w-0 overflow-hidden",
              )}
            >
              {headerActions}
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimized();
              }}
              className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={minimized ? "Expand" : "Minimize"}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  minimized && "rotate-180",
                )}
              />
            </button>
          </div>
        )}
      </div>

      {/* 2-Way Smooth Expandable Body (Height Grid + Delayed Content Reveal) */}
      {!isNearDock && (
        <div
          className="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            gridTemplateRows: showBody ? "1fr" : "0fr",
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "min-h-0 overflow-y-auto transition-[opacity,transform] duration-250 ease-out",
                showBody
                  ? "opacity-100 translate-y-0 delay-100 pointer-events-auto"
                  : "opacity-0 -translate-y-2 delay-0 pointer-events-none",
              )}
              style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
