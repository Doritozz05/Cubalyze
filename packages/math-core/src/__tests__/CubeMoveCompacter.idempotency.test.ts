import { describe, it, expect } from "vitest";
import { compactCubeMoves, CubeState } from "../index";
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from "@cubalyze/types";

function event(face: CubeFace, direction: CubeMoveDirection, host = 0): CubeMoveEvent {
  return { face, direction, cubeTimestamp: host, hostTimestamp: host };
}

function seq(moves: CubeMoveEvent[]): string {
  return moves
    .map((m) => {
      const base = m.face;
      if (m.direction === 2) return `${base}2`;
      return m.direction === -1 ? `${base}'` : base;
    })
    .join(" ");
}

/**
 * Regression: re-analyzing a persisted solve feeds ALREADY-COMPACTED moves
 * back through compactCubeMoves. A four-identical-quarter-turn quad
 * (L L L L) compacts to L2 L2 (net 360° = identity); re-merging L2 L2 into a
 * single L2 would turn a 360° into a 180° and corrupt the cube state — which
 * collapsed the whole phase detection of the f28cdbe1 solve after re-analyze
 * (Cross(3m) only, no F2L/OLL/PLL). The compacter must never merge 180° moves.
 */
describe("compactCubeMoves idempotency", () => {
  it("never merges two adjacent 180° moves (L2 L2 stays L2 L2)", () => {
    const input = [event("L", 2), event("L", 2)];
    const out = compactCubeMoves(input).moves;
    expect(seq(out)).toBe("L2 L2");
    expect(out).toHaveLength(2);
  });

  it("four same-face quarter turns compact to L2 L2 and re-compaction is a no-op", () => {
    const raw = [event("L", 1), event("L", 1), event("L", 1), event("L", 1)];
    const once = compactCubeMoves(raw).moves;
    expect(seq(once)).toBe("L2 L2");

    // Re-compacting the already-compacted sequence must NOT change it.
    const twice = compactCubeMoves(once).moves;
    expect(seq(twice)).toBe("L2 L2");
    expect(twice).toEqual(once);
  });

  it("the once-compacted 360° quad leaves the cube solved; a merged L2 would not", () => {
    const once = compactCubeMoves([
      event("L", 1),
      event("L", 1),
      event("L", 1),
      event("L", 1),
    ]).moves;

    const s1 = new CubeState();
    s1.applySequence(seq(once));
    expect(s1.isSolved()).toBe(true); // L2 L2 = 360° = identity

    // The corrupting merge (L2 L2 → L2) changes the net state:
    const s2 = new CubeState();
    s2.applySequence("L2");
    expect(s2.isSolved()).toBe(false);
  });

  it("quarter-turn pairs still merge as before (D D → D2)", () => {
    const out = compactCubeMoves([event("D", 1), event("D", 1)]).moves;
    expect(seq(out)).toBe("D2");
    expect(out).toHaveLength(1);
  });

  it("cancelling and mixed pairs never merge (D D' and D2 D)", () => {
    expect(seq(compactCubeMoves([event("D", 1), event("D", -1)]).moves)).toBe("D D'");
    expect(seq(compactCubeMoves([event("D", 2), event("D", 1)]).moves)).toBe("D2 D");
  });
});
