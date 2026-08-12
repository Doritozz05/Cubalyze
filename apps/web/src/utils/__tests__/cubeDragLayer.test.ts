import { describe, it, expect } from "vitest";
import { resolveDragLayer, resolveDragMove } from "../cubeDragLayer";

/**
 * Virtual-cube drag model: the layer under the finger turns, with the
 * direction read from the swipe in pure screen space. Vertical drags turn the
 * column at the sticker (R/M/L), horizontal drags the row (U/E/D). These
 * tests pin every gesture the user reported:
 *
 *   - drag the right column UP → R (down → R')
 *   - drag the middle column UP → M' (down → M)  — M mirrors L, not R
 *   - drag the left column DOWN → L (up → L')
 *   - right-swipe on the U face → U' (left → U), bottom row → D, middle → E
 *   - the R layer must NEVER resolve to F (regression: the old camera-tangent
 *     scoring fell back to the F face for center-ish grabs)
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
});

describe("resolveDragMove — swipe direction (no live tracking)", () => {
  const R = (x: number, y: number) => ({ cubieX: x, cubieY: y });

  it("right column: UP → R, DOWN → R'", () => {
    expect(resolveDragMove({ dx: 0, dy: -30, ...R(1, 1) })).toEqual({ face: "R", direction: 1 });
    expect(resolveDragMove({ dx: 0, dy: 30, ...R(1, 0) })).toEqual({ face: "R", direction: -1 });
    // Any sticker row on the column gets the same direction.
    for (const y of [-1, 0, 1]) {
      expect(resolveDragMove({ dx: 0, dy: -30, ...R(1, y) })).toEqual({ face: "R", direction: 1 });
    }
  });

  it("middle column: UP → M', DOWN → M (M mirrors L, not R)", () => {
    expect(resolveDragMove({ dx: 0, dy: -30, ...R(0, 1) })).toEqual({ face: "M", direction: -1 });
    expect(resolveDragMove({ dx: 0, dy: 30, ...R(0, 0) })).toEqual({ face: "M", direction: 1 });
  });

  it("left column: DOWN → L, UP → L'", () => {
    expect(resolveDragMove({ dx: 0, dy: 30, ...R(-1, 0) })).toEqual({ face: "L", direction: 1 });
    expect(resolveDragMove({ dx: 0, dy: -30, ...R(-1, 1) })).toEqual({ face: "L", direction: -1 });
  });

  it("U face: right-swipe → U', left-swipe → U", () => {
    expect(resolveDragMove({ dx: 30, dy: 0, ...R(0, 1) })).toEqual({ face: "U", direction: -1 });
    expect(resolveDragMove({ dx: -30, dy: 0, ...R(1, 1) })).toEqual({ face: "U", direction: 1 });
  });

  it("middle row right → E, bottom row right → D, bottom row left → D'", () => {
    expect(resolveDragMove({ dx: 30, dy: 0, ...R(0, 0) })).toEqual({ face: "E", direction: 1 });
    expect(resolveDragMove({ dx: 30, dy: 0, ...R(1, -1) })).toEqual({ face: "D", direction: 1 });
    expect(resolveDragMove({ dx: -30, dy: 0, ...R(1, -1) })).toEqual({ face: "D", direction: -1 });
  });

  it("slightly diagonal drags keep the dominant axis and direction", () => {
    // Mostly vertical → column move, direction from dy.
    expect(resolveDragMove({ dx: 4, dy: -30, ...R(1, 0) })).toEqual({ face: "R", direction: 1 });
    // Mostly horizontal → row move, direction from dx.
    expect(resolveDragMove({ dx: 30, dy: -4, ...R(0, 1) })).toEqual({ face: "U", direction: -1 });
  });

  it("no movement → null", () => {
    expect(resolveDragMove({ dx: 0, dy: 0, ...R(1, 0) })).toBeNull();
    expect(resolveDragMove({ dx: NaN, dy: 0, ...R(1, 0) })).toBeNull();
  });
});
