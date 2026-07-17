import type { TimerState } from "@/types";

/**
 * Configuration context required to render a deterministic timer hint.
 *
 * The hint is computed solely from (phase, hasLast, ctx) so any caller that
 * provides the same inputs gets the exact same text — no hidden state, no
 * stale flags. This makes the rendering trivially testable and keeps the
 * message strictly aligned with the current state-machine phase.
 */
export interface HintContext {
  /** A Smart Cube is currently paired and reporting moves. */
  smartCube: boolean;
  /** Scramble Verification preference is ON. */
  scrambleVerif: boolean;
  /** Inspection preference is ON. */
  inspection: boolean;
}

/**
 * Returns the localized user-facing hint for the timer given its current
 * engine phase and active preferences.
 *
 * Order of preference per phase:
 *   - ready_for_move : always "make a move to start" (a physical cube
 *                      move is what unlocks the timer).
 *   - inspection     : always "inspecting".
 *   - holding/ready  : manual hold-and-release copy unchanged.
 *   - running        : smart-cube vs manual stop copy.
 *   - idle           : branches on smart cube → scramble/inspection/arm
 *                      copy, otherwise "press & hold" copy with `hasLast`
 *                      variation.
 *   - stopped        : always "solve saved".
 */
export function hintFor(
  phase: TimerState,
  hasLast: boolean,
  ctx: HintContext,
): string {
  switch (phase) {
    case "inspection":
      return "inspecting";
    case "ready_for_move":
      return "make a move to start";
    case "holding":
      return "keep holding";
    case "ready":
      return "release to start";
    case "running":
      return ctx.smartCube ? "make a move to stop" : "press to stop";
    case "stopped":
      return "solve saved";
    case "idle":
    default:
      if (ctx.smartCube) {
        if (ctx.scrambleVerif) return "complete the scramble";
        if (ctx.inspection) return "press space to start inspection";
        return "tap or press space to start";
      }
      return hasLast ? "hold to start next" : "press & hold to start";
  }
}
