import { describe, it, expect } from "vitest";
import { resolveDragLayer } from "../cubeDragLayer";

/**
 * Virtual-cube drag model (csTimer): the layer under the finger follows it.
 * Vertical drags turn the column at the sticker (R/M/L), horizontal drags the
 * row (U/E/D). These tests pin every gesture the user reported:
 *
 *   - drag the right column up → R
 *   - drag the middle column up → M
 *   - drag the bottom row right → D
 *   - right-swipe on the U face → U
 *   - the R layer must NEVER resolve to F (regression: the old camera-tangent
 *     scoring fell back to the F face for center-ish grabs).
 */
describe("resolveDragLayer — screen-space csTimer model", () => {
  const R = (x: number, y: number) => ({ cubieX: x, cubieY: y });

  it("vertical drag on the right column → R (any sticker row)", () => {
    for (const y of [-1, 0, 1]) {
      const r = resolveDragLayer({ dx: 0, dy: -30, ...R(1, y) });
      expect(r).toEqual({ axis: "x", layerValue: 1, face: "R" });
    }
    // Slightly diagonal still counts as vertical.
    expect(resolveDragLayer({ dx: 4, dy: -30, ...R(1, 0) })?.face).toBe("R");
  });

  it("vertical drag on the middle column → M, left column → L", () => {
    expect(resolveDragLayer({ dx: 0, dy: -30, ...R(0, 1) })?.face).toBe("M");
    expect(resolveDragLayer({ dx: 0, dy: -30, ...R(-1, 0) })?.face).toBe("L");
  });

  it("horizontal drag on the bottom row → D, middle row → E, top row → U", () => {
    expect(resolveDragLayer({ dx: 30, dy: 0, ...R(1, -1) })?.face).toBe("D");
    expect(resolveDragLayer({ dx: 30, dy: 0, ...R(0, 0) })?.face).toBe("E");
    expect(resolveDragLayer({ dx: 30, dy: 0, ...R(1, 1) })?.face).toBe("U");
  });

  it("right-swipe on the U face (y=1 sticker) → U", () => {
    expect(resolveDragLayer({ dx: 30, dy: 0, ...R(0, 1) })?.face).toBe("U");
  });

  it("left-swipe is still a horizontal drag → the same row layer", () => {
    expect(resolveDragLayer({ dx: -30, dy: 2, ...R(1, -1) })?.face).toBe("D");
  });

  it("vertical drag on the R face center → R, never F (regression)", () => {
    expect(resolveDragLayer({ dx: 0, dy: 30, ...R(1, 0) })?.face).toBe("R");
  });

  it("face-center grab + vertical drag → M (the center column), never F (regression)", () => {
    expect(resolveDragLayer({ dx: 0, dy: -30, ...R(0, 0) })?.face).toBe("M");
  });

  it("no movement → null", () => {
    expect(resolveDragLayer({ dx: 0, dy: 0, ...R(1, 0) })).toBeNull();
    expect(resolveDragLayer({ dx: NaN, dy: 0, ...R(1, 0) })).toBeNull();
  });

  it("direction of the turn follows the finger (arc-length tracking sign)", () => {
    // The layer resolution is axis+layer only; the ±90° snap direction is
    // driven by the live-twist angle (engine-tested). These just sanity-check
    // that the resolved axis/layer is consistent for both drag directions.
    const up = resolveDragLayer({ dx: 0, dy: -30, ...R(1, 1) });
    const down = resolveDragLayer({ dx: 0, dy: 30, ...R(1, 1) });
    expect(up).toEqual(down); // same layer either way — direction comes from the finger
    expect(up?.face).toBe("R");
  });
});
