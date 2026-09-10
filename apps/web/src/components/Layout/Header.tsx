"use client";

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { History, Menu } from "lucide-react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { WidgetDock } from "@/widgets/dock";
import { getSlotTemplate } from "@/bottom-layout/slot-templates";
import { useIsDockEditing } from "@/widgets/dock/dockEditStore";
import { dockBarState, useDockRevealRequested } from "@/widgets/dock/dockZoneState";
import {
  BatteryPiece,
  ClockPiece,
  ProfilePiece,
  SpacerPiece,
  SeparatorPiece,
  ManualSolvePiece,
  SessionPiece,
  PuzzlePiece,
  SessionStatsPiece,
  SessionChartPiece,
  RandomPuzzlePiece,
} from "@/widgets/dock/pieces";
import { useWidgetStore } from "@/widgets/widgetStore";
import { areaBaseId } from "@/widgets/dock/dockAreasRegistry";
import { useIsCoarsePointer, useIsTouch } from "@/hooks/use-mobile";
import { MobileSessionSheet } from "./MobileSessionSheet";
import type { PuzzleCategory, Solve } from "@/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";

/**
 * Dock slide — slower than the sidebar panels (0.25s) so the auto-hide
 * reveal/retract reads as a smooth, deliberate motion instead of a snap.
 * easeOutCubic: fast start, gentle settle, no bounce.
 */
const DOCK_SLIDE_MOTION = { duration: 0.6, ease: [0.22, 1, 0.36, 1] } as const;

/** How long the dock stays visible after the pointer leaves, before it retracts. */
const DOCK_RETRACT_DELAY_MS = 6000;

/**
 * Calculates the dynamic dock horizontal shift so it centers over the scramble/timer column,
 * but clamps so it never collides with the left sidebar (respecting minLeftMargin).
 */
function useDynamicDockShift(
  active: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  dockRef: React.RefObject<HTMLDivElement | null>,
) {
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!active) {
      setShift(0);
      return;
    }

    const compute = () => {
      const container = containerRef.current;
      const dock = dockRef.current;
      if (!container || !dock) return;

      const containerWidth = container.offsetWidth;
      const dockWidth = dock.offsetWidth;
      if (containerWidth <= 0 || dockWidth <= 0) return;

      const unshiftedLeftMargin = (containerWidth - dockWidth) / 2;
      const minLeftMargin = 16;
      const maxAllowedShift = Math.max(0, unshiftedLeftMargin - minLeftMargin);
      const targetShift = 140;
      setShift(Math.min(targetShift, maxAllowedShift));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    if (dockRef.current) ro.observe(dockRef.current);

    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [active, containerRef, dockRef]);

  return active ? shift : 0;
}

// ── Glass-dock sub-components (desktop) ───────────────────────────────────

// The Smart Cube battery lives in the DOCK as the battery widget piece — the
// former hardcoded status-tray chip (BatteryStatusChip) was removed so there
// is exactly ONE battery indicator, wherever the user places it.

export interface HeaderProps {
  /** Current session solve count, shown as a small chip. */
  sessionCount?: number;
  /** All known sessions (for the session switcher). */
  sessions?: SessionMeta[];
  /** Active session id. */
  activeSessionId?: string | null;
  /** Switch to a session. */
  onSwitchSession?: (id: string) => void;
  /** Create + switch to a new session. */
  onNewSession?: () => void;
  /** Rename a session. */
  onRenameSession?: (id: string, name: string) => void;
  /** Delete a session entirely. */
  onDeleteSession?: (id: string) => void;
  /** Open the manual solve entry sheet (the "+" button). */
  onAddManual?: () => void;
  /** Open the user's profile view (dock profile pill). */
  onOpenProfile?: () => void;
  /** Open the mobile "More" sheet (same as the bottom tab bar's More tab). */
  onOpenMore?: () => void;
  /** Currently selected puzzle category. */
  puzzle?: PuzzleCategory;
  /** Callback when puzzle selection changes. */
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  /** Active session solves (newest-first) — feeds the live stats/chart dock pieces. */
  solves?: Solve[];
  className?: string;
}

/**
 * Top bar. On desktop (lg+) everything lives in ONE centered glass dock —
 * widget pills, quick actions, session and puzzle — Windows-taskbar style,
 * so the header reads as a single piece and nothing ever scrolls or clips.
 * On touch the header is a minimal bar: the bottom-bar "More" button at
 * top-left (widgets and app actions), the selected puzzle with the session
 * name beneath it centered, and an icon-only session button at the right.
 */
