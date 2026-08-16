/**
 * Test: method/subset registry attribution.
 *
 * The 4 sets sourced from SpeedCubeDB dumps on 2026-08-06 (CLS, Summer
 * Variation, ELL, Anti PLL) belong to OTHER methods (ELL→CFCE, CLS→MGLS,
 * SV→ZZ/Petrus, Anti-PLL→1LLL practice) — they are algorithm subsets under a
 * neutral 3×3 "Advanced" method, NOT CFOP subsets and NOT training phases.
 * FRUF (sid 11) is intentionally absent (its algs fail verification).
 */
import { describe, it, expect } from "vitest";
import { METHODS, SUBSETS, getSubsetsForMethod, getMethod, getSubset } from "../methodRegistry";

describe("method registry — Advanced 3x3 attribution", () => {
  const advanced = METHODS.find((m) => m.name === "Advanced 3x3");
  const cfop = METHODS.find((m) => m.name === "CFOP");

  it("registers an 'Advanced 3x3' method on the 3×3 puzzle", () => {
    expect(advanced).toBeDefined();
    expect(advanced!.puzzleType).toBe("333"); // WCA code (ADR-002)
    expect(advanced!.sortOrder).toBeGreaterThan(cfop!.sortOrder);
  });

  it("CFOP keeps its canonical subsets and no longer owns the 4 new sets", () => {
    const cfopSubsets = getSubsetsForMethod(cfop!.id).map((s) => s.name);
    expect(cfopSubsets).toContain("F2L");
    expect(cfopSubsets).toContain("OLL");
    expect(cfopSubsets).toContain("PLL");
    expect(cfopSubsets).toContain("COLL");
    expect(cfopSubsets).toContain("Winter Variation");
    expect(cfopSubsets).not.toContain("CLS");
    expect(cfopSubsets).not.toContain("Summer Variation");
    expect(cfopSubsets).not.toContain("ELL");
    expect(cfopSubsets).not.toContain("Anti PLL");
  });

  it("Advanced 3x3 owns exactly the 4 verified non-CFOP sets", () => {
    const names = getSubsetsForMethod(advanced!.id).map((s) => s.name).sort();
    expect(names).toEqual(["Anti PLL", "CLS", "ELL", "Summer Variation"]);
  });

  it("every subset resolves to its owning method (no orphans)", () => {
    for (const s of SUBSETS) {
      expect(getMethod(s.methodId), `methodId of ${s.name}`).toBeDefined();
    }
  });

  it("subset ids stay stable across the move (user progress is keyed by id)", () => {
    const byName = new Map(SUBSETS.map((s) => [s.name, s.id]));
    expect(byName.get("CLS")).toBe("00000000-0000-4000-9000-000000000008");
    expect(byName.get("Summer Variation")).toBe("00000000-0000-4000-9000-000000000009");
    expect(byName.get("ELL")).toBe("00000000-0000-4000-9000-000000000010");
    expect(byName.get("Anti PLL")).toBe("00000000-0000-4000-9000-000000000012");
    expect(getSubset("00000000-0000-4000-9000-000000000011")).toBeUndefined(); // FRUF gap
  });
});
