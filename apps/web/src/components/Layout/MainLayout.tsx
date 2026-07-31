"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { useIsMobile } from "@/hooks/use-mobile";
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
 *
 * The old right sidebar (Times/Stats/Analysis tabs) has been removed — those
 * views now live in the main stage and are switched via the LeftSidebar nav.
 * The right aside only ever hosts the 3D cube, sliding in/out with the same
 * easing curve as the left sidebar (see SIDEBAR_MOTION.panel). Once the cube
 * has been activated once (`cube3DReady`), it stays mounted so its worker +
 * OffscreenCanvas aren't re-initialized on every toggle.
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

  // Track viewport width so the cube panel can derive a responsive
  // (~half-screen) width on desktop. framer-motion then animates between 0
  // (hidden) and this numeric value smoothly. Coalesced via rAF.
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
  // Keep the panel mounted after the first cube activation so the worker
  // (and its OffscreenCanvas transfer) survives subsequent toggles.
  const rightMounted = rightVisible || !!cube3DReady;

  const asideWidth = cubeShown
    ? Math.max(
      CUBE_MIN_WIDTH,
      Math.min(CUBE_MAX_WIDTH, (vw - LEFT_NAV_WIDTH) / 2),
    )
    : 0;

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
                // Desktop: width is animated, height falls back to Tailwind CSS.
                // Mobile: width is fluid (full container), height animates between
                // 0 and "auto" to slide the panel up/down smoothly.
                width: isMobile ? "100%" : rightVisible ? asideWidth : 0,
                height: isMobile ? (rightVisible ? "auto" : 0) : "",
                opacity: rightVisible ? 1 : 0,
              }}
              transition={SIDEBAR_MOTION.panel}
              style={{ overflow: "hidden" }}
              className={cn(
                "flex shrink-0 flex-col bg-surface",
                !isFocused && "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
                !isFocused && "border-line max-lg:border-t max-lg:border-l-0 lg:border-l lg:border-t-0",
                cubeShown && "min-h-[50vh] lg:min-h-0",
                !rightVisible && "pointer-events-none",
              )}
              aria-hidden={!rightVisible}
            >
              {/* Padding lives on the inner wrapper (NOT on the animated
                  <motion.aside>). With box-sizing: border-box, padding on the
                  container would prevent it from collapsing to width=0 /
                  height=0 when closed, leaving a residual strip in the DOM. */}
              <div className={cn("h-full min-h-0 w-full", INNER_PADDING)}>
                {cube3DReady && cube3D}
              </div>
            </motion.aside>
          )}
        </main>
      </div>
    </div>
  );
}
