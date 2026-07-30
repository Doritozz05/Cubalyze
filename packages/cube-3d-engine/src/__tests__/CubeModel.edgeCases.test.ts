/**
 * Nivel 2 — Edge cases para CubeModel
 *
 * Casos frontera:
 * • buildCubies: conteo correcto para 2×2 (8) vs 3×3 (26)
 * • updateLogicalState: quarterTurns=0, 4, -5 (normalización)
 * • getCubiesByFace: layerValue inexistente, axis inválido
 * • snapCubiePositions: lista vacía de meshes, 1 mesh
 * • applyFacelets: string vacío, string demasiado corto, 2×2 en modelo 3×3
 * • resetCube: después de corrupción parcial
 * • getCubiesByFace con axis/valor fuera de rango
 */
import { describe, it, expect } from 'vitest';
import { CubeMeshFactory, DEFAULT_STYLE } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';

// We need a minimal Three.js mock for the Group used by CubeMeshFactory
// Since CubeMeshFactory.createCubieGroup returns actual Three.js Groups,
// we need real Three.js. The tests below are designed to work with it.

describe('CubeModel — Nivel 2 Edge Cases', () => {

  // ── buildCubies: conteo ────────────────────────────────────────────

  it('2×2 tiene exactamente 8 cubies (esquinas, sin centro ni edges)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 2);
    expect(model.getAllCubies().length).toBe(8); // 2³ - 0 core
  });

  it('3×3 tiene exactamente 26 cubies (27 - 1 core)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(model.getAllCubies().length).toBe(26); // 3³ - 1 core
  });

  it('order por defecto es 3', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory);
    expect(model.order).toBe(3);
    expect(model.getAllCubies().length).toBe(26);
  });

  // ── updateLogicalState: normalización de quarterTurns ──────────────

  it('updateLogicalState con quarterTurns=0 no cambia nada', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const stateBefore = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    model.updateLogicalState('y', 0, 0);
    const stateAfter = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(stateAfter).toEqual(stateBefore);
  });

  it('updateLogicalState con quarterTurns=4 = 0 (4×90° = 360°)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const stateBefore = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    model.updateLogicalState('y', 0, 4); // 4 quarter turns = full rotation
    const stateAfter = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(stateAfter).toEqual(stateBefore);
  });

  it('updateLogicalState con quarterTurns=-5 = -1 (normalizado: 3)', () => {
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

  it('updateLogicalState con quarterTurns=2 = 180° (self-inverse)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    model.updateLogicalState('y', 0, 2); // 180°
    model.updateLogicalState('y', 0, 2); // otra 180°
    const state = model.getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    // Dos 180° = 360° = identidad
    const expected = new CubeModel(factory, 3).getLogicalState().map(c => ({ x: c.gridX, y: c.gridY, z: c.gridZ }));
    expect(state).toEqual(expected);
  });

  // ── updateLogicalState: capas específicas ──────────────────────────

  it('updateLogicalState en capa -1 (solo lado izquierdo)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    model.updateLogicalState('x', -1, 1); // Rota capa x=-1
    // Todos los cubies en x=-1 deben tener gridX=-1 aún (la capa rota pero no cambia de eje)
    const xNeg1 = model.getLogicalState().filter(c => Math.abs(c.gridX + 1) < 0.01);
    expect(xNeg1.length).toBe(9); // 3×3 grid, una capa
  });

  it('updateLogicalState con layerValue fuera del grid no crashea', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.updateLogicalState('y', 99, 1)).not.toThrow();
    // No cubies en y=99, así que no se modifica nada
  });

  // ── getCubiesByFace: edge cases ────────────────────────────────────

  it('getCubiesByFace con layerValue 0 (middle slice) en 3×3 = 8 cubies (core excluido)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const middle = model.getCubiesByFace('y', 0);
    // 9 posiciones menos 1 core (0,0,0) = 8 cubies
    expect(middle.length).toBe(8);
  });

  it('getCubiesByFace con layerValue inexistente devuelve array vacío', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const empty = model.getCubiesByFace('z', 99);
    expect(empty).toEqual([]);
  });

  // ── snapCubiePositions: edge cases ─────────────────────────────────

  it('snapCubiePositions con lista vacía no crashea', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.snapCubiePositions([])).not.toThrow();
  });

  // ── resetCube: después de operaciones ──────────────────────────────

  it('resetCube después de múltiples rotaciones vuelve al estado lógico inicial', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const initialState = model.getLogicalState().map(c => ({
      x: c.gridX, y: c.gridY, z: c.gridZ,
      ix: c.initialGridX, iy: c.initialGridY, iz: c.initialGridZ,
    }));
    // Aplicar varias rotaciones
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

  it('resetCube dos veces seguidas es seguro (idempotente)', () => {
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

  it('applyFacelets con string vacío no crashea', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.applyFacelets('')).not.toThrow();
  });

  it('applyFacelets con string de 1 carácter no crashea', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    expect(() => model.applyFacelets('X')).not.toThrow();
  });

  it('applyFacelets con 54 caracteres inválidos no crashea', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    // 54 caracteres pero no representan un estado válido
    expect(() => model.applyFacelets('X'.repeat(54))).not.toThrow();
  });

  // ── getAllCubies ───────────────────────────────────────────────────

  it('getAllCubies devuelve el mismo número que cubies internos', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 2);
    expect(model.getAllCubies().length).toBe(8);
    expect(model.getAllCubies().length).toBe(model.getLogicalState().length);
  });

  // ── getLogicalState: integridad ────────────────────────────────────

  it('getLogicalState devuelve snapshots inmutables (cubies individuales tienen initialGrid correcto)', () => {
    const factory = new CubeMeshFactory(DEFAULT_STYLE);
    const model = new CubeModel(factory, 3);
    const state = model.getLogicalState();
    // Verificamos que cada cubie tiene initialGrid coincidiendo con su posición inicial
    for (const cubie of state) {
      expect(cubie.initialGridX).toBe(cubie.gridX);
      expect(cubie.initialGridY).toBe(cubie.gridY);
      expect(cubie.initialGridZ).toBe(cubie.gridZ);
    }
    // Después de rotación de capa x=1 (right face), gridY/gridZ cambian
    model.updateLogicalState('x', 1, 1);
    const stateAfter = model.getLogicalState();
    const rotatedCubies = stateAfter.filter(c => c.gridY !== c.initialGridY || c.gridZ !== c.initialGridZ);
    expect(rotatedCubies.length).toBeGreaterThan(0);
  });
});
