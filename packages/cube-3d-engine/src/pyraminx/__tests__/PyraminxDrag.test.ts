/**
 * Pyraminx drag resolver tests.
 *
 * Pins the drag → WCA token mapping (prime/plain, tips, edges) and the
 * camera-robust screen-space scoring, plus a full-pipeline symmetry check
 * against the REAL engine camera: every sticker must resolve BOTH drag
 * directions (a "turn it back the other way" flick is never dropped by the
 * geometry — the controls layer guarantees it at pointer-up).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import {
  pyraminxDragToken,
  resolvePyraminxDragMove,
  type PyraminxDragCandidate,
} from "../PyraminxDrag";
import { PYRAMINX_AXES } from "../PyraminxGeometry";
import { PyraminxEngine, type PyraminxPick } from "../PyraminxEngine";

const mockSetPixelRatio = vi.fn();
const mockSetSize = vi.fn();
const mockRender = vi.fn();
const mockDispose = vi.fn();

vi.mock("three", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: mockSetPixelRatio,
      setSize: mockSetSize,
      render: mockRender,
      dispose: mockDispose,
      getContext: () => null,
      domElement: {},
    })),
  };
});

(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (
  cb: FrameRequestCallback,
) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame ??= (
  id: number,
) => clearTimeout(id);

/** Identity camera: screen-right = +x, screen-up = +y. */
const CAM = {
  cameraRight: { x: 1, y: 0, z: 0 },
  cameraUp: { x: 0, y: 1, z: 0 },
};

