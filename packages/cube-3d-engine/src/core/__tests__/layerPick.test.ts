import { describe, expect, it } from 'vitest';
import { resolveLayerHit, swipeTurnDirection, rotateVectorByQuaternion } from '../layerPick';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

describe('resolveLayerHit', () => {
  it('maps a +Z sticker to the F face (layer z=1)', () => {
    const hit = resolveLayerHit({ meshLocalNormal: { x: 0, y: 0, z: 1 }, cubieQuaternion: IDENTITY });
    expect(hit).toMatchObject({
      axis: 'z',
      axisSign: 1,
      layerValue: 1,
      face: 'F',
      axisVector: { x: 0, y: 0, z: 1 },
    });
  });

  it('maps +Y → U, -Y → D, +X → R, -X → L, -Z → B', () => {
    const cases = [
      [{ x: 0, y: 1, z: 0 }, 'U', 'y', 1, 1],
      [{ x: 0, y: -1, z: 0 }, 'D', 'y', -1, -1],
      [{ x: 1, y: 0, z: 0 }, 'R', 'x', 1, 1],
      [{ x: -1, y: 0, z: 0 }, 'L', 'x', -1, -1],
      [{ x: 0, y: 0, z: -1 }, 'B', 'z', -1, -1],
    ] as const;
    for (const [normal, face, axis, layerValue, axisSign] of cases) {
      const hit = resolveLayerHit({ meshLocalNormal: { ...normal }, cubieQuaternion: IDENTITY });
      expect(hit.face).toBe(face);
      expect(hit.axis).toBe(axis);
      expect(hit.layerValue).toBe(layerValue);
      expect(hit.axisSign).toBe(axisSign);
    }
  });

  it('labels faces correctly after a whole-cube x rotation (cubie quaternion 90° around X)', () => {
    // A +Z sticker (was F) rotated 90° around +X now faces -Y → D.
    const q = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });
    // Sanity: the rotated world normal is -Y.
    expect(q.y).toBeCloseTo(-1, 5);

    const hit = resolveLayerHit({
      meshLocalNormal: { x: 0, y: 0, z: 1 },
      cubieQuaternion: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
    });
    expect(hit.face).toBe('D');
    expect(hit.axis).toBe('y');
    expect(hit.layerValue).toBe(-1);
  });
});

describe('swipeTurnDirection', () => {
  // U face: dragging the front-top edge (0,1,1) RIGHTWARD is U' (ccw from above).
  it('U front edge dragged right → -1 (U\')', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 0, y: 1, z: 0 },
      worldPoint: { x: 0, y: 1, z: 1 },
      worldDrag: { x: 1, y: 0, z: 0 },
    });
    expect(dir).toBe(-1);
  });

  it('U front edge dragged left → +1 (U)', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 0, y: 1, z: 0 },
      worldPoint: { x: 0, y: 1, z: 1 },
      worldDrag: { x: -1, y: 0, z: 0 },
    });
    expect(dir).toBe(1);
  });

  // R face: dragging the front edge (1,0,1) DOWN is R' (ccw viewed from the right).
  it('R front edge dragged down → -1 (R\')', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 1, y: 0, z: 0 },
      worldPoint: { x: 1, y: 0, z: 1 },
      worldDrag: { x: 0, y: -1, z: 0 },
    });
    expect(dir).toBe(-1);
  });

  it('R front edge dragged up → +1 (R)', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 1, y: 0, z: 0 },
      worldPoint: { x: 1, y: 0, z: 1 },
      worldDrag: { x: 0, y: 1, z: 0 },
    });
    expect(dir).toBe(1);
  });

  // F face: dragging the top edge (0,1,1) LEFT is F' (ccw viewed from front).
  it('F top edge dragged left → -1 (F\')', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 0, y: 0, z: 1 },
      worldPoint: { x: 0, y: 1, z: 1 },
      worldDrag: { x: -1, y: 0, z: 0 },
    });
    expect(dir).toBe(-1);
  });

  it('F top edge dragged right → +1 (F)', () => {
    const dir = swipeTurnDirection({
      axisVector: { x: 0, y: 0, z: 1 },
      worldPoint: { x: 0, y: 1, z: 1 },
      worldDrag: { x: 1, y: 0, z: 0 },
    });
    expect(dir).toBe(1);
  });
});
