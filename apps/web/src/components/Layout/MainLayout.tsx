"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { useIsMobile } from "@/hooks/use-mobile";
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
  /** Toggle mobile nav sheet. */
  onToggleMobileNav?: () => void;
  /** Open the manual solve entry sheet (the "+" button in the header). */
  onAddManual?: () => void;
  /** 3D cube view (rendered in the right aside when cube3DActive). */
  cube3D?: React.ReactNode;
  /** Whether the 3D cube view is active (shows the split). */
  cube3DActive?: boolean;
  /** Whether the 3D cube has been activated at least once (keeps it mounted). */
  cube3DReady?: boolean;
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
  onToggleMobileNav,
  onAddManual,
  cube3D,
  cube3DActive,
  cube3DReady,
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
  // Defer useIsMobile to post-mount to avoid SSR/hydration flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsMobile = useIsMobile();
  const isMobile = mounted ? rawIsMobile : false;

  // Track viewport width so the cube panel can derive a responsive width
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  useEffect(() => {
    let rafId: number | null = null;
    const update = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setVw(window.innerWidth);
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

  const maxPanelWidth = cubeShown
    ? Math.max(
        CUBE_MIN_WIDTH,
        Math.min(CUBE_MAX_WIDTH, (vw - LEFT_NAV_WIDTH) / 2),
      )
    : 0;

  // User-defined width resize state
  const [userPanelWidth, setUserPanelWidth] = useState<number | null>(null);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Pin global DMZ grabbing hand cursor while resizing
  useGlobalDragCursor(isResizingPanel);

  // Upper bound is strictly maxPanelWidth (current default size)
  const effectiveWidth = Math.min(
    maxPanelWidth,
    Math.max(CUBE_RESIZE_MIN_WIDTH, userPanelWidth ?? maxPanelWidth),
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizingPanel(true);
      dragStartRef.current = { startX: e.clientX, startWidth: effectiveWidth };
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [effectiveWidth],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      // Moving right (+deltaX) reduces width because panel is anchored to the right
      const newWidth = Math.min(
        maxPanelWidth,
        Math.max(CUBE_RESIZE_MIN_WIDTH, dragStartRef.current.startWidth - deltaX),
      );
      setUserPanelWidth(newWidth);
    },
    [maxPanelWidth],
  );

  const handleResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsResizingPanel(false);
      dragStartRef.current = null;
      try {
        (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture was already lost
      }
    },
    [],
  );

  const handleResizeReset = useCallback(() => {
    setUserPanelWidth(null);
  }, []);

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

      <div className={cn("flex flex-1 flex-col", !isFocused && !hideHeader && "pt-14", !isFocused && "md:pl-14")}>
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
              onToggleMobileNav={onToggleMobileNav}
              onAddManual={onAddManual}
              puzzle={puzzle}
              onPuzzleChange={onPuzzleChange}
            />
          )}
        </AnimatePresence>

        <main className={cn(
          "mx-auto flex w-full flex-1 flex-col overflow-hidden lg:flex-row",
          !isFocused && !hideHeader && "h-[calc(100dvh-3.5rem)]",
          !isFocused && hideHeader && "h-dvh"
        )}>
          <section
            id="timer-section"
            className={cn(
              "flex min-h-0 flex-col min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-out",
              !hideHeader && "px-4 py-6 sm:px-6 lg:px-8 lg:py-8 gap-6",
              hideHeader && "p-3 sm:p-4 gap-3 h-full",
              isFocused ? "items-center justify-center h-screen w-screen absolute inset-0 z-50 bg-canvas" : ""
            )}
          >
            {main}
          </section>

          {rightMounted && (
            <motion.aside
              initial={false}
              animate={{
                width: isMobile ? "100%" : rightVisible ? effectiveWidth : 0,
                height: isMobile ? (rightVisible ? "auto" : 0) : "",
                opacity: rightVisible ? 1 : 0,
              }}
              transition={isResizingPanel ? { duration: 0 } : SIDEBAR_MOTION.panel}
              style={{ overflow: "hidden" }}
              className={cn(
                "relative flex shrink-0 flex-col bg-surface overflow-hidden",
                !isFocused && "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
                !isFocused && "border-line max-lg:border-t max-lg:border-l-0 lg:border-l lg:border-t-0",
                cubeShown && "min-h-[50vh] lg:min-h-0",
                !rightVisible && "pointer-events-none",
              )}
              aria-hidden={!rightVisible}
            >
              {/* Drag handle on left border (Desktop only) */}
              {rightVisible && !isMobile && (
                <div
                  onPointerDown={handleResizeStart}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                  onPointerCancel={handleResizeEnd}
                  onDoubleClick={handleResizeReset}
                  className={cn(
                    "absolute left-0 top-0 bottom-0 z-20 w-3 -ml-1.5 cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center group",
                    isResizingPanel && "cursor-grabbing"
                  )}
                  title="Arrastrar para ajustar ancho (Doble clic para restablecer)"
                >
                  <div
                    className={cn(
                      "h-10 w-1 rounded-full transition-all duration-150 bg-line-2 group-hover:bg-ink-2 group-hover:w-1.5",
                      isResizingPanel && "bg-ink w-1.5 h-16"
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
