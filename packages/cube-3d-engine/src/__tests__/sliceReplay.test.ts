import { describe, expect, it } from 'vitest';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import { ReplayEngine } from '../replay/ReplayEngine';
import type { CubeMoveEvent } from '@cubeforge/types';

/**
 * P0 — the 3D replay must animate the slice half of wide moves (r → R M',
 * u → U E', f → F S) as real middle-layer turns, so the middle layer is
 * never "frozen" and the cube ends visually solved.
 */

const ev = (face: CubeMoveEvent['face'], direction: 1 | -1 | 2 = 1): CubeMoveEvent => ({
  face,
  direction,
  cubeTimestamp: 0,
  hostTimestamp: 0,
});

describe('slice moves in the 3D replay (P0)', () => {
  it('FACE_ROTATION_MAP animates M/E/S on the middle layer (layerValue 0)', () => {
    expect(FACE_ROTATION_MAP.M).toEqual({ axis: 'x', layerValue: 0, angleSign: 1 });
    expect(FACE_ROTATION_MAP.E).toEqual({ axis: 'y', layerValue: 0, angleSign: 1 });
    expect(FACE_ROTATION_MAP.S).toEqual({ axis: 'z', layerValue: 0, angleSign: -1 });
  });

  it('ReplayEngine maps a slice event to a middle-layer rotation', async () => {
    const applied: { axis: string; layers: number[]; angle: number }[] = [];
    const engine = new ReplayEngine([ev('M')], {
      resetCube: () => {},
      rotateLayers: (axis, layers, angle) => {
        applied.push({ axis, layers, angle });
      },
    });
    expect(engine.moveCount).toBe(1);
    await engine.stepForward();
    expect(applied).toHaveLength(1);
    // M (direction 1) rotates the x-axis middle layer +90° (sign like L).
    expect(applied[0]).toMatchObject({ axis: 'x', layers: [0], angle: 90 });
  });

  it('S and E slice events rotate the correct axis/sign', async () => {
    const applied: { axis: string; layers: number[]; angle: number }[] = [];
    const engine = new ReplayEngine([ev('S'), ev('E', -1)], {
      resetCube: () => {},
      rotateLayers: (axis, layers, angle) => {
        applied.push({ axis, layers, angle });
      },
    });
    await engine.stepForward();
    await engine.stepForward();
    expect(applied).toHaveLength(2);
    expect(applied[0]).toMatchObject({ axis: 'z', layers: [0], angle: -90 });
    expect(applied[1]).toMatchObject({ axis: 'y', layers: [0], angle: -90 });
  });

  it('the six outer faces still map to their own layers (regression)', () => {
    expect(FACE_ROTATION_MAP.U).toMatchObject({ axis: 'y', layerValue: 1 });
    expect(FACE_ROTATION_MAP.D).toMatchObject({ axis: 'y', layerValue: -1 });
    expect(FACE_ROTATION_MAP.R).toMatchObject({ axis: 'x', layerValue: 1 });
    expect(FACE_ROTATION_MAP.L).toMatchObject({ axis: 'x', layerValue: -1 });
    expect(FACE_ROTATION_MAP.F).toMatchObject({ axis: 'z', layerValue: 1 });
    expect(FACE_ROTATION_MAP.B).toMatchObject({ axis: 'z', layerValue: -1 });
  });
});
