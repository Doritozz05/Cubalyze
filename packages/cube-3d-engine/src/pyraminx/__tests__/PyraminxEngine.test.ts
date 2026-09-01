/**
 * PyraminxEngine — panel seam tests.
 *
 * Covers the surface the web panel (useCube3D / Cube3DPanel) drives on the
 * Pyraminx engine:
 *   • updateStyle maps CUBE skin colors onto the Pyraminx's 4 faces (WCA
 *     scheme preserved: U=yellow, L=green, R=blue, B=red) and toggles
 *     sticker panels for stickered/stickerless skins
 *   • onMoveEvent fires one display token per COMMITTED turn (U, U', l, …)
 *     for the recent-moves strip
 *
 * WebGLRenderer is mocked (Node has no WebGL); requestAnimationFrame is
 * polyfilled so the engine's own render loop advances the pivot machinery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPyraminxSequence, solvedPyraminx } from '@cubeforge/solver-engine/pyraminx';
import { Vector3 } from 'three';
import {
  PyraminxReplayEngine,
  createPyraminxReplayDriver,
} from '../PyraminxReplayEngine';

const mockSetPixelRatio = vi.fn();
const mockSetSize = vi.fn();
const mockRender = vi.fn();
const mockDispose = vi.fn();

vi.mock('three', async (importOriginal) => {
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

// Polyfill the animation frame API the engine loop needs (Node lacks it).
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (
  cb: FrameRequestCallback,
) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame ??= (
  id: number,
) => clearTimeout(id);

import {
  PyraminxEngine,
  PYRAMINX_CANONICAL_QUAT,
  TETRAHEDRAL_TILT_ANGLE,
} from '../PyraminxEngine';

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 320,
    height: 240,
    style: {},
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

function buildEngine(): PyraminxEngine {
  return new PyraminxEngine({ canvas: makeCanvas(), width: 320, height: 240 });
}

describe('PyraminxEngine.updateStyle (panel skin seam)', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('maps cube face colors onto the Pyraminx faces preserving the WCA scheme', () => {
    // Cube default skin colors: D=yellow, F=green, B=blue, R=red.
    engine.updateStyle({
      stickerColors: {
        U: '#111111',
        D: '#222222', // → pyraminx U (yellow)
        F: '#333333', // → pyraminx L (green)
        B: '#444444', // → pyraminx R (blue)
        R: '#555555', // → pyraminx B (red)
        L: '#666666',
      },
    });
    const colors = engine.factory.getStyle().stickerColors;
    expect(colors.U).toBe('#222222');
    expect(colors.L).toBe('#333333');
    expect(colors.R).toBe('#444444');
    expect(colors.B).toBe('#555555');
  });

  it('updates coreColor and skinType without touching unrelated faces', () => {
    engine.updateStyle({ coreColor: '#0f0f0f', skinType: 'stickered' });
    expect(engine.factory.getStyle().coreColor).toBe('#0f0f0f');
    expect(engine.factory.getStyle().skinType).toBe('stickered');
    // Colors untouched by a core-only update keep their defaults.
    expect(engine.factory.getStyle().stickerColors.U).toBe('#ffe62a');
  });

  it('stickerless hides the sticker panels; stickered restores them', () => {
    const piece = engine.model.pieces[0];
    const stickerChildren = () =>
      piece.mesh.children.filter(
        (c) => (c as { userData?: { pyraminxSticker?: boolean } }).userData?.pyraminxSticker === true,
      );
    expect(stickerChildren().length).toBeGreaterThan(0);
    expect(stickerChildren().every((c) => c.visible)).toBe(true);

    engine.updateStyle({ skinType: 'stickerless' });
    expect(stickerChildren().every((c) => c.visible)).toBe(false);

    engine.updateStyle({ skinType: 'stickered' });
    expect(stickerChildren().every((c) => c.visible)).toBe(true);
  });
});

describe('PyraminxEngine.onMoveEvent (moves strip)', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('fires the WCA token once per committed layer turn (prime included)', async () => {
    const tokens: string[] = [];
    engine.onMoveEvent((token) => tokens.push(token));

    // −120° = the plain CLOCKWISE turn (WCA 12e2); +120° = the prime.
    await engine.rotateVertex('U', 'layer', -120, 0);
    await engine.rotateVertex('U', 'layer', 120, 0);
    await engine.rotateVertex('L', 'layer', -120, 0);

    expect(tokens).toEqual(["U", "U'", 'L']);
  });

  it('fires lowercase tokens for tip turns', async () => {
    const tokens: string[] = [];
    engine.onMoveEvent((token) => tokens.push(token));

    await engine.rotateVertex('B', 'tip', -120, 0);
    await engine.rotateVertex('B', 'tip', 120, 0);

    expect(tokens).toEqual(['b', "b'"]);
  });

  it('fires tokens for every move of an animated scramble', async () => {
    const tokens: string[] = [];
    engine.onMoveEvent((token) => tokens.push(token));

    const ok = await engine.applyScrambleAnimated("U L' B u'", 0);
    expect(ok).toBe(true);
    expect(tokens).toEqual(["U", "L'", 'B', "u'"]);
  });

  it('does not fire for invalid tokens (applyMove no-op)', async () => {
    const tokens: string[] = [];
    engine.onMoveEvent((token) => tokens.push(token));

    const ok = await engine.applyMove('X', 0);
    expect(ok).toBe(false);
    expect(tokens).toEqual([]);
  });
});

/**
 * The 3D model rotates tips PHYSICALLY (a layer turn carries the tip at its
 * vertex — like the real puzzle), while the WCA scrambler's state ignores
 * tips on layer turns (tips are separate moves appended at the end). The big
 * coordinates (edges + corners) must match the scrambler EXACTLY; the tips
 * follow the physical convention and are compared separately.
 */
