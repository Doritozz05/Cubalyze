"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import { Palette, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@cubeforge/database";
import { IdenticonAvatar } from "@/components/Identity/IdenticonAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsTouch } from "@/hooks/use-mobile";
import {
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
  HOVER_DELAY,
  UNHOVER_DELAY,
  SIDEBAR_MOTION,
  ACTIVE_PILL_SPRING,
  NAV_GROUPS,
  Grid3x3,
  type ViewId,
} from "./sidebar.constants";

const HOVER_SUPPRESS_MS = 500;
// Settings is a large, rarely-opened surface (all its sections + country-flag
// icons). Load it on demand so it stays out of the initial bundle.
const SettingsDialog = lazy(() =>
  import("@/components/Settings/SettingsDialog").then((m) => ({ default: m.SettingsDialog })),
);
import { ThemeStudioModal } from "@/components/Settings/theme-studio/ThemeStudioModal";
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
  /** Export a JSON file containing every session's solves (full fidelity). */
  onExportAllJSON?: () => Promise<void>;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  /** Section to show when the settings dialog opens (e.g. 'profile'). */
  settingsInitialSection?: string;
  /** Stable identity seed (user_id) for the footer CubeMark chip. */
  profileSeed?: string | null;
  /** The user's profile row — photo (if set) or display name for the chip. */
  profile?: Profile | null;
  widgetExplorerOpen?: boolean;
  onWidgetExplorerOpenChange?: (open: boolean) => void;
  cubeConnectorOpen?: boolean;
  onCubeConnectorOpenChange?: (open: boolean) => void;
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
  onExportAllJSON,
  settingsOpen: externalSettingsOpen,
  onSettingsOpenChange,
  settingsInitialSection,
  profileSeed,
  profile,
  widgetExplorerOpen: externalWidgetExplorerOpen,
  onWidgetExplorerOpenChange,
  cubeConnectorOpen: externalCubeConnectorOpen,
  onCubeConnectorOpenChange,
}: LeftSidebarProps) {
  // Touch regime (phones + small tablets <768px) renders the Sheet variant.
  // Desktop (>=768px) keeps the rail. The rail's touch interactions (tap-to-
  // toggle, swipe open/close) are driven by the pointer TYPE (pointerType ===
  // "touch"), not matchMedia — see the gesture block below — so they work on
  // any touchscreen, even an iPad whose primary pointer reports as fine.
  const isTouch = useIsTouch();
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [internalWidgetExplorerOpen, setInternalWidgetExplorerOpen] = useState(false);
  const [internalCubeConnectorOpen, setInternalCubeConnectorOpen] = useState(false);
  const [themeStudioOpen, setThemeStudioOpen] = useState(false);

  const settingsOpen = externalSettingsOpen ?? internalSettingsOpen;
  const setSettingsOpen = onSettingsOpenChange ?? setInternalSettingsOpen;

  const widgetExplorerOpen = externalWidgetExplorerOpen ?? internalWidgetExplorerOpen;
  const setWidgetExplorerOpen = onWidgetExplorerOpenChange ?? setInternalWidgetExplorerOpen;

  const cubeConnectorOpen = externalCubeConnectorOpen ?? internalCubeConnectorOpen;
  const setCubeConnectorOpen = onCubeConnectorOpenChange ?? setInternalCubeConnectorOpen;
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timestamp until which hover-expansion is suppressed (set when the window
  // regains focus after a native dialog, e.g. the Web Bluetooth chooser, closed).
  const suppressExpandUntilRef = useRef(0);

  // Labels/titles are visible whenever the rail is expanded: on hover (desktop)
  // or always (the touch sheet has a fixed wide width). This also fixes a
  // pre-existing issue where the mobile sheet showed icon-only items.
  const labelVisible = isTouch || isHovered;

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
  const asideRef = useRef<HTMLElement>(null);

  // ── Touch gestures on the rail (tap-to-toggle + swipe) ────────────────
  // These are gated on the POINTER TYPE (pointerType === "touch"), NOT on
  // matchMedia: an iPad with a trackpad/keyboard attached reports
  // (pointer: coarse) === false, but the user still touches the screen — the
  // gesture must work either way. Mouse pointers (desktop, trackpad) keep
  // the hover behavior.
  //
  //  - swipe RIGHT (from the rail or the left edge of the screen) → open
  //  - swipe LEFT (on the rail) → close
  //  - tap on empty rail space → toggle
  //  - vertical drags are left to the browser (the nav keeps scrolling)
  // Tracking runs at the DOCUMENT level because the finger may drift off the
  // 56px rail mid-gesture (implicit pointer capture isn't guaranteed), and a
  // recognized swipe swallows the click that would otherwise fire on release.
  const SWIPE_THRESHOLD = 48;
  // Left-edge zone (px): a swipe right starting within this strip — the rail
  // plus a small margin of the stage — opens the drawer, like a native
  // edge-swipe drawer.
  const SWIPE_EDGE_ZONE = 72;
  const swipeStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipeConsumedRef = useRef(false);
  // True when the last pointerdown ON THE RAIL was a touch (only touch taps
  // toggle; a mouse click keeps the hover behavior).
  const touchTapRef = useRef(false);
  // Until this timestamp, synthetic mouseenter from a touch tap is ignored
  // (a tap fires mouseenter too, which would re-expand a just-collapsed rail
  // on devices whose primary pointer is fine, e.g. iPads with a trackpad).
  const touchSuppressUntilRef = useRef(0);
  const TOUCH_SUPPRESS_MS = 2000;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const target = e.target as Node | null;
      const inRail = !!asideRef.current && !!target && asideRef.current.contains(target);
      // Only gestures on the rail itself or the left edge of the screen.
      if (!inRail && e.clientX >= SWIPE_EDGE_ZONE) return;
      touchSuppressUntilRef.current = performance.now() + TOUCH_SUPPRESS_MS;
      if (inRail) touchTapRef.current = true;
      swipeStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      swipeConsumedRef.current = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const start = swipeStartRef.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      // Vertical-dominant or too short → keep letting the browser scroll.
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
      swipeStartRef.current = null;
      swipeConsumedRef.current = true;
      if (dx > 0) setIsHovered(true); // swipe right → open
      else setIsHovered(false); // swipe left → close
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (swipeStartRef.current?.id === e.pointerId) swipeStartRef.current = null;
    };

    // Swallow the click after a recognized swipe anywhere in the page (the
    // button under the finger, a stage element, the rail toggle).
    const onClickCapture = (e: MouseEvent) => {
      if (swipeConsumedRef.current) {
        e.stopPropagation();
        swipeConsumedRef.current = false;
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // Hover is impossible on touch without a cursor, but it must stay enabled
  // for fine-pointer devices (desktop, iPads with a trackpad) — touch taps
  // suppress the synthetic hover via touchSuppressUntilRef instead.
  useEffect(() => {
    if (isTouch) return;

    const clearHoverTimer = () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    };

    const handleWindowBlur = () => {
      // Native dialog opened (page lost focus) — collapse and stop any pending expand.
      clearHoverTimer();
      setIsHovered(false);
    };

    const handleWindowFocus = () => {
      // Native dialog closed and focus returned. Suppress expansion briefly.
      suppressExpandUntilRef.current = performance.now() + HOVER_SUPPRESS_MS;
      clearHoverTimer();
      setIsHovered(false);
    };

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      clearHoverTimer();
    };
  }, [isTouch]);

  const handleMouseEnter = useCallback(() => {
    // Suppress hover if a native dialog (e.g. Web Bluetooth) just closed, or
    // if a touch interaction happened recently (its synthetic mouseenter
    // must not re-expand the rail after a tap/swipe).
    if (performance.now() <= suppressExpandUntilRef.current) return;
    if (performance.now() <= touchSuppressUntilRef.current) return;

    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(true), HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(false), UNHOVER_DELAY);
  }, []);

  // Tap-to-toggle: a TOUCH tap on the rail's empty area toggles the expanded
  // state (a tap that lands on a nav/footer button is that button's own
  // action — navigate, open dialog — and must not also collapse the rail).
  // Mouse clicks never toggle: hover handles those. A just-recognized swipe
  // must not toggle either (its click is swallowed at the document level).
  const handleRailTap = useCallback((e: React.MouseEvent) => {
    if (!touchTapRef.current) return; // mouse click — hover behavior applies
    touchTapRef.current = false;
    if (swipeConsumedRef.current) {
      swipeConsumedRef.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("button")) return;
    setIsHovered((h) => !h);
  }, []);

  // Collapse when a touch tap lands outside the expanded rail (capture phase
  // so no inner stopPropagation can hide the tap) — the touch equivalent of
  // mouseleave. Pointer-type gated so trackpad clicks on fine-pointer devices
  // keep the hover behavior.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const target = e.target as Node | null;
      if (target && asideRef.current && !asideRef.current.contains(target)) {
        setIsHovered(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
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
    [handleNavigateItem, setWidgetExplorerOpen],
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
      <LayoutGroup>
        {/* Scrollbar hidden while the rail is collapsed (icons only) and
            shown again once it expands — see .scrollbar-none in index.css. */}
        <nav className={cn("flex-1 overflow-y-auto px-2 py-3 touch-pan-y", !isHovered && "scrollbar-none")}>
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey} className="mb-1">
              <SidebarGroupTitle label={t(group.titleKey)} labelVisible={labelVisible} />
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    labelVisible={labelVisible}
                    isActive={activeView === item.id}
                    onClick={() => handleNavItemClick(item.id)}
                    onboardingTarget={
                      item.id === "widgets" ? "widgets-entry" : undefined
                    }
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
        </nav>

        {/* Footer — Profile (avatar chip) + device / settings / theme. The
            Profile entry lives here on DESKTOP only: on touch the navigation
            sheet keeps the previous footer (Settings / Smart Cube / Theme) and
            Profile stays in the More bottom sheet (see MobileMoreSheet). */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {!isTouch && (
            <SidebarProfileItem
              seed={profileSeed}
              profile={profile}
              labelVisible={labelVisible}
              isActive={activeView === "profile"}
              onClick={() => handleNavItemClick("profile")}
            />
          )}
          {/* In the touch regime the Sheet's rail is a plain button — the
              always-mounted standalone Drawer (rendered below) is the single
              dialog, so no duplicate Drawer mounts inside the Sheet. */}
          <CubeConnector 
            variant="rail" 
            expanded={labelVisible} 
            open={cubeConnectorOpen}
            hideDialog={isTouch}
            onOpenChange={(open) => {
              setCubeConnectorOpen(open);
              if (!open) {
                onMobileOpenChange?.(false);
                setIsHovered(false);
              }
            }}
          />
          <SidebarFooterItem
            icon={Settings}
            label={tCommon("settings")}
            labelVisible={labelVisible}
            onClick={() => setSettingsOpen(true)}
          />
          <SidebarFooterItem
            icon={Palette}
            label={tCommon("theme")}
            labelVisible={labelVisible}
            onClick={() => {
              setThemeStudioOpen(true);
              if (isTouch) onMobileOpenChange?.(false);
            }}
          />
        </div>
      </LayoutGroup>
    </>
  );

  // Touch (mobile + tablet): render as Sheet (opened from the bottom tab bar's
  // "More" button, or the header hamburger on older builds).
  if (isTouch) {
    return (
      <>
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="left" className="w-56 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t("title")}</SheetTitle>
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
        <Suspense fallback={null}>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={(open) => {
              setSettingsOpen(open);
              if (!open) {
                onMobileOpenChange?.(false);
              }
            }}
            initialSection={settingsInitialSection}
            solves={solves}
            sessionName={sessionName}
            onImportSolves={onImportSolves}
            onExportAllJSON={onExportAllJSON}
          />
          <ThemeStudioModal
            open={themeStudioOpen}
            onOpenChange={setThemeStudioOpen}
          />
        </Suspense>
        {/* Only the Drawer — no trigger. Its legacy `hidden sm:flex` trigger
            used to leak into the layout top-left in the touch regime (e.g.
            the stray Bluetooth icon on the Skill Tree view). The rail button
            inside the Sheet (or the MobileMoreSheet entry) opens it. */}
        <CubeConnector
          hideTrigger
          open={cubeConnectorOpen}
          onOpenChange={(open) => {
            setCubeConnectorOpen(open);
            if (!open) {
              onMobileOpenChange?.(false);
            }
          }}
        />
      </>
    );
  }

  // Desktop: fixed, hover-to-expand
  return (
    <>
      <motion.aside
        ref={asideRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleRailTap}
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ width: isHovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH, x: 0, opacity: 1 }}
        exit={{ x: "-100%", opacity: 0 }}
        transition={SIDEBAR_MOTION.panel}
        // touch-pan-y: the browser only owns vertical pans on the rail, so
        // horizontal swipes (open/close) always reach the gesture handlers
        // instead of being claimed as pans.
        data-slot="sidebar"
        data-glass-panel="true"
        className="fixed left-0 top-0 z-50 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar select-none overflow-hidden touch-pan-y"
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
      <Suspense fallback={null}>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) {
              onMobileOpenChange?.(false);
            }
          }}
          initialSection={settingsInitialSection}
          solves={solves}
          sessionName={sessionName}
          onImportSolves={onImportSolves}
          onExportAllJSON={onExportAllJSON}
        />
        <ThemeStudioModal
          open={themeStudioOpen}
          onOpenChange={setThemeStudioOpen}
        />
      </Suspense>
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
  onboardingTarget,
}: {
  icon: React.ElementType;
  label: string;
  labelVisible: boolean;
  isActive?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  /** Spotlight target for the onboarding tour (TDD-0020). */
  onboardingTarget?: string;
}) {
  const reduceMotion = useReducedMotion();
  const button = (
    <button
      type="button"
      onClick={onClick}
      data-onboarding-target={onboardingTarget}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md text-sm px-2.5 py-2 transition-colors group",
        isActive
          ? "text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 rounded-md bg-sidebar-accent"
          transition={reduceMotion ? { duration: 0 } : ACTIVE_PILL_SPRING}
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
        transition={reduceMotion ? { duration: 0 } : SIDEBAR_MOTION.label}
        className="relative z-10 overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </button>
  );

  return button;
}

