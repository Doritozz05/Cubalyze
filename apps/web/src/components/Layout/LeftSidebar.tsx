"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { motion, LayoutGroup } from "framer-motion";
import { Sun, Moon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
  HOVER_DELAY,
  UNHOVER_DELAY,
  HOVER_SUPPRESS_MS,
  SIDEBAR_MOTION,
  ACTIVE_PILL_SPRING,
  NAV_GROUPS,
  Grid3x3,
  type ViewId,
} from "./sidebar.constants";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { WidgetExplorer } from "@/widgets/explorer";
import { CubeConnector } from "@/components/Hardware/CubeConnector";
import type { Solve } from "@/types";

export interface LeftSidebarProps {
  /** Currently active view — drives the active-pill highlight. */
  activeView: ViewId;
  /** Switch the main stage to a view. */
  onNavigate: (view: ViewId) => void;
  /** Whether the timer engine is running/ready — shows a pulse on Timer. */
  timerActive?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Solves for the Data/Export settings section. */
  solves?: Solve[];
  /** Session name for export. */
  sessionName?: string;
  /** Batch import callback for importing solves from files. */
  onImportSolves?: (solves: Array<{ time: number; penalty: import('@/types').Penalty; scramble: string; method?: string; timestamp: number; note?: string; source: import('@/types').SolveSource; puzzleType?: string }>) => Promise<void>;
}

export function LeftSidebar({
  activeView,
  onNavigate,
  timerActive,
  mobileOpen,
  onMobileOpenChange,
  solves,
  sessionName,
  onImportSolves,
}: LeftSidebarProps) {
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const setStoreTheme = useStore(preferencesStore, (s) => s.setTheme);
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [widgetExplorerOpen, setWidgetExplorerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref mirror of isHovered so the window-level guard handlers (registered
  // once, not per render) always read the latest value.
  const isHoveredRef = useRef(isHovered);
  // Last REAL pointer coordinates, kept up to date by a window pointermove
  // listener. Used to verify that a mouseenter is backed by an actual cursor
  // position over the rail instead of a synthetic event from a native dialog.
  const lastPointerRef = useRef({ x: -1, y: -1 });
  // Timestamp until which hover-expansion is suppressed (set when the window
  // regains focus after a native dialog, e.g. the Web Bluetooth chooser, closed).
  const suppressExpandUntilRef = useRef(0);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  // Labels/titles are visible whenever the rail is expanded: on hover (desktop)
  // or always (the mobile sheet has a fixed wide width). This also fixes a
  // pre-existing issue where the mobile sheet showed icon-only items.
  const labelVisible = isMobile || isHovered;

  const isPointerOverRail = useCallback((x: number, y: number) => {
    // The rail hugs the left edge and spans the full viewport height. The
    // real hover zone is the current rendered width: COLLAPSED_WIDTH when
    // collapsed, EXPANDED_WIDTH once expanded (mirrors the old element-bounds
    // mouseenter semantics).
    const zoneWidth = isHoveredRef.current ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
    return x >= 0 && x <= zoneWidth && y >= 0 && y <= window.innerHeight;
  }, []);

  /**
   * Guards the hover-to-expand behaviour against synthetic mouse events.
   *
   * The pairing flow calls navigator.bluetooth.requestDevice() which opens the
   * browser's NATIVE Bluetooth chooser. That dialog is not part of the page:
   * when it opens the window blurs, and when it closes (user clicks the native
   * "Pair" button) Chromium can dispatch synthetic mouse events at stale
   * coordinates — typically (0,0), exactly where the fixed left-0 top-0 rail
   * lives. The synthetic mouseenter used to pass through React untouched and
   * expand the sidebar even when the real cursor was nowhere near it, and
   * because the real cursor never entered the rail the matching mouseleave
   * never fired — leaving the sidebar stuck open.
   *
   * Fix:
   *  - blur  → collapse immediately (a native dialog opened).
   *  - focus → suppress expansion briefly (a native dialog just closed).
   *  - pointermove → track the real cursor; if the rail claims to be hovered
   *    while the pointer is actually elsewhere, self-heal by collapsing.
   *  - mouseenter → only expand when the last REAL pointer position is over
   *    the rail and we are outside the suppression window.
   */
  useEffect(() => {
    if (isMobile) return;

    const clearHoverTimer = () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    };

    const handleWindowBlur = () => {
      // Native dialog opened (page lost focus) — collapse and stop any pending
      // expand so a synthetic enter on close can't run later.
      clearHoverTimer();
      setIsHovered(false);
    };

    const handleWindowFocus = () => {
      // Native dialog closed and focus returned. Ignore hover-expansion for a
      // short beat: Chromium may dispatch synthetic mouse events at (0,0) now.
      suppressExpandUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      // Re-verify against the last real pointer: only keep expanded if the
      // cursor is genuinely over the rail.
      const { x, y } = lastPointerRef.current;
      if (x >= 0 && !isPointerOverRail(x, y)) {
        clearHoverTimer();
        setIsHovered(false);
      }
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      // Self-heal: if we think the rail is hovered but the real cursor is not
      // over it (e.g. a synthetic mouseenter fired earlier), collapse.
      if (isHoveredRef.current && !isPointerOverRail(e.clientX, e.clientY)) {
        clearHoverTimer();
        setIsHovered(false);
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      clearHoverTimer();
    };
  }, [isMobile, isPointerOverRail]);

  const handleMouseEnter = useCallback(() => {
    // Only expand if this mouseenter is backed by a REAL pointer position over
    // the rail and we're outside the post-native-dialog suppression window.
    const { x, y } = lastPointerRef.current;
    const verified =
      x >= 0 &&
      isPointerOverRail(x, y) &&
      performance.now() > suppressExpandUntilRef.current;
    if (!verified) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(true), HOVER_DELAY);
  }, [isPointerOverRail]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(false), UNHOVER_DELAY);
  }, []);

  const handleNavigateItem = useCallback(
    (view: ViewId) => {
      onNavigate?.(view);
      onMobileOpenChange?.(false);
    },
    [onNavigate, onMobileOpenChange],
  );

  /**
   * Handle nav-item clicks (both view-navigation and action-items like
   * "widgets" which open dialogs rather than switching the stage).
   */
  const handleNavItemClick = useCallback(
    (id: string) => {
      if (id === "widgets") {
        setWidgetExplorerOpen(true);
        return;
      }
      handleNavigateItem(id as ViewId);
    },
    [handleNavigateItem],
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
        <div className="flex items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-surface">
            <Grid3x3 className="size-4" />
          </div>
          <motion.span
            animate={{ opacity: labelVisible ? 1 : 0 }}
            transition={SIDEBAR_MOTION.brand}
            className="nums overflow-hidden text-sm font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap"
          >
            cubeforge
          </motion.span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <LayoutGroup>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-1">
              <SidebarGroupTitle label={group.title} labelVisible={labelVisible} />
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    labelVisible={labelVisible}
                    isActive={activeView === item.id}
                    onClick={() => handleNavItemClick(item.id)}
                    badge={
                      item.id === "timer" && timerActive ? (
                        <span className="size-1.5 rounded-full bg-ready animate-pulse" />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </LayoutGroup>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <CubeConnector 
          variant="rail" 
          expanded={labelVisible} 
          onOpenChange={(open) => {
            if (!open) {
              onMobileOpenChange?.(false);
              setIsHovered(false);
            }
          }}
        />
        <SidebarFooterItem
          icon={Settings}
          label="Settings"
          labelVisible={labelVisible}
          onClick={() => setSettingsOpen(true)}
        />
        <SidebarFooterItem
          icon={mounted && isDark ? Sun : Moon}
          label={mounted && isDark ? "Light mode" : "Dark mode"}
          labelVisible={labelVisible}
          onClick={() => setStoreTheme(isDark ? "light" : "dark")}
        />
      </div>
    </>
  );

  // Mobile: render as Sheet (trigger rendered in header)
  if (isMobile) {
    return (
      <>
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="left" className="w-56 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
              {sidebarContent}
            </div>
          </SheetContent>
        </Sheet>
        <WidgetExplorer
          open={widgetExplorerOpen}
          onOpenChange={(open) => {
            setWidgetExplorerOpen(open);
            if (!open) {
              onMobileOpenChange?.(false);
            }
          }}
        />
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) {
              onMobileOpenChange?.(false);
            }
          }}
          solves={solves}
          sessionName={sessionName}
          onImportSolves={onImportSolves}
        />
      </>
    );
  }

  // Desktop: fixed, hover-to-expand
  return (
    <>
      <motion.aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ width: isHovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH, x: 0, opacity: 1 }}
        exit={{ x: "-100%", opacity: 0 }}
        transition={SIDEBAR_MOTION.panel}
        className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar select-none overflow-hidden"
      >
        {sidebarContent}
      </motion.aside>

      <WidgetExplorer
        open={widgetExplorerOpen}
        onOpenChange={(open) => {
          setWidgetExplorerOpen(open);
          if (!open) {
            onMobileOpenChange?.(false);
          }
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            onMobileOpenChange?.(false);
          }
        }}
        solves={solves}
        sessionName={sessionName}
        onImportSolves={onImportSolves}
      />
    </>
  );
}

