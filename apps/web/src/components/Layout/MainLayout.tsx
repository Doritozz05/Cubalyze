"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { SIDEBAR_MOTION } from "./sidebar.constants";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SessionMeta } from "@/hooks/usePersistentSession";

/**
 * Width the right panel occupies once expanded.
 *
 * The 3D cube scales with the viewport (≈ half of the available width, minus
 * the left nav) so it visually matches the previous `lg:grid-cols-2` "focus
 * mode" layout. The stats sidebar keeps a compact fixed width. Both are
 * clamped so the panel stays readable on very small or very wide screens.
 *
 * Side effects of matching the old sizing: the main column also returns to
 * ~50% viewport width, so the SessionStats row beneath the timer regains
 * its original proportions.
 */
const LEFT_NAV_WIDTH = 56; // matches md:pl-14 on the row
const CUBE_MIN_WIDTH = 460;
const CUBE_MAX_WIDTH = 720;
const STATS_WIDTH = 380;

/** Padding applied around the cube canvas / stats sidebar contents. Lives on
 *  the inner wrappers (NOT on the animated <motion.aside>) so the container
 *  can collapse to width=0 / height=0 cleanly when closed. */
const INNER_PADDING = "px-4 py-6 sm:px-6 lg:py-8";

export interface MainLayoutProps {
  /** Primary content area: scramble, timer, quick stats. */
  main: React.ReactNode;
  /** Sidebar content: solve log + stats tabs. */
  sidebar: React.ReactNode;
  /** Left navigation sidebar (fixed position, hover-to-expand). */
  leftSidebar?: React.ReactNode;
  /** Toggle mobile nav sheet. */
  onToggleMobileNav?: () => void;
  /** 3D cube view (rendered in place of the sidebar when cube3DActive). */
  cube3D?: React.ReactNode;
  /** Whether the 3D cube view is active (hides sidebar, shows cube). */
  cube3DActive?: boolean;
  /** Whether the 3D cube has been activated at least once (keeps it mounted). */
  cube3DReady?: boolean;
  /** Personal best shown in the header (ms). */
  pb?: number | null;
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
  /** Toggle the 3D cube view. */
  onToggleCube3D?: () => void;
  /** Whether the right sidebar is active. */
  sidebarActive?: boolean;
  /** Toggle the right sidebar view. */
  onToggleSidebar?: () => void;
  className?: string;
}

/**
 * Top-level shell: sticky header and a two-region body (timer stage + right
 * panel) that collapses to a single column on small screens.
 *
 * The right panel slides in/out using framer-motion with the same easing
 * curve as the left sidebar (see SIDEBAR_MOTION.panel).
 *
 * When `cube3DActive`, the right panel swaps its body to the 3D cube canvas.
 * Once the cube has been activated once (`cube3DReady`), it stays mounted so
 * its worker + OffscreenCanvas aren't re-initialized on every toggle.
 */
export function MainLayout({
  main,
  sidebar,
  leftSidebar,
  onToggleMobileNav,
  cube3D,
  cube3DActive,
  cube3DReady,
  pb,
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onToggleCube3D,
  sidebarActive,
  onToggleSidebar,
  className,
}: MainLayoutProps) {
  // Defer useIsMobile to post-mount to avoid SSR/hydration flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsMobile = useIsMobile();
  const isMobile = mounted ? rawIsMobile : false;

  // Track viewport width so the cube panel can derive a responsive
  // (~half-screen) width on desktop. framer-motion then animates between 0
  // (hidden) and this numeric value smoothly.
  //
  // Initialised synchronously via lazy initializer so the very first render
  // already has a correct value (otherwise the cube would briefly show at the
  // clamped minimum width if toggled on before the post-mount effect fires).
  //
  // Coalesced via requestAnimationFrame — `resize` can fire dozens of times
  // per second during a window drag, and we only care about the latest value
  // once per paint.
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

  const cubeShown = !!cube3DActive;
  const statsShown = !cubeShown && !!sidebarActive;
  const rightVisible = cubeShown || statsShown;
  // Keep the panel mounted after the first cube activation so the worker
  // (and its OffscreenCanvas transfer) survives subsequent toggles.
  const rightMounted = rightVisible || !!cube3DReady;

  const asideWidth = cubeShown
    ? Math.max(
        CUBE_MIN_WIDTH,
        Math.min(CUBE_MAX_WIDTH, (vw - LEFT_NAV_WIDTH) / 2),
      )
    : statsShown
      ? STATS_WIDTH
      : 0;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-canvas text-ink lg:h-dvh lg:overflow-hidden",
        className,
      )}
    >
      {leftSidebar}

      <div className="flex flex-1 flex-col md:pl-14">
        <Header
          pb={pb}
          sessionCount={sessionCount}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          cube3DActive={cube3DActive}
          onToggleCube3D={onToggleCube3D}
          sidebarActive={sidebarActive}
          onToggleSidebar={onToggleSidebar}
          onToggleMobileNav={onToggleMobileNav}
        />

        <main className="mx-auto flex w-full flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row lg:overflow-hidden">
          <section
            id="timer-section"
            className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 lg:min-w-0 lg:flex-1 lg:overflow-y-auto"
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
                "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
                "border-line max-lg:border-t max-lg:border-l-0 lg:border-l lg:border-t-0",
                cubeShown && "min-h-[50vh] lg:min-h-0",
                !rightVisible && "pointer-events-none",
              )}
              aria-hidden={!rightVisible}
            >
              {/* Padding lives on the inner wrappers (NOT on the animated
                  <motion.aside>). With box-sizing: border-box, padding on the
                  container would prevent it from collapsing to width=0 /
                  height=0 when closed, leaving a residual strip in the DOM. */}
              <div
                className={cn(
                  "h-full min-h-0 w-full",
                  INNER_PADDING,
                  cubeShown ? "block" : "hidden",
                )}
              >
                {cube3DReady && cube3D}
              </div>
              <div
                className={cn(
                  "h-full min-h-0 w-full",
                  INNER_PADDING,
                  cubeShown ? "hidden" : "block",
                )}
              >
                {sidebar}
              </div>
            </motion.aside>
          )}
        </main>
      </div>
    </div>
  );
}
