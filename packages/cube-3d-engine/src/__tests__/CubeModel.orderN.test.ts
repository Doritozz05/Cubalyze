/**
 * Order-N generalization — CubeModel + CubeMeshFactory for any N×N×N.
 *
 * Verifies:
 *   • cubie counts and centered grid coordinates for orders 4, 5, 7
 *   • sticker placement derived from each cubie's own outer bound
 *     (corners 3, big-cube wings/edges 2, face centers 1, inner 0)
 *   • layer selection + logical-state permutation on inner layers (±0.5)
 *   • RotationEngine integration on an order-4 outer layer
 *   • 2×2 / 3×3 regression: identical counts, layers and sticker counts
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CubeMeshFactory, DEFAULT_STYLE } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { RotationEngine } from '../animation/RotationEngine';

/** Count visible main stickers on a cubie group (excludes the core mesh and
 *  floating projection stickers, which exist but are invisible by default). */
function mainStickerCount(model: CubeModel, x: number, y: number, z: number): number {
  const cubie = model
    .getLogicalState()
    .find((c) => c.initialGridX === x && c.initialGridY === y && c.initialGridZ === z)!;
  return cubie.mesh.children.filter(
    (child) =>
      (child as { isMesh?: boolean }).isMesh &&
      !child.userData?.isFloatingSticker &&
      (child as { geometry?: { type?: string } }).geometry?.type === 'ShapeGeometry',
  ).length;
}

function logicalAt(model: CubeModel, x: number, y: number, z: number) {
  return model
    .getLogicalState()
    .find((c) => c.initialGridX === x && c.initialGridY === y && c.initialGridZ === z)!;
}

