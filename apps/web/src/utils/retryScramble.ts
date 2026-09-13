import type { PuzzleCategory } from "@/types";
import { puzzleCategoryToType, SELECTABLE_PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";

/** What the timer needs to re-run a stored solve: the exact scramble and its event. */
export interface RetryTarget {
  /** The solve's own scramble, trimmed. Never a freshly generated one. */
  scramble: string;
  /** The selectable category whose event matches the solve's puzzle. */
  category: PuzzleCategory;
}

/**
 * Resolve what "Retry scramble" should put on the stage for a stored solve.
 *
 * A retry is only honest when the timer can actually reproduce the attempt, so
 * this returns `null` — and the caller explains why instead of failing on click
 * — in two cases:
 *
 *   • the solve's event has no registered scramble provider (anything outside
 *     `SELECTABLE_PUZZLE_CATEGORIES`), so there is no puzzle to send it to;
 *   • the solve carries no scramble text (a very old solve, or one stripped by
 *     an export/import round-trip), so there is nothing to replay.
 *
 * Shared by the solve panel (to enable/disable the action and state the reason)
 * and by App (to perform it), so the two can never drift apart.
 *
 * The parameter is structural on purpose: `scramble` is required on `Solve`,
 * but rows that reach the UI from a legacy export or an import can be missing
 * it, and that is exactly the case this has to answer honestly.
 */
export function resolveRetryScramble(solve: {
  scramble?: string;
  puzzleType?: string;
}): RetryTarget | null {
  const scramble = solve.scramble?.trim();
  if (!scramble) return null;
  const puzzleType = solve.puzzleType ?? "333";
  const category =
    SELECTABLE_PUZZLE_CATEGORIES.find(
      (candidate) => puzzleCategoryToType(candidate) === puzzleType,
    ) ?? null;
  return category ? { scramble, category } : null;
}
