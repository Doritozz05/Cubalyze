import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CubeModel } from '../core/CubeModel';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { RotationEngine } from '../animation/RotationEngine';

/** Build a 3×3 model + engine (pure scene-graph math — no WebGL needed). */
function build() {
  const model = new CubeModel(new CubeMeshFactory(), 3);
  const engine = new RotationEngine(model);
  return { model, engine };
}

/** Find the cubie whose current world position sits at (x, y, z). */
function cubieAt(model: CubeModel, x: number, y: number, z: number) {
  return model
    .getAllCubies()
    .find((g) => {
      const p = g.getWorldPosition(new Vector3());
      return Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01 && Math.abs(p.z - z) < 0.01;
    });
}

describe('RotationEngine live twist (drag-to-turn)', () => {
  it('beginTwist detaches the layer and setTwistAngle rotates it around the axis', () => {
    const { model, engine } = build();

    expect(engine.beginTwist('z', [1])).toBe(true);

    // The URF cubie (world 1,1,1) rotated +45° around +Z: (x,y) → (x cosθ - y sinθ, x sinθ + y cosθ).
    engine.setTwistAngle(45);
    const moved = cubieAt(model, 0, Math.SQRT2, 1);
    expect(moved).toBeTruthy();
    const p = moved!.getWorldPosition(new Vector3());
    expect(p.x).toBeCloseTo(0, 4);
    expect(p.y).toBeCloseTo(Math.SQRT2, 4);
    expect(p.z).toBeCloseTo(1, 4);

    // The URF cubie left its home position while twisting.
    expect(cubieAt(model, 1, 1, 1)).toBeFalsy();
  });

  it('finishTwist(90) commits the turn and applies the logical grid update', async () => {
    const { model, engine } = build();

    const urf = model.getLogicalState().find(
      (c) => c.initialGridX === 1 && c.initialGridY === 1 && c.initialGridZ === 1,
    )!;
    const ufl = model.getLogicalState().find(
      (c) => c.initialGridX === -1 && c.initialGridY === 1 && c.initialGridZ === 1,
    )!;

    engine.beginTwist('z', [1]);
    engine.setTwistAngle(30);

    // Duration 0 → the next update() snap applies the commit immediately.
    const done = engine.finishTwist(90, 0);
    engine.update(10_000);
    await done;

    // URF (1,1,1) under a +90° z-turn → (-1,1,1). The logical grid must match
    // the visual pivot rotation exactly.
    expect([urf.gridX, urf.gridY, urf.gridZ]).toEqual([-1, 1, 1]);
    expect([ufl.gridX, ufl.gridY, ufl.gridZ]).toEqual([-1, -1, 1]);

    // The mesh snapped onto the logical grid (no float drift).
    const p = urf.mesh.getWorldPosition(new Vector3());
    expect(p.x).toBeCloseTo(-1, 5);
    expect(p.y).toBeCloseTo(1, 5);
  });

  it('finishTwist(0) springs back with NO logical change', async () => {
    const { model, engine } = build();

    engine.beginTwist('z', [1]);
    engine.setTwistAngle(-60);
    const done = engine.finishTwist(0, 0);
    engine.update(10_000);
    await done;

    // Every cubie back at its solved grid position.
    expect(cubieAt(model, 1, 1, 1)).toBeTruthy();
    expect(cubieAt(model, 1, -1, 1)).toBeTruthy();
    expect(cubieAt(model, 0, 0, 1)).toBeTruthy();
  });

  it('rejects a second live twist while one is active', () => {
    const { engine } = build();
    expect(engine.beginTwist('z', [1])).toBe(true);
    expect(engine.beginTwist('x', [1])).toBe(false);
  });

  it('beginTwist snaps a colliding timed rotation first (no double-rotation)', async () => {
    const { model, engine } = build();

    // Start an animated rotation of the F layer (z=1)…
    const rot = engine.rotateLayers('z', [1], 90, 60, 0, 'linear');
    // …and grab the SAME layer before it finishes. The live twist must win by
    // snapping the animation, never double-rotating on top of it.
    expect(engine.beginTwist('z', [1])).toBe(true);
    await rot;

    // The timed rotation was snapped to completion (first +90°) and the live
    // twist committed its own +90° on top → URF travels 180° total. The two
    // turns are INDEPENDENT gestures, exactly like a keyboard R followed by a
    // physical drag of the same layer (R2). No cubie is ever double-rotated
    // by a single gesture.
    const urf = model.getLogicalState().find(
      (c) => c.initialGridX === 1 && c.initialGridY === 1 && c.initialGridZ === 1,
    )!;
    const done = engine.finishTwist(90, 0);
    engine.update(20_000);
    await done;
    expect([urf.gridX, urf.gridY, urf.gridZ]).toEqual([-1, -1, 1]);
  });
});
