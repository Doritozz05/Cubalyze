"use client";

import { useRef, useCallback, useEffect, useLayoutEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { useDockZoneActive, useDropX, useDraggingWidgetId, dockZoneState } from "@/widgets/dock/dockZoneState";
import { useGlobalDragCursor } from "@/hooks/useGlobalDragCursor";
import type { WidgetId } from "@/widgets/types";

const EXCLUDED_FROM_DOCK = new Set(["cube-button"]);

/** Width (px) of the invisible drop-zone spacer rendered while dragging over the dock. */
const GHOST_WIDTH = 48;

// ── Dock pill ────────────────────────────────────────────────────────────

/**
 * A single docked widget pill in the header dock bar.
 *
 * - **Click**: launches the widget as a floating panel at a smart position.
 * - **Drag (any direction)**: the pill instantly "lifts out" of the dock — the
 *   real pill fades out with no transition and a portaled clone follows the
 *   cursor, so it's NEVER clipped by the dock's overflow container. Dragging
 *   down past the commit threshold undocks to a free-floating minimized pill.
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

  const [isDragging, setIsDragging] = useState(false);
  const [isCommitted, setIsCommitted] = useState(false);

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

  if (!definition || !isDocked) return null;

  const Icon = definition.icon;

  // Position the lifted clone directly via transform — no React re-render per
  // frame, so the clone tracks the cursor at 60fps.
  const placeGhost = (x: number, y: number) => {
    const el = ghostRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

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
        ref={(el: HTMLElement | null) => {
          itemRef.current = el;
          onPillRef?.(widgetId, el);
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: isDragging ? 0 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
          // Hide the real pill INSTANTLY on lift (no clipped fade inside the
          // overflow container); fade it back smoothly when it snaps back.
          opacity: isDragging ? { duration: 0 } : { duration: 0.15 },
        }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          handleClick();
        }}
        onDragStart={(_e, info) => {
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
          // The click event fires AFTER this handler, so the suppression flag
          // must NOT be cleared here — the click itself (or a safety timeout)
          // clears it. Otherwise every reorder drag would launch the widget.
          setIsDragging(false);
          ghostOriginRef.current = null;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }}
        className={cn(
          "relative flex h-8 shrink-0 touch-none select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-200",
          "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hover:border-ink/20",
          "cursor-grab active:cursor-grabbing",
        )}
        aria-label={`${definition.name} — pinned`}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate max-w-28">{definition.name}</span>
      </Reorder.Item>

      {/* Lifted clone — portaled to <body> so the dock's overflow NEVER clips
          it. Rendered always (for zero-latency lift) but only visible while
          dragging; positioned imperatively via transform for 60fps tracking. */}
      {createPortal(
        <div
          ref={ghostRef}
          aria-hidden
          className={cn(
            "pointer-events-none fixed left-0 top-0 z-60 flex h-8 items-center gap-1.5 rounded-md border border-ink/20 bg-surface px-2.5 text-xs font-medium text-ink shadow-xl",
            isDragging
              ? "opacity-100"
              : isCommitted
                ? "opacity-0"
                : "opacity-0 transition-opacity duration-150",
          )}
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

  // ── Edge fades for horizontal overflow ──────────────────────────────────
  // When the dock overflows its centered area, fade the pills at the visible
  // edges to hint there's more content in that direction.
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  // Shared "at right edge" tracker — updated by updateScrollEdges (called from
  // onScroll and ResizeObserver) so it always reflects the user's LAST scroll
  // position, not just the state at the previous count change.
  const atRightRef = useRef(false);

  const updateScrollEdges = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    atRightRef.current = atRight;
    setScrollEdges((prev) =>
      prev.left === !atLeft && prev.right === !atRight
        ? prev
        : { left: !atLeft, right: !atRight },
    );
  }, []);

  const edgeMask =
    scrollEdges.left || scrollEdges.right
      ? `linear-gradient(to right, ${
          scrollEdges.left ? "transparent" : "black"
        } 0, black 12px, black calc(100% - 12px), ${
          scrollEdges.right ? "transparent" : "black"
        } 100%)`
      : undefined;

  // ── Auto-reveal: when a new widget docks, scroll so it becomes visible ──
  // Only auto-scroll to the right edge if the user was ALREADY looking at the
  // end of the dock (where new pills appear). If they were scrolled elsewhere
  // (e.g. they just dropped a widget mid-dock), keep their position instead
  // of yanking the viewport away from the pill they just placed.
  //
  // Declared BEFORE the ResizeObserver effect so it reads atRightRef from the
  // user's last scroll (pre-add) rather than the post-add geometry.
  const prevDockedCountRef = useRef(dockedIds.length);
  useLayoutEffect(() => {
    const prevCount = prevDockedCountRef.current;
    prevDockedCountRef.current = dockedIds.length;
    const el = containerRef.current;
    const grew = dockedIds.length > prevCount;
    if (!el || !grew || el.scrollWidth <= el.clientWidth + 1) return;
    if (atRightRef.current) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  }, [dockedIds.length]);

  // Keep fades in sync with pill changes and window resizes.
  useLayoutEffect(() => {
    updateScrollEdges();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollEdges, dockedIds, isDockZoneActive]);

  // ── Mouse-wheel horizontal scroll ───────────────────────────────────────
  // The dock scrolls horizontally, but a plain mouse wheel emits vertical
  // deltas (and the scrollbar is hidden), so cut-off pills are unreachable.
  // When the dock overflows, translate the wheel into horizontal scrolling.
  // When it fits, let the wheel scroll the page as usual.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      if (!overflow) return;
      e.preventDefault();
      // Normalize line-mode deltas (some mice/trackpads report ±1-3 per notch)
      // to pixel distances so the dock scrolls at a comfortable speed.
      const factor = e.deltaMode === 1 ? 16 : 1;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX * factor
        : e.deltaY * factor;
      el.scrollLeft += dx;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
  }, [dockedIds.length, isDockZoneActive]);

  // ── Ghost position from CONTAINER (stable — ghost doesn't create feedback) ─
  // Using the container width as reference (not pill positions that shift with
  // the ghost) breaks the feedback loop that plagued the grey-spacer approach.
  // With a horizontally scrollable dock, offset by scrollLeft and measure the
  // full content width (minus the 48px ghost spacer) so the drop index still
  // lands under the cursor.
  useLayoutEffect(() => {
    if (!isDockZoneActive || dockedIds.length === 0 || !draggingWidgetId) {
      setGhostIndex(-1);
      dockZoneState.setDropIndex(-1);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // NOTE: isDockZoneActive is guaranteed true here (early return above), so
    // scrollWidth includes the ghost spacer — subtract it for stable mapping.
    const rect = container.getBoundingClientRect();
    const contentX = dropX - rect.left + container.scrollLeft;
    const contentWidth = Math.max(container.scrollWidth - GHOST_WIDTH, 1);
    const proportion = Math.max(0, Math.min(1, contentX / contentWidth));
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
      role="toolbar"
      aria-label="Docked widgets"
      onScroll={updateScrollEdges}
      className="flex min-w-0 flex-1 items-center overflow-x-auto px-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }}
    >
      <Reorder.Group
        as="div"
        axis="x"
        values={dockedIds}
        onReorder={handleReorder}
        className="mx-auto flex items-center gap-1.5"
      >
        <AnimatePresence mode="popLayout">
          {displayIds.map((id) => {
            if (id === GHOST_ID) {
              return (
                <motion.div
                  key={GHOST_ID}
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 0, width: GHOST_WIDTH }}
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
