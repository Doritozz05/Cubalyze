"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, ChevronUp } from "lucide-react";
import { useIsTouch } from "@/hooks/use-mobile";
import { TouchPanel } from "@/components/TouchPanel";

/** Default desktop aside classes (matches the common training-view pattern). */
const DEFAULT_ASIDE_CLASS = "flex min-h-0 flex-col gap-4 lg:w-64 lg:shrink-0 overflow-hidden";

export interface TouchAsideProps {
  /** Title shown on the touch trigger bar and in the sheet header. */
  title: string;
  /** The aside content — rendered verbatim in both regimes. */
  children: React.ReactNode;
  /**
   * Exact className applied to the desktop <aside>. Pass the view's original
   * aside classes verbatim so desktop rendering stays 100% identical.
   */
  className?: string;
}

/**
 * Sidebar wrapper for training views.
 *
 * Desktop (>=768px): renders the exact same `<aside>` markup as before —
 * zero visual change. Touch (<768px): the aside content collapses into a
 * tappable "Options ▾" bar that opens the content in a bottom sheet
 * (`TouchPanel`), so stats/options never steal vertical space from the timer.
 */
export function TouchAside({ title, children, className }: TouchAsideProps) {
  // Defer to post-mount to avoid SSR/hydration flash (same pattern as MainLayout).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsTouch = useIsTouch();
  const isTouch = mounted && rawIsTouch;
  const [open, setOpen] = useState(false);

  if (!isTouch) {
    return (
      <aside className={className ?? DEFAULT_ASIDE_CLASS}>
        {children}
      </aside>
    );
  }

  return (
    <>
      {/* Touch trigger bar — full-width, thumb-friendly */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-11 w-full shrink-0 items-center justify-between rounded-xl border border-line bg-surface px-4 text-[0.72rem] font-medium text-ink shadow-xs touch-manipulation select-none"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-ink-3" />
          {title}
        </span>
        <ChevronUp className="size-4 text-ink-3" />
      </button>

      <TouchPanel open={open} onOpenChange={setOpen} title={title}>
        {children}
      </TouchPanel>
    </>
  );
}
