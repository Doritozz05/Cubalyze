"use client";

// ─────────────────────────────────────────────────────────────────────────
// useTimerUI — DEPRECATED compatibility shim.
//
// The orchestration has been centralised in `useSolveSession.ts`. This file
// remains so historical imports don't break the typecheck while consumers
// are migrated. Do not add new usages — use `useSolveSession` directly.
// ─────────────────────────────────────────────────────────────────────────

import { useSolveSession } from "./useSolveSession";
import type { TimerState, Penalty } from "@/types";

/**
 * @deprecated Use `useSolveSession` instead. This thin wrapper exists
 * only to avoid breaking legacy imports during the migration.
 *
 * Note: legacy `useTimerUI` exposed `state`/`time`/`lastTime`/`press`/
 * `release`/`reset`/`cancel` and an internal local toggle. The new
 * orchestration reads inspection from `preferencesStore`, so this shim
 * requires a valid scramble to operate. Pass an empty string if you do
 * not have one at the call site.
 */
export function useTimerUI(
  onSolve?: (time: number, penalty: Penalty) => void,
  _isScrambledLegacy?: boolean,
): {
  state: TimerState;
  time: number;
  lastTime: number | null;
  press: () => void;
  release: () => void;
  reset: () => void;
  cancel: () => void;
  inspectionEnabled: boolean;
} {
  // We pick a stable empty scramble so the orchestrator can still wire up.
  const session = useSolveSession("", { onSolve });
  return {
    state: session.phase,
    time: session.time,
    lastTime: session.lastTime,
    press: session.press,
    release: session.release,
    reset: session.reset,
    cancel: session.cancel,
    inspectionEnabled: session.inspection,
  };
}
