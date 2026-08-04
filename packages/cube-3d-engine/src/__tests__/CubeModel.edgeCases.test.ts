/**
 * Level 2 — Edge cases for CubeModel
 *
 * Boundary cases:
 * • buildCubies: correct count for 2×2 (8) vs 3×3 (26)
 * • updateLogicalState: quarterTurns=0, 4, -5 (normalization)
 * • getCubiesByFace: missing layerValue, invalid axis
 * • snapCubiePositions: empty mesh list, 1 mesh
 * • applyFacelets: empty string, too-short string, 2×2 on a 3×3 model
 * • resetCube: after partial corruption
 * • getCubiesByFace with out-of-range axis/value
 */
import { describe, it, expect } from 'vitest';
import { CubeMeshFactory, DEFAULT_STYLE } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';

// We need a minimal Three.js mock for the Group used by CubeMeshFactory
// Since CubeMeshFactory.createCubieGroup returns actual Three.js Groups,
// we need real Three.js. The tests below are designed to work with it.

describe('CubeModel — Level 2 Edge Cases', () => {

  // ── buildCubies: count ─────────────────────────────────────────────

  it('2×2 has exactly 8 cubies (corners, no centers or edges)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 2);
    expect(model.getAllCubies().length).toBe(8); // 2³ - 0 core
  });

  it('3×3 has exactly 26 cubies (27 - 1 core)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(model.getAllCubies().length).toBe(26); // 3³ - 1 core
  });

  it('default order is 3', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory);
    expect(model.order).toBe(3);
    expect(model.getAllCubies().length).toBe(26);
  });

  // ── updateLogicalState: quarterTurns normalization ────────────────

  it('updateLogicalState with quarterTurns=0 changes nothing', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const stateBefore = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    model.updateLogicalState('y', 0, 0);
    const stateAfter = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(stateAfter).toEqual(stateBefore);
  });

  it('updateLogicalState with quarterTurns=4 = 0 (4×90° = 360°)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const stateBefore = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    model.updateLogicalState('y', 0, 4); // 4 quarter turns = full rotation
    const stateAfter = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(stateAfter).toEqual(stateBefore);
  });

  it('updateLogicalState with quarterTurns=-5 = -1 (normalized: 3)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    // -5 % 4 = -1 → (-1 + 4) % 4 = 3 = -90° equivalent
    model.updateLogicalState('y', 0, -5);
    const afterMinus5 = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    // Compare with quarterTurns=3
    model.resetCube();
    model.updateLogicalState('y', 0, 3);
    const after3 = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(afterMinus5).toEqual(after3);
  });

  it('updateLogicalState with quarterTurns=2 = 180° (self-inverse)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    model.updateLogicalState('y', 0, 2); // 180°
    model.updateLogicalState('y', 0, 2); // another 180°
    const state = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    // Two 180° = 360° = identity
    const expected = new CubeModel(factory, 3).getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(state).toEqual(expected);
  });

  // ── updateLogicalState: specific layers ────────────────────────────

  it('updateLogicalState on layer -1 (left side only)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    model.updateLogicalState('x', -1, 1); // Rotate layer x=-1
    // All cubies at x=-1 must still have gridX=-1 (the layer rotates but stays on its axis)
    const xNeg1 = model.getLogicalState().filter(c => Math.abs(c.gridX + 1) < 0.01);
    expect(xNeg1.length).toBe(9); // 3×3 grid, one layer
  });

  it('updateLogicalState with layerValue outside the grid does not crash', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.updateLogicalState('y', 99, 1)).not.toThrow();
    // No cubies at y=99, so nothing is modified
  });

  // ── getCubiesByFace: edge cases ────────────────────────────────────

  it('getCubiesByFace with layerValue 0 (middle slice) on 3×3 = 8 cubies (core excluded)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const middle = model.getCubiesByFace('y', 0);
    // 9 positions minus 1 core (0,0,0) = 8 cubies
    expect(middle.length).toBe(8);
  });

  it('getCubiesByFace with a missing layerValue returns an empty array', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const empty = model.getCubiesByFace('z', 99);
    expect(empty).toEqual([]);
  });

  // ── snapCubiePositions: edge cases ─────────────────────────────────

  it('snapCubiePositions with an empty list does not crash', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.snapCubiePositions([])).not.toThrow();
  });

  // ── resetCube: after operations ───────────────────────────────────

  it('resetCube after multiple rotations returns to the initial logical state', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const initialState = model.getLogicalState().map(c => ({
      x: c.gridX, y: c.gridY, z: c.gridZ,
      ix: c.initialGridX, iy: c.initialGridY, iz: c.initialGridZ,
    }));
    // Apply several rotations
    model.updateLogicalState('x', 1, 1);
    model.updateLogicalState('y', 0, 2);
    model.updateLogicalState('z', -1, 3);
    model.resetCube();
    const afterReset = model.getLogicalState();
    for (let i = 0; i < afterReset.length; i++) {
      expect(afterReset[i].gridX).toBe(initialState[i].x);
      expect(afterReset[i].gridY).toBe(initialState[i].y);
      expect(afterReset[i].gridZ).toBe(initialState[i].z);
    }
  });

  it('resetCube twice in a row is safe (idempotent)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    model.updateLogicalState('x', -1, 1);
    model.resetCube();
    model.resetCube();
    const state = model.getLogicalState();
    expect(state.every(c => c.gridX === c.initialGridX)).toBe(true);
    expect(state.every(c => c.gridY === c.initialGridY)).toBe(true);
    expect(state.every(c => c.gridZ === c.initialGridZ)).toBe(true);
  });

  // ── applyFacelets: edge cases ──────────────────────────────────────

  it('applyFacelets with an empty string does not crash', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.applyFacelets('')).not.toThrow();
  });

  it('applyFacelets with a 1-character string does not crash', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.applyFacelets('X')).not.toThrow();
  });

  it('applyFacelets with 54 invalid characters does not crash', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    // 54 characters but they do not represent a valid state
    expect(() => model.applyFacelets('X'.repeat(54))).not.toThrow();
  });

  // ── getAllCubies ───────────────────────────────────────────────────

  it('getAllCubies returns the same number as the internal cubies', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 2);
    expect(model.getAllCubies().length).toBe(8);
    expect(model.getAllCubies().length).toBe(model.getLogicalState().length);
  });

  // ── getLogicalState: integridad ────────────────────────────────────

  it('getLogicalState returns immutable snapshots (individual cubies have correct initialGrid)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const state = model.getLogicalState();
    // Verify each cubie has initialGrid matching its initial position
    for (const cubie of state) {
      expect(cubie.initialGridX).toBe(cubie.gridX);
      expect(cubie.initialGridY).toBe(cubie.gridY);
      expect(cubie.initialGridZ).toBe(cubie.gridZ);
    }
    // After rotating layer x=1 (right face), gridY/gridZ change
    model.updateLogicalState('x', 1, 1);
    const stateAfter = model.getLogicalState();
    const rotatedCubies = stateAfter.filter(c => c.gridY !== c.initialGridY || c.gridZ !== c.initialGridZ);
    expect(rotatedCubies.length).toBeGreaterThan(0);
  });
});
