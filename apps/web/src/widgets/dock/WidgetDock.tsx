"use client";

import { memo, useRef, useCallback, useLayoutEffect, useEffect, useState, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive, useDraggingWidgetId, dockZoneState } from "@/widgets/dock/dockZoneState";
import { useGlobalDragCursor } from "@/hooks/useGlobalDragCursor";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "react-i18next";
import { WIDGET_LABEL_KEY } from "@/widgets/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dragActivity, useDragActivityActive } from "@/components/ui/dragActivity";
import type { ReactNode } from "react";
import type { WidgetId } from "@/widgets/types";
import { useIsDockEditing, dockEditStore } from "@/widgets/dock/dockEditStore";
import { DockExplorer } from "@/widgets/dock/DockExplorer";
import { getDockArea, areaBaseId } from "@/widgets/dock/dockAreasRegistry";


const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

/** Horizontal pitch of one icon-only pill (size-8 + gap-0.5). */
const PILL_PITCH = 34;

/**
 * The element whose width is the dock's real horizontal budget: the nearest
 * fixed-position ancestor — the app header.
 *
 * On desktop the header runs from the sidebar's right edge to the right edge
 * of the viewport (`lg:left-14`), so this is exactly the "until the bar
 * touches the sidebar" bound: the dock only collapses when it would actually
 * reach the sidebar, never before — even when the viewport has spare room.
 *
 * The bar's immediate parents are content-sized flex wrappers whose width
 * tracks the bar itself, so measuring them reports "no room" and collapses
 * every widget. The fixed header is the only stable, genuinely constraining
 * ancestor; outside one we fall back to the viewport width.
 */
function getDockBudgetParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    if (getComputedStyle(parent).position === "fixed") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** Launch a widget as a floating panel at a smart position. */
function launchWidget(widgetId: WidgetId) {
  const store = widgetStore.getState();
  const inst = store.instances[widgetId];
  if (!inst) return;

  store.setStatus(widgetId, "floating");

  // Compute a smart launch position if the stored position is unreasonable
  const pos = inst.position;
  const panelW = inst.panelWidth ?? 340;
  const isReasonable =
    pos &&
    pos.x >= 0 &&
    pos.y >= 50 &&
    pos.x + 60 < window.innerWidth &&
    pos.y + 40 < window.innerHeight;

  if (!isReasonable) {
    const floatingCount = Object.values(store.instances).filter(
      (i) => i.status === "floating" || i.status === "minimized",
    ).length;
    store.setPosition(widgetId, {
      x: Math.max(24, Math.round((window.innerWidth - panelW) / 2)),
      y: 72 + floatingCount * 30,
    });
  }
}

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget in the glass bar — flat icon-only (macOS style):
 * the label floats above the pill on hover and the icon magnifies.
 *
 * - **Click**: launches the widget as a floating panel at a smart position.
 * - **Drag (any direction)**: the pill instantly "lifts out" of the bar — the
 *   real pill fades out with no transition and a portaled clone follows the
 *   cursor. Dragging down past the commit threshold undocks to a
 *   free-floating minimized pill.
 */
