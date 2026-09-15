import { describe, it, expect } from "vitest";
import {
  faceletsCornersSolved,
  cubeStateCornersSolved,
} from "@/hooks/useScrambleValidator";
import {
  CubeState,
  FaceletStringConverter,
  SOLVED_FACELETS,
  SOLVED_FACELETS_2X2,
  cornerFacelet,
} from "@cubalyze/math-core";
import { Cube2x2FaceletConverter, Cube2x2State } from "@cubalyze/math-core";

const stateOf = (seq: string): CubeState => {
  const s = new CubeState();
  if (seq) s.applySequence(seq);
  return s;
};

const faceletsOf = (seq: string): string =>
  FaceletStringConverter.toFaceletString(stateOf(seq));

/** All 24 whole-cube rotation states, via closure of x/y (|O| = 24). */
function rotationStates(): CubeState[] {
  const seen = new Map<string, CubeState>();
  const solved = new CubeState();
  seen.set(FaceletStringConverter.toFaceletString(solved), solved);
  const queue = [solved];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const token of ["x", "y"]) {
      const next = cur.clone();
      next.applySequence(token);
      const f = FaceletStringConverter.toFaceletString(next);
      if (!seen.has(f)) {
        seen.set(f, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

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

  // ── REGRESSION: a 2×2 has no fixed centers, so a solved 2×2 may be a
  //    whole-cube rotation of the canonical corner arrangement. The old
  //    `fromFaceletString(f).isCornersSolved()` demanded cp===id && co===0
  //    (alignment with the 3×3 centers) and reported these as UNSOLVED —
  //    this is the reported "Solve this cube to apply this scramble" /
  //    "timer keeps running on a solved 2×2" bug.
  it("all 24 whole-cube rotations of solved count as corners-solved", () => {
    const rotations = rotationStates();
    // Sanity: x/y generate the full rotation group (|O| = 24).
    expect(rotations).toHaveLength(24);
    for (const state of rotations) {
      // A pure rotation of solved is still 3×3-solved (every face
      // monochrome), so SOLVED_FACELETS accepts it too — but the REAL
      // reported case keeps the edges scrambled. Reproduce that: rotate the
      // corner assembly, then scramble edges with slices only.
      const f = FaceletStringConverter.toFaceletString(state);
      expect(faceletsCornersSolved(f)).toBe(true);

      const rotatedScrambledEdges = state.clone();
      rotatedScrambledEdges.applySequence("M E S");
      const fMixed = FaceletStringConverter.toFaceletString(rotatedScrambledEdges);
      expect(SOLVED_FACELETS.test(fMixed)).toBe(false);
      expect(faceletsCornersSolved(fMixed)).toBe(true);
    }
  });

  it("REGRESSION: rotated-solved corners were rejected by the old frame-dependent check", () => {
    // Rotate the corner assembly, scramble only the edges.
    const state = stateOf("y");
    state.applySequence("M E S");
    const f = FaceletStringConverter.toFaceletString(state);

    // The 2×2 IS solved (this is what the 3D widget shows)…
    expect(faceletsCornersSolved(f)).toBe(true);
    // …but the old criterion demanded cp===id && co===0 (alignment with the
    // 3×3 centers) and said UNSOLVED → "Solve this cube to apply this
    // scramble" / missed timer stop.
    const oldCheck = FaceletStringConverter.fromFaceletString(f).isCornersSolved();
    expect(oldCheck).toBe(false);
  });

  it("rotated-solved corners stay solved with scrambled edges", () => {
    // Whole-cube rotation then edge-only slice turns: the corner assembly is
    // still a solved 2×2 in a rotated frame.
    expect(faceletsCornersSolved(faceletsOf("x M M M"))).toBe(true);
    expect(faceletsCornersSolved(faceletsOf("y' E E"))).toBe(true);
  });

  it("a single (non-rotation) face turn off solved is NOT solved", () => {
    // U alone moves U corners into a non-monochrome arrangement.
    expect(faceletsCornersSolved(faceletsOf("U"))).toBe(false);
    expect(faceletsCornersSolved(faceletsOf("R U"))).toBe(false);
  });

  it("corner twist in place is NOT solved", () => {
    expect(faceletsCornersSolved(faceletsOf("R U R' U R U2 R'"))).toBe(false);
  });

  it("every corner facelet index set has exactly 4 stickers on its face", () => {
    const byFace: number[][] = Array.from({ length: 6 }, () => []);
    for (const triple of cornerFacelet) {
      for (const idx of triple) byFace[Math.floor(idx / 9)].push(idx);
    }
    for (const indices of byFace) {
      expect(indices).toHaveLength(4);
      for (const idx of indices) expect(idx).toBeGreaterThanOrEqual(0);
      for (const idx of indices) expect(idx).toBeLessThan(54);
    }
    // Every face must contribute its four distinct corners.
    for (const indices of byFace) expect(new Set(indices).size).toBe(4);
  });
});

describe("faceletsCornersSolved — formal equivalence with the rotation group", () => {
  it("matches the 24-rotation criterion over randomized states", () => {
    // Reference: a state is a solved 2×2 iff its corner arrangement equals one
    // of the 24 whole-cube rotations of the solved corner arrangement.
    const rotationKeys = new Set(
      rotationStates().map((s) => `${Array.from(s.cp).join(",")}|${Array.from(s.co).join(",")}`),
    );
    expect(rotationKeys.size).toBe(24);

    let hits = 0;
    const faces = "URFDLB";
    const rnd = (n: number) => Math.floor(Math.random() * n);
    for (let iter = 0; iter < 2000; iter++) {
      const s = new CubeState();
      if (rnd(3) === 0) s.applySequence(["x", "y", "x'", "y'", "z"][rnd(5)]);
      const len = rnd(11);
      for (let k = 0; k < len; k++) {
        const f = faces[rnd(6)];
        const d = [1, -1, 2][rnd(3)];
        s.applySequence(f + (d === -1 ? "'" : d === 2 ? "2" : ""));
      }
      const facelets = FaceletStringConverter.toFaceletString(s);
      const reference = rotationKeys.has(
        `${Array.from(s.cp).join(",")}|${Array.from(s.co).join(",")}`,
      );
      if (reference) hits++;
      expect(faceletsCornersSolved(facelets)).toBe(reference);
    }
    // Sanity: the random mix actually produced solved-2×2 cases.
    expect(hits).toBeGreaterThan(0);
  });
});

describe("cubeStateCornersSolved — move-tracker criterion", () => {
  it("agrees with faceletsCornersSolved for solved, rotated and scrambled states", () => {
    for (const seq of ["", "x", "y2", "z'", "M", "x M M", "R U R' U'", "U", "R U R' U R U2 R'"]) {
      const state = stateOf(seq);
      expect(cubeStateCornersSolved(state)).toBe(
        faceletsCornersSolved(FaceletStringConverter.toFaceletString(state)),
      );
    }
  });

  it("accepts a whole-cube rotation of solved (the tracker-stop regression)", () => {
    expect(cubeStateCornersSolved(stateOf("x"))).toBe(true);
    expect(cubeStateCornersSolved(stateOf("x y z"))).toBe(true);
  });

  it("rejects a corner twist", () => {
    expect(cubeStateCornersSolved(stateOf("R U R' U R U2 R'"))).toBe(false);
  });
});
