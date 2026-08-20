"use client";

import { useEffect } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { keyboardState } from "@/lib/keyboardState";

export interface UseTimerKeyboardOptions {
  /** Called on start-key keydown (guarded against key repeat). */
  onPress: () => void;
  /** Called on start-key keyup. */
  onRelease: () => void;
  /** Boolean disable — re-renders on change (e.g. drill verdict overlay). Default true. */
  enabled?: boolean;
  /**
   * Ref-based disable — read at event time without re-renders. Used by the
   * practice timer so training views can mute it while their own timer is
   * active (avoids two key handlers racing).
   */
  disabledRef?: React.MutableRefObject<boolean>;
}

/**
 * Global timer-key control (hold-to-arm, release-to-start). The key is the
 * user-configurable `shortcuts.startTimer` preference (default Space).
 *
 * Shared by useDrillTimer and useSolveSession — previously each hook owned
 * an identical copy of this effect. Listens in the capture phase so the
 * timer wins over any focused element, and ignores events originating from
 * inputs / textareas / contenteditable nodes — plus any event while a modal
 * (Settings) owns the keyboard (see keyboardState).
 */
export function useTimerKeyboard({
  onPress,
  onRelease,
  enabled = true,
  disabledRef,
}: UseTimerKeyboardOptions) {
  // Defensive default: pre-v4 persisted prefs lack shortcuts.startTimer.
  const startKey = useStore(preferencesStore, (s) => s.shortcuts.startTimer ?? " ");

  useEffect(() => {
    const isDisabled = () =>
      !enabled || disabledRef?.current === true || keyboardState.settingsOpen;

    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };

    // Case-insensitive match so "N" (shift held) still triggers "n".
    const isStartKey = (e: KeyboardEvent) => e.key.toLowerCase() === startKey.toLowerCase();

    const onKeyDown = (e: KeyboardEvent) => {
      if (isDisabled() || !isStartKey(e)) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) onPress();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isDisabled() || !isStartKey(e)) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      onRelease();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [onPress, onRelease, enabled, disabledRef, startKey]);
}