const DockPill = memo(function DockPill({
  widgetId,
  onReorderEnd,
}: {
  widgetId: WidgetId;
  onReorderEnd?: () => void;
}) {
  const { t } = useTranslation("widgets");
  const definition = getWidget(widgetId);
  const status = useWidgetStore((s) => s.instances[widgetId]?.status);
  // macOS-style running indicator: the widget is open as a floating panel
  // (or minimized), so its pill gets the small "active" dot.
  const isRunning = status === "floating" || status === "minimized";

  const [isDragging, setIsDragging] = useState(false);
  const [isCommitted, setIsCommitted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Set on drag start and only cleared by the post-drag click event (or a
  // safety timeout) — prevents the click that fires after a drag from
  // launching the widget when the user just reordered a pill.
  const suppressClickRef = useRef(false);
  const itemRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  // Dock-slot position where the lift started, so the clone tracks with zero
  // jump. The drag-start offset is subtracted because framer-motion has already
  // transformed the pill by the drag threshold (~3px) by the time onDragStart
  // fires — otherwise the clone would double-count it and sit a few px off.
  const ghostOriginRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Global grabbing cursor while dragging ─────────────────────────────
  // The lifted clone is pointer-events-none, so the CSS cursor follows
  // whatever element sits under the pointer — leaving the dock would flip it
  // back to default/pointer mid-drag. Pin `cursor: grabbing` on <html> for
  // the whole drag instead (cleanup also runs on unmount).
  useGlobalDragCursor(isDragging);
  const reduceMotion = useReducedMotion();
  // True while ANY drag is in progress (floating widget or another pill's
  // reorder) — suppresses the hover magnify + lets begin/end report here.
  const dragActive = useDragActivityActive();

  // The dock shows every ACTIVE widget (docked, floating or minimized) —
  // macOS-style: launching keeps the pill, the running dot marks it.
  if (!definition || status === "inactive" || !status) return null;

  const Icon = definition.icon;

  // Position the lifted clone directly via transform — no React re-render per
  // frame, so the clone tracks the cursor at 60fps.
  const placeGhost = (x: number, y: number) => {
    const el = ghostRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Reorder.Item
            as="button"
            value={widgetId}
            drag
            layout={reduceMotion ? undefined : true}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            ref={(el: HTMLElement | null) => {
              itemRef.current = el;
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: isDragging ? 0 : 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                    // Hide the real pill INSTANTLY on lift (no clipped fade); fade
                    // it back smoothly when it snaps back.
                    opacity: isDragging ? { duration: 0 } : { duration: 0.15 },
                  }
            }
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              // Toggle semantics: clicking a docked pill launches the widget
              // (floating, pill stays with the running dot); clicking the running
              // pill again closes its panel and docks it back — the dot
              // disappears and the pill stays pinned (status → docked).
              const st = widgetStore.getState().instances[widgetId]?.status;
              if (st === "floating" || st === "minimized") {
                widgetStore.getState().setStatus(widgetId, "docked");
              } else {
                launchWidget(widgetId);
              }
            }}
            onDragStart={(_e, info) => {
              dragActivity.begin();
              suppressClickRef.current = true;
              setIsDragging(true);
              setIsCommitted(false);
              dragStartOffsetRef.current = { x: info.offset.x, y: info.offset.y };
              // Lift out from the pill's exact dock position so there's no jump.
              const el = itemRef.current;
              if (el) {
                const rect = el.getBoundingClientRect();
                ghostOriginRef.current = { x: rect.left, y: rect.top };
                placeGhost(rect.left, rect.top);
              } else {
                placeGhost(info.point.x - 60, info.point.y - 16);
              }
            }}
            onDrag={(_e, info) => {
              const origin = ghostOriginRef.current;
              if (!origin) return;
              const start = dragStartOffsetRef.current;
              placeGhost(
                origin.x + (info.offset.x - start.x),
                origin.y + (info.offset.y - start.y),
              );
            }}
            onDragEnd={(_e, info) => {
              dragActivity.end();
              if (info.offset.y > 35) {
                const store = widgetStore.getState();
                store.setStatus(widgetId, "minimized");
                store.setPosition(widgetId, {
                  x: Math.max(0, Math.min(window.innerWidth - 120, info.point.x - 60)),
                  y: Math.max(64, Math.min(window.innerHeight - 40, info.point.y - 16)),
                });
                // Commit: hide the clone instantly so it doesn't double-vision
                // with the minimized pill appearing at the same spot.
                setIsCommitted(true);
              }
              // Commit the reorder order captured during the drag (once, on drop).
              onReorderEnd?.();
              // The click event fires AFTER this handler, so the suppression flag
              // must NOT be cleared here — the click itself (or a safety timeout)
              // clears it. Otherwise every reorder drag would launch the widget.
              setIsDragging(false);
              ghostOriginRef.current = null;
              window.setTimeout(() => {
                suppressClickRef.current = false;
              }, 0);
            }}
            style={{ zIndex: isHovered ? 30 : undefined }}
            className={cn(
              "relative grid size-8 shrink-0 touch-none select-none cursor-grab place-items-center rounded-full",
              "text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:cursor-grabbing",
            )}
            aria-label={t(isRunning ? "dock.running" : "dock.pinned", {
              name: t(WIDGET_LABEL_KEY[widgetId]),
            })}
          >
            {/* Magnified icon (macOS-style) — the label floats above on hover. */}
            <motion.span
              animate={{ scale: isHovered && !dragActive ? 1.35 : 1 }}
              transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 22 }
              }
              className="grid place-items-center"
            >
              <Icon className="size-4" />
            </motion.span>
            {/* Running indicator (macOS-style active dot) — only when the
                widget is ALSO open as a floating panel or minimized. */}
            {isRunning && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-ink-3"
              />
            )}
          </Reorder.Item>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t(WIDGET_LABEL_KEY[widgetId])}</TooltipContent>
      </Tooltip>

      {/* Lifted clone — portaled to <body> so it's NEVER clipped. Rendered
          always (for zero-latency lift) but only visible while dragging;
          positioned imperatively via transform for 60fps tracking. */}
      {createPortal(
        <div
          ref={ghostRef}
          aria-hidden
          className={cn(
            "pointer-events-none fixed left-0 top-0 z-60 grid size-8 place-items-center rounded-full bg-surface text-ink shadow-xl",
            isDragging
              ? "opacity-100"
              : isCommitted
                ? "opacity-0"
                : "opacity-0 transition-opacity duration-150",
          )}
        >
          <Icon className="size-4" />
        </div>,
        document.body,
      )}
    </>
  );
});

