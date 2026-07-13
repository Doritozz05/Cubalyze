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
  className?: string;
}

/**
 * Top-level shell: sticky header, a two-column body (timer stage + sidebar)
 * that collapses to a single column on small screens, and a sticky footer
 * with the keyboard hint. Footer is pinned to the bottom via mt-auto.
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
      />

      <main className={cn(
        "mx-auto flex w-full flex-1 flex-col lg:grid",
        cube3DActive 
          ? "lg:grid-cols-2" 
          : "lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,380px)]"
      )}>
        <section className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {main}
        </section>

        <aside
          className={cn(
            "flex flex-col bg-surface px-4 py-6 sm:px-6 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem-2.75rem)] lg:overflow-hidden lg:py-8",
            cube3DActive
              ? "min-h-[50vh] border-t border-line lg:min-h-0 lg:border-l lg:border-t-0"
              : "border-t border-line lg:border-l lg:border-t-0",
          )}
        >
          {cube3DActive ? cube3D : sidebar}
        </aside>
      </main>

      <footer className="mt-auto border-t border-line bg-surface">
        <div className="mx-auto flex h-11 w-full items-center justify-between gap-4 px-4 text-xs text-ink-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="hidden items-center gap-1.5 lg:flex">
              <Kbd>Space</Kbd>
              start / stop
              <Sep />
              <Kbd>N</Kbd>
              new scramble
              <Sep />
              <Kbd>C</Kbd>
              copy
              <Sep />
              <Kbd>Esc</Kbd>
              cancel
            </span>
            <span className="hidden items-center gap-1.5 sm:flex lg:hidden">
              <Kbd>Space</Kbd>
              arm · release to launch · stop
            </span>
            <span className="sm:hidden">Tap &amp; hold the timer to start</span>
          </div>
          <span className="nums shrink-0 tracking-tight">cubeforge · v0.1</span>
        </div>
      </footer>
    </div>
  );
}

function Sep() {
  return <span className="h-3 w-px bg-line" aria-hidden />;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="nums rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.62rem] font-medium text-ink-2">
      {children}
    </kbd>
  );
}
