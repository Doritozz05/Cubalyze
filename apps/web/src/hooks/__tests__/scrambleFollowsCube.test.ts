import { describe, it, expect } from "vitest";
import type { PuzzleCategory } from "@/types";
import { scrambleFollowsCubeForPuzzle } from "../useOrientation";

/**
 * Central display policy for the orientation-adapted scramble.
 *
 * Only puzzles with FIXED centres can define the colour frame the scramble is
 * written in. A 2×2 has none, so its (still dynamic) scramble must never rotate
 * with the cube — otherwise a middle-layer turn on a 3×3-as-2×2 (M = R + L' + x',
 * where x' is the 3×3 CORE rotating while the 2×2 corners stay put) rewrote it.
 */
describe("scrambleFollowsCubeForPuzzle", () => {
  it("a 2×2 never follows the cube orientation", () => {
    expect(scrambleFollowsCubeForPuzzle("2x2")).toBe(false);
  });

  it("every puzzle with a fixed colour reference keeps following the cube", () => {
    const others: PuzzleCategory[] = [
      "3x3",
      "3x3 OH",
      "4x4",
      "5x5",
      "6x6",
      "7x7",
      "Megaminx",
      "Pyraminx",
      "Skewb",
      "FTO",
    ];
    for (const puzzle of others) {
      expect(scrambleFollowsCubeForPuzzle(puzzle), puzzle).toBe(true);
    }
  });
});
