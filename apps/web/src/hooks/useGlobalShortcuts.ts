"use client";

import { useEffect } from "react";
import { useShortcuts } from "@/hooks/useShortcuts";
import type { TimerState } from "@/types";

export interface GlobalShortcutsDeps {
  onNewScramble: () => void;
  onCopyScramble: () => void;
  onCancel: () => void;
  timerStateRef: React.MutableRefObject<TimerState>;
  /** The tour owns the keyboard while active (ESC skips, Space is swallowed). */
  enabled: boolean;
  solveCount: number;
}

/**
 * Global keyboard shortcuts + document title (extracted from App.tsx).
 */
export function useGlobalShortcuts(deps: GlobalShortcutsDeps) {
  useShortcuts({
    onNewScramble: deps.onNewScramble,
    onCopyScramble: deps.onCopyScramble,
    onCancel: deps.onCancel,
    timerStateRef: deps.timerStateRef,
    enabled: deps.enabled,
  });

  useEffect(() => {
    document.title = `cubeforge — ${deps.solveCount} solves`;
  }, [deps.solveCount]);
}
