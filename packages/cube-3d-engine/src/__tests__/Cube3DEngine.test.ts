import { describe, it, expect, beforeEach } from 'vitest';
import { Mesh, MeshBasicMaterial } from 'three';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';

describe('setF2LMaskGray logic', () => {
  let factory: CubeMeshFactory;
  let model: CubeModel;

  beforeEach(() => {
    factory = new CubeMeshFactory();
    model = new CubeModel(factory);
  });

  it('identifies yellow U-layer pieces and FR slot pieces correctly', () => {
    const cubies = model.getLogicalState();
    
    // In Basic F2L: only initialGridY === 1 is grayed
    const basicYellowPieces = cubies.filter(c => c.initialGridY === 1);
    expect(basicYellowPieces.length).toBe(9);

    // In Advanced F2L: initialGridY === 1 PLUS corner (1, -1, 1) and edge (1, 0, 1)
    const af2lCorner = cubies.find(
      c => c.initialGridX === 1 && c.initialGridY === -1 && c.initialGridZ === 1
    );
    const af2lEdge = cubies.find(
      c => c.initialGridX === 1 && c.initialGridY === 0 && c.initialGridZ === 1
    );

    expect(af2lCorner).toBeDefined();
    expect(af2lEdge).toBeDefined();

    const af2lGrayedPieces = cubies.filter(
      c =>
        c.initialGridY === 1 ||
        (c.initialGridX === 1 && c.initialGridY === -1 && c.initialGridZ === 1) ||
        (c.initialGridX === 1 && c.initialGridY === 0 && c.initialGridZ === 1)
    );

    // 9 (U layer) + 1 (DFR corner) + 1 (FR edge) = 11 pieces total in AF2L
    expect(af2lGrayedPieces.length).toBe(11);
  });
});

describe('sticker z-fighting guard', () => {
  let factory: CubeMeshFactory;

  beforeEach(() => {
    factory = new CubeMeshFactory();
  });

  it('stickered skin sticker meshes enable polygonOffset (no z-fighting at distance)', () => {
    // A cubie on the +x face has: [core, R sticker, ...].
    const group = factory.createCubieGroup(1, 0, 0);
    const sticker = group.children.find((child) => {
      const mesh = child as Mesh;
      return (
        mesh.isMesh &&
        (mesh.material as MeshBasicMaterial)?.isMeshBasicMaterial === true
      );
    });
    expect(sticker).toBeDefined();
    const stickerMat = (sticker as Mesh).material as MeshBasicMaterial;
    // NEGATIVE offset pushes stickers toward the camera so they always win
    // the depth test against the core (positive offsets make them vanish).
    expect(stickerMat.polygonOffset).toBe(true);
    expect(stickerMat.polygonOffsetFactor).toBeLessThan(0);
    expect(stickerMat.polygonOffsetUnits).toBeLessThan(0);
  });

  it('every face sticker pool carries polygonOffset', () => {
    for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      const group = factory.createCubieGroup(x, y, z);
      const stickers = group.children.filter((child) => {
        const mesh = child as Mesh;
        return (
          mesh.isMesh &&
          (mesh.material as MeshBasicMaterial)?.isMeshBasicMaterial === true
        );
      });
      expect(stickers.length).toBeGreaterThan(0);
      for (const s of stickers) {
        const mat = (s as Mesh).material as MeshBasicMaterial;
        expect(mat.polygonOffset).toBe(true);
        expect(mat.polygonOffsetFactor).toBeLessThan(0);
        expect(mat.polygonOffsetUnits).toBeLessThan(0);
      }
    }
  });
});
