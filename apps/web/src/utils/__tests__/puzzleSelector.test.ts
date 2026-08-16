/**
 * Phase A6 — data-driven puzzle selector.
 *
 * The selector is generated from the event registry: only events with a
 * real scramble provider (playable) or marked "planned" (FTO, disabled)
 * appear. The ghost puzzles (4×4–7×7, Megaminx, Skewb) had no provider and
 * are no longer offered — choosing them used to silently time a 3×3.
 */
import { describe, expect, it } from "vitest";
import {
  PUZZLE_SELECTOR,
  SELECTABLE_PUZZLE_CATEGORIES,
  getEventForCategory,
  puzzleCategoryToType,
  generateScrambleFor,
} from "@/utils/puzzleUtils";
// Side-effect: registers the 2×2/3×3 ScrambleProviders (same as the app
// entry — App.tsx imports it before the first render).
import "@/utils/scrambleProviders";

describe("A6 — puzzle selector generated from the registry", () => {
  it("only playable events + planned FTO appear (no ghosts)", () => {
    const categories = PUZZLE_SELECTOR.map((i) => i.category);
    // Playable today: 2×2, 3×3, 3×3 OH, Pyraminx (D2). Planned: FTO (disabled, 2027).
    expect(categories).toEqual(["2x2", "3x3", "3x3 OH", "Pyraminx", "FTO"]);

    const playable = PUZZLE_SELECTOR.filter((i) => i.playable);
    expect(playable.map((i) => i.category)).toEqual(["2x2", "3x3", "3x3 OH", "Pyraminx"]);

    const fto = PUZZLE_SELECTOR.find((i) => i.category === "FTO")!;
    expect(fto.playable).toBe(false);
    expect(fto.planned).toBe(true);
  });

  it("ghost categories are gone from the selectable set", () => {
    for (const ghost of ["4x4", "5x5", "6x6", "7x7", "Megaminx", "Skewb"] as const) {
      expect(SELECTABLE_PUZZLE_CATEGORIES, ghost).not.toContain(ghost);
      expect(PUZZLE_SELECTOR.map((i) => i.category), ghost).not.toContain(ghost);
    }
  });

  it("Pyraminx is playable with its own event and puzzle_type", () => {
    expect(SELECTABLE_PUZZLE_CATEGORIES).toContain("Pyraminx");
    expect(puzzleCategoryToType("Pyraminx")).toBe("pyram");
    const event = getEventForCategory("Pyraminx")!;
    expect(event.id).toBe("pyram");
    expect(event.scrambleProvider).not.toBeNull();
    // The scramble is a real random-state Pyraminx scramble (11 moves + tips).
    const scramble = generateScrambleFor("Pyraminx");
    expect(scramble.split(/\s+/).length).toBeGreaterThanOrEqual(11);
  });

  it("selectable categories have a working scramble provider", () => {
    for (const category of SELECTABLE_PUZZLE_CATEGORIES) {
      const event = getEventForCategory(category);
      expect(event, category).toBeDefined();
      expect(event!.scrambleProvider, category).not.toBeNull();
      // And the scramble actually generates (non-empty).
      expect(generateScrambleFor(category).length, category).toBeGreaterThan(0);
    }
  });

  it("3×3 OH is its own event with its own puzzle_type", () => {
    expect(SELECTABLE_PUZZLE_CATEGORIES).toContain("3x3 OH");
    expect(puzzleCategoryToType("3x3 OH")).toBe("333oh");
    expect(getEventForCategory("3x3 OH")!.id).toBe("333oh");
    // Same scrambles as 3×3 (WCA), but never stored mixed with 333.
    expect(getEventForCategory("3x3 OH")!.scrambleProvider).toBe(
      getEventForCategory("3x3")!.scrambleProvider,
    );
  });

  it("FTO maps to its registry event (planned)", () => {
    expect(puzzleCategoryToType("FTO")).toBe("fto");
    const fto = getEventForCategory("FTO")!;
    expect(fto.status).toBe("planned");
    // No provider yet → honest empty scramble, never a fake 3×3.
    expect(generateScrambleFor("FTO")).toBe("");
  });
});
