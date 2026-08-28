import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial } from 'three';
import { CubeModel } from '../CubeModel';
import { CubeMeshFactory, DEFAULT_STYLE } from '../CubeMeshFactory';
import { resolveLayerHit, rotateVectorByQuaternion } from '../layerPick';
import { RotationEngine } from '../../animation/RotationEngine';

/** Reverse map: sticker hex color → face (single source: the default palette).
 *  Keys use `getHexString()` format (lowercase, NO '#' prefix). */
const COLOR_TO_FACE: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_STYLE.stickerColors).map(([face, color]) => [color.replace('#', ''), face]),
);

/**
 * Replicate Cube3DEngine.pickLayer's normal pipeline for a sticker mesh:
 * the raycast reports the shared ShapeGeometry normal (+Z) in the STICKER's
 * local space, so we first rotate it by the sticker's OWN quaternion (the
 * face orientation applied by CubeMeshFactory), then resolveLayerHit applies
 * the cubie quaternion for the cube frame. The bug this guards against: the
 * sticker quaternion was ignored, so every sticker resolved to +Z → F.
 */
const resolveSticker = (mesh: Mesh, cubieQuat: { x: number; y: number; z: number; w: number }) => {
  const meshLocalNormal = rotateVectorByQuaternion(
    { x: 0, y: 0, z: 1 },
    {
      x: mesh.quaternion.x,
      y: mesh.quaternion.y,
      z: mesh.quaternion.z,
      w: mesh.quaternion.w,
    },
  );
  return resolveLayerHit({ meshLocalNormal, cubieQuaternion: cubieQuat });
};

/** The sticker child meshes of a cubie (skips the core body and floating stickers). */
const stickerMeshesOf = (model: CubeModel, gridX: number, gridY: number, gridZ: number): Mesh[] => {
  const cubie = model
    .getLogicalState()
    .find((c) => c.initialGridX === gridX && c.initialGridY === gridY && c.initialGridZ === gridZ);
  if (!cubie) throw new Error(`cubie ${gridX},${gridY},${gridZ} not found`);
  return (cubie.mesh.children as Mesh[]).filter((m) => {
    if (!m.isMesh) return false;
    if (m.userData?.isFloatingSticker) return false;
    const mat = m.material;
    if (Array.isArray(mat) || !mat) return false;
    const hex = (mat as MeshBasicMaterial).color?.getHexString?.();
    return hex ? hex in COLOR_TO_FACE : false;
  });
};

describe('sticker picking — sticker mesh quaternions', () => {
  it('every one of the 54 stickers resolves to its OWN face on a solved cube (regression: all → F)', () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const resolvedFaces = new Set<string>();
    let stickerCount = 0;

    for (const cubie of model.getLogicalState()) {
      for (const mesh of stickerMeshesOf(model, cubie.initialGridX, cubie.initialGridY, cubie.initialGridZ)) {
        const mat = mesh.material as MeshBasicMaterial;
        const face = COLOR_TO_FACE[mat.color.getHexString()];
        stickerCount++;
        const hit = resolveSticker(mesh, {
          x: cubie.mesh.quaternion.x,
          y: cubie.mesh.quaternion.y,
          z: cubie.mesh.quaternion.z,
          w: cubie.mesh.quaternion.w,
        });
        expect(
          hit.face,
          `sticker ${face} on cubie ${cubie.initialGridX},${cubie.initialGridY},${cubie.initialGridZ} resolved to ${hit.face} — sticker quaternion ignored?`,
        ).toBe(face);
        resolvedFaces.add(hit.face);
      }
    }

    expect(stickerCount).toBe(54); // 8 corners × 3 + 12 edges × 2 + 6 centers × 1
    expect(resolvedFaces).toEqual(new Set(['U', 'D', 'F', 'B', 'R', 'L']));
  });

  it('resolves the correct axis+layer for every sticker (U→y:1, D→y:-1, F→z:1, …)', () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const expected: Record<string, { axis: string; layerValue: number }> = {
      U: { axis: 'y', layerValue: 1 },
      D: { axis: 'y', layerValue: -1 },
      F: { axis: 'z', layerValue: 1 },
      B: { axis: 'z', layerValue: -1 },
      R: { axis: 'x', layerValue: 1 },
      L: { axis: 'x', layerValue: -1 },
    };

    for (const cubie of model.getLogicalState()) {
      for (const mesh of stickerMeshesOf(model, cubie.initialGridX, cubie.initialGridY, cubie.initialGridZ)) {
        const face = COLOR_TO_FACE[(mesh.material as MeshBasicMaterial).color.getHexString()];
        const hit = resolveSticker(mesh, {
          x: cubie.mesh.quaternion.x,
          y: cubie.mesh.quaternion.y,
          z: cubie.mesh.quaternion.z,
          w: cubie.mesh.quaternion.w,
        });
        expect(hit.axis, `${face} sticker → axis`).toBe(expected[face].axis);
        expect(hit.layerValue, `${face} sticker → layer`).toBe(expected[face].layerValue);
      }
    }
  });

  it('after a whole-cube x rotation the front-center sticker resolves to U (cube frame follows the cubie quaternion)', async () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const engine = new RotationEngine(model);

    // T key (x) = rotate all x layers by -90°.
    const prom = engine.rotateLayers('x', [-1, 0, 1], -90, 0);
    engine.update(1_000); // duration 0 → snap on the first update
    await prom;

    // The front-center cubie moved to the top-center slot (F → U under x):
    // whole-cube rotations DO permute grid positions, only the centers keep
    // facing outward.
    const center = model
      .getLogicalState()
      .find((c) => c.initialGridX === 0 && c.initialGridY === 0 && c.initialGridZ === 1)!;
    expect([Math.abs(center.gridX), Math.abs(center.gridY), Math.abs(center.gridZ)]).toEqual([0, 1, 0]); // -0 vs 0

    const [sticker] = stickerMeshesOf(model, 0, 0, 1);
    const hit = resolveSticker(sticker, {
      x: center.mesh.quaternion.x,
      y: center.mesh.quaternion.y,
      z: center.mesh.quaternion.z,
      w: center.mesh.quaternion.w,
    });
    expect(hit.face).toBe('U');
    expect(hit.axis).toBe('y');
    expect(hit.layerValue).toBe(1);
  });
});