/* ── Subcomponents ─────────────────────────────────────────────────────── */

function SidebarGroupTitle({
  label,
  labelVisible,
}: {
  label: string;
  labelVisible: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={{
        height: labelVisible ? "auto" : 0,
        opacity: labelVisible ? 1 : 0,
        marginBottom: labelVisible ? 4 : 0,
      }}
      transition={SIDEBAR_MOTION.label}
      className="overflow-hidden"
    >
      <span className="relative z-20 block px-3 text-[0.62rem] uppercase tracking-[0.15em] text-sidebar-foreground/40 whitespace-nowrap">
        {label}
      </span>
    </motion.div>
  );
}

function SidebarNavItem({
  icon: Icon,
  label,
  labelVisible,
  isActive,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  labelVisible: boolean;
  isActive?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md text-sm px-2 py-2 transition-colors group",
        isActive
          ? "text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 rounded-md bg-sidebar-accent"
          transition={ACTIVE_PILL_SPRING}
        />
      )}
      <div className="relative z-10 flex size-5 shrink-0 items-center justify-center">
        <Icon className="size-4" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5">{badge}</span>
        )}
      </div>
      <motion.span
        initial={false}
        animate={{ width: labelVisible ? "auto" : 0, opacity: labelVisible ? 1 : 0 }}
        transition={SIDEBAR_MOTION.label}
        className="relative z-10 overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </button>
  );

  return button;
}

function SidebarFooterItem({
  icon: Icon,
  label,
  labelVisible,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  labelVisible: boolean;
  onClick?: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md text-sm px-2 py-2 transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <div className="flex size-5 shrink-0 items-center justify-center">
        <Icon className="size-4" />
      </div>
      <motion.span
        initial={false}
        animate={{ width: labelVisible ? "auto" : 0, opacity: labelVisible ? 1 : 0 }}
        transition={SIDEBAR_MOTION.label}
        className="overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </button>
  );

  return button;
}
