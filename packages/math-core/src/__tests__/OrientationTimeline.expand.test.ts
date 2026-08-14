import { describe, it, expect } from "vitest";
import {
  compactOrientationTimeline,
  expandOrientationTimeline,
  getOrientationAtIndex,
} from "../orientation/OrientationTimeline";
import { OrientationTable } from "../orientation/OrientationTable";
import type { CubeOrientation, OrientationTimeline } from "@cubeforge/types";

/** Build a CubeOrientation snapshot from a table index (mirrors how the app
 *  serializes a grip into a CubeOrientation). */
function orientationFromId(id: number): CubeOrientation {
  const entry = OrientationTable.ENTRIES[id];
  return {
    quaternion: {
      x: entry.quaternion.x,
      y: entry.quaternion.y,
      z: entry.quaternion.z,
      w: entry.quaternion.w,
    },
    faceMap: { ...entry.faceMap },
    label: entry.label,
  };
}

/** Canonical id of a reconstructed snapshot, or undefined for a gap. */
function idOf(o: CubeOrientation | undefined): number | undefined {
  if (!o) return undefined;
  return OrientationTable.fromFaceMap(o.faceMap).id;
}

describe("expandOrientationTimeline", () => {
  it("round-trips a keyframed orientation stream losslessly", () => {
    // 10 moves with grip changes at indices 0, 3, 7 (typical CFOP: 2-3 regrips).
    const ids = [4, 4, 4, 12, 12, 12, 12, 1, 1, 1];
    const orientations = ids.map(orientationFromId);

    const compact = compactOrientationTimeline(orientations)!;
    expect(compact).toEqual([
      [0, 4],
      [3, 12],
      [7, 1],
    ]);

    const expanded = expandOrientationTimeline(compact, orientations.length);
    expect(expanded).toHaveLength(orientations.length);
    expect(expanded.map(idOf)).toEqual(ids);

    // Re-compacting the expansion reproduces the same keyframes (stable).
    expect(compactOrientationTimeline(expanded)).toEqual(compact);
  });

  it("fills gaps before the first keyframe with identity", () => {
    // First keyframe at move 3: moves 0-2 fall back to identity (id 0).
    const timeline: OrientationTimeline = [
      [3, 9],
      [5, 2],
    ];
    const expanded = expandOrientationTimeline(timeline, 6);
    expect(expanded.map(idOf)).toEqual([0, 0, 0, 9, 9, 2]);
    expect(getOrientationAtIndex(timeline, 4)).toBe(9);
  });

  it("returns all-undefined for an empty/undefined timeline", () => {
    expect(expandOrientationTimeline(undefined, 3)).toEqual([undefined, undefined, undefined]);
    expect(expandOrientationTimeline([], 3)).toEqual([undefined, undefined, undefined]);
  });
});
