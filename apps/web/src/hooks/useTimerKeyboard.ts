"use client";

import { useEffect } from "react";

export interface UseTimerKeyboardOptions {
  /** Called on Space keydown (guarded against key repeat). */
  onPress: () => void;
  /** Called on Space keyup. */
  onRelease: () => void;
  /** Boolean disable — re-renders on change (e.g. drill verdict overlay). Default true. */
  enabled?: boolean;
  /**
   * Ref-based disable — read at event time without re-renders. Used by the
   * practice timer so training views can mute it while their own timer is
   * active (avoids two Space handlers racing).
   */
  disabledRef?: React.MutableRefObject<boolean>;
}

/**
 * Global Space-key timer control (hold-to-arm, release-to-start).
 *
 * Shared by useDrillTimer and useSolveSession — previously each hook owned
 * an identical copy of this effect. Listens in the capture phase so the
 * timer wins over any focused element, and ignores events originating from
 * inputs / textareas / contenteditable nodes.
 */
export function useTimerKeyboard({
  onPress,
  onRelease,
  enabled = true,
  disabledRef,
}: UseTimerKeyboardOptions) {
  useEffect(() => {
    const isDisabled = () => !enabled || disabledRef?.current === true;

    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isDisabled() || e.code !== "Space") return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) onPress();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isDisabled() || e.code !== "Space") return;
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
  }, [onPress, onRelease, enabled, disabledRef]);
}