describe('CubeModel — any order N', () => {
  // ── Cubie counts ──────────────────────────────────────────────────────

  it('4×4 builds 64 cubies (no core — even order)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    expect(model.getAllCubies().length).toBe(64); // 4³
  });

  it('5×5 builds 124 cubies (125 - 1 core)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 5);
    expect(model.getAllCubies().length).toBe(124); // 5³ - 1
  });

  it('7×7 builds 342 cubies (343 - 1 core)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 7);
    expect(model.getAllCubies().length).toBe(342); // 7³ - 1
  });

  it('6×6 builds 216 cubies (no core — even order)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 6);
    expect(model.getAllCubies().length).toBe(216); // 6³
  });

  // ── Centered grid coordinates ─────────────────────────────────────────

  it('4×4 grid is centered: outer layers at ±1.5, inner at ±0.5', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    expect(model.gridMin).toBe(-1.5);
    expect(model.gridMax).toBe(1.5);
    const xs = new Set(model.getLogicalState().map((c) => c.initialGridX));
    expect([...xs].sort((a, b) => a - b)).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });

  it('7×7 grid is centered: layers at ±3, ±2, ±1, 0', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 7);
    expect(model.gridMin).toBe(-3);
    expect(model.gridMax).toBe(3);
    const xs = new Set(model.getLogicalState().map((c) => c.initialGridX));
    expect([...xs].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it('mesh positions use spacing 1.0 for N≥3 (cubies touch seamlessly)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    const corner = logicalAt(model, 1.5, 1.5, 1.5);
    const p = corner.mesh.getWorldPosition(new Vector3());
    expect(p.x).toBeCloseTo(1.5, 5);
    expect(p.y).toBeCloseTo(1.5, 5);
    expect(p.z).toBeCloseTo(1.5, 5);
  });

  // ── Sticker placement (order-agnostic outer bound) ────────────────────

  it('4×4 sticker counts match piece types: corner 3, wing 2, face center 1, inner 0', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    expect(mainStickerCount(model, 1.5, 1.5, 1.5)).toBe(3); // corner
    expect(mainStickerCount(model, 0.5, 1.5, 1.5)).toBe(2); // wing (edge)
    expect(mainStickerCount(model, 0.5, 0.5, 1.5)).toBe(1); // face center
    expect(mainStickerCount(model, 0.5, 0.5, 0.5)).toBe(0); // inner core piece
  });

  it('7×7 sticker counts: corner 3, edge 2, face center 1, interior 0', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 7);
    expect(mainStickerCount(model, 3, 3, 3)).toBe(3); // corner
    expect(mainStickerCount(model, 3, 3, 0)).toBe(2); // edge between +x and +y
    expect(mainStickerCount(model, 3, 0, 0)).toBe(1); // center of the +x face
    expect(mainStickerCount(model, 3, 2, 0)).toBe(1); // off-center piece of the +x face
    expect(mainStickerCount(model, 0, 0, 1)).toBe(0); // interior (not on the surface)
  });

  // ── Layer selection + logical permutation on inner layers ─────────────

  it('4×4 outer layer has 16 cubies; inner slice layer has 16 too', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    expect(model.getCubiesByFace('y', 1.5).length).toBe(16);
    expect(model.getCubiesByFace('y', 0.5).length).toBe(16);
  });

  it('4×4 R layer (+90°) permutes the corner exactly: (1.5,1.5,1.5) → (1.5,-1.5,1.5)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    const corner = logicalAt(model, 1.5, 1.5, 1.5);
    model.updateLogicalState('x', 1.5, 1);
    expect([corner.gridX, corner.gridY, corner.gridZ]).toEqual([1.5, -1.5, 1.5]);
  });

  it('4×4 inner slice rotation (x=0.5) permutes without touching the outer layer', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    const inner = logicalAt(model, 0.5, 1.5, 1.5);
    const outerCorner = logicalAt(model, 1.5, 1.5, 1.5);
    model.updateLogicalState('x', 0.5, 1); // inner slice only
    expect([inner.gridX, inner.gridY, inner.gridZ]).toEqual([0.5, -1.5, 1.5]);
    expect([outerCorner.gridX, outerCorner.gridY, outerCorner.gridZ]).toEqual([1.5, 1.5, 1.5]);
  });

  it('resetCube restores the order-4 logical state after inner+outer turns', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    model.updateLogicalState('x', 1.5, 1);
    model.updateLogicalState('y', 0.5, 2);
    model.updateLogicalState('z', -1.5, 3);
    model.resetCube();
    expect(
      model.getLogicalState().every((c) => c.gridX === c.initialGridX && c.gridY === c.initialGridY && c.gridZ === c.initialGridZ),
    ).toBe(true);
  });

  // ── RotationEngine integration ────────────────────────────────────────

  it('RotationEngine animates an order-4 outer layer and snaps to the logical grid', async () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 4);
    const engine = new RotationEngine(model);
    const urf = logicalAt(model, 1.5, 1.5, 1.5);

    // +90° z-turn of the outer layer z=1.5: (x, y) → (-y, x).
    const rot = engine.rotateLayers('z', [1.5], 90, 0);
    engine.update(10_000);
    await rot;

    expect([urf.gridX, urf.gridY, urf.gridZ]).toEqual([-1.5, 1.5, 1.5]);
    const p = urf.mesh.getWorldPosition(new Vector3());
    expect(p.x).toBeCloseTo(-1.5, 5);
    expect(p.y).toBeCloseTo(1.5, 5);
    expect(p.z).toBeCloseTo(1.5, 5);
  });

  // ── 2×2 / 3×3 regression (behavior must be unchanged) ────────────────

  it('2×2 keeps 8 cubies with 3 stickers per corner (no middle layer)', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 2);
    expect(model.getAllCubies().length).toBe(8);
    expect(model.getCubiesByFace('y', 1).length).toBe(4);
    expect(mainStickerCount(model, 1, 1, 1)).toBe(3);
  });

  it('3×3 keeps 26 cubies, ±1 grid, corner 3 stickers, face center 1', () => {
    const model = new CubeModel(new CubeMeshFactory(DEFAULT_STYLE), 3);
    expect(model.getAllCubies().length).toBe(26);
    expect(model.gridMin).toBe(-1);
    expect(model.gridMax).toBe(1);
    expect(model.getCubiesByFace('y', 0).length).toBe(8); // middle slice, core excluded
    expect(mainStickerCount(model, 1, 1, 1)).toBe(3);
    expect(mainStickerCount(model, 0, 1, 0)).toBe(1);
  });
});