function bigState(s: { edgePerm: number; edgeOrient: number; cornerOrient: number }): string {
  return `${s.edgePerm}/${s.edgeOrient}/${s.cornerOrient}`;
}

describe('PyraminxEngine.pickSticker (virtual-cube piece drags)', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('hits a piece at the screen center with sane turn candidates', () => {
    const pick = engine.pickSticker(0, 0);
    expect(pick).not.toBeNull();
    expect(pick!.candidates.length).toBeGreaterThanOrEqual(1);
    expect(pick!.candidates.length).toBeLessThanOrEqual(2);
    for (const c of pick!.candidates) {
      expect(['U', 'L', 'R', 'B']).toContain(c.vertex);
      expect(['layer', 'tip']).toContain(c.scope);
    }
    expect(Number.isFinite(pick!.position.x)).toBe(true);
    expect(Number.isFinite(pick!.position.y)).toBe(true);
    expect(Number.isFinite(pick!.position.z)).toBe(true);
  });

  it('returns null off the puzzle (background drag)', () => {
    expect(engine.pickSticker(3, 3)).toBeNull();
    expect(engine.pickSticker(NaN, 0)).toBeNull();
  });

  it('picks a U-vertex piece when the camera looks straight down the U axis', () => {
    // Orbit to look down +Z: the center region belongs to the U vertex
    // (its tip or the corner under it), so every candidate is a U turn.
    engine.sceneManager.setOrbitAngles(0, Math.PI / 2 - 0.01);
    const pick = engine.pickSticker(0, 0);
    expect(pick).not.toBeNull();
    for (const c of pick!.candidates) {
      expect(c.vertex).toBe('U');
    }
  });
});

