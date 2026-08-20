"use client";

import { useEffect } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { keyboardState } from "@/lib/keyboardState";

export interface UseShortcutsOptions {
  /** New scramble. Ignored while the timer is running/stopped. */
  onNewScramble?: () => void;
  /** Copy the current scramble. Ignored while the timer is running/stopped. */
  onCopyScramble?: () => void;
  /** Cancel the timer's arming/holding (Esc). */
  onCancel?: () => void;
  /** A ref whose `.current` is the current timer state — gates N/C. */
  timerStateRef?: React.MutableRefObject<string>;
  /**
   * When false the listener is not attached at all (e.g. while the onboarding
   * tour owns the keyboard — TDD-0020). Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts (N / C / Esc by default, customizable via settings).
 * Space is handled inside `useTimerUI`, so it is explicitly excluded here.
 * Shortcuts that mutate data (new / copy) are disabled while the timer is active.
 */
export function useShortcuts({
  onNewScramble,
  onCopyScramble,
  onCancel,
  timerStateRef,
  enabled = true,
}: UseShortcutsOptions) {
  const shortcuts = useStore(preferencesStore, (s) => s.shortcuts);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // While a modal (Settings) owns the keyboard, never fire shortcut
      // actions — the user is interacting with the dialog, not the timer.
      if (keyboardState.settingsOpen) return;
      // Never intercept modifier combos or the timer's start key (the timer
      // owns it, whichever key the user configured).
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key.toLowerCase() === shortcuts.startTimer.toLowerCase()) return;

      // Ignore when focus is in an editable element.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      const key = e.key.toLowerCase();
      const st = timerStateRef?.current ?? "idle";
      const timerActive = st === "running" || st === "stopped";

      if (key === shortcuts.cancelTimer.toLowerCase()) {
        if (onCancel) {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (timerActive) return;

      if (key === shortcuts.newScramble.toLowerCase() && onNewScramble) {
        e.preventDefault();
        onNewScramble();
      } else if (key === shortcuts.copyScramble.toLowerCase() && onCopyScramble) {
        e.preventDefault();
        onCopyScramble();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNewScramble, onCopyScramble, onCancel, timerStateRef, shortcuts, enabled]);
}
