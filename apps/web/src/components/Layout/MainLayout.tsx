"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { useIsTouch } from "@/hooks/use-mobile";
import { useGlobalDragCursor } from "@/hooks/useGlobalDragCursor";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import type { PuzzleCategory } from "@/types";

/**
 * Width the 3D cube panel occupies once expanded.
 *
 * The cube scales with the viewport (≈ half of the available width, minus the
 * left nav) so it visually matches the previous `lg:grid-cols-2` "focus mode"
 * layout, clamped so it stays readable on small or very wide screens.
 */
const LEFT_NAV_WIDTH = 56; // matches md:pl-14 on the row
const CUBE_MIN_WIDTH = 510;
const CUBE_MAX_WIDTH = 800;
const CUBE_RESIZE_MIN_WIDTH = 220; // Minimum width when user resizes to the right

/** Padding applied around the cube canvas. Lives on the inner wrapper (NOT on
 *  the animated <motion.aside>) so the container can collapse to width=0 /
 *  height=0 cleanly when closed. */
const INNER_PADDING = "px-4 py-6 sm:px-6 lg:py-8";

export interface MainLayoutProps {
  /** Primary content area: scramble, timer, quick stats — or a full Insights
   *  view (Times/Stats/Analysis) when the LeftSidebar nav switches to it. */
  main: React.ReactNode;
  /** Left navigation sidebar (fixed position, hover-to-expand). */
  leftSidebar?: React.ReactNode;
  /** Open the manual solve entry sheet (the "+" button in the header). */
  onAddManual?: () => void;
  /** Navigate to the Profile view (header avatar chip). */
  onOpenProfile?: () => void;
  /** Stable identity seed for the header CubeMark chip (user_id). */
  profileSeed?: string;
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
  onOpenProfile,
  profileSeed,
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
  isFocused,
  hideHeader,
  puzzle,
  onPuzzleChange,
  className,
}: MainLayoutProps) {
  // Defer useIsTouch to post-mount to avoid SSR/hydration flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsTouch = useIsTouch();
  const isTouch = mounted ? rawIsTouch : false;

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
        Math.min(CUBE_MAX_WIDTH, (vw - LEFT_NAV_WIDTH) / 2),
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

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-canvas text-ink",
        className,
      )}
    >
      <AnimatePresence>
        {!isFocused && leftSidebar}
      </AnimatePresence>

      <div className={cn(
        "flex flex-1 flex-col min-h-0 overflow-hidden",
        // Header offset: desktop reserves exactly 3.5rem; touch also adds the
        // iOS top safe-area so the header (which grows on iOS) never overlaps.
        !isFocused && !hideHeader && "max-lg:pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-14",
        // Rail padding only where the desktop rail actually renders (>=1024px).
        // Tablets (<1024px) use the touch regime with the bottom tab bar.
        !isFocused && "lg:pl-14",
        // Reserve room for the fixed bottom tab bar on touch (<1024px). This
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
              profileSeed={profileSeed}
              puzzle={puzzle}
              onPuzzleChange={onPuzzleChange}
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
              !hideHeader && "px-4 py-6 sm:px-6 lg:px-8 lg:py-8 gap-6",
              hideHeader && "p-3 sm:p-4 gap-3 h-full min-h-0",
              isFocused ? "items-center justify-center h-screen w-screen absolute inset-0 z-50 bg-canvas" : ""
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
                "relative flex shrink-0 flex-col bg-surface overflow-hidden",
                !isFocused && "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
                !isFocused && "border-line max-lg:border-t max-lg:border-l-0 lg:border-l lg:border-t-0",
                cubeShown && "min-h-0",
                !rightVisible && "pointer-events-none",
              )}
              aria-hidden={!rightVisible}
            >
              {/* Drag handle on left border (Desktop only: width resize) */}
              {rightVisible && !isTouch && (
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
                  title="Drag to resize width (Double-click to reset)"
                >
                  <div
                    className={cn(
                      "h-10 w-1 rounded-full transition-all duration-150 bg-line-2 group-hover:bg-ink-2 group-hover:w-1.5",
                      isResizingWidth && "bg-ink w-1.5 h-16"
                    )}
                  />
                </div>
              )}

              {/* Drag handle on top border (Touch/Mobile only: height resize & shrink/close) */}
              {rightVisible && isTouch && (
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
                  title="Drag to resize or close (Double-click to reset)"
                >
                  <div
                    className={cn(
                      "h-1.5 w-12 rounded-full transition-all duration-150 bg-line-2 group-hover:bg-ink-2 group-hover:h-2",
                      isResizingHeight && "bg-ink h-2 w-16"
                    )}
                  />
                </div>
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
