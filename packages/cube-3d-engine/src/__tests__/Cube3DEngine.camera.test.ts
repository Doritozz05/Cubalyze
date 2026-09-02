import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Polyfill rAF for Node test environment
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (
  cb: FrameRequestCallback,
) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame ??= (
  id: number,
) => clearTimeout(id);

import { Cube3DEngine } from '../core/Cube3DEngine';

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

function buildEngine(): Cube3DEngine {
  return new Cube3DEngine({ canvas: makeCanvas(), width: 320, height: 240 });
}

describe('Cube3DEngine.CANONICAL_VIEW & camera controls', () => {
  let engine: Cube3DEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = buildEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('exposes CANONICAL_VIEW with downward eye perspective (theta=0, phi=PI/4, radius=7)', () => {
    expect(Cube3DEngine.CANONICAL_VIEW).toEqual({
      theta: 0,
      phi: Math.PI / 4,
      radius: 7,
    });
  });

  it('initializes camera at CANONICAL_VIEW on mount', () => {
    const angles = engine.sceneManager.getOrbitAngles();
    expect(angles.theta).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.theta, 5);
    expect(angles.phi).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.phi, 5);
    expect(angles.radius).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.radius, 5);
  });

  it('resetCamera() restores camera angles to CANONICAL_VIEW after user rotation', () => {
    engine.rotateCamera(40, -30);
    const rotated = engine.sceneManager.getOrbitAngles();
    expect(rotated.theta).not.toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.theta, 2);

    engine.resetCamera(false);
    const reset = engine.sceneManager.getOrbitAngles();
    expect(reset.theta).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.theta, 5);
    expect(reset.phi).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.phi, 5);
    expect(reset.radius).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.radius, 5);
  });

  it('calibrateGyro() restores camera angles to CANONICAL_VIEW', () => {
    engine.rotateCamera(50, 40);
    const rotated = engine.sceneManager.getOrbitAngles();
    expect(rotated.phi).not.toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.phi, 2);

    engine.calibrateGyro();
    const calibrated = engine.sceneManager.getOrbitAngles();
    expect(calibrated.theta).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.theta, 5);
    expect(calibrated.phi).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.phi, 5);
    expect(calibrated.radius).toBeCloseTo(Cube3DEngine.CANONICAL_VIEW.radius, 5);
  });

  it('setIsometricView() sets camera to isometric angles (PI/6, PI/6, 7)', () => {
    engine.setIsometricView(false);
    const iso = engine.sceneManager.getOrbitAngles();
    expect(iso.theta).toBeCloseTo(Math.PI / 6, 5);
    expect(iso.phi).toBeCloseTo(Math.PI / 6, 5);
    expect(iso.radius).toBeCloseTo(7, 5);
  });
});
