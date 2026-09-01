import { describe, expect, it } from "vitest";
import {
  pyraminxDragToken,
  resolvePyraminxDragMove,
  type PyraminxDragCandidate,
} from "../pyraminxDrag";

/** Identity camera: screen-right = +x, screen-up = +y. */
const CAM = {
  cameraRight: { x: 1, y: 0, z: 0 },
  cameraUp: { x: 0, y: 1, z: 0 },
};

/** The 4 vertex axes (engine constants, root frame). */
const AXES = {
  U: { x: 0, y: 0, z: 1 },
  L: { x: -Math.SQRT2 / 3, y: Math.SQRT2 / Math.sqrt(3), z: -1 / 3 },
  R: { x: (2 * Math.SQRT2) / 3, y: 0, z: -1 / 3 },
  B: { x: -Math.SQRT2 / 3, y: -Math.SQRT2 / Math.sqrt(3), z: -1 / 3 },
};

/** Tangent t = axis × point. */
function tangent(axis: { x: number; y: number; z: number }, p: { x: number; y: number; z: number }) {
  return {
    x: axis.y * p.z - axis.z * p.y,
    y: axis.z * p.x - axis.x * p.z,
    z: axis.x * p.y - axis.y * p.x,
  };
}

function norm(v: { x: number; y: number; z: number }) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function resolve(args: {
  dx: number;
  dy: number;
  p: { x: number; y: number; z: number };
  candidates: PyraminxDragCandidate[];
}) {
  return resolvePyraminxDragMove({
    dx: args.dx,
    dy: args.dy,
    worldPoint: args.p,
    candidates: args.candidates,
    axes: AXES,
    ...CAM,
  });
}

describe("resolvePyraminxDragMove (fixed ±120° turns)", () => {
  const U_CAND: PyraminxDragCandidate[] = [{ vertex: "U", scope: "layer" }];
  // A piece at +x on the U layer: its tangent under the +120° (counter-
  // clockwise, prime) U turn is +y. The plain WCA turn is the CLOCKWISE one
  // (WCA 12e2), i.e. motion along −t — the stickers follow the finger.
  const P_X = { x: 1, y: 0, z: 0 };

  it("a drag along the +tangent resolves the prime (the +120° turn's motion)", () => {
    // dy = −10 → worldDrag = −dy·up = +y = the +tangent → prime.
    const move = resolve({ dx: 0, dy: -10, p: P_X, candidates: U_CAND });
    expect(move).toEqual({ vertex: "U", scope: "layer", direction: -1 });
    expect(pyraminxDragToken(move!)).toBe("U'");
  });

  it("a drag against the tangent resolves the plain token (stickers follow the finger)", () => {
    const move = resolve({ dx: 0, dy: 10, p: P_X, candidates: U_CAND });
    expect(move).toEqual({ vertex: "U", scope: "layer", direction: 1 });
    expect(pyraminxDragToken(move!)).toBe("U");
  });

  it("a drag perpendicular to the tangent stays ambiguous (null) until it commits", () => {
    // worldDrag = +x, tangent = +y → cos 0 < 0.3 → null.
    expect(resolve({ dx: 10, dy: 0, p: P_X, candidates: U_CAND })).toBeNull();
  });

  it("tip candidates resolve lowercase tokens", () => {
    const move = resolve({
      dx: 0,
      dy: 10,
      p: P_X,
      candidates: [{ vertex: "U", scope: "tip" }],
    });
    expect(pyraminxDragToken(move!)).toBe("u");
  });

  it("returns null for degenerate drags", () => {
    expect(resolve({ dx: 0, dy: 0, p: P_X, candidates: U_CAND })).toBeNull();
    expect(
      resolvePyraminxDragMove({
        dx: NaN,
        dy: 5,
        worldPoint: P_X,
        candidates: U_CAND,
        axes: AXES,
        ...CAM,
      }),
    ).toBeNull();
  });

  it("an edge piece turns around its slot's endpoint, sign from the swipe", () => {
    // Real UL edge slot position (slot 1): p = (a_U + a_L)/3, so the two
    // endpoint tangents are ANTI-PARALLEL — the swipe direction picks the
    // sign and the (deterministic) first candidate is the vertex. Swiping
    // the other way over the same edge gives the prime of the SAME vertex
    // (a coherent edge gesture — the other vertex's layer is reachable via
    // its corner/tip or its other edges).
    const p = {
      x: -Math.SQRT2 / 9,
      y: Math.SQRT2 / (3 * Math.sqrt(3)),
      z: 2 / 9,
    };
    const candidates: PyraminxDragCandidate[] = [
      { vertex: "U", scope: "layer" },
      { vertex: "L", scope: "layer" },
    ];
    const tU = norm(tangent(AXES.U, p));

    // Drag along U's tangent (worldDrag = dx·right − dy·up) = the +120°
    // counter-clockwise motion → the prime.
    const dragU = resolve({ dx: tU.x * 50, dy: -tU.y * 50, p, candidates });
    expect(dragU?.vertex).toBe("U");
    expect(dragU?.direction).toBe(-1);
    expect(pyraminxDragToken(dragU!)).toBe("U'");

    // Opposite direction (along −t) → the plain CLOCKWISE turn.
    const dragUInv = resolve({ dx: -tU.x * 50, dy: tU.y * 50, p, candidates });
    expect(dragUInv?.vertex).toBe("U");
    expect(dragUInv?.direction).toBe(1);
    expect(pyraminxDragToken(dragUInv!)).toBe("U");
  });

  it("a tip dragged directly at the apex (on the axis) resolves via view-plane fallback", () => {
    // p is exactly on the axis of U: { x: 0, y: 0, z: 1 }, so axis × p = 0
    const onAxisPoint = { x: 0, y: 0, z: 1 };
    const tipCandidate: PyraminxDragCandidate[] = [{ vertex: "U", scope: "tip" }];

    // Drag rightwards on screen (dx = 30) -> the +120° (counter-clockwise)
    // motion, i.e. the prime: resolves to u'
    const moveRight = resolve({ dx: 30, dy: 0, p: onAxisPoint, candidates: tipCandidate });
    expect(moveRight).not.toBeNull();
    expect(moveRight?.vertex).toBe("U");
    expect(moveRight?.scope).toBe("tip");
    expect(moveRight?.direction).toBe(-1);
    expect(pyraminxDragToken(moveRight!)).toBe("u'");

    // Drag leftwards on screen (dx = -30) -> resolves to u
    const moveLeft = resolve({ dx: -30, dy: 0, p: onAxisPoint, candidates: tipCandidate });
    expect(moveLeft).not.toBeNull();
    expect(moveLeft?.vertex).toBe("U");
    expect(moveLeft?.scope).toBe("tip");
    expect(moveLeft?.direction).toBe(1);
    expect(pyraminxDragToken(moveLeft!)).toBe("u");
  });
});
