import { describe, it, expect } from "vitest";
import { filterCornersOnlyMoves } from "@/hooks/useSolveSession";
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from "@cubeforge/types";

function event(
  face: CubeFace,
  direction: CubeMoveDirection,
  extra?: Partial<CubeMoveEvent>,
): CubeMoveEvent {
  return { face, direction, cubeTimestamp: 0, hostTimestamp: 0, ...extra };
}

describe("filterCornersOnlyMoves — 3×3 as 2×2 mode", () => {
  it("keeps outer-face turns unchanged (including D/L/B)", () => {
    const moves = [event("R", 1), event("U", -1), event("D", 2), event("L", 1), event("B", 1)];
    expect(filterCornersOnlyMoves(moves)).toEqual(moves);
  });

  it("drops pure slice turns (M/E/S move no corner)", () => {
    const moves = [event("R", 1), event("M", 1), event("U", 1), event("E", -1), event("S", 2)];
    expect(filterCornersOnlyMoves(moves)).toEqual([event("R", 1), event("U", 1)]);
  });

  it("collapses wide events to the outer-face half without wide/displayNotation", () => {
    const moves = [
      event("R", 1, { wide: true, displayNotation: "r" }),
      event("U", 1),
    ];
    expect(filterCornersOnlyMoves(moves)).toEqual([event("R", 1), event("U", 1)]);
  });

  it("returns empty for slices-only input", () => {
    expect(filterCornersOnlyMoves([event("M", 1), event("E", 2)])).toEqual([]);
  });
});
