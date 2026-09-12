"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { BackgroundLayer } from "./BackgroundLayer";
import { SIDEBAR_MOTION, type ViewId } from "./sidebar.constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsCoarsePointer, useIsTouch } from "@/hooks/use-mobile";
import { useGlobalDragCursor } from "@/hooks/useGlobalDragCursor";
import { useIsDockEditing } from "@/widgets/dock/dockEditStore";
import { useDockBarState } from "@/widgets/dock/dockZoneState";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import type { PuzzleCategory, Solve } from "@/types";

/**
 * Width the 3D cube panel occupies once expanded.
 *
 * The cube scales with the viewport: large tablets in desktop layout (iPad Pro
 * landscape ≈ 1194–1366px) open it at ¼ of the available width, real desktops
 * (≥1280px) at ⅓ — clamped so it stays readable on small or very wide screens.
 */
const LEFT_NAV_WIDTH = 56; // matches md:pl-14 on the row
const CUBE_MIN_WIDTH = 280;
const CUBE_MAX_WIDTH = 800;
const CUBE_RESIZE_MIN_WIDTH = 220; // Minimum width when user resizes to the right
// Viewport line between the "large tablet" regime (panel opens at ¼ of the
// available width) and the desktop regime (½ — the user can resize from there).
// Matches Tailwind `xl` (1280px).
const DESKTOP_REGIME_MIN_WIDTH = 1280;

/** Padding applied around the cube canvas. Lives on the inner wrapper (NOT on
 *  the animated <motion.aside>) so the container can collapse to width=0 /
 *  height=0 cleanly when closed. */
const INNER_PADDING = "px-4 py-6 sm:px-6 lg:py-8";

export interface MainLayoutProps {
  /** Currently active view/tab id. Used for view-scoped background layer. */
  activeView?: ViewId;
  /** Primary content area: scramble, timer, quick stats — or a full Insights
   *  view (Times/Stats/Analysis) when the LeftSidebar nav switches to it. */
  main: React.ReactNode;
  /** Left navigation sidebar (fixed position, hover-to-expand). */
  leftSidebar?: React.ReactNode;
  /** Open the manual solve entry sheet (the "+" button in the header). */
  onAddManual?: () => void;
  /** Open the user's profile view (dock profile pill). */
  onOpenProfile?: () => void;
  /** Open the Locker stage (the cube dock piece's empty state action). */
  onOpenLocker?: () => void;
  /** Open the mobile "More" sheet (top-left header button, touch regime). */
  onOpenMore?: () => void;
  /** 3D cube view (rendered in the right aside when cube3DActive). */
  cube3D?: React.ReactNode;
  /** Whether the 3D cube view is active (shows the split). */
  cube3DActive?: boolean;
  /** Whether the 3D cube has been activated at least once (keeps it mounted). */
  cube3DReady?: boolean;
  /** Callback when user closes or drags down to dismiss the 3D cube view. */
  onCloseCube?: () => void;
  /** Current session solve count, shown as a chip in the header. */
  sessionCount?: number;
  /** All known sessions (for the switcher). */
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
  /** Whether focus mode is active. */
  isFocused?: boolean;
  /** Whether to hide top header (e.g. for Skills view). */
  hideHeader?: boolean;
  /** Currently selected puzzle category. */
  puzzle?: PuzzleCategory;
  /** Callback when puzzle selection changes. */
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
  /** Active session solves (newest-first) — forwarded to the header dock pieces. */
  solves?: Solve[];
  className?: string;
}

/**
 * Top-level shell: sticky header and a two-region body (main stage + optional
 * 3D-cube split) that collapses to a single column on small screens.
 */
