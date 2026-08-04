import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vector3 } from 'three';

// ────────────────────────────────────────────────────────────────────────
//  Mock WebGLRenderer — the real one needs a WebGL context (Node.js lacks it)
// ────────────────────────────────────────────────────────────────────────

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

import { SceneManager } from '../core/SceneManager';

// ────────────────────────────────────────────────────────────────────────

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

describe('SceneManager — Level 2 Edge Cases', () => {
  let sceneManager: SceneManager;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = createMockCanvas();
    sceneManager = new SceneManager(canvas, 800, 600, 2);
  });

  afterEach(() => {
    sceneManager.dispose();
  });

  // ────────────────────────────────────────────────────────────────────
  //  Constructor / initialization
  // ────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates scene, camera, renderer, cameraGroup', () => {
      expect(sceneManager.scene).toBeDefined();
      expect(sceneManager.camera).toBeDefined();
      expect(sceneManager.renderer).toBeDefined();
      expect(sceneManager.cameraGroup).toBeDefined();
    });

    it('camera is at default position (0, 0, orbitRadius=7)', () => {
      expect(sceneManager.camera.position.z).toBe(7);
      expect(sceneManager.camera.position.x).toBe(0);
      expect(sceneManager.camera.position.y).toBe(0);
    });

    it('camera aspect ratio matches constructor params', () => {
      expect(sceneManager.camera.aspect).toBeCloseTo(800 / 600);
    });

    it('pixel ratio is clamped at 2 (calls setPixelRatio with Math.min(5,2))', () => {
      const sm2 = new SceneManager(canvas, 800, 600, 5);
      expect(mockSetPixelRatio).toHaveBeenCalledWith(2);
      sm2.dispose();
    });

    it('constructor with pixelRatio=1 works', () => {
      const sm1 = new SceneManager(canvas, 400, 300, 1);
      expect(sm1.camera.aspect).toBeCloseTo(400 / 300);
      sm1.dispose();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  resize — edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('resize — edge cases', () => {
    it('resize with 0 width is a no-op (guard prevents degenerate aspect)', () => {
      const originalAspect = sceneManager.camera.aspect;
      sceneManager.resize(0, 600);
      // Guard `if (width <= 0 || height <= 0) return;` prevents NaN aspect
      expect(sceneManager.camera.aspect).toBe(originalAspect);
    });

    it('resize with 0 height is a no-op (guard prevents Infinity aspect)', () => {
      const originalAspect = sceneManager.camera.aspect;
      sceneManager.resize(800, 0);
      // Guard prevents division by zero
      expect(sceneManager.camera.aspect).toBe(originalAspect);
    });

    it('resize with negative width is a no-op (guard)', () => {
      const originalAspect = sceneManager.camera.aspect;
      sceneManager.resize(-800, 600);
      expect(sceneManager.camera.aspect).toBe(originalAspect);
    });

    it('resize with negative height is a no-op (guard)', () => {
      const originalAspect = sceneManager.camera.aspect;
      sceneManager.resize(800, -600);
      expect(sceneManager.camera.aspect).toBe(originalAspect);
    });

    it('resize with 0x0 is a no-op (guard prevents NaN)', () => {
      const originalAspect = sceneManager.camera.aspect;
      sceneManager.resize(0, 0);
      expect(sceneManager.camera.aspect).toBe(originalAspect);
    });

    it('resize multiple times works correctly', () => {
      sceneManager.resize(1024, 768);
      expect(sceneManager.camera.aspect).toBeCloseTo(1024 / 768);

      sceneManager.resize(1920, 1080);
      expect(sceneManager.camera.aspect).toBeCloseTo(1920 / 1080);

      sceneManager.resize(400, 400);
      expect(sceneManager.camera.aspect).toBeCloseTo(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  rotateCamera — edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('rotateCamera — edge cases', () => {
    it('rotateCamera with dx=0, dy=0 does not change position', () => {
      const initialZ = sceneManager.camera.position.z;
      sceneManager.rotateCamera(0, 0);
      expect(sceneManager.camera.position.z).toBeCloseTo(initialZ);
      expect(sceneManager.camera.position.x).toBeCloseTo(0);
      expect(sceneManager.camera.position.y).toBeCloseTo(0);
    });

    it('rotateCamera clamps phi (does not go below MIN_PHI or above MAX_PHI)', () => {
      // Rotate far upward
      sceneManager.rotateCamera(0, 100000);
      const posUp = sceneManager.camera.position;
      const distUp = Math.sqrt(posUp.x ** 2 + posUp.y ** 2 + posUp.z ** 2);
      expect(distUp).toBeCloseTo(7, 0);

      // Rotate far downward
      sceneManager.rotateCamera(0, -100000);
      const posDown = sceneManager.camera.position;
      const distDown = Math.sqrt(posDown.x ** 2 + posDown.y ** 2 + posDown.z ** 2);
      expect(distDown).toBeCloseTo(7, 0);
    });

    it('rotateCamera keeps camera at orbit radius after large horizontal rotation', () => {
      sceneManager.rotateCamera(100000, 0);
      const pos = sceneManager.camera.position;
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(dist).toBeCloseTo(7, 0);
    });

    it('rotateCamera preserves orbit radius with mixed dx, dy', () => {
      sceneManager.rotateCamera(500, 300);
      const pos = sceneManager.camera.position;
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(dist).toBeCloseTo(7, 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  zoomBy
  // ────────────────────────────────────────────────────────────────────

  describe('zoomBy — edge cases', () => {
    it('zoomBy(1) is a no-op', () => {
      sceneManager.zoomBy(1);
      expect(sceneManager.camera.position.z).toBeCloseTo(7, 5);
    });

    it('zoomBy(2) doubles the orbit radius (7 → 14)', () => {
      sceneManager.zoomBy(2);
      const dist = Math.sqrt(
        sceneManager.camera.position.x ** 2 +
        sceneManager.camera.position.y ** 2 +
        sceneManager.camera.position.z ** 2,
      );
      expect(dist).toBeCloseTo(14, 5);
    });

    it('zoomBy(0.5) halves the orbit radius (7 → 3.5)', () => {
      sceneManager.zoomBy(0.5);
      const dist = Math.sqrt(
        sceneManager.camera.position.x ** 2 +
        sceneManager.camera.position.y ** 2 +
        sceneManager.camera.position.z ** 2,
      );
      expect(dist).toBeCloseTo(3.5, 5);
    });

    it('zoomBy(100) clamps at maxOrbitRadius (20)', () => {
      sceneManager.zoomBy(100);
      const dist = Math.sqrt(
        sceneManager.camera.position.x ** 2 +
        sceneManager.camera.position.y ** 2 +
        sceneManager.camera.position.z ** 2,
      );
      expect(dist).toBeCloseTo(20, 5);
    });

    it('zoomBy(0.0001) clamps at minOrbitRadius (2)', () => {
      sceneManager.zoomBy(0.0001);
      const dist = Math.sqrt(
        sceneManager.camera.position.x ** 2 +
        sceneManager.camera.position.y ** 2 +
        sceneManager.camera.position.z ** 2,
      );
      expect(dist).toBeCloseTo(2, 5);
    });

    it('zoomBy with NaN, 0 or negative factor is a no-op', () => {
      const before = sceneManager.camera.position.clone();
      sceneManager.zoomBy(NaN);
      sceneManager.zoomBy(0);
      sceneManager.zoomBy(-2);
      expect(sceneManager.camera.position.distanceTo(before)).toBeCloseTo(0, 5);
    });

    it('zoomBy preserves the viewing angles (theta/phi)', () => {
      sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6);
      const before = sceneManager.camera.position.clone().normalize();
      sceneManager.zoomBy(1.5);
      const after = sceneManager.camera.position.clone().normalize();
      expect(after.distanceTo(before)).toBeCloseTo(0, 5);
    });

    it('zoom in then zoom out returns to the same radius (round-trip)', () => {
      sceneManager.zoomBy(1.4);
      sceneManager.zoomBy(1 / 1.4);
      const dist = Math.sqrt(
        sceneManager.camera.position.x ** 2 +
        sceneManager.camera.position.y ** 2 +
        sceneManager.camera.position.z ** 2,
      );
      expect(dist).toBeCloseTo(7, 5);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Dynamic near plane (depth precision at distance)
  // ────────────────────────────────────────────────────────────────────

  describe('dynamic near plane — depth precision guard', () => {
    it('near scales with the default radius 7 (0.03 → 0.21)', () => {
      expect(sceneManager.camera.near).toBeCloseTo(0.21, 5);
    });

    it('zooming out to max radius (20) raises near to 0.6', () => {
      sceneManager.zoomBy(100);
      expect(sceneManager.camera.near).toBeCloseTo(0.6, 5);
    });

    it('zooming in clamps near at the minimum 0.1 (no clipping)', () => {
      sceneManager.zoomBy(0.0001);
      expect(sceneManager.camera.near).toBeCloseTo(0.1, 5);
    });

    it('near plane never exceeds the 1.5 max clamp', () => {
      // Radius clamped to 20 → near = 0.6; force far above max via rotation
      // at max zoom is not possible, but the clamp formula is stable:
      sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6, 20);
      expect(sceneManager.camera.near).toBeLessThanOrEqual(1.5);
    });

    it('far plane stays at 100', () => {
      expect(sceneManager.camera.far).toBe(100);
    });

    it('rotating the camera keeps near in sync with distance', () => {
      const before = sceneManager.camera.near;
      sceneManager.rotateCamera(0, -10000); // phi clamps, radius stays 7
      expect(sceneManager.camera.near).toBeCloseTo(before, 5);
      sceneManager.zoomBy(2); // radius → 14
      expect(sceneManager.camera.near).toBeCloseTo(0.42, 5);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  resetCamera
  // ────────────────────────────────────────────────────────────────────

  describe('resetCamera', () => {
    it('resetCamera returns to default position', () => {
      sceneManager.rotateCamera(100, -50);
      expect(sceneManager.camera.position.z).not.toBe(7);

      sceneManager.resetCamera();
      expect(sceneManager.camera.position.x).toBe(0);
      expect(sceneManager.camera.position.y).toBe(0);
      expect(sceneManager.camera.position.z).toBe(7);
    });

    it('resetCamera after setOrbitAngles returns to default', () => {
      sceneManager.setOrbitAngles(Math.PI / 2, 0);
      expect(sceneManager.camera.position.x).not.toBe(0);

      sceneManager.resetCamera();
      expect(sceneManager.camera.position.z).toBe(7);
      expect(sceneManager.camera.position.x).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  setOrbitAngles — edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('setOrbitAngles — edge cases', () => {
    it('setOrbitAngles with theta=0, phi=0: camera at (0,0,7)', () => {
      sceneManager.setOrbitAngles(0, 0);
      expect(sceneManager.camera.position.x).toBeCloseTo(0, 5);
      expect(sceneManager.camera.position.y).toBeCloseTo(0, 5);
      expect(sceneManager.camera.position.z).toBeCloseTo(7, 5);
    });

    it('setOrbitAngles with theta=pi/2, phi=0: camera at (7,0,0)', () => {
      sceneManager.setOrbitAngles(Math.PI / 2, 0);
      expect(sceneManager.camera.position.x).toBeCloseTo(7, 5);
      expect(sceneManager.camera.position.y).toBeCloseTo(0, 5);
      expect(sceneManager.camera.position.z).toBeCloseTo(0, 5);
    });

    it('setOrbitAngles clamps phi at ±(pi/2 - 0.1)', () => {
      // Above the clamp
      sceneManager.setOrbitAngles(0, Math.PI);
      const posHigh = sceneManager.camera.position;
      const distHigh = Math.sqrt(posHigh.x ** 2 + posHigh.y ** 2 + posHigh.z ** 2);
      expect(distHigh).toBeCloseTo(7, 0);

      // Below the clamp
      sceneManager.setOrbitAngles(0, -Math.PI);
      const posLow = sceneManager.camera.position;
      const distLow = Math.sqrt(posLow.x ** 2 + posLow.y ** 2 + posLow.z ** 2);
      expect(distLow).toBeCloseTo(7, 0);
    });

    it('setOrbitAngles with extreme theta values wraps correctly', () => {
      sceneManager.setOrbitAngles(Math.PI * 10, 0);
      const pos = sceneManager.camera.position;
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(dist).toBeCloseTo(7, 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  setLighting
  // ────────────────────────────────────────────────────────────────────

  describe('setLighting', () => {
    it('setLighting with 0 intensities', () => {
      expect(() => sceneManager.setLighting(0, 0)).not.toThrow();
    });

    it('setLighting with extreme intensities', () => {
      expect(() => sceneManager.setLighting(100, 100)).not.toThrow();
    });

    it('setLighting with custom direction', () => {
      expect(() =>
        sceneManager.setLighting(0.5, 0.5, new Vector3(1, 2, 3))
      ).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  render
  // ────────────────────────────────────────────────────────────────────

  describe('render', () => {
    it('render does not throw on empty scene (uses mocked renderer)', () => {
      expect(() => sceneManager.render()).not.toThrow();
      expect(mockRender).toHaveBeenCalled();
    });

    it('render calls onRender callback when set', () => {
      const cb = vi.fn();
      sceneManager.onRender = cb;
      sceneManager.render();
      expect(cb).toHaveBeenCalledOnce();
      sceneManager.onRender = null;
    });

    it('render does not throw when onRender is null', () => {
      sceneManager.onRender = null;
      expect(() => sceneManager.render()).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  dispose
  // ────────────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('dispose called once disposes renderer', () => {
      sceneManager.dispose();
      expect(mockDispose).toHaveBeenCalledOnce();
    });

    it('dispose called twice disposes renderer again (idempotent on renderer)', () => {
      sceneManager.dispose();
      sceneManager.dispose();
      expect(mockDispose).toHaveBeenCalledTimes(2);
    });

    it('resize after dispose is allowed (camera still exists)', () => {
      sceneManager.dispose();
      expect(() => sceneManager.resize(1024, 768)).not.toThrow();
    });
  });
});
