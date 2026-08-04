"use client";

import { useState } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import type { TimerState } from "@/types";

export interface TimerFocusDeps {
  timerPhase: TimerState;
  smartCubeConnected: boolean;
}

/**
 * Focus-mode computation (extracted from App.tsx): when focus mode is on, the
 * chrome (scramble, session stats, widgets, tab bar) collapses while the user
 * is solving. Manual mode uses an explicit manual-focus toggle instead.
 */
export function useTimerFocus(deps: TimerFocusDeps) {
  const inputMode = useStore(preferencesStore, (s) => s.inputMode);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const [manualFocus, setManualFocus] = useState(false);

  const isManualMode = inputMode === "manual";

  const isFocused =
    (isManualMode && manualFocus) ||
    (focusMode &&
      !isManualMode &&
      (deps.timerPhase === "running" ||
        deps.timerPhase === "inspection" ||
        deps.timerPhase === "holding" ||
        deps.timerPhase === "ready_for_move" ||
        (deps.timerPhase === "ready" && !deps.smartCubeConnected)));

  return {
    isFocused,
    manualFocus,
    toggleManualFocus: () => setManualFocus((f) => !f),
  };
}
