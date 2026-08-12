import { describe, it, expect } from "vitest";
import { resolveDragMove } from "../cubeDragLayer";
import type { CubeFace } from "@cubeforge/types";

/**
 * Virtual-cube drag model — the gesture is read in the GRABBED FACE's own
 * orientation ("as if that face faced you"), and the stickers follow the
 * finger:
 *
 *   • front face: vertical → columns R/M/L by x, horizontal → rows U/E/D by y
 *   • top/bottom face: horizontal → F/S/B by front-back row, front-back →
 *     R/M/L by column
 *   • side faces: vertical → F/S/B by front-back column, front-back → U/E/D
 *
 * These tests pin every gesture the user reported/validated:
 *   - front face right column UP → R (down → R'), middle UP → M', left DOWN → L
 *   - front face top row right → U', bottom row right → D (unchanged — "la
 *     cara frontal es una delicia")
 *   - top face front row right → F (left → F') — NOT U' anymore
 *   - right face front column UP → F (down → F') — NOT R/R' anymore
 *   - the front face right column must NEVER resolve to F (regression: the
 *     old camera-tangent scoring fell back to F for center-ish grabs)
 */

/**
 * The simulator's locked isometric camera (theta=π/6, phi=π/6, radius 7):
 * camera at (3.031, 3.5, 5.25), right = (0.866, 0, −0.5), up = (−0.25, 0.866,
 * −0.433). Computed from SceneManager.setOrbitAngles + three.js lookAt.
 */
const CAMERA_RIGHT = { x: 0.866, y: 0, z: -0.5 };
const CAMERA_UP = { x: -0.25, y: 0.866, z: -0.433 };

interface Pick {
  face: CubeFace;
  x: number;
  y: number;
  z: number;
  /** Sticker world point (cube surface at ±1.5, centered at origin). */
  px: number;
  py: number;
  pz: number;
}

const move = (dx: number, dy: number, p: Pick) =>
  resolveDragMove({
    dx,
    dy,
    face: p.face,
    cubiePosition: { x: p.x, y: p.y, z: p.z },
    worldPoint: { x: p.px, y: p.py, z: p.pz },
    cameraRight: CAMERA_RIGHT,
    cameraUp: CAMERA_UP,
  });

/** Stickers on the FRONT face (z = +1 outward). */
const FRONT = {
  rightCol: (y = 0): Pick => ({ face: "F", x: 1, y, z: 1, px: 1.5, py: y * 1.5, pz: 1 }),
  midCol: (y = 0): Pick => ({ face: "F", x: 0, y, z: 1, px: 0, py: y * 1.5, pz: 1 }),
  leftCol: (y = 0): Pick => ({ face: "F", x: -1, y, z: 1, px: -1.5, py: y * 1.5, pz: 1 }),
  topRow: (x = 0): Pick => ({ face: "F", x, y: 1, z: 1, px: x * 1.5, py: 1.5, pz: 1 }),
  midRow: (x = 0): Pick => ({ face: "F", x, y: 0, z: 1, px: x * 1.5, py: 0, pz: 1 }),
  botRow: (x = 0): Pick => ({ face: "F", x, y: -1, z: 1, px: x * 1.5, py: -1.5, pz: 1 }),
};

/** Stickers on the TOP face (y = +1 outward). */
const TOP = {
  frontRow: (x = 0): Pick => ({ face: "U", x, y: 1, z: 1, px: x * 1.5, py: 1.5, pz: 1 }),
  midRow: (x = 0): Pick => ({ face: "U", x, y: 1, z: 0, px: x * 1.5, py: 1.5, pz: 0 }),
  backRow: (x = 0): Pick => ({ face: "U", x, y: 1, z: -1, px: x * 1.5, py: 1.5, pz: -1 }),
  rightCol: (z = 0): Pick => ({ face: "U", x: 1, y: 1, z, px: 1.5, py: 1.5, pz: z * 1.5 }),
  midCol: (z = 0): Pick => ({ face: "U", x: 0, y: 1, z, px: 0, py: 1.5, pz: z * 1.5 }),
};