// ── Edit-mode remove button ─────────────────────────────────────────────

/**
 * Small X badge shown on each dock area in edit mode. Clicking removes that
 * piece from the dock (the DockExplorer can re-add it). The pointerdown stop
 * propagation keeps the badge's click from starting the Reorder drag, and
 * the click stop propagation prevents the dock-area's own handlers.
 */
function AreaRemoveButton({ areaId, name }: { areaId: string; name: string }) {
  const { t } = useTranslation("dock");
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        widgetStore.getState().removeDockArea(areaId);
      }}
      aria-label={t("removeItem", { name })}
      title={t("removeItem", { name })}
      className="absolute -right-1 -top-1 z-10 grid size-5 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-sm transition-colors hover:border-dnf/40 hover:bg-dnf/10 hover:text-dnf"
    >
      <X className="size-3" />
    </button>
  );
}

// ── Overflow chevron (Windows-style) ─────────────────────────────────────

/**
 * Subtle chevron shown when the bar can't fit every widget. Opens a flyout
 * listing the hidden widgets (still docked — just not visible); clicking one
 * launches it as a floating panel, exactly like clicking its pill would.
 */
const OverflowMenu = forwardRef<HTMLButtonElement, { ids: WidgetId[] }>(
  function OverflowMenu({ ids }, ref) {
    const { t } = useTranslation("widgets");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label={t("dock.moreHidden", { count: ids.length })}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronUp className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {ids.map((id) => {
            const def = getWidget(id);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <DropdownMenuItem
                key={id}
                className="gap-2"
                onClick={() => launchWidget(id)}
              >
                <Icon className="size-3.5 shrink-0 text-ink-2" />
                <span className="truncate">{t(WIDGET_LABEL_KEY[id])}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

// ── Widget Dock (the unified glass bar) ─────────────────────────────────

/**
 * One centered glass bar — a macOS dock crossed with the Windows taskbar.
 * Widgets are flat, icon-only pills (labels float up on hover, icons magnify).
 * When the bar can't fit every widget, the leftover pills collapse into a
 * subtle chevron flyout — nothing ever scrolls or gets clipped.
 *
 * `trailing` areas (session, puzzle, clock, profile, spacer, separator…)
 * render inside the same bar, interleaved with the widget pills in
 * `dockAreaOrder` order — Windows-tray style.
 *
 * While a floating widget is dragged near the dock, the bar temporarily
 * expands to show every pill (plus the drop-zone ghost) for precise docking.
 */
export function WidgetDock({
  trailingAreas,
  reportRect = true,
}: {
  trailingAreas?: Record<string, ReactNode>;
  /**
   * When false (dock auto-hidden), the bar is not registered as a drag-to-dock
   * zone — invisible bars must not shrink floating widgets dragged overhead.
   */
  reportRect?: boolean;
}) {
  const { t } = useTranslation("widgets");
  const { t: tDock } = useTranslation("dock");
  const reduceMotion = useReducedMotion();
  const dockOrder = useWidgetStore((s) => s.dockOrder);
  const instances = useWidgetStore((s) => s.instances);
  const isDockZoneActive = useDockZoneActive();
  const draggingWidgetId = useDraggingWidgetId();
  const isEditing = useIsDockEditing();
  const dragActive = useDragActivityActive();
  const dockAreaOrder = useWidgetStore((s) => s.dockAreaOrder);
  const [explorerOpen, setExplorerOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const widgetsGroupRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // Ref so the resize/measure observers read the CURRENT visibility without
  // re-subscribing when it flips (dock auto-hide reveal/retract).
  const reportRectRef = useRef(reportRect);
  reportRectRef.current = reportRect;

  // ── Retract clears the drag-to-dock zone ───────────────────────────────
  // When the auto-hide bar retracts (reportRect flips false), its old spot
  // must stop acting as a drop zone immediately — the slide-up is a transform
  // the ResizeObserver never sees, so clear it on the prop flip itself.
  useEffect(() => {
    if (!reportRect) dockZoneState.setDockRect(null);
  }, [reportRect]);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (!reportRectRef.current) {
        dockZoneState.setDockRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      dockZoneState.setDockRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      dockZoneState.setDockRect(null);
    };
  }, []);

  // ── Live rect refresh WHILE DRAGGING ───────────────────────────────────
  // The bar can move under a live drag (auto-hide snap-reveal, or pills
  // parting as a widget enters) in ways the ResizeObserver never sees
  // (transforms) or sees too late (framer springs). A per-frame RAF read
  // keeps the drag-to-dock zone at the bar's LIVE position — but ONLY while
  // a drag is active, so idle frames never pay a forced layout read (the
  // ResizeObserver + window-resize listener above keep the rect current
  // while nothing is moving). setDockRect is a guarded module write — it
  // never notifies React.
  useEffect(() => {
    if (!reportRect || !dragActive) return;
    let raf = 0;
    const tick = () => {
      const el = barRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        dockZoneState.setDockRect({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reportRect, dragActive]);

  // The dock lists every ACTIVE widget (docked, floating or minimized) —
  // launching a widget keeps its pill in the bar and marks it "running"
  // with a dot (macOS/Windows dock behavior). Only truly inactive widgets
  // (excluded special widgets like cube-button) are left out.
  const orderedDocked = dockOrder.filter((id) => {
    if (EXCLUDED_FROM_DOCK.has(id)) return false;
    const inst = instances[id];
    return inst && inst.status !== "inactive";
  });
  const orderedSet = new Set(orderedDocked);
  const extraDocked = Object.entries(instances)
    .filter(
      ([id, inst]) =>
        inst?.status !== "inactive" &&
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

  // ── Fit (no scroll, no clipping) ─────────────────────────────────────────
  // Icon-only pills have a fixed pitch, so overflow is plain arithmetic:
  // count how many fit next to the trailing controls; the rest go into the
  // chevron flyout. While a floating widget is being dragged near the dock,
  // expand to show everything for precise dropping.
  const [hiddenCount, setHiddenCount] = useState(0);

  const recompute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isDockZoneActive) {
      setHiddenCount((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const n = dockedIds.length;
    if (n === 0) {
      setHiddenCount((prev) => (prev === 0 ? prev : 0));
      return;
    }
    // ── Available width ───────────────────────────────────────────────────
    // The bar's immediate parent is a content-sized wrapper (added for the
    // auto-hide slide), so its clientWidth equals the bar's own width and
    // would report zero room for pills — collapsing EVERY widget into the
    // overflow chevron. The real budget is the first ancestor genuinely
    // wider than the bar (the flex container that centers it), capped at
    // the fixed header that constrains the whole bar.
    const budget = getDockBudgetParent(el);
    const available = budget ? budget.clientWidth : window.innerWidth;
    const gap = 2; // gap-0.5
    // Sum the widths of every non-widget area (session, puzzle, clock,
    // profile, spacer, separator…) — they're interleaved with the pills now.
    let areasW = 0;
    let areaCount = 0;
    if (rowRef.current) {
      rowRef.current.querySelectorAll("[data-area-id]").forEach((a) => {
        areasW += a.getBoundingClientRect().width;
        areaCount += 1;
      });
    }
    // Reserve the flex gaps between the blocks (widgets group + areas).
    const children = areaCount + (dockAreaOrder.includes("widgets") ? 1 : 0);
    const widgetsSpace =
      available - areasW - Math.max(0, children - 1) * gap;
    let fit = Math.floor(widgetsSpace / PILL_PITCH);
    if (fit < n) {
      // Reserve the chevron's own slot only when something will be hidden.
      fit = Math.max(0, Math.floor((widgetsSpace - (32 + gap)) / PILL_PITCH));
    }
    const next = Math.max(0, n - fit);
    setHiddenCount((prev) => (prev === next ? prev : next));
  }, [dockedIds, isDockZoneActive, dockAreaOrder]);

  useLayoutEffect(() => {
    recompute();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    // Observe the real budget element too — a window resize changes the
    // flex container (not the content-sized wrapper), so without this the
    // overflow chevron would never appear/clear as the viewport resizes.
    const budget = getDockBudgetParent(el);
    if (budget) ro.observe(budget);
    let cancelled = false;
    // Re-measure once webfonts settle (tray labels depend on the font).
    document.fonts?.ready?.then(() => {
      if (!cancelled) recompute();
    }).catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [recompute]);

  const isExpanded = isDockZoneActive;
  const renderedIds = useMemo(() => {
    if (isExpanded || hiddenCount === 0) return dockedIds;
    return dockedIds.slice(0, dockedIds.length - hiddenCount);
  }, [dockedIds, isExpanded, hiddenCount]);
  const overflowIds =
    isExpanded || hiddenCount === 0 ? [] : dockedIds.slice(-hiddenCount);

  // ── Drop index for dock-from-floating drops ───────────────────────────
  const [ghostIndex, setGhostIndex] = useState(-1);

  // PERFORMANCE: a continuous RAF loop polls the dragged widget's X (stored
  // in module state — dockZoneState.enter updates it every frame WITHOUT
  // notifying React) and only touches React state when the computed
  // insertion index actually changes. The previous approach subscribed to
  // dropX and recomputed the index in a layout effect on EVERY frame of
  // pointer movement over the bar, re-rendering the whole dock (framer
  // Reorder + AnimatePresence) at 60fps — the visible lag on entering and
  // leaving the dock zone.
  useEffect(() => {
    if (!isDockZoneActive || dockedIds.length === 0 || !draggingWidgetId) {
      setGhostIndex(-1);
      dockZoneState.setDropIndex(-1);
      return;
    }
    let raf = 0;
    const tick = () => {
      // Map the pointer onto the WIDGETS GROUP (not the whole bar) — other
      // areas (clock, profile…) sit beside the pills and don't take slots.
      const row = widgetsGroupRef.current;
      if (row) {
        const rect = row.getBoundingClientRect();
        const contentX = dockZoneState.dropX - rect.left;
        const contentWidth = Math.max(row.scrollWidth - PILL_PITCH, 1);
        const proportion = Math.max(0, Math.min(1, contentX / contentWidth));
        const idx = Math.round(proportion * dockedIds.length);
        setGhostIndex((prev) => (prev === idx ? prev : idx));
        dockZoneState.setDropIndex(idx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isDockZoneActive, dockedIds, draggingWidgetId]);

  // ── Reorder state (dock-to-dock) ───────────────────────────────────
  // The reorder order is kept in LOCAL state during a drag and committed to
  // the persisted store ONCE on drop. Committing on every onReorder (which
  // fires once per pill crossed) spammed a synchronous localStorage write
  // plus a full store notify + dock re-render per swap — the visible lag when
  // sweeping a pill back and forth quickly. The ref lets commitReorder read
  // the latest order without re-subscribing every render.
  const [reorderOrder, setReorderOrder] = useState<WidgetId[] | null>(null);
  const reorderOrderRef = useRef<WidgetId[] | null>(null);

  const handleReorder = useCallback((newOrder: WidgetId[]) => {
    reorderOrderRef.current = newOrder;
    setReorderOrder(newOrder);
  }, []);

  const commitReorder = useCallback(() => {
    const order = reorderOrderRef.current;
    if (!order) return;
    reorderOrderRef.current = null;
    setReorderOrder(null);
    const current = widgetStore.getState().dockOrder;
    const visibleSet = new Set(order);
    const invisible = current.filter((id) => !visibleSet.has(id));
    widgetStore.getState().setDockOrder([...order, ...invisible]);
  }, []);

  // ── Display list: the dragged widget ITSELF joins the dock while its
  //    drag is over the bar — treated as if it were ALREADY docked (the
  //    user's suggested approach): its real pill sits in the flow at the
  //    insertion index and the other pills part around it via framer layout
  //    FLIP, exactly like a dock-to-dock reorder. No invisible spacer, no
  //    compacting — nothing to mount or re-layout, so the bar never shows a
  //    missing icon even for one frame. If the drag leaves the bar, the pill
  //    simply exits the flow and the widget stays floating.
  // The base order rendered in the Reorder.Group: the in-flight reorder
  // order while a dock-to-dock drag is active, otherwise the store order.
  const reorderBase = reorderOrder ?? renderedIds;

  const displayIds = useMemo(() => {
    if (!isDockZoneActive || !draggingWidgetId) return reorderBase;
    // Dragging a floating widget into the dock: lift its pill out of its
    // current slot and re-insert an INVISIBLE ghost at the live insertion
    // index. The other pills part around it via framer layout FLIP — the
    // same "ghost parts the dock" effect as a dock-to-dock reorder. (A
    // floating widget stays pinned in the dock while floating, so it must be
    // removed FIRST; the old code early-returned when it was already present,
    // leaving the ghost stuck at its original slot so the pills never parted.)
    const ids = reorderBase.filter((id) => id !== draggingWidgetId);
    const idx = ghostIndex >= 0 ? Math.min(ghostIndex, ids.length) : ids.length;
    ids.splice(idx, 0, draggingWidgetId);
    return ids;
  }, [reorderBase, isDockZoneActive, ghostIndex, draggingWidgetId]);

  // ── Edit mode: render each dock area for reordering ──────────────────
  // The dock is composed of modular areas (widgets zone, ＋, session,
  // puzzle, clock, profile, spacer). In edit mode each area is draggable
  // to reorder; adding/removing pieces happens in the DockExplorer (＋).
  // Every entry in dockAreaOrder is a unique instance id (repeatables are
  // stored as "spacer-0", "spacer-1", …), so framer Reorder gets stable
  // identities and dragging stays as smooth as the widget pills.
  const handleAreaReorder = useCallback((newOrder: string[]) => {
    // dockAreaOrder is the single source of truth — the widgets zone can
    // sit anywhere the user drags it.
    widgetStore.getState().setDockAreaOrder(newOrder);
  }, []);

  const editModeAreas = useMemo(() => {
    if (!isEditing) return [];
    return dockAreaOrder.map((areaId) => {
      // Widgets zone: render a compact preview of the widget pills.
      // Draggable like every other area — it can sit anywhere in the bar.
      if (areaId === "widgets") {
        return (
          <Reorder.Item
            key={areaId}
            value={areaId}
            drag
            layout={reduceMotion ? undefined : true}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex h-8 items-center gap-0.5"
          >
            <div className="flex items-center gap-0.5 rounded-full border border-line/50 bg-surface-2/50 px-1.5 py-0.5">
              {dockedIds.slice(0, 5).map((wid) => {
                const def = getWidget(wid);
                const Icon = def?.icon;
                return Icon ? (
                  <div key={wid} className="grid size-6 place-items-center rounded-full text-ink-3">
                    <Icon className="size-3" />
                  </div>
                ) : null;
              })}
              {dockedIds.length > 5 && (
                <span className="text-[0.6rem] text-ink-3">+{dockedIds.length - 5}</span>
              )}
            </div>
          </Reorder.Item>
        );
      }
      // Other areas: render from the area definition (match on the base id
      // so suffixed repeatable instances like "separator-1" resolve too)
      const baseId = areaBaseId(areaId);
      const area = getDockArea(baseId);
      if (!area) return null;
      const Icon = area.icon;

      // Separator: a visible draggable chip in edit mode — the thin vertical
      // line is a piece too, so it gets the same circle affordance + remove X.
      if (baseId === "separator") {
        return (
          <Reorder.Item
            key={areaId}
            value={areaId}
            drag
            layout={reduceMotion ? undefined : true}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex h-8 items-center cursor-grab touch-none"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-ink-3/40 bg-surface-2/70 text-ink-3">
              <Icon className="size-4" />
            </div>
            <AreaRemoveButton areaId={areaId} name={tDock(area.labelKey)} />
          </Reorder.Item>
        );
      }

      // Spacer: a visible draggable chip in edit mode — same circle affordance.
      if (baseId === "spacer") {
        return (
          <Reorder.Item
            key={areaId}
            value={areaId}
            drag
            layout={reduceMotion ? undefined : true}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex h-8 items-center cursor-grab touch-none"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-ink-3/40 bg-surface-2/70 text-ink-3">
              <Icon className="size-4" />
            </div>
            <AreaRemoveButton areaId={areaId} name={tDock(area.labelKey)} />
          </Reorder.Item>
        );
      }

      // Default: icon circle + remove X
      return (
        <Reorder.Item
          key={areaId}
          value={areaId}
          drag
          layout={reduceMotion ? undefined : true}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          className="relative h-8 cursor-grab touch-none"
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
            <Icon className="size-4" />
          </div>
          <AreaRemoveButton areaId={areaId} name={tDock(area.labelKey)} />
        </Reorder.Item>
      );
    });
  }, [isEditing, dockAreaOrder, dockedIds, reduceMotion, tDock]);

  const renderNormal = () => (
    <div ref={rowRef} className="flex min-w-0 items-center gap-0.5">
      {/* Forced invisible spacers on the left side for layout symmetry */}
      <div data-area-id="forced-spacer-l1" aria-hidden className="w-2 shrink-0 pointer-events-none" />
      <div data-area-id="forced-spacer-l2" aria-hidden className="w-2 shrink-0 pointer-events-none" />

      {/* Render areas in dockAreaOrder — the widgets zone can sit anywhere. */}
      {dockAreaOrder.map((areaId) => {
        if (areaId === "widgets") {
          return (
            <div
              key={areaId}
              ref={widgetsGroupRef}
              className="flex min-w-0 items-center gap-0.5"
            >
              <Reorder.Group
                as="div"
                axis="x"
                values={reorderBase}
                onReorder={handleReorder}
                className="flex items-center gap-0.5"
              >
                <AnimatePresence mode="popLayout">
                  {displayIds.map((id) => {
                    if (id === draggingWidgetId && isDockZoneActive) {
                      const def = getWidget(id);
                      const Icon = def?.icon;
                      return (
                        <motion.div
                          key={id}
                          layout={reduceMotion ? undefined : true}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 400, damping: 30 }
                          }
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                          className="relative grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink opacity-0"
                          aria-hidden
                        >
                          {Icon ? <Icon className="size-4" /> : null}
                        </motion.div>
                      );
                    }
                    return <DockPill key={id} widgetId={id} onReorderEnd={commitReorder} />;
                  })}
                </AnimatePresence>
              </Reorder.Group>

              {overflowIds.length > 0 && <OverflowMenu ids={overflowIds} />}
            </div>
          );
        }
        const node = trailingAreas?.[areaBaseId(areaId)];
        if (!node) return null;
        return (
          <div key={areaId} data-area-id={areaBaseId(areaId)}>
            {node}
          </div>
        );
      })}

      {/* Forced invisible spacers on the right side for layout symmetry */}
      <div data-area-id="forced-spacer-r1" aria-hidden className="w-2 shrink-0 pointer-events-none" />
      <div data-area-id="forced-spacer-r2" aria-hidden className="w-2 shrink-0 pointer-events-none" />
    </div>
  );

  const renderEditMode = () => (
    <>
      <Reorder.Group
        as="div"
        axis="x"
        values={dockAreaOrder}
        onReorder={handleAreaReorder}
        className="list-none flex h-full items-center gap-1"
      >
        {editModeAreas}
      </Reorder.Group>
      {/* ＋ button to open DockExplorer */}
      <button
        onClick={() => setExplorerOpen(true)}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-ink-3/40 text-ink-3 transition-colors hover:border-ink-2 hover:text-ink"
        aria-label={tDock("addPiece")}
      >
        <Plus className="size-4" />
      </button>

      {/* Done button */}
      <button
        onClick={() => dockEditStore.stopEditing()}
        className="ml-2 shrink-0 rounded-full bg-ink px-3 py-1.5 text-[0.72rem] font-medium text-canvas transition-colors hover:bg-ink-2"
      >
        {tDock("doneEditing")}
      </button>

      <DockExplorer open={explorerOpen} onOpenChange={setExplorerOpen} />
    </>
  );  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label={t("dock.dockedWidgets")}
      data-context-zone="dock"
    >
      {/* Edit mode backdrop — portaled to <body> so it escapes the header's
          z-20 stacking context: it dims + blurs the ENTIRE web, including the
          z-50 sidebar and the floating widgets. It shares the sidebar's z-50
          but sits later in the DOM (ties go to the later sibling), and any
          dialog/sheet opened afterwards portals above it. The header itself is
          raised to z-60 while editing (see Header) so the dock bar stays crisp
          on top. Clicking anywhere closes edit mode. */}
      {isEditing &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-canvas/40 backdrop-blur-sm"
            onClick={() => dockEditStore.stopEditing()}
          />,
          document.body,
        )}
      <div
        ref={barRef}
        className={cn(
          "relative z-10 flex min-w-0 items-center gap-0.5 rounded-full border border-line bg-surface px-1.5 py-1 shadow-sm",
          isExpanded && "z-40 w-max",
          isEditing && "z-60 overflow-hidden",
        )}
      >
        {isEditing ? renderEditMode() : renderNormal()}
      </div>
    </div>
  );
}
