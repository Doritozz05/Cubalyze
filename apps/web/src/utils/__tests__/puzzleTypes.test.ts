import { describe, it, expect } from "vitest";
import { puzzleTypeLabel } from "../puzzleTypes";

describe("puzzleTypeLabel", () => {
  it("resolves canonical WCA codes to human labels", () => {
    expect(puzzleTypeLabel("333")).toBe("3×3");
    expect(puzzleTypeLabel("222")).toBe("2×2");
    expect(puzzleTypeLabel("333oh")).toBe("3×3 OH");
  });

  it("resolves legacy spellings to human labels instead of leaking the raw code", () => {
    expect(puzzleTypeLabel("3x3x3")).toBe("3×3");
    expect(puzzleTypeLabel("3x3")).toBe("3×3");
    expect(puzzleTypeLabel("2x2x2")).toBe("2×2");
    expect(puzzleTypeLabel("2x2")).toBe("2×2");
    expect(puzzleTypeLabel("3x3 OH")).toBe("3×3 OH");
  });

  it("falls back to the raw value for unknown codes", () => {
    expect(puzzleTypeLabel("9x9x9")).toBe("9x9x9");
  });
});
