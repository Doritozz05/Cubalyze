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
 * Mirrors (approximately) `clamp(320px, 26vw, 380px)` for the stats panel and
 * gives the 3D cube a bit more room to breathe.
 */
const RIGHT_PANEL_WIDTH = {
  stats: 380,
  cube: 520,
} as const;

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

  const cubeShown = !!cube3DActive;
  const statsShown = !cubeShown && !!sidebarActive;
  const rightVisible = cubeShown || statsShown;
  // Keep the panel mounted after the first cube activation so the worker
  // (and its OffscreenCanvas transfer) survives subsequent toggles.
  const rightMounted = rightVisible || !!cube3DReady;

  const asideWidth = cubeShown
    ? RIGHT_PANEL_WIDTH.cube
    : statsShown
      ? RIGHT_PANEL_WIDTH.stats
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
              <div
                className={cn(
                  "h-full min-h-0 w-full",
                  cubeShown ? "block" : "hidden",
                )}
              >
                {cube3DReady && cube3D}
              </div>
              <div
                className={cn(
                  "h-full min-h-0 w-full",
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