export function Header({
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onAddManual,
  onOpenProfile,
  onOpenMore,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
  solves,
  className,
}: HeaderProps) {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>(puzzleProp);
  const isDockEditing = useIsDockEditing();

  // Phones (<768px) use the compact touch header, which stays pinned — the
  // desktop dock autohide doesn't apply there. Large tablets (iPad >=768px)
  // get the desktop dock too: no hover exists, so the reveal/retract runs on
  // taps instead (see the coarse-pointer listener below).
  const isTouch = useIsTouch();
  const isCoarsePointer = useIsCoarsePointer();

  // ── macOS-style dock auto-hide (headerMode === 'autohide') ─────────────
  // The glass bar slides out of view. On hover-capable devices it is revealed
  // while the pointer hovers the top edge of the viewport (the whole desktop
  // header row acts as the reveal band); leaving the bar/band retracts it
  // after a short delay. On coarse pointers (iPad) the top band is tap-to-
  // reveal and a tap anywhere outside the header retracts it. Editing the
  // dock keeps it pinned in both cases.
  const headerMode = useStore(preferencesStore, (s) => s.headerMode);
  const bottomLayoutTemplate = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const showBottomLayout = useStore(preferencesStore, (s) => s.showBottomLayout);
  const dynamicDock = useStore(preferencesStore, (s) => s.dynamicDock ?? false);
  const isRail = showBottomLayout && getSlotTemplate(bottomLayoutTemplate)?.placement === "right";
  const isDynamicDockActive = dynamicDock && isRail;

  const bandRef = useRef<HTMLDivElement>(null);
  const dockWrapRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const dynamicShift = useDynamicDockShift(isDynamicDockActive, bandRef, dockWrapRef);

  const dockAutoHide = headerMode === "autohide" && !isTouch;
  const [dockRevealed, setDockRevealed] = useState(false);
  const retractTimerRef = useRef<number | null>(null);
  // True while a floating widget is being dragged near the top strip where
  // the hidden dock lives (see dockRevealState). Pointer capture during the
  // drag suppresses the hover band's pointerenter, so this signal is what
  // actually reveals the dock mid-drag.
  const dragRevealRequested = useDockRevealRequested();

  const cancelRetract = useCallback(() => {
    if (retractTimerRef.current !== null) {
      window.clearTimeout(retractTimerRef.current);
      retractTimerRef.current = null;
    }
  }, []);

  // ── Dropdown/popover guard ──────────────────────────────────────────
  // When a Radix dropdown/select/popover originating from the header or dock
  // is open, its content lives in a portal OUTSIDE the header DOM. Without a guard,
  // the header's pointerleave fires and the dock retracts — leaving the dropdown
  // floating over empty space.
  //
  // NOTE: We check specifically for dropdowns, popovers and selects (or triggers
  // inside the header with open state) rather than a generic [data-state="open"],
  // because otherwise open Dialogs, Sheets, Tooltips, or other components anywhere
  // in the app would permanently freeze the dock in revealed mode.
  const anyPopoverOpen = useCallback((): boolean => {
    // 1. Check if any non-tooltip trigger inside the header is currently in an open state
    if (headerRef.current?.querySelector('[data-state="open"]:not([data-slot="tooltip-trigger"])')) {
      return true;
    }
    // 2. Check for portaled dropdown menus, select dropdowns, or popovers
    const openFloatingMenus = document.querySelectorAll(
      '[data-slot="dropdown-menu-content"][data-state="open"], ' +
      '[data-slot="select-content"][data-state="open"], ' +
      '[data-slot="popover-content"][data-state="open"]'
    );
    return openFloatingMenus.length > 0;
  }, []);

  const revealDock = useCallback(() => {
    cancelRetract();
    setDockRevealed(true);
  }, [cancelRetract]);

  const scheduleRetract = useCallback(() => {
    // Don't retract while a dropdown/select/popover is open — its portal
    // lives outside the header, so the pointerleave already fired. The
    // dock must stay visible until the user closes the dropdown.
    if (anyPopoverOpen()) {
      cancelRetract();
      return;
    }
    cancelRetract();
    retractTimerRef.current = window.setTimeout(
      () => {
        // Re-check at fire time: a dropdown may have opened during the
        // delay window.
        if (anyPopoverOpen()) {
          return;
        }
        setDockRevealed(false);
      },
      DOCK_RETRACT_DELAY_MS,
    );
  }, [cancelRetract, anyPopoverOpen]);

  // Clear any pending retract on unmount.
  useEffect(() => {
    return () => {
      if (retractTimerRef.current !== null) window.clearTimeout(retractTimerRef.current);
    };
  }, []);


  // Drag-to-dock reveal: while a floating widget is dragged toward the top,
  // slide the (auto-hidden) dock back down; when the drag leaves the strip or
  // ends, fall back to the normal retract delay so the dock doesn't vanish
  // the instant the drag stops. On coarse pointers there is no hover to
  // re-reveal, so a drag never schedules the 6s retract — retraction there is
  // exclusively tap-outside (see the coarse-pointer listener below).
  useEffect(() => {
    if (dragRevealRequested) {
      revealDock();
    } else if (!isCoarsePointer) {
      scheduleRetract();
    }
  }, [dragRevealRequested, revealDock, scheduleRetract, isCoarsePointer]);

  // Auto-hide off, revealed by hover, or dock editing → bar always visible.
  const dockVisible = !dockAutoHide || dockRevealed || isDockEditing;

  // Publish the bar's state to the shell so MainLayout can free the reserved
  // top space while the dock is retracted (content fills the strip instead of
  // leaving it empty) and grow it back when the dock slides down.
  useEffect(() => {
    dockBarState.set(dockAutoHide, dockVisible);
  }, [dockAutoHide, dockVisible]);

  // Native enter/leave listeners (React's onPointerEnter/Leave are
  // synthesized from pointerover/out pairs and can't be driven reliably, so
  // attach native pointerenter/pointerleave to the reveal band and the dock
  // wrapper instead — identical behavior for real pointers). Coarse pointers
  // (iPad) have no hover: skip these and rely on the tap listener below.
  useEffect(() => {
    if (!dockAutoHide || isCoarsePointer) return;
    const band = bandRef.current;
    const wrap = dockWrapRef.current;
    if (!band || !wrap) return;
    const onEnter = () => revealDock();
    const onLeave = () => scheduleRetract();

    // When the cursor moves quickly upwards past the top of the browser window
    // (into the tab bar or address bar / OS chrome), the cursor exits the document
    // without triggering pointerleave on the inner elements. Listening to
    // document mouseleave/pointerout catches when clientY <= 0 or cursor leaves window.
    const onDocLeave = (e: MouseEvent) => {
      if (!e.relatedTarget || e.clientY <= 0) {
        scheduleRetract();
      }
    };

    band.addEventListener("pointerenter", onEnter);
    band.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onDocLeave);

    return () => {
      band.removeEventListener("pointerenter", onEnter);
      band.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("mouseleave", onDocLeave);
    };
  }, [dockAutoHide, isCoarsePointer, revealDock, scheduleRetract]);

  // When the dock retracts or hides, automatically dismiss any lingering tooltips
  // that were opened by hovering dock items (which portal to document.body).
  useEffect(() => {
    if (!dockVisible) {
      // Dispatch pointercancel or escape to ensure radix tooltips unmount cleanly
      // and blur active element inside header if focused.
      const activeEl = document.activeElement;
      if (activeEl && headerRef.current?.contains(activeEl)) {
        (activeEl as HTMLElement).blur();
      }
      document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    }
  }, [dockVisible]);

  // Coarse pointers (iPad): no hover, so the dock reveal/retract is tap-
  // driven — deterministic, never stuck. Tapping the (hidden) top band
  // reveals the dock and keeps it; tapping anywhere OUTSIDE the header
  // retracts it. Taps on dock pieces (inside the header) keep it open. Runs
  // in the capture phase so no inner stopPropagation can hide the tap.
  useEffect(() => {
    if (!dockAutoHide || !isCoarsePointer) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      const header = headerRef.current;
      if (!target || !header) return;
      if (dockRevealed) {
        // Don't retract when tapping inside an open dropdown/popover —
        // its portal lives outside the header, so header.contains() is
        // false, but the user is still interacting with dock content.
        if (!header.contains(target) && !anyPopoverOpen()) {
          cancelRetract();
          setDockRevealed(false);
        }
      } else if (header.contains(target)) {
        revealDock();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [dockAutoHide, isCoarsePointer, dockRevealed, revealDock, cancelRetract, anyPopoverOpen]);

  useEffect(() => {
    setPuzzle(puzzleProp);
  }, [puzzleProp]);
  // Touch regime: minimal bar — the bottom-bar "More" button at top-left
  // (opens the shared More sheet, which also contains the widgets), the
  // selected puzzle + session name centered, and an icon-only session
  // button at the far right. No manual-solve button on touch.
  const { t } = useTranslation("shell");
  const { t: tNav } = useTranslation("nav");
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const dockAreaOrder = useWidgetStore((s) => s.dockAreaOrder);

  // Build trailingAreas dynamically from the store's dockAreaOrder.
  // The order is the single source of truth — the dock renders areas in this
  // sequence, and edit mode can reorder/remove/add them.
  const trailingAreas = useMemo(() => {
    const all: Record<string, ReactNode> = {
      "manual-solve": <ManualSolvePiece onAddManual={onAddManual} />,
    };
    if (sessions && sessions.length > 0) {
      all["session"] = (
        <SessionPiece
          sessions={sessions}
          activeSessionId={activeSessionId}
          sessionCount={sessionCount}
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />
      );
    }
    all["puzzle"] = (
      <PuzzlePiece
        puzzle={puzzle}
        onPuzzleChange={(p) => {
          setPuzzle(p);
          onPuzzleChange?.(p);
        }}
        variant="tray"
      />
    );
    // Phase 4: system/layout pieces
    all["clock"] = <ClockPiece />;
    all["battery"] = <BatteryPiece />;
    all["profile"] = <ProfilePiece onOpenProfile={onOpenProfile} />;
    all["session-stats"] = <SessionStatsPiece solves={solves ?? []} />;
    all["session-chart"] = <SessionChartPiece solves={solves ?? []} />;
    all["random-puzzle"] = (
      <RandomPuzzlePiece
        puzzle={puzzle}
        onPuzzleChange={(p) => {
          setPuzzle(p);
          onPuzzleChange?.(p);
        }}
      />
    );
    all["spacer"] = <SpacerPiece />;
    all["separator"] = <SeparatorPiece />;
    return all;
  }, [sessions, activeSessionId, sessionCount, onSwitchSession, onNewSession, onRenameSession, onDeleteSession, onAddManual, onOpenProfile, puzzle, onPuzzleChange, solves]);

  // Filter to only areas that exist in dockAreaOrder (so removed areas don't
  // render). Repeatable instances are suffixed ("separator-0"), so look up
  // by base id; the dock renders one trailing piece per instance.
  const orderedTrailingAreas = useMemo(() => {
    const result: Record<string, ReactNode> = {};
    for (const id of dockAreaOrder) {
      if (id === "widgets") continue; // widgets area is the left side, not trailing
      const base = areaBaseId(id);
      if (trailingAreas[base]) result[base] = trailingAreas[base];
    }
    return result;
  }, [dockAreaOrder, trailingAreas]);

  // Active session name — shown under the puzzle in the touch header.
  const activeSessionName = useMemo(
    () => sessions?.find((s) => s.id === activeSessionId)?.name ?? null,
    [sessions, activeSessionId],
  );

  return (
    <motion.header
      data-slot="app-header"
      ref={headerRef}
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={SIDEBAR_MOTION.panel}
      className={cn(
        // `lg:left-14` keeps the desktop header aligned with the rail.
        // Below 768px the header spans the full width (touch regime).
        // On iOS with viewport-fit=cover the header grows by the top safe-area
        // so its content never hides under the status bar (desktop: h-14).
        // Desktop (lg+) has NO background: the glass dock floats on its own;
        // touch keeps the solid bar so its controls never sit on bare content.
        // While the dock is being edited the header is raised to z-60 so the
        // bar stays crisp above the body-portaled edit backdrop (z-50).
        "fixed inset-x-0 lg:left-14 top-0 z-20",
        isDockEditing && "z-60",
        // While retracted, the (transparent) header must not swallow clicks
        // aimed at the stage content that now fills the top strip — only the
        // thin reveal band below stays interactive.
        dockAutoHide && !dockVisible && "pointer-events-none",
        "max-lg:border-b max-lg:bg-surface",
        "max-lg:h-[calc(3.5rem+env(safe-area-inset-top))] lg:h-14",
        className,
      )}
    >
      {/* Desktop (lg+): ONE centered glass dock — widgets, quick actions,
          session, puzzle and the smart-cube battery all live in the same
          bar (Option B), so the header reads as a single macOS-dock /
          Windows-taskbar piece. */}
      {/* The desktop header row doubles as the reveal band when the dock is
          in auto-hide mode: hovering it (mostly empty while retracted)
          slides the bar back down. */}
      <div
        ref={bandRef}
        className={cn(
          "relative hidden w-full items-center lg:flex",
          // Retracted: collapse the hover zone to a thin strip along the top
          // edge (the reveal line's band) so the rest of the header area lets
          // clicks through to the stage. Revealed: the full row is the hover
          // band, matching the pre-existing behavior.
          dockAutoHide && !dockVisible ? "pointer-events-auto h-7" : "h-full",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <motion.div
            ref={dockWrapRef}
            initial={false}
            animate={{
              y: dockVisible ? 0 : -48,
              opacity: dockVisible ? 1 : 0,
              x: isDynamicDockActive ? -dynamicShift : 0,
            }}
            // While a widget drag is revealing the dock, snap it into place
            // instantly (no 0.6s slide): the drag-to-dock zone rect is
            // measured from the bar's live position, so a slide would leave
            // the zone stale mid-animation and the widget wouldn't engage.
            transition={
              dockAutoHide && !dragRevealRequested ? DOCK_SLIDE_MOTION : { duration: 0.3 }
            }
            style={dockVisible ? undefined : { pointerEvents: "none" }}
            className="min-w-0"
          >
            <WidgetDock trailingAreas={orderedTrailingAreas} reportRect={dockVisible} />
          </motion.div>
        </div>

        {/* Floating reveal line — while the dock is retracted a thin glowing
            line marks the top edge so auto-hide stays discoverable. */}
        {dockAutoHide && (
          <motion.div
            aria-hidden
            initial={false}
            animate={{
              opacity: dockVisible ? 0 : 0.6,
              x: isDynamicDockActive ? -dynamicShift : 0,
            }}
            transition={DOCK_SLIDE_MOTION}
            className="pointer-events-none absolute left-1/2 top-1.5 z-10 -translate-x-1/2"
          >
            <div className="h-1 w-12 rounded-full bg-ink/25 shadow-[0_0_10px_2px_rgba(0,0,0,0.2)]" />
          </motion.div>
        )}
      </div>

      {/* Touch (<lg): minimal bar — More (bottom-bar icon) top-left, the
          selected puzzle with the session name beneath it centered, and the
          session icon-only at the far right. No manual solve on touch. */}
      <div
        data-context-zone="mobile-header"
        className="relative flex h-full w-full items-center justify-between px-4 pt-safe sm:px-6 lg:hidden"
      >
        {/* Left: More button — same icon/action as the bottom tab bar */}
        <button
          type="button"
          onClick={() => onOpenMore?.()}
          aria-label={tNav("moreOptions")}
          data-onboarding-target="widgets-entry"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95"
        >
          <Menu className="size-5" />
        </button>

        {/* Center: selected puzzle + session name below (tap to change puzzle) */}
        <div className="absolute left-1/2 top-1/2 max-w-[46%] -translate-x-1/2 -translate-y-1/2">
          <PuzzlePiece
            puzzle={puzzle}
            onPuzzleChange={(p) => {
              setPuzzle(p);
              onPuzzleChange?.(p);
            }}
            variant="center"
            caption={activeSessionName ?? undefined}
          />
        </div>

        {/* Right: session button — icon only, no name, no counter.
            Always rendered on touch: even with zero sessions (DB still
            booting, or a fresh install before the seed lands) the user
            needs a way to open the sheet and create one. Hiding the
            button entirely when `sessions` is empty left mobile users
            stranded with no session switcher if the DB init was slow
            or failed. */}
        <div className="flex min-w-0 items-center justify-end">
          <button
            type="button"
            onClick={() => setSessionDrawerOpen(true)}
            aria-label={t("switchSession")}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <History className="size-5" />
          </button>

          <MobileSessionSheet
            open={sessionDrawerOpen}
            onOpenChange={setSessionDrawerOpen}
            sessions={sessions ?? []}
            activeSessionId={activeSessionId}
            onSwitchSession={onSwitchSession}
            onNewSession={onNewSession}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
          />
        </div>
      </div>
    </motion.header>
  );
}
