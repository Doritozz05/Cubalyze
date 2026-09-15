import { describe, it, expect } from "vitest";
import { reanalyzeSolve } from "@/hooks/useSolveSession";
import type { CubeMoveEvent, CubeFace, CubeMoveDirection, OrientationTimeline } from "@cubalyze/types";

function event(face: CubeFace, direction: CubeMoveDirection, host = 0): CubeMoveEvent {
  return { face, direction, cubeTimestamp: host, hostTimestamp: host };
}

/**
 * Regression: re-analyzing a persisted solve feeds the STORED (already
 * compacted) moves back through the pipeline. Those moves can legitimately
 * contain adjacent same-face 180° pairs — e.g. a four-identical-quarter-turn
 * quad (L L L L) was compacted to L2 L2 on first save. Re-compacting them
 * into a single L2 turns a 360° into a 180° and corrupts the cube state
 * (the f28cdbe1 re-analyze collapsed to a spurious Cross(3m) with no
 * F2L/OLL/PLL). reanalyzeSolve must pass the stored moves through UNCHANGED.
 */
describe("reanalyzeSolve", () => {
  it("does not re-compact stored moves with adjacent 180° pairs", async () => {
    const storedMoves: CubeMoveEvent[] = [
      event("L", 2, 0),
      event("L", 2, 100),
      event("U", 1, 200),
      event("U", -1, 300),
    ];
    const storedTimeline: OrientationTimeline = [
      [0, 4],
      [2, 9],
    ];

    const result = await reanalyzeSolve(storedMoves, "R U R'", "CFOP", storedTimeline, 400);

    expect(result).not.toBeNull();
    // The stored moves are returned verbatim — no re-compaction (L2 L2 must
    // NOT collapse into L2).
    expect(result!.compactedMoves).toHaveLength(4);
    expect(result!.compactedMoves[0]).toEqual(event("L", 2, 0));
    expect(result!.compactedMoves[1]).toEqual(event("L", 2, 100));
    // The stored orientation timeline round-trips unchanged.
    expect(result!.compactedOrientationTimeline).toEqual(storedTimeline);
  });

  it("returns null for empty moves", async () => {
    expect(await reanalyzeSolve([], "R", "CFOP", undefined, 0)).toBeNull();
  });
});