/**
 * Footer entry for the user's identity. Renders the avatar (photo, CubeMark
 * or a fallback icon) instead of a generic glyph, and shows the display name
 * when the rail is expanded. Highlights while the Profile view is active.
 */
function SidebarProfileItem({
  seed,
  profile,
  labelVisible,
  isActive,
  onClick,
}: {
  seed?: string | null;
  profile?: Profile | null;
  labelVisible: boolean;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const hasPhoto = profile?.avatarKind === "photo" && !!profile.avatarData;
  const avatar = hasPhoto ? (
    <img
      src={profile.avatarData}
      alt=""
      className="size-5 rounded-md object-cover ring-1 ring-sidebar-border"
    />
  ) : seed ? (
    <IdenticonAvatar
      seed={seed}
      size={20}
      // Solid (non-glass) tile: the liquid-glass engine must not turn the
      // identity frame into a frosted chip — it stays dry like the base
      // --surface-2 look (see --surface-2-solid in index.css).
      tile="surface-2-solid"
      className="rounded-md ring-1 ring-sidebar-border"
    />
  ) : (
    <UserRound className="size-4" />
  );

  const label = profile?.displayName?.trim() || t("profile");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md text-sm px-2.5 py-2 transition-colors group",
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
        {avatar}
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
      className="flex w-full items-center gap-3 rounded-md text-sm px-2.5 py-2 transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
