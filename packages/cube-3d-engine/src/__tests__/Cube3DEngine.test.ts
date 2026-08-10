import { describe, it, expect, beforeEach } from 'vitest';
import { Mesh, MeshBasicMaterial } from 'three';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';
import { CORNER_HOME_POSITION, EDGE_HOME_POSITION } from '../core/Cube3DEngine';

describe('setF2LMaskGray logic', () => {
  let factory: CubeMeshFactory;
  let model: CubeModel;

  beforeEach(() => {
    factory = new CubeMeshFactory();
    model = new CubeModel(factory);
  });

  // Mirrors the engine's F2L mask rule: the pair stays
  // colored wherever it is; U-layer pieces and out-of-place F2L pieces gray.
  function maskGrayed(cubies: ReadonlyArray<{
    gridX: number; gridY: number; gridZ: number;
    initialGridX: number; initialGridY: number; initialGridZ: number;
  }>, pair?: { homeC: number; homeE: number } | null) {
    const pairKeys = pair
      ? new Set([
          `${CORNER_HOME_POSITION[pair.homeC].x},${CORNER_HOME_POSITION[pair.homeC].y},${CORNER_HOME_POSITION[pair.homeC].z}`,
          `${EDGE_HOME_POSITION[pair.homeE].x},${EDGE_HOME_POSITION[pair.homeE].y},${EDGE_HOME_POSITION[pair.homeE].z}`,
        ])
      : null;
    return cubies.filter((c) => {
      const key = `${c.initialGridX},${c.initialGridY},${c.initialGridZ}`;
      if (pairKeys?.has(key)) return false;
      const inHome = c.gridX === c.initialGridX && c.gridY === c.initialGridY && c.gridZ === c.initialGridZ;
      return c.initialGridY === 1 || !inHome;
    });
  }

  it('in a solved cube grays exactly the U layer (9 pieces) and keeps the pair colored', () => {
    const cubies = model.getLogicalState();

    // Basic F2L pair = FR slot pieces (DFR corner + FR edge).
    const grayed = maskGrayed(cubies, { homeC: 4, homeE: 8 });
    expect(grayed.length).toBe(9); // U layer only

    const grayedKeys = new Set(grayed.map((c) => `${c.initialGridX},${c.initialGridY},${c.initialGridZ}`));
    // The pair is never grayed.
    expect(grayedKeys.has('1,-1,1')).toBe(false); // DFR corner
    expect(grayedKeys.has('1,0,1')).toBe(false); // FR edge
    // Solved cross + other slots stay colored.
    expect(grayedKeys.has('0,-1,1')).toBe(false); // DF edge
  });

  it('keeps a both-on-top pair colored while the displaced U pieces gray', () => {
    // Emulate a both-on-top state with a real 4-piece swap: the pair (DFR
    // corner 4 + FR edge 8) sits in the U layer, and two U pieces moved into
    // the DFR/FR slots.
    const cubies = model.getLogicalState();
    const dfr = cubies.find((c) => c.initialGridX === 1 && c.initialGridY === -1 && c.initialGridZ === 1)!;
    const fr = cubies.find((c) => c.initialGridX === 1 && c.initialGridY === 0 && c.initialGridZ === 1)!;
    const u1 = cubies.find((c) => c.initialGridX === 0 && c.initialGridY === 1 && c.initialGridZ === 1)!; // UF corner home
    const u2 = cubies.find((c) => c.initialGridX === 1 && c.initialGridY === 1 && c.initialGridZ === 0)!; // UR edge home

    // Swap current positions: pair → U layer, U pieces → slots.
    const swap = (a: any, b: any) => {
      [a.gridX, a.gridY, a.gridZ, b.gridX, b.gridY, b.gridZ] =
        [b.gridX, b.gridY, b.gridZ, a.gridX, a.gridY, a.gridZ];
    };
    swap(dfr, u1);
    swap(fr, u2);

    const grayed = maskGrayed(cubies, { homeC: 4, homeE: 8 });
    const grayedKeys = new Set(grayed.map((c) => `${c.initialGridX},${c.initialGridY},${c.initialGridZ}`));
    // The pair stays colored even though it now sits in the U layer.
    expect(grayedKeys.has('1,-1,1')).toBe(false);
    expect(grayedKeys.has('1,0,1')).toBe(false);
    // The displaced U pieces (now in the slots) gray out.
    expect(grayedKeys.has('0,1,1')).toBe(true);
    expect(grayedKeys.has('1,1,0')).toBe(true);
    // Exactly the U layer (9) is grayed; all solved F2L stays colored.
    expect(grayed.length).toBe(9);
  });

  it('without a pair grays the U layer only (legacy 2×2 / no-setup behavior)', () => {
    const cubies = model.getLogicalState();
    expect(maskGrayed(cubies, null).length).toBe(9);
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
