import { describe, expect, it } from "vitest";
import { validateScramble } from "@cubeforge/events";
import { generateScrambleFor, getEventForCategory, puzzleCategoryToType } from "@/utils/puzzleUtils";
import "@/utils/scrambleProviders"; // self-registers the real 2×2/3×3 providers
import { registerScrambleProviders } from "@/utils/scrambleProviders";

/**
 * TDD A4 exit criteria:
 *  - 1000 verified 2×2/3×3 scrambles (valid state, not solved, min moves).
 *  - an event without a provider produces NO scramble (no silent 3×3 default).
 */

const GHOST_CATEGORIES = ["4x4", "5x5", "6x6", "7x7", "Megaminx", "Skewb"] as const;

function assertValidScramble(
  category: (typeof GHOST_CATEGORIES)[number] | "2x2" | "3x3" | "3x3 OH" | "Pyraminx",
) {
  const event = getEventForCategory(category);
  expect(event, `${category} → event spec`).toBeDefined();
  const scramble = generateScrambleFor(category);
  expect(scramble, `${category} scramble non-empty`).not.toBe("");
  expect(validateScramble(event!, scramble), `${category} scramble validates`).toBe(true);
}

describe("scramble providers — verified output", () => {
  it("generates and validates 1000 3×3 scrambles", () => {
    for (let i = 0; i < 1000; i++) assertValidScramble("3x3");
  });

  it("generates and validates 1000 2×2 scrambles", () => {
    for (let i = 0; i < 1000; i++) assertValidScramble("2x2");
  });

  it("3×3 OH uses the 3×3 provider (same scrambles as 3×3, distinct event)", () => {
    // ADR-002: the event id IS the puzzle_type — OH persists as '333oh'.
    expect(getEventForCategory("3x3 OH")?.id).toBe("333oh");
    expect(puzzleCategoryToType("3x3 OH")).toBe("333oh");
    assertValidScramble("3x3 OH");
  });

  it("generates and validates 1000 Pyraminx scrambles (11 moves + tips)", () => {
    for (let i = 0; i < 1000; i++) {
      const event = getEventForCategory("Pyraminx")!;
      const scramble = generateScrambleFor("Pyraminx");
      expect(scramble).not.toBe("");
      expect(validateScramble(event, scramble)).toBe(true);
      const bigMoves = scramble.split(/\s+/).filter((t) => t === t.toUpperCase()).length;
      expect(bigMoves).toBe(11); // official WCA scramble length for Pyraminx
    }
  });
});

describe("scramble providers — no ghost fallback", () => {
  it("ghost categories produce NO scramble (never a 3×3 fallback)", () => {
    for (const category of GHOST_CATEGORIES) {
      const event = getEventForCategory(category);
      expect(event, `${category} spec exists in registry`).toBeDefined();
      expect(event!.scrambleProvider, `${category} has no provider`).toBeNull();
      expect(generateScrambleFor(category), `${category} → empty scramble`).toBe("");
    }
  });

  it("Pyraminx rejects a 3×3 scramble (different notation)", () => {
    const event = getEventForCategory("Pyraminx")!;
    expect(validateScramble(event, "R U R' F R U R' F'")).toBe(false);
    expect(validateScramble(event, "U L' R B'")).toBe(true); // valid pyraminx notation
  });

  it("rejects a 3×3 scramble handed to a provider-less event", () => {
    const event = getEventForCategory("4x4")!;
    expect(validateScramble(event, "R U R' F R U R' F'")).toBe(false);
  });
});

describe("scramble providers — registration", () => {
  it("is idempotent (safe under HMR / repeated imports)", () => {
    expect(() => registerScrambleProviders()).not.toThrow();
    expect(() => registerScrambleProviders()).not.toThrow();
  });
});
