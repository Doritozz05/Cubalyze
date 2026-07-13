"use client";

import { useEffect } from "react";

export interface UseShortcutsOptions {
  /** New scramble. Ignored while the timer is running/stopped. */
  onNewScramble?: () => void;
  /** Copy the current scramble. Ignored while the timer is running/stopped. */
  onCopyScramble?: () => void;
  /** Cancel the timer's arming/holding (Esc). */
  onCancel?: () => void;
  /** A ref whose `.current` is the current timer state — gates N/C. */
  timerStateRef?: React.MutableRefObject<string>;
}

/**
 * Global keyboard shortcuts (N / C / Esc). Space is handled inside
 * `useTimerUI`, so it is explicitly excluded here. Shortcuts that mutate
 * data (new / copy) are disabled while the timer is active.
 */
export function useShortcuts({
  onNewScramble,
  onCopyScramble,
  onCancel,
  timerStateRef,
}: UseShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept modifier combos or Space (timer owns it).
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "Space") return;

      // Ignore when focus is in an editable element.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      const key = e.key.toLowerCase();
      const st = timerStateRef?.current ?? "idle";
      const timerActive = st === "running" || st === "stopped";

      if (key === "escape") {
        if (onCancel) {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (timerActive) return;

      if (key === "n" && onNewScramble) {
        e.preventDefault();
        onNewScramble();
      } else if (key === "c" && onCopyScramble) {
        e.preventDefault();
        onCopyScramble();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNewScramble, onCopyScramble, onCancel, timerStateRef]);
}