export function MainLayout({
  main,
  leftSidebar,
  onAddManual,
  cube3D,
  cube3DActive,
  cube3DReady,
  onCloseCube,
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  activeView,
  onOpenProfile,
  onOpenLocker,
  onOpenMore,
  isFocused,
  hideHeader,
  puzzle,
  onPuzzleChange,
  solves,
  className,
}: MainLayoutProps) {
  // Defer useIsTouch/useIsCoarsePointer to post-mount to avoid SSR/hydration flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsTouch = useIsTouch();
  const isTouch = mounted ? rawIsTouch : false;
  // Touch tablets running the desktop layout (>=768px) still have a system
  // gesture bar — used to reserve bottom clearance (see the section padding).
  const rawCoarse = useIsCoarsePointer();
  const isCoarse = mounted ? rawCoarse : false;
  // True while the dock is being edited (right-click → "Editar dock…").
  // When editing, the wrapper below drops its `z-1` stacking context so the
  // header's z-60 can rise above the body-portaled edit backdrop (z-50);
  // otherwise the z-1 wrapper traps the header and the blur covers the dock.
  const isDockEditing = useIsDockEditing();
  // Desktop dock bar visibility (auto-hide header). While the dock is
  // retracted the reserved top padding collapses to zero so the stage flows
  // up into the freed strip; it grows back when the dock slides down.
  const dockBar = useDockBarState();
  const dockBarHidden = dockBar.autohide && !dockBar.visible;

  // Track viewport width and height so the cube panel can derive responsive bounds
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [vh, setVh] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  useEffect(() => {
    let rafId: number | null = null;
    const update = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setVw(window.innerWidth);
        setVh(window.innerHeight);
      });
    };
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const cubeShown = !!cube3DActive && !isFocused;
  const rightVisible = cubeShown;
  const rightMounted = rightVisible || !!cube3DReady;

  // Desktop width resize state
  const maxPanelWidth = cubeShown
    ? Math.max(
        CUBE_MIN_WIDTH,
        Math.min(
          CUBE_MAX_WIDTH,
          (vw - LEFT_NAV_WIDTH) * (vw < DESKTOP_REGIME_MIN_WIDTH ? 0.25 : 0.5),
        ),
      )
    : 0;

  const [userPanelWidth, setUserPanelWidth] = useState<number | null>(null);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const widthDragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const effectiveWidth = Math.min(
    maxPanelWidth,
    Math.max(CUBE_RESIZE_MIN_WIDTH, userPanelWidth ?? maxPanelWidth),
  );

  const handleWidthResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizingWidth(true);
      widthDragStartRef.current = { startX: e.clientX, startWidth: effectiveWidth };
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [effectiveWidth],
  );

  const handleWidthResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!widthDragStartRef.current) return;
      const deltaX = e.clientX - widthDragStartRef.current.startX;
      const newWidth = Math.min(
        maxPanelWidth,
        Math.max(CUBE_RESIZE_MIN_WIDTH, widthDragStartRef.current.startWidth - deltaX),
      );
      setUserPanelWidth(newWidth);
    },
    [maxPanelWidth],
  );

  const handleWidthResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsResizingWidth(false);
      widthDragStartRef.current = null;
      try {
        (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture was already lost
      }
    },
    [],
  );

  const handleWidthResizeReset = useCallback(() => {
    setUserPanelWidth(null);
  }, []);

  // Mobile height resize & shrink/close state
  const defaultMobileHeight = Math.min(420, Math.max(280, Math.round((vh || 800) * 0.45)));
  const maxMobileHeight = Math.min(650, Math.max(340, Math.round((vh || 800) * 0.75)));
  const minMobileHeight = 160;
  const closeThresholdHeight = 110;

  const [userPanelHeight, setUserPanelHeight] = useState<number | null>(null);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const heightDragStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const currentHeightValue = userPanelHeight ?? defaultMobileHeight;
  const effectiveHeight = Math.min(
    maxMobileHeight,
    Math.max(minMobileHeight, currentHeightValue),
  );

  const handleHeightResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizingHeight(true);
      heightDragStartRef.current = { startY: e.clientY, startHeight: currentHeightValue };
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [currentHeightValue],
  );

  const handleHeightResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!heightDragStartRef.current) return;
      const deltaY = e.clientY - heightDragStartRef.current.startY;
      // Moving down (+deltaY) shrinks height
      const rawHeight = heightDragStartRef.current.startHeight - deltaY;
      if (rawHeight < closeThresholdHeight) {
        setUserPanelHeight(rawHeight);
      } else {
        const clampedHeight = Math.min(
          maxMobileHeight,
          Math.max(minMobileHeight, rawHeight),
        );
        setUserPanelHeight(clampedHeight);
      }
    },
    [maxMobileHeight],
  );

  const handleHeightResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsResizingHeight(false);
      if (userPanelHeight !== null && userPanelHeight < closeThresholdHeight) {
        onCloseCube?.();
        setUserPanelHeight(null);
      }
      heightDragStartRef.current = null;
      try {
        (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture was already lost
      }
    },
    [userPanelHeight, onCloseCube],
  );

  const handleHeightResizeReset = useCallback(() => {
    setUserPanelHeight(null);
  }, []);

  // Pin global DMZ grabbing hand cursor while resizing
  const isResizing = isResizingWidth || isResizingHeight;
  useGlobalDragCursor(isResizing);
  const { t } = useTranslation("shell");

  return (
    <div
      className={cn(
        "relative flex h-dvh flex-col overflow-hidden bg-canvas text-ink",
        className,
      )}
    >
      <BackgroundLayer activeView={activeView} />

      <AnimatePresence>
        {!isFocused && leftSidebar}
      </AnimatePresence>

      <div className={cn(
        // `z-1` stacks content above the BackgroundLayer — but it also creates
        // a stacking context that would trap the fixed header's z-60 beneath
        // the body-portaled dock-edit backdrop (z-50). While editing, drop to
        // `z-auto` so the header can actually rise above the blur.
        isDockEditing ? "relative z-auto" : "relative z-1",
        "flex flex-1 flex-col min-h-0 overflow-hidden",
        // Header offset: desktop reserves exactly 3.5rem; touch also adds the
        // iOS top safe-area so the header (which grows on iOS) never overlaps.
        // When the header is hidden, keep only the safe-area inset on touch so
        // content never sits under the iOS status bar.
        // In desktop auto-hide mode the reserved height animates with the
        // dock: 3.5rem while revealed, 0 while retracted (content fills the
        // strip instead of leaving an empty gap). Focus mode, in contrast,
        // collapses the header space DIRECTLY (no slide) so the timer snaps
        // to its full size without any in-between animation.
        !isFocused && "transition-[padding-top] duration-500 ease-out",
        !isFocused && !hideHeader && cn(
          "max-lg:pt-[calc(3.5rem+env(safe-area-inset-top))]",
          // Desktop auto-hide: while REVEALED the content offsets by the full
          // bar (pt-14). While RETRACTED it keeps a `pt-7` margin instead of
          // filling the strip edge-to-edge: the collapsed dock still shows a
          // thin reveal band + glow line at the top, and the stretched 3D
          // cube panel would otherwise collide with it (and its hover zone
          // would overlay the content). The band is h-7, so pt-7 is exact.
          dockBarHidden ? "lg:pt-7" : "lg:pt-14",
        ),
        !isFocused && hideHeader && "max-lg:pt-safe",
        // Rail padding only where the desktop rail actually renders (>=768px).
        // Phones + small tablets (<768px) use the touch regime with the bottom tab bar.
        !isFocused && "lg:pl-14",
        // Reserve room for the fixed bottom tab bar on touch (<768px). This
        // lives on the wrapper (not <main>) because <main> is flex-1 — its
        // used height comes from flex layout, so an explicit height on it
        // would be ignored. Desktop has no bottom bar, so no padding.
        !isFocused && "max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom))]",
      )}>
        <AnimatePresence>
          {!isFocused && !hideHeader && (
            <Header
              key="header-root"
              sessionCount={sessionCount}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSwitchSession={onSwitchSession}
              onNewSession={onNewSession}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              onAddManual={onAddManual}
              onOpenProfile={onOpenProfile}
              onOpenLocker={onOpenLocker}
              onOpenMore={onOpenMore}
              puzzle={puzzle}
              onPuzzleChange={onPuzzleChange}
              solves={solves}
              activeView={activeView}
            />
          )}
        </AnimatePresence>

        <main className={cn(
          "mx-auto flex w-full flex-1 flex-col min-h-0 overflow-hidden lg:flex-row h-full",
          // NOTE: no height override — <main> is flex-1 min-h-0, so flex layout
          // sizes it. Bottom-bar and top header spaces are reserved on the wrapper.
        )}>
          <section
            id="timer-section"
            className={cn(
              "flex min-h-0 flex-col min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-out",
              // Mobile: when the timer stage (scramble + timer + bottom layout
              // strip) is taller than the space between header and tab bar,
              // let the stage scroll instead of clipping the strip into the
              // bottom bar. Only the timer view — every other view owns its
              // own scroll surface.
              activeView === "timer" && "max-lg:overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 gap-6 [@media(max-height:700px)]:lg:pt-4",
              activeView === "timer" && isCoarse && !hideHeader && "lg:pb-12",
              activeView !== "timer" && "h-full min-h-0 w-full overflow-hidden",
              // Keep the stage in normal flow while focused so the header
              // padding collapse animates smoothly instead of snapping the
              // section from static to absolute (position/auto-height are
              // not animatable, so `absolute inset-0` teleported the timer).
              isFocused ? "relative z-50 items-center justify-center" : ""
            )}
          >
            {main}
          </section>

          {rightMounted && (
            <motion.aside
              initial={false}
              animate={{
                width: isTouch ? "100%" : rightVisible ? effectiveWidth : 0,
                height: isTouch ? (rightVisible ? effectiveHeight : 0) : "",
                opacity: rightVisible ? 1 : 0,
              }}
              transition={isResizing ? { duration: 0 } : SIDEBAR_MOTION.panel}
              style={{
                overflow: "hidden",
                // Hard floor so buttons/close icon never clip off-screen during drag
                minWidth: !isTouch && rightVisible ? CUBE_RESIZE_MIN_WIDTH : undefined,
              }}
              className={cn(
                "relative flex shrink-0 flex-col bg-surface overflow-hidden border-line border-t lg:border-l rounded-tl-xl max-lg:rounded-t-xl",
                // When the dock is retracted the stage runs edge-to-edge, so
                // the cube panel stretches to the full viewport height too —
                // but not INTO the collapsed reveal band: keep the same pt-7
                // top offset as the main content so the stretched cube never
                // collides with the shrunken dock bar.
                !isFocused &&
                  (dockBarHidden
                    ? "lg:sticky lg:top-7 lg:h-[calc(100dvh-1.75rem)]"
                    : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"),
                cubeShown && "min-h-0",
                !rightVisible && "pointer-events-none",
              )}
              aria-hidden={!rightVisible}
            >
              {/* Drag handle on left border (Desktop only: width resize) */}
              {rightVisible && !isTouch && (
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <div
                      onPointerDown={handleWidthResizeStart}
                      onPointerMove={handleWidthResizeMove}
                      onPointerUp={handleWidthResizeEnd}
                      onPointerCancel={handleWidthResizeEnd}
                      onDoubleClick={handleWidthResizeReset}
                      className={cn(
                        "absolute left-0 top-0 bottom-0 z-20 w-3 -ml-1.5 cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center group",
                        isResizingWidth && "cursor-grabbing"
                      )}
                    >
                      <div
                        className={cn(
                          "h-10 w-1 rounded-full transition-all duration-150 bg-line-2 group-hover:bg-ink-2 group-hover:w-1.5",
                          isResizingWidth && "bg-ink w-1.5 h-16"
                        )}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t("resizeWidth")}</TooltipContent>
                </Tooltip>
              )}

              {/* Drag handle on top border (Touch/Mobile only: height resize & shrink/close) */}
              {rightVisible && isTouch && (
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <div
                      onPointerDown={handleHeightResizeStart}
                      onPointerMove={handleHeightResizeMove}
                      onPointerUp={handleHeightResizeEnd}
                      onPointerCancel={handleHeightResizeEnd}
                      onDoubleClick={handleHeightResizeReset}
                      className={cn(
                        "absolute top-0 left-0 right-0 z-20 h-6 -mt-3 cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center group",
                        isResizingHeight && "cursor-grabbing"
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-12 rounded-full transition-all duration-150 bg-line-2 group-hover:bg-ink-2 group-hover:h-2",
                          isResizingHeight && "bg-ink h-2 w-16"
                        )}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("resizeHeight")}</TooltipContent>
                </Tooltip>
              )}

              <div className={cn("h-full min-h-0 w-full overflow-hidden", INNER_PADDING)}>
                {cube3DReady && cube3D}
              </div>
            </motion.aside>
          )}
        </main>
      </div>
    </div>
  );
}
