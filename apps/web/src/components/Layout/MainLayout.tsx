"use client";

import { cn } from "@/lib/utils";
import { Header } from "./Header";
import type { SessionMeta } from "@/hooks/usePersistentSession";

export interface MainLayoutProps {
  /** Primary content area: scramble, timer, quick stats. */
  main: React.ReactNode;
  /** Sidebar content: solve log + stats tabs. */
  sidebar: React.ReactNode;
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
  className?: string;
}

/**
 * Top-level shell: sticky header, a two-column body (timer stage + sidebar)
 * that collapses to a single column on small screens, and a sticky footer
 * with the keyboard hint. Footer is pinned to the bottom via mt-auto.
 */
export function MainLayout({
  main,
  sidebar,
  pb,
  sessionCount,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  className,
}: MainLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-canvas text-ink",
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
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,380px)]">
        <section className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {main}
        </section>

        <aside className="flex flex-col border-t border-line bg-surface px-4 py-6 sm:px-6 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem-2.75rem)] lg:overflow-hidden lg:border-l lg:border-t-0 lg:py-8">
          {sidebar}
        </aside>
      </main>

      <footer className="mt-auto border-t border-line bg-surface">
        <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between gap-4 px-4 text-xs text-ink-3 sm:px-6">
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
          <span className="nums shrink-0 tracking-tight">cubit · v0.1</span>
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