describe('PyraminxEngine camera & whole-puzzle rotations', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
    engine.setIsometricView();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('isometric/reset land on the canonical isometric view', () => {
    const a = engine.sceneManager.getOrbitAngles();
    expect(a.theta).toBeCloseTo(PyraminxEngine.CANONICAL_ISOMETRIC_VIEW.theta, 6);
    expect(a.phi).toBeCloseTo(PyraminxEngine.CANONICAL_ISOMETRIC_VIEW.phi, 6);
    expect(a.radius).toBeCloseTo(PyraminxEngine.CANONICAL_ISOMETRIC_VIEW.radius, 6);

    engine.resetCamera();
    const b = engine.sceneManager.getOrbitAngles();
    expect(b.theta).toBeCloseTo(PyraminxEngine.CANONICAL_ISOMETRIC_VIEW.theta, 6);
    expect(b.phi).toBeCloseTo(PyraminxEngine.CANONICAL_ISOMETRIC_VIEW.phi, 6);
  });

  it('rotateCamera performs continuous free camera rotation (turntable orbit)', () => {
    const initial = engine.sceneManager.getOrbitAngles();
    engine.rotateCamera(30, 20);
    const updated = engine.sceneManager.getOrbitAngles();
    expect(updated.theta).not.toBe(initial.theta);
    expect(updated.phi).not.toBe(initial.phi);
  });

  it('starts in the canonical upright orientation', () => {
    const q = engine.getPuzzleQuaternion();
    expect(q.x).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.x, 5);
    expect(q.y).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.y, 5);
    expect(q.z).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.z, 5);
    expect(q.w).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.w, 5);
  });

  it('rotatePuzzleY performs 120° drone lateral rotation (3 steps complete 360°)', async () => {
    const q0 = engine.getPuzzleQuaternion();
    await engine.rotatePuzzleY(1, 0);
    const q1 = engine.getPuzzleQuaternion();
    expect(Math.abs(q1.y - q0.y)).toBeGreaterThan(0.05);

    await engine.rotatePuzzleY(1, 0);
    await engine.rotatePuzzleY(1, 0);
    const q3 = engine.getPuzzleQuaternion();
    // After 3 steps of 120° = 360°, quaternion matches q0 (or -q0 antipodal)
    const dot = Math.abs(q3.x * q0.x + q3.y * q0.y + q3.z * q0.z + q3.w * q0.w);
    expect(dot).toBeCloseTo(1, 4);
  });

  it('rotatePuzzleX tilts the puzzle and resetPuzzleOrientation restores canonical', async () => {
    await engine.rotatePuzzleX(1, 0);
    const tilted = engine.getPuzzleQuaternion();
    expect(Math.abs(tilted.x - PYRAMINX_CANONICAL_QUAT.x)).toBeGreaterThan(0.05);

    await engine.resetPuzzleOrientation(false);
    const reset = engine.getPuzzleQuaternion();
    expect(reset.x).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.x, 5);
    expect(reset.y).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.y, 5);
    expect(reset.z).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.z, 5);
    expect(reset.w).toBeCloseTo(PYRAMINX_CANONICAL_QUAT.w, 5);
  });

  it('orbitStep delegates to puzzle rotations', () => {
    const q0 = engine.getPuzzleQuaternion();
    engine.orbitStep(50, 0, 0);
    const q1 = engine.getPuzzleQuaternion();
    expect(q1.equals(q0)).toBe(false);
  });

  it('sequences of lateral and tilt rotations always preserve canonical upright pose', async () => {
    // Starting vertices in canonical upright frame:
    const S2 = Math.sqrt(2);
    const S6 = Math.sqrt(6);
    const vCanon = [
      new Vector3(0, 1, 0),
      new Vector3(-S6 / 3, -1 / 3, S2 / 3),
      new Vector3(S6 / 3, -1 / 3, S2 / 3),
      new Vector3(0, -1 / 3, (-2 * S2) / 3),
    ];

    // Sequence: Right, Down, Left, Down, Down, Right, Up, Left
    const sequence: Array<{ kind: 'y' | 'x'; dir: 1 | -1 }> = [
      { kind: 'y', dir: 1 },
      { kind: 'x', dir: 1 },
      { kind: 'y', dir: -1 },
      { kind: 'x', dir: 1 },
      { kind: 'x', dir: 1 },
      { kind: 'y', dir: 1 },
      { kind: 'x', dir: -1 },
      { kind: 'y', dir: -1 },
    ];

    for (const step of sequence) {
      if (step.kind === 'y') await engine.rotatePuzzleY(step.dir, 0);
      else await engine.rotatePuzzleX(step.dir, 0);

      const q = engine.getPuzzleQuaternion();
      // Apply q to the 4 canonical vertices:
      // Note: model.root is initialized with PYRAMINX_CANONICAL_QUAT.
      // The relative transformation from the canonical pose is q * CANONICAL_QUAT^-1.
      const relQ = q.clone().multiply(PYRAMINX_CANONICAL_QUAT.clone().invert());
      const transformed = vCanon.map((v) => v.clone().applyQuaternion(relQ));

      // 1. Exactly one vertex is the apex at (0, 1, 0)
      const apex = transformed.find((v) => Math.abs(v.y - 1) < 1e-3);
      expect(apex).toBeDefined();

      // 2. The other 3 vertices form a flat horizontal base at y = -1/3
      const base = transformed.filter((v) => Math.abs(v.y - (-1 / 3)) < 1e-3);
      expect(base).toHaveLength(3);

      // 3. The front base edge is horizontal (two vertices at z > 0 with equal z)
      const front = base.filter((v) => v.z > 0.1);
      expect(front).toHaveLength(2);
      expect(Math.abs(front[0].z - front[1].z)).toBeLessThan(1e-3);
    }
  });
});

