"use client";

import { useShortcuts } from "@/hooks/useShortcuts";
import type { TimerState } from "@/types";

export interface GlobalShortcutsDeps {
  onNewScramble: () => void;
  onCopyScramble: () => void;
  onCancel: () => void;
  timerStateRef: React.MutableRefObject<TimerState>;
  /** The tour owns the keyboard while active (ESC skips, Space is swallowed). */
  enabled: boolean;
}

/**
 * Global keyboard shortcuts (the localized per-view document title lives in
 * useDocumentTitle, owned by App and the views).
 */
export function useGlobalShortcuts(deps: GlobalShortcutsDeps) {
  useShortcuts({
    onNewScramble: deps.onNewScramble,
    onCopyScramble: deps.onCopyScramble,
    onCancel: deps.onCancel,
    timerStateRef: deps.timerStateRef,
    enabled: deps.enabled,
  });
}
