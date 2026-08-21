import i18n from "@/i18n";
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
  /** The scramble has been physically applied on the Smart Cube. */
  isScrambled: boolean;
  /** Whether the last solve in current session is DNF. */
  isLastSolveDnf?: boolean;
  /** Penalty string for the last solve in current session. */
  lastSolvePenalty?: string;
  /**
   * The primary pointer is touch (phone OR large tablet with a coarse
   * pointer) — there is no physical keyboard, so the hint must not say
   * "press space"; the generic "tap/press" wording is used instead.
   */
  coarsePointer?: boolean;
  /**
   * Localized display label of the user's configured start key (e.g.
   * "Space" / "Espacio", "N", "Enter"). Interpolated into the keyboard
   * hints instead of a hardcoded "space". Defaults to the localized
   * Space label when omitted.
   */
  startKeyLabel?: string;
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
 *                      variation. The keyboard copy interpolates the user's
 *                      configured start key (`ctx.startKeyLabel`), and on
 *                      coarse-pointer devices drops the key entirely.
 *   - stopped / idle  : same as idle.
 */
export function hintFor(
  phase: TimerState,
  hasLast: boolean,
  ctx: HintContext,
): string {
  switch (phase) {
    case "inspection":
      return i18n.t("timer:hint.inspecting");
    case "ready_for_move":
      return i18n.t("timer:hint.makeMoveToStart");
    case "holding":
      return i18n.t("timer:hint.keepHolding");
    case "ready":
      return i18n.t("timer:hint.releaseToStart");
    case "running":
      return ctx.smartCube
        ? i18n.t("timer:hint.makeMoveToStop")
        : i18n.t("timer:hint.pressToStop");
    case "stopped":
    case "idle":
    default: {
      // The user's configured start key, localized ("Space"/"Espacio", "N", …).
      const keyLabel = ctx.startKeyLabel ?? i18n.t("timer:key.space");

      // Coarse-pointer devices (phones + large tablets) have no keyboard and
      // start via tap (click-to-start), so drop the key/"hold" wording and
      // keep the generic "press/tap" copy.
      if (ctx.coarsePointer) {
        if (ctx.smartCube) {
          if (ctx.scrambleVerif && !ctx.isScrambled) return i18n.t("timer:hint.completeScramble");
          if (ctx.scrambleVerif && ctx.isScrambled) {
            return ctx.inspection
              ? i18n.t("timer:hint.pressInspection")
              : i18n.t("timer:hint.makeMoveToStart");
          }
          // Scramble Verification OFF (Modes 3 & 4): tap arms the cube gate
          // and the first physical move starts the solve.
          return i18n.t("timer:hint.tapStart");
        }
        if (ctx.inspection) {
          return i18n.t("timer:hint.pressInspection");
        }
        return hasLast
          ? i18n.t("timer:hint.tapStartNext")
          : i18n.t("timer:hint.tapStart");
      }
      if (ctx.smartCube) {
        if (ctx.scrambleVerif && !ctx.isScrambled) return i18n.t("timer:hint.completeScramble");
        if (ctx.scrambleVerif && ctx.isScrambled) {
          return ctx.inspection
            ? i18n.t("timer:hint.pressSpaceInspection", { key: keyLabel })
            : i18n.t("timer:hint.makeMoveToStart");
        }
        // Scramble Verification OFF (Modes 3 & 4): the start key arms the cube
        // gate and the first physical move starts the solve — inspection is
        // never shown here because pressing the key arms instead of starting it.
        return i18n.t("timer:hint.tapOrSpaceStart", { key: keyLabel });
      }
      if (ctx.inspection) {
        return i18n.t("timer:hint.pressSpaceInspection", { key: keyLabel });
      }
      return hasLast
        ? i18n.t("timer:hint.holdStartNext", { key: keyLabel })
        : i18n.t("timer:hint.pressHoldStart", { key: keyLabel });
    }
  }
}
