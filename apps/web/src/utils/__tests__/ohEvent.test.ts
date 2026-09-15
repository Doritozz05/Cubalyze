/**
 * Phase D1 — 3×3 OH as a fully usable event (no analysis/catalog yet, by
 * decision: D-phase events only need scrambles + playability).
 *
 * Verifies the OH flow end-to-end at the data level:
 *   1. Selector: "3×3 OH" is selectable.
 *   2. Scramble: same provider as 3×3 (WCA), generates and validates.
 *   3. Type: every OH solve/session persists as '333oh' (never '333').
 *   4. Stats: OH solves group separately from 3×3 — never mixed.
 */
import { describe, expect, it } from "vitest";
import { isDbPuzzleType } from "@cubalyze/events";
import { validateScramble } from "@cubalyze/events";
import {
  PUZZLE_SELECTOR,
  SELECTABLE_PUZZLE_CATEGORIES,
  generateScrambleFor,
  getEventForCategory,
  puzzleCategoryToType,
} from "@/utils/puzzleUtils";
import { aggregateByPuzzle } from "@/hooks/useProfileStats";
import type { Solve } from "@/types";
import "@/utils/scrambleProviders"; // registers the real providers

function solve(id: string, puzzleType: string, timeMs: number): Solve {
  return {
    id,
    time: timeMs,
    penalty: "none",
    scramble: "R U R' U'",
    timestamp: 1_000_000 + Number(id.replace(/\D/g, "")),
    puzzleType,
  } as Solve;
}

describe("D1 — 3×3 OH is a usable event", () => {
  it("1. the selector offers 3×3 OH as playable", () => {
    expect(SELECTABLE_PUZZLE_CATEGORIES).toContain("3x3 OH");
    const item = PUZZLE_SELECTOR.find((i) => i.category === "3x3 OH")!;
    expect(item.playable).toBe(true);
  });

  it("2. OH scrambles come from the 3×3 provider and validate", () => {
    expect(getEventForCategory("3x3 OH")!.scrambleProvider).toBe(
      getEventForCategory("3x3")!.scrambleProvider,
    );
    const event = getEventForCategory("3x3 OH")!;
    const scramble = generateScrambleFor("3x3 OH");
    expect(scramble.length).toBeGreaterThan(0);
    expect(validateScramble(event, scramble)).toBe(true);
  });

  it("3. OH persists with its own type '333oh' — the DB accepts it", () => {
    expect(puzzleCategoryToType("3x3 OH")).toBe("333oh");
    expect(isDbPuzzleType("333oh")).toBe(true);
    expect(isDbPuzzleType("333")).toBe(true);
  });

  it("4. OH stats never mix with 3×3", () => {
    const byPuzzle = aggregateByPuzzle([
      solve("s1", "333", 10_000),
      solve("s2", "333", 9_500),
      solve("s3", "333oh", 11_000),
      solve("s4", "333oh", 12_500),
    ]);
    const keys = byPuzzle.map((p) => p.puzzle).sort();
    expect(keys).toEqual(["333", "333oh"]);
    const oh = byPuzzle.find((p) => p.puzzle === "333oh")!;
    expect(oh.count).toBe(2);
    expect(oh.stats.best).toBe(11_000);
    const s333 = byPuzzle.find((p) => p.puzzle === "333")!;
    expect(s333.count).toBe(2);
    expect(s333.stats.best).toBe(9_500);
  });
});
