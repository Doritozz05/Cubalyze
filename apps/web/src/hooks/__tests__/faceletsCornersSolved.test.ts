import { describe, it, expect } from "vitest";
import { faceletsCornersSolved } from "@/hooks/useScrambleValidator";
import {
  CubeState,
  FaceletStringConverter,
  SOLVED_FACELETS,
  SOLVED_FACELETS_2X2,
} from "@cubeforge/math-core";
import { Cube2x2FaceletConverter, Cube2x2State } from "@cubeforge/math-core";

const faceletsOf = (seq: string): string => {
  const s = new CubeState();
  if (seq) s.applySequence(seq);
  return FaceletStringConverter.toFaceletString(s);
};

describe("faceletsCornersSolved — 3×3 as 2×2 display gate", () => {
  it("fully solved 3×3 counts as corners-solved", () => {
    const f = faceletsOf("");
    expect(SOLVED_FACELETS.test(f)).toBe(true);
    expect(faceletsCornersSolved(f)).toBe(true);
  });

  it("corners home + edges scrambled (M) counts as corners-solved", () => {
    const f = faceletsOf("M");
    expect(SOLVED_FACELETS.test(f)).toBe(false);
    expect(faceletsCornersSolved(f)).toBe(true);
  });

  it("a real 2×2 scramble counts as not solved", () => {
    // Genuine corner scramble: corners displaced.
    expect(faceletsCornersSolved(faceletsOf("R U R' U'"))).toBe(false);
  });

  it("24-char 2×2 facelets return false (covered by the 2X2 regex instead)", () => {
    const f2 = Cube2x2FaceletConverter.toFaceletString(new Cube2x2State());
    expect(SOLVED_FACELETS_2X2.test(f2)).toBe(true);
    expect(faceletsCornersSolved(f2)).toBe(false);
  });

  it("garbage input returns false instead of throwing", () => {
    expect(faceletsCornersSolved("not-facelets")).toBe(false);
    expect(faceletsCornersSolved("")).toBe(false);
  });
});
