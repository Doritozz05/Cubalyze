"use client";

import { cn } from "@/lib/utils";
import { Header } from "./Header";
import type { SessionMeta } from "@/hooks/usePersistentSession";

export interface MainLayoutProps {
  /** Primary content area: scramble, timer, quick stats. */
  main: React.ReactNode;
  /** Sidebar content: solve log + stats tabs. */
  sidebar: React.ReactNode;
  /** 3D cube view (rendered in place of the sidebar when cube3DActive). */
  cube3D?: React.ReactNode;
  /** Whether the 3D cube view is active (hides sidebar, shows cube). */
  cube3DActive?: boolean;
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
  /** Whether the sidebar is active. */
  sidebarActive?: boolean;
  /** Toggle the sidebar view. */
  onToggleSidebar?: () => void;
  className?: string;
}

/**
 * Top-level shell: sticky header and a two-column body (timer stage + sidebar)
 * that collapses to a single column on small screens.
 *
 * When `cube3DActive`, the sidebar is replaced by the 3D cube canvas — a
 * "focused mode" that keeps the timer + scramble front-and-center while the
 * physical cube's live state renders beside it.
 */
export function MainLayout({
  main,
  sidebar,
  cube3D,
  cube3DActive,
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
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-canvas text-ink lg:h-dvh lg:overflow-hidden",
        className,
      )}
    >
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
      />

      <main className={cn(
        "mx-auto flex w-full flex-1 flex-col lg:grid",
        cube3DActive || sidebarActive
          ? cube3DActive 
            ? "lg:grid-cols-2" 
            : "lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,380px)]"
          : "lg:grid-cols-1"
      )}>
        <section className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {main}
        </section>

        {(cube3DActive || sidebarActive) && (
          <aside
            className={cn(
              "flex flex-col bg-surface px-4 py-6 sm:px-6 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:py-8",
              cube3DActive
                ? "min-h-[50vh] border-t border-line lg:min-h-0 lg:border-l lg:border-t-0"
                : "border-t border-line lg:border-l lg:border-t-0",
            )}
          >
            {cube3DActive ? cube3D : sidebar}
          </aside>
        )}
      </main>

    </div>
  );
}