/** Stickers on the RIGHT face (x = +1 outward). */
const RIGHT = {
  frontCol: (y = 0): Pick => ({ face: "R", x: 1, y, z: 1, px: 1.5, py: y * 1.5, pz: 1 }),
  midCol: (y = 0): Pick => ({ face: "R", x: 1, y, z: 0, px: 1.5, py: y * 1.5, pz: 0 }),
  topRow: (z = 0): Pick => ({ face: "R", x: 1, y: 1, z, px: 1.5, py: 1.5, pz: z * 1.5 }),
};

describe("resolveDragMove — front face (unchanged, user-validated)", () => {
  it("right column: UP → R, DOWN → R' (any row)", () => {
    for (const y of [-1, 0, 1]) {
      expect(move(0, -30, FRONT.rightCol(y))).toEqual({ face: "R", direction: 1 });
      expect(move(0, 30, FRONT.rightCol(y))).toEqual({ face: "R", direction: -1 });
    }
  });

  it("middle column: UP → M', left column: DOWN → L", () => {
    expect(move(0, -30, FRONT.midCol(1))).toEqual({ face: "M", direction: -1 });
    expect(move(0, 30, FRONT.leftCol(0))).toEqual({ face: "L", direction: 1 });
  });

  it("top row: right → U', left → U; middle row → E; bottom row → D", () => {
    expect(move(30, 0, FRONT.topRow(1))).toEqual({ face: "U", direction: -1 });
    expect(move(-30, 0, FRONT.topRow(0))).toEqual({ face: "U", direction: 1 });
    expect(move(30, 0, FRONT.midRow(0))).toEqual({ face: "E", direction: 1 });
    expect(move(30, 0, FRONT.botRow(1))).toEqual({ face: "D", direction: 1 });
  });

  it("regression: front face right column never resolves to F", () => {
    expect(move(0, -30, FRONT.rightCol(0))?.face).toBe("R");
    expect(move(0, 30, FRONT.rightCol(0))?.face).toBe("R");
  });
});

describe("resolveDragMove — top face (as if rotated to face you)", () => {
  it("front row: right → F, left → F' (the U' fix)", () => {
    expect(move(30, 0, TOP.frontRow(0))).toEqual({ face: "F", direction: 1 });
    expect(move(-30, 0, TOP.frontRow(1))).toEqual({ face: "F", direction: -1 });
  });

  it("middle row right → S, back row right → B'", () => {
    expect(move(30, 0, TOP.midRow(0))).toEqual({ face: "S", direction: 1 });
    expect(move(30, 0, TOP.backRow(0))).toEqual({ face: "B", direction: -1 });
  });

  it("front-back drag → R/M/L by column: right column UP → R, middle UP → M'", () => {
    expect(move(0, -30, TOP.rightCol(0))).toEqual({ face: "R", direction: 1 });
    expect(move(0, -30, TOP.midCol(0))).toEqual({ face: "M", direction: -1 });
  });
});

describe("resolveDragMove — side face (as if rotated to face you)", () => {
  it("right face front column: DOWN → F, UP → F' (the R fix)", () => {
    // F (−90° about z) moves the right-face front-column stickers DOWN, F'
    // moves them UP — the stickers follow the finger.
    expect(move(0, 30, RIGHT.frontCol(0))).toEqual({ face: "F", direction: 1 });
    expect(move(0, -30, RIGHT.frontCol(0))).toEqual({ face: "F", direction: -1 });
  });

  it("right face middle column UP → S'", () => {
    expect(move(0, -30, RIGHT.midCol(0))).toEqual({ face: "S", direction: -1 });
  });

  it("front-back drag → U/E/D by row: right face top row right → U'", () => {
    expect(move(30, 0, RIGHT.topRow(0))).toEqual({ face: "U", direction: -1 });
  });
});

describe("resolveDragMove — guards", () => {
  it("no movement → null", () => {
    expect(move(0, 0, FRONT.rightCol(0))).toBeNull();
    expect(move(NaN, 0, FRONT.rightCol(0))).toBeNull();
  });

  it("slightly diagonal drags keep the dominant face-plane axis", () => {
    // Mostly vertical on the front face right column → still R, up.
    expect(move(4, -30, FRONT.rightCol(0))).toEqual({ face: "R", direction: 1 });
    // Mostly horizontal on the top face front row → still F, right.
    expect(move(30, -4, TOP.frontRow(0))).toEqual({ face: "F", direction: 1 });
  });
});
