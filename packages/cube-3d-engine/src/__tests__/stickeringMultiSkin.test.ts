import { describe, it, expect, beforeEach } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { Cube3DEngine } from '../core/Cube3DEngine';
import { Edge, type PhaseMask } from '@cubalyze/math-core';

describe('Stickering Multi-Skin System & Reactive Preservation', () => {
  let factory: CubeMeshFactory;
  let model: CubeModel;

  beforeEach(() => {
    factory = new CubeMeshFactory();
    model = new CubeModel(factory);
  });

  it('grays out cubies in stickered skin mode', () => {
    // White cross mask (edges: UR, UF, UL, UB)
    const mask: PhaseMask = {
      name: 'white-cross',
      edges: [{ id: Edge.UR }, { id: Edge.UF }, { id: Edge.UL }, { id: Edge.UB }],
      corners: [],
    };

    // Construct a mocked engine instance
    const engine = Object.create(Cube3DEngine.prototype);
    engine.factory = factory;
    engine.model = model;
    engine.grayedStickers = [];
    engine.activeStickeringState = null;
    engine.requestRender = () => {};

    // Apply phase stickering
    engine.setPhaseStickering(mask, '#3a3a3a');

    // In stickered mode, child sticker meshes should be grayed
    expect(engine.grayedStickers.length).toBeGreaterThan(0);
    const firstGrayed = engine.grayedStickers[0];
    expect((firstGrayed.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('3a3a3a');

    // Clear gray restores original
    engine.clearLayerGray();
    expect(engine.grayedStickers.length).toBe(0);
    expect((firstGrayed.mesh.material as MeshBasicMaterial).color.getHexString()).not.toBe('3a3a3a');
  });

  it('grays out exposed face materials in stickerless skin mode', () => {
    // Switch factory to stickerless skin
    factory.updateStyle({ skinType: 'stickerless' });

    const mask: PhaseMask = {
      name: 'white-cross',
      edges: [{ id: Edge.UR }, { id: Edge.UF }, { id: Edge.UL }, { id: Edge.UB }],
      corners: [],
    };

    const engine = Object.create(Cube3DEngine.prototype);
    engine.factory = factory;
    engine.model = model;
    engine.grayedStickers = [];
    engine.activeStickeringState = null;
    engine.requestRender = () => {};

    engine.setPhaseStickering(mask, '#3a3a3a');

    // In stickerless mode, grayedStickers should track multi-material array indices (materialIndex >= 0)
    const multiMaterialRecords = engine.grayedStickers.filter((r: any) => r.materialIndex >= 0);
    expect(multiMaterialRecords.length).toBeGreaterThan(0);

    const firstMulti = multiMaterialRecords[0];
    const matArray = firstMulti.mesh.material as MeshBasicMaterial[];
    expect(matArray[firstMulti.materialIndex].color.getHexString()).toBe('3a3a3a');

    // Clear restores original face material
    engine.clearLayerGray();
    expect(engine.grayedStickers.length).toBe(0);
    const restoredArray = firstMulti.mesh.material as MeshBasicMaterial[];
    expect(restoredArray[firstMulti.materialIndex].color.getHexString()).not.toBe('3a3a3a');
  });

  it('preserves and re-applies active gray stickering when updateStyle changes skinType', () => {
    const mask: PhaseMask = {
      name: 'white-cross',
      edges: [{ id: Edge.UR }, { id: Edge.UF }, { id: Edge.UL }, { id: Edge.UB }],
      corners: [],
    };

    const engine = Object.create(Cube3DEngine.prototype);
    engine.factory = factory;
    engine.model = model;
    engine.grayedStickers = [];
    engine.activeStickeringState = null;
    engine.requestRender = () => {};

    // 1. Set mask in stickered mode
    engine.setPhaseStickering(mask, '#3a3a3a');
    expect(engine.activeStickeringState).not.toBeNull();
    expect(engine.grayedStickers.length).toBeGreaterThan(0);

    // 2. Change skin dynamically to stickerless
    engine.updateStyle({ skinType: 'stickerless' });

    // 3. Stickering state MUST still be active and re-applied to the stickerless mesh!
    expect(engine.activeStickeringState).not.toBeNull();
    const multiMaterialRecords = engine.grayedStickers.filter((r: any) => r.materialIndex >= 0);
    expect(multiMaterialRecords.length).toBeGreaterThan(0);

    // 4. Change skin dynamically to translucent
    engine.updateStyle({ skinType: 'translucent' });
    expect(engine.activeStickeringState).not.toBeNull();
    expect(engine.grayedStickers.length).toBeGreaterThan(0);
  });
});