/** The 4 vertex axes (engine constants, root frame). */
const AXES = {
  U: { x: PYRAMINX_AXES.U.x, y: PYRAMINX_AXES.U.y, z: PYRAMINX_AXES.U.z },
  L: { x: PYRAMINX_AXES.L.x, y: PYRAMINX_AXES.L.y, z: PYRAMINX_AXES.L.z },
  R: { x: PYRAMINX_AXES.R.x, y: PYRAMINX_AXES.R.y, z: PYRAMINX_AXES.R.z },
  B: { x: PYRAMINX_AXES.B.x, y: PYRAMINX_AXES.B.y, z: PYRAMINX_AXES.B.z },
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

  it("an edge's endpoint tangents are anti-parallel — the swipe picks WHICH endpoint turns", () => {
    // Real UL edge slot position (slot 1): p = (a_U + a_L)/3, so tU = a_U×p
    // and tL = a_L×p are EXACTLY anti-parallel. |cos| would tie and only the
    // first candidate could ever fire (the sticker felt like it could only
    // go one way); the SIGNED screen alignment breaks the tie with the swipe
    // direction, so the grabbed stickers always follow the finger and BOTH
    // endpoints of an edge are reachable by drag.
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

    // Drag along U's projected tangent (worldDrag = dx·right − dy·up) = the
    // +120° counter-clockwise motion of the U turn → U prime.
    const dragU = resolve({ dx: tU.x * 50, dy: -tU.y * 50, p, candidates });
    expect(dragU?.vertex).toBe("U");
    expect(dragU?.direction).toBe(-1);
    expect(pyraminxDragToken(dragU!)).toBe("U'");

    // The same swipe line the other way is the +120° motion of the L turn
    // (tL = −tU) → the sticker follows the finger around the OTHER endpoint.
    const dragUInv = resolve({ dx: -tU.x * 50, dy: tU.y * 50, p, candidates });
    expect(dragUInv?.vertex).toBe("L");
    expect(dragUInv?.direction).toBe(-1);
    expect(pyraminxDragToken(dragUInv!)).toBe("L'");
  });

  it("fires an arc-following drag even when the camera foreshortens the tangent", () => {
    // Camera looking along +z (right = +x, up = +y): the view plane is the
    // xy-plane. Pick a turn whose tangent points mostly INTO the screen —
    // t = (0, 0.25, 1) ≈ 14.5° from the view direction — so against the
    // FULL 3D tangent a perfect arc drag caps at |cos| = 0.242 < 0.3 and
    // the old resolver rejected it ("100% correct drag, nothing happens").
    // Screen-space scoring reads the projected arc and resolves it like any
    // other sticker.
    const axes = { ...AXES, U: { x: 1, y: 0, z: 0 } };
    // a = U = +x, p = (0, 1, −0.25) → t = a × p = (0, 0.25, 1).
    const p = { x: 0, y: 1, z: -0.25 };
    const move = resolvePyraminxDragMove({
      dx: 0,
      dy: -25, // drag screen-up = along the projected arc (0, 0.25, 0)
      worldPoint: p,
      candidates: [{ vertex: "U", scope: "layer" }],
      axes,
      ...CAM,
    });
    expect(move).toEqual({ vertex: "U", scope: "layer", direction: -1 });
    expect(pyraminxDragToken(move!)).toBe("U'");
  });

  it("a tangent-ambiguous swipe toward a vertex falls back to that vertex (spatial fallback)", () => {
    // Identity camera: right = +x, up = +y. Piece at (1, 0, 0.5) with a
    // single U candidate: its arc is screen-UP (t = a_U × p = (0, 1, 0)), so
    // a LEFT drag is tangent-perpendicular (|cos| = 0) and the pure tangent
    // rule refuses it. But the U vertex sits at (0, 0, 1) — screen-LEFT of
    // the piece — and the drag heads straight at it, so the spatial fallback
    // must fire the U turn ("dragged toward the vertex → turns that vertex").
    const p = { x: 1, y: 0, z: 0.5 };
    const candidates: PyraminxDragCandidate[] = [{ vertex: "U", scope: "layer" }];
    const move = resolvePyraminxDragMove({
      dx: -40,
      dy: 0,
      worldPoint: p,
      candidates,
      axes: AXES,
      vertices: {
        U: { x: 0, y: 0, z: 1 },
        L: { x: 0, y: 0, z: 0 },
        R: { x: 0, y: 0, z: 0 },
        B: { x: 0, y: 0, z: 0 },
      },
      ...CAM,
    });
    expect(move).toEqual({ vertex: "U", scope: "layer", direction: 1 });
    expect(pyraminxDragToken(move!)).toBe("U");
  });

  it("the spatial fallback stays null without vertices (pure tangent rule preserved)", () => {
    const p = { x: 1, y: 0, z: 0.5 };
    const candidates: PyraminxDragCandidate[] = [{ vertex: "U", scope: "layer" }];
    const move = resolvePyraminxDragMove({
      dx: -40,
      dy: 0,
      worldPoint: p,
      candidates,
      axes: AXES,
      ...CAM,
    });
    expect(move).toBeNull();
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

describe("drag symmetry with the real engine camera (every sticker, both directions)", () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PyraminxEngine({ canvas: makeCanvas(), width: 400, height: 400 });
    engine.setIsometricView();
  });

  afterEach(() => {
    engine.dispose();
  });

  it("resolves BOTH drag directions on every sticker — the geometry never drops an inverse swipe", () => {
    const cam = engine.sceneManager.camera;
    cam.updateMatrixWorld(true);
    const m = cam.matrixWorld.elements;
    const cameraRight = { x: m[0], y: m[1], z: m[2] };
    const cameraUp = { x: m[4], y: m[5], z: m[6] };
    const axes = {
      U: engine.getWorldAxis("U"),
      L: engine.getWorldAxis("L"),
      R: engine.getWorldAxis("R"),
      B: engine.getWorldAxis("B"),
    };
    const toV = (v: Vector3) => ({ x: v.x, y: v.y, z: v.z });

    const failures: string[] = [];
    const K = 40;

    for (let ny = -0.92; ny <= 0.92; ny += 0.14) {
      for (let nx = -0.92; nx <= 0.92; nx += 0.14) {
        const pick = engine.pickSticker(nx, ny);
        if (!pick) continue;
        const label = `${pick.kind}@(${nx.toFixed(2)},${ny.toFixed(2)})`;
        for (const c of pick.candidates) {
          const a = toV(axes[c.vertex]);
          const p = pick.position;
          const tx = a.y * p.z - a.z * p.y;
          const ty = a.z * p.x - a.x * p.z;
          const tz = a.x * p.y - a.y * p.x;
          const tLen = Math.hypot(tx, ty, tz);
          if (tLen < 1e-3) continue; // on-axis grab — fallback covered below
          const sx = (tx * cameraRight.x + ty * cameraRight.y + tz * cameraRight.z) / tLen;
          const sy = (tx * cameraUp.x + ty * cameraUp.y + tz * cameraUp.z) / tLen;
          const sLen = Math.hypot(sx, sy);
          if (sLen < 1e-4) continue;
          const base = { worldPoint: p, candidates: [c], axes, cameraRight, cameraUp };
          const plus = resolvePyraminxDragMove({ dx: (sx / sLen) * K, dy: (-sy / sLen) * K, ...base });
          const minus = resolvePyraminxDragMove({ dx: (-sx / sLen) * K, dy: (sy / sLen) * K, ...base });
          if (!plus) failures.push(`${label} cand=${c.vertex}: drag along +arc -> NULL`);
          if (!minus) failures.push(`${label} cand=${c.vertex}: drag along -arc -> NULL`);
          if (plus && minus && c.scope !== "layer") {
            // tips/corners: same candidate — the two drags must be opposite directions
            if (plus.direction === minus.direction) {
              failures.push(`${label} cand=${c.vertex}: both drags same direction ${plus.direction}`);
            }
          }
        }
      }
    }

    // WYSIWYG regression: the token's vertex must match the sticker the
    // user actually dragged (the right-front base vertex dragged leftward
    // must produce that vertex's token, never the other base vertex's).
    for (let ny = -0.92; ny <= 0.92; ny += 0.14) {
      for (let nx = 0.0; nx <= 0.92; nx += 0.14) {
        const pick = engine.pickSticker(nx, ny);
        if (!pick) continue;
        for (const c of pick.candidates) {
          const a = toV(axes[c.vertex]);
          const p = pick.position;
          const tx = a.y * p.z - a.z * p.y;
          const ty = a.z * p.x - a.x * p.z;
          const tz = a.x * p.y - a.y * p.x;
          const tLen = Math.hypot(tx, ty, tz);
          if (tLen < 1e-3) continue;
          const sx = (tx * cameraRight.x + ty * cameraRight.y + tz * cameraRight.z) / tLen;
          const sy = (tx * cameraUp.x + ty * cameraUp.y + tz * cameraUp.z) / tLen;
          const sLen = Math.hypot(sx, sy);
          if (sLen < 1e-4) continue;
          const move = resolvePyraminxDragMove({
            dx: (sx / sLen) * 40,
            dy: (-sy / sLen) * 40,
            worldPoint: p,
            candidates: [c],
            axes,
            cameraRight,
            cameraUp,
          });
          if (move && move.vertex !== c.vertex) {
            failures.push(
              `${pick.kind}@(${nx.toFixed(2)},${ny.toFixed(2)}): candidate ${c.vertex} resolved ${move.vertex}`,
            );
          }
        }
      }
    }

    // The user-reported dead zone (canonical view): the UR edge swiped PURE
    // HORIZONTAL scores < 0.3 against BOTH its arcs (both near-vertical) —
    // the pure tangent rule fires nothing. The swipe heads at the U vertex,
    // so the spatial fallback must turn U instead of doing nothing.
    const scale = engine.model.root.scale.x;
    const baseInput = {
      axes,
      cameraRight,
      cameraUp,
      vertices: {
        U: axes.U.clone().multiplyScalar(scale),
        L: axes.L.clone().multiplyScalar(scale),
        R: axes.R.clone().multiplyScalar(scale),
        B: axes.B.clone().multiplyScalar(scale),
      },
    };
    let deadZone: { p: PyraminxPick } | null = null;
    for (let ny = 0.9; ny >= -0.9 && !deadZone; ny -= 0.06) {
      for (let nx = -0.9; nx <= 0.9 && !deadZone; nx += 0.06) {
        const p = engine.pickSticker(nx, ny);
        if (!p || p.kind !== "edge") continue;
        const pureMove = resolvePyraminxDragMove({
          dx: 60,
          dy: 0,
          worldPoint: p.position,
          candidates: p.candidates,
          axes,
          cameraRight,
          cameraUp,
        });
        if (pureMove) continue; // only the dead zone reproduces the report
        deadZone = { p };
      }
    }
    expect(deadZone).not.toBeNull();
    const deadMove = resolvePyraminxDragMove({
      dx: 60,
      dy: 0,
      worldPoint: deadZone!.p.position,
      candidates: deadZone!.p.candidates,
      ...baseInput,
    });
    expect(deadMove).not.toBeNull();
    // The swipe must turn the vertex it heads at — one of the piece's own
    // candidates (never a random layer).
    expect(deadZone!.p.candidates.map((c) => c.vertex)).toContain(deadMove!.vertex);

    // On-axis apex tip fallback symmetry (drag right vs left).
    const apexPick = engine.pickSticker(0, -0.6);
    if (apexPick && apexPick.kind === "tip") {
      const c = apexPick.candidates[0];
      const a = toV(axes[c.vertex]);
      const p = apexPick.position;
      const tLen = Math.hypot(a.y * p.z - a.z * p.y, a.z * p.x - a.x * p.z, a.x * p.y - a.y * p.x);
      if (tLen < 1e-3) {
        const base = { worldPoint: p, candidates: [c], axes, cameraRight, cameraUp };
        const r = resolvePyraminxDragMove({ dx: 30, dy: 0, ...base });
        const l = resolvePyraminxDragMove({ dx: -30, dy: 0, ...base });
        if (!r || !l || r.direction === l.direction) {
          failures.push(`apex tip: asymmetric (r=${r && pyraminxDragToken(r)}, l=${l && pyraminxDragToken(l)})`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 400,
    height: 400,
    style: {},
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}
