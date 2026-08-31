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

import { PyraminxEngine } from '../PyraminxEngine';

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

    await engine.rotateVertex('U', 'layer', 120, 0);
    await engine.rotateVertex('U', 'layer', -120, 0);
    await engine.rotateVertex('L', 'layer', 120, 0);

    expect(tokens).toEqual(["U", "U'", 'L']);
  });

  it('fires lowercase tokens for tip turns', async () => {
    const tokens: string[] = [];
    engine.onMoveEvent((token) => tokens.push(token));

    await engine.rotateVertex('B', 'tip', 120, 0);
    await engine.rotateVertex('B', 'tip', -120, 0);

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

describe('PyraminxEngine.orbitStep (fixed-angle camera steps)', () => {
  let engine: PyraminxEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
    engine.setIsometricView();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('yaw snaps to the 120° grid (3-fold symmetry), pitch stays on the 30° grid', () => {
    const YAW = (Math.PI * 2) / 3;
    const PITCH = Math.PI / 6;
    engine.orbitStep(10, 0); // one rightward step
    const a1 = engine.sceneManager.getOrbitAngles();
    expect(Math.abs(a1.theta + YAW) % (Math.PI * 2)).toBeLessThan(1e-6);
    expect(Math.abs(a1.phi - PITCH) % (Math.PI * 2)).toBeLessThan(1e-6);
    engine.orbitStep(10, 0); // another step stays ON the grid
    const a2 = engine.sceneManager.getOrbitAngles();
    expect(Math.abs((a2.theta + 2 * YAW) % (Math.PI * 2))).toBeLessThan(1e-6);
    expect(Math.abs(a2.phi - PITCH) % (Math.PI * 2)).toBeLessThan(1e-6);
  });

  it('pitch steps by 30° and clamps near the poles', () => {
    const PITCH = Math.PI / 6;
    engine.orbitStep(0, 10); // down → top tips forward
    const a1 = engine.sceneManager.getOrbitAngles();
    expect(Math.abs(a1.phi - (PITCH - PITCH)) % (Math.PI * 2)).toBeLessThan(1e-6);
    expect(Math.abs(a1.phi)).toBeLessThan(1e-6);
    // Repeated down-steps clamp below the pole (never NaN / full flip).
    engine.orbitStep(0, 10);
    engine.orbitStep(0, 10);
    const a2 = engine.sceneManager.getOrbitAngles();
    expect(a2.phi).toBeGreaterThan(-Math.PI / 2);
    expect(Number.isFinite(a2.phi)).toBe(true);
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
});
