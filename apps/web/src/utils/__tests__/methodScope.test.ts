import { describe, it, expect } from "vitest";
import { EVENT_REGISTRY } from "@cubalyze/events";
import { methodForEvent } from "../puzzleUtils";

/**
 * `solves.method` used to be a blind copy of the global method preference, so
 * every event persisted "CFOP" — including 2×2 and Pyraminx, which have no
 * method at all. The rule now lives in one place and reads the registry:
 * an event keeps a method only when its spec declares analysis methods.
 */
describe("methodForEvent", () => {
  it("keeps the user's method on the 3×3 family", () => {
    expect(methodForEvent("333", "CFOP")).toBe("CFOP");
    expect(methodForEvent("333", "Roux")).toBe("Roux");
    expect(methodForEvent("333oh", "CFOP")).toBe("CFOP");
  });

  it("stores nothing on events that have no method", () => {
    for (const puzzleType of ["222", "pyram", "clock", "minx", "skewb", "sq1", "444", "777"]) {
      expect(methodForEvent(puzzleType, "CFOP")).toBeUndefined();
    }
  });

  it("stores nothing on unknown or legacy codes", () => {
    // Pre-ADR-002 spellings are converted by migration 027; guessing "333"
    // here would resurrect the very bug this fixes.
    for (const legacy of ["3x3x3", "2x2", "3x3", "foo", ""]) {
      expect(methodForEvent(legacy, "CFOP")).toBeUndefined();
    }
  });

  it("keeps whatever method the user chose, not only the analysed ones", () => {
    // The registry describes what the ANALYSIS engine detects (CFOP/Roux on
    // 3×3), not what the user is allowed to solve with: a ZZ solve is a fact.
    expect(methodForEvent("333", "ZZ")).toBe("ZZ");
    expect(methodForEvent("333", "Petrus")).toBe("Petrus");
  });

  it("follows the registry for EVERY declared event (drift guard)", () => {
    for (const spec of EVENT_REGISTRY) {
      const expected = spec.analysis.methods.length > 0;
      expect(methodForEvent(spec.id, "CFOP") === "CFOP").toBe(expected);
    }
  });

  it("preserves the caller's method type generically", () => {
    type Custom = "CFOP" | "Fan";
    const custom: Custom = "Fan";
    expect(methodForEvent<Custom>("333", custom)).toBe("Fan");
    expect(methodForEvent<Custom>("222", custom)).toBeUndefined();
  });
});
