import { describe, it, expect } from "vitest";
import { resolveRetryScramble } from "../retryScramble";
import { puzzleCategoryToType, SELECTABLE_PUZZLE_CATEGORIES } from "../puzzleUtils";

/**
 * "Retry scramble" is only honest when the timer can actually reproduce the
 * attempt: the solve's OWN scramble plus an event the app can generate for.
 * The resolver is the single source of the rule — the solve panel enables the
 * action with it and App performs it with it — so these tests pin down both
 * halves of that contract: never a fresh scramble, and a stated reason (null)
 * instead of a click that fails.
 */
describe("resolveRetryScramble", () => {
  it("returns the solve's exact scramble and its event for a 3×3 solve", () => {
    const target = resolveRetryScramble({
      scramble: "R U R' U'",
      puzzleType: "333",
    });
    expect(target).toEqual({ scramble: "R U R' U'", category: "3x3" });
  });

  it("keeps the scramble untouched apart from trimming it", () => {
    const target = resolveRetryScramble({
      scramble: "  F2 L2 B2  ",
      puzzleType: "222",
    });
    expect(target?.scramble).toBe("F2 L2 B2");
  });

  it("treats a missing puzzleType as 3×3, the app's default", () => {
    expect(resolveRetryScramble({ scramble: "U2" })?.category).toBe("3x3");
  });

  it("honours the puzzle the solve was done with", () => {
    expect(resolveRetryScramble({ scramble: "U2", puzzleType: "222" })?.category).toBe("2x2");
  });

  it("returns null when the solve carries no scramble text", () => {
    expect(resolveRetryScramble({ scramble: "", puzzleType: "333" })).toBeNull();
    expect(resolveRetryScramble({ scramble: "   ", puzzleType: "333" })).toBeNull();
    expect(resolveRetryScramble({ puzzleType: "333" })).toBeNull();
  });

  it("returns null for an event with no registered scramble provider", () => {
    // A 4×4 import can be stored and analyzed, but the timer cannot scramble it.
    const hasProvider = SELECTABLE_PUZZLE_CATEGORIES.some(
      (category) => puzzleCategoryToType(category) === "444",
    );
    expect(hasProvider).toBe(false);
    expect(resolveRetryScramble({ scramble: "U U'", puzzleType: "444" })).toBeNull();
  });

  it("resolves for every event the app can actually scramble", () => {
    // The rule is "provider exists", not a hardcoded list: whatever the app can
    // generate for, a solve of that puzzle can be retried.
    for (const category of SELECTABLE_PUZZLE_CATEGORIES) {
      const target = resolveRetryScramble({
        scramble: "U",
        puzzleType: puzzleCategoryToType(category),
      });
      expect(target?.category).toBe(category);
    }
  });
});