describe('PyraminxReplayEngine over the real driver (reconstruction scramble)', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('applies a reconstruction scramble so position 0 IS the scrambled state', async () => {
    // A real pyraminx reconstruction record (cuberoot-2110) scramble.
    const scramble = "R U B U' L' R L U R B' R l r";
    const expected = applyPyraminxSequence(solvedPyraminx(), scramble)!;

    const replay = new PyraminxReplayEngine(
      ["B", "r'"],
      1000,
      createPyraminxReplayDriver(engine),
    );
    await replay.applyInitialScramble(scramble);
    const state = engine.getState();
    expect(bigState(state)).toBe(bigState(expected));
    // The puzzle is genuinely scrambled (not the solved state).
    expect(engine.getState()).not.toEqual(solvedPyraminx());
    replay.dispose();
  });

  it('seek(0) re-applies the scramble exactly (physical + logical)', async () => {
    const scramble = "U L' B u'";
    const expected = applyPyraminxSequence(solvedPyraminx(), scramble)!;
    const replay = new PyraminxReplayEngine(
      ["U", "L", "R"],
      1000,
      createPyraminxReplayDriver(engine),
    );
    await replay.applyInitialScramble(scramble);
    await replay.seek(0);
    const state = engine.getState();
    expect(bigState(state)).toBe(bigState(expected));
    // The tip token u' twisted the physical U tip (layer turns also carry it
    // in the model) — the solver records tips from explicit tip moves only.
    expect(state.tips).not.toBe(0);
    replay.dispose();
  });

  it('seeking past the last move applies the scramble + every solve token', async () => {
    const scramble = 'U';
    const tokens = ["U'"]; // the inverse of the scramble solves it
    const expected = applyPyraminxSequence(solvedPyraminx(), [scramble, ...tokens].join(' '))!;
    const replay = new PyraminxReplayEngine(tokens, 1000, createPyraminxReplayDriver(engine));
    await replay.applyInitialScramble(scramble);
    await replay.seek(10_000);
    const state = engine.getState();
    expect(bigState(state)).toBe(bigState(expected));
    // Edges + corners solved after scramble + inverse move.
    expect(bigState(state)).toBe('0/0/0');
    replay.dispose();
  });

  it('tracks grip index and conjugates key tokens through whole-puzzle rotations', async () => {
    // WYSIWYG conjugation: the "R" key turns the layer at the screen-RIGHT
    // position, the "L" key the screen-LEFT one. In the canonical view the
    // L vertex sits at the bottom-right, so "R" performs the canonical L
    // layer and "L" the canonical R layer — the letters match what the user
    // sees, like the cube simulator.
    expect(engine.getGripIndex()).toBe(0);
    expect(engine.conjugateKeyToken('U')).toBe('U');
    expect(engine.conjugateKeyToken('L')).toBe('R');
    expect(engine.conjugateKeyToken("R'")).toBe("L'");
    expect(engine.conjugateKeyToken('u')).toBe('u');

    // Rotate lateral Y by 120° (Grip 1): canonical R is now at the bottom-
    // right, canonical B at the left, canonical L at the back.
    await engine.rotatePuzzleY(1, 0);
    expect(engine.getGripIndex()).toBe(1);
    expect(engine.conjugateKeyToken('U')).toBe('U');
    expect(engine.conjugateKeyToken('L')).toBe('B');
    expect(engine.conjugateKeyToken('R')).toBe('R');
    expect(engine.conjugateKeyToken('B')).toBe('L');

    // Tilt X by 180° C2 (Grip 4): L tip on top, U at the back.
    await engine.rotatePuzzleX(1, 0);
    expect(engine.getGripIndex()).toBe(4);
    expect(engine.conjugateKeyToken('U')).toBe('L');
    expect(engine.conjugateKeyToken('L')).toBe('R');
    expect(engine.conjugateKeyToken('R')).toBe('B');
    expect(engine.conjugateKeyToken('B')).toBe('U');

    // Reset orientation brings back Grip 0
    await engine.resetPuzzleOrientation(false);
    expect(engine.getGripIndex()).toBe(0);
    expect(engine.conjugateKeyToken('U')).toBe('U');
  });
});

