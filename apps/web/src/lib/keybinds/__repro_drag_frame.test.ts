import { describe, expect, it } from "vitest";
import {
  CubeModel,
  CubeMeshFactory,
  RotationEngine,
  resolveLayerHit,
} from "@cubeforge/cube-3d-engine";
import { resolveDragMove } from "@/utils/cubeDragLayer";
import { OrientationTable } from "@cubeforge/math-core";

/**
 * The critical frame question: after a whole-cube y rotation, what does
 * `pickLayer` (resolveLayerHit) report for a sticker that was originally R?
 *
 * The grip/validator conjugation assumes the DRAG resolves POSITION-frame
 * faces ("the layer at the position the user sees"). If the pick instead
 * reports the ORIGINAL face label (R), then conjugating it AGAIN through the
 * grip would DOUBLE-translate and everything breaks.
 */
describe("drag frame after whole-cube rotation (repro)", () => {
  it("resolveLayerHit reports the POSITION frame face after a y rotation", () => {
    // Solve: build a real 3×3 model, rotate the whole cube by y (via the
    // engine, exactly like the view's rotate action), then resolveLayerHit on
    // a sticker that ORIGINALLY faced R. The engine's whole-cube rotation is
    // y = U-direction (angle = direction * angleSign(U) * 90).
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const engine = new RotationEngine(model);

    // Apply a y rotation exactly like actionToMoves for {axis:'y', direction:1}
    // (FACE_ROTATION_MAP['U'].angleSign — verified in cubeKeybinds.test.ts).
    const U_SIGN = -1; // from FACE_ROTATION_MAP U: J (U) → angle -90
    void engine.rotateLayers("y", [-1, 0, 1], 1 * U_SIGN * 90, 0);
    engine.update(1_000);
    void Promise.resolve();

    // Find the cubie originally at the R position (x=+1) — e.g. the center
    // cubie (1,0,0). Its sticker that pointed +X is now somewhere else.
    const cubies = model.getLogicalState();
    const rCenter = cubies.find(
      (c) => Math.abs(c.initialGridX - 1) < 0.01 && c.initialGridY === 0 && c.initialGridZ === 0,
    );
    expect(rCenter).toBeTruthy();

    // Where did the R-center cubie end up? (grid position after y rotation)
    const grid = [rCenter!.gridX, rCenter!.gridY, rCenter!.gridZ];
    console.log("R-center cubie grid after y:", grid);

    // Simulate the hit: the cubie's mesh-local normal for its original R
    // sticker is +X; rotating by the cubie quaternion gives the current world
    // normal, and resolveLayerHit maps it to a face label.
    const hit = resolveLayerHit({
      meshLocalNormal: { x: 1, y: 0, z: 0 },
      cubieQuaternion: rCenter!.mesh.quaternion,
    });
    console.log("resolveLayerHit face for original-R sticker after y:", hit.face, hit.axis, hit.axisSign);

    // THE ASSERTION: after y, the R face sits at the FRONT position, so the
    // pick must report F (position frame), NOT R (original frame).
    expect(hit.face).toBe("F");
  });
});
