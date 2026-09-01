import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  resolvePyraminxDragMove,
  pyraminxDragToken,
  type PyraminxDragCandidate,
  PYRAMINX_GRIP_QUATERNIONS,
  PYRAMINX_GRIP_MAPS,
  PYRAMINX_VERTEX_POSITIONS,
  pyraminxCornerSlotPosition,
  computePyraminxIsometricBasis,
  displayPyraminxTokenThroughGrip,
} from "@cubeforge/cube-3d-engine";

interface V3 { x: number; y: number; z: number }

function qmul(q: { x: number; y: number; z: number; w: number }, v: V3): V3 {
  const p = new Vector3(v.x, v.y, v.z).applyQuaternion(q as unknown as import("three").Quaternion);
  return { x: p.x, y: p.y, z: p.z };
}

/**
 * WYSIWYG invariant of the pyraminx virtual view — regression guard for the
 * "I turn the middle-right red layer and it says L'" bug.
 *
 * The canonical isometric view places the L vertex at the bottom-RIGHT of
 * the screen and the R vertex at the LEFT (the view is mirrored vs the WCA
 * hold). The grip tables must compensate so the LETTER follows the SCREEN
 * POSITION: dragging the layer you see at the right must display R/R', at
 * the left L/L' — exactly like the cube simulator. These tests drive the
 * REAL drag resolver (resolvePyraminxDragMove) with the REAL camera basis
 * and assert the display the user sees.
 */
describe("pyraminx drag → display WYSIWYG (no mirror)", () => {
  const { forward, right, up } = computePyraminxIsometricBasis();
  const cameraRight: V3 = { x: right.x, y: right.y, z: right.z };
  const cameraUp: V3 = { x: up.x, y: up.y, z: up.z };
  const cameraForward: V3 = { x: forward.x, y: forward.y, z: forward.z };

  /** The canonical vertex sitting at the given screen position for a grip. */
  const vertexAt = (grip: number, pos: "U" | "L" | "R" | "B") =>
    PYRAMINX_GRIP_MAPS[grip][pos];

  /** Drag the corner at `pos` along the given screen direction. */
  const dragCornerAt = (
    grip: number,
    pos: "U" | "L" | "R" | "B",
    dir: V3,
  ): string | null => {
    const canonVertex = vertexAt(grip, pos);
    const gq = PYRAMINX_GRIP_QUATERNIONS[grip];
    const worldPoint = qmul(gq, pyraminxCornerSlotPosition(canonVertex));
    const axes = {
      U: qmul(gq, PYRAMINX_VERTEX_POSITIONS.U),
      L: qmul(gq, PYRAMINX_VERTEX_POSITIONS.L),
      R: qmul(gq, PYRAMINX_VERTEX_POSITIONS.R),
      B: qmul(gq, PYRAMINX_VERTEX_POSITIONS.B),
    };
    const candidates: PyraminxDragCandidate[] = [{ vertex: canonVertex, scope: "layer" }];
    const move = resolvePyraminxDragMove({
      dx: 40 * dir.x,
      dy: 40 * dir.y,
      worldPoint,
      candidates,
      axes,
      cameraRight,
      cameraUp,
    });
    return move ? pyraminxDragToken(move) : null;
  };

  const screenPos = (p: V3): { r: number; u: number } => ({
    r: p.x * right.x + p.y * right.y + p.z * right.z,
    u: p.x * up.x + p.y * up.y + p.z * up.z,
  });

  it("the user's case: dragging the middle-right red layer shows R (not R')", () => {
    // Canonical view (grip 0): the corner at the bottom-right of the screen
    // is the canonical L vertex (its stickers meet at the red B face — the
    // "middle-right red layer"). Dragging it right must DISPLAY the plain R
    // (the layer follows the finger under the clockwise turn — the WCA
    // direction — and the letter matches the screen position).
    const canonAtRight = vertexAt(0, "R");
    expect(canonAtRight).toBe("L");

    // Sanity: it really sits at the bottom-right of the view.
    const gq = PYRAMINX_GRIP_QUATERNIONS[0];
    const s = screenPos(qmul(gq, PYRAMINX_VERTEX_POSITIONS[canonAtRight]));
    expect(s.r).toBeGreaterThan(0.2); // right half
    expect(s.u).toBeLessThan(-0.4); // bottom

    const canonical = dragCornerAt(0, "R", cameraRight);
    expect(canonical).toBe("L"); // the layer under the finger is canonical L
    expect(displayPyraminxTokenThroughGrip(canonical!, 0)).toBe("R"); // the user sees R
  });

  it("every grip: whatever drags resolve, the display matches the screen position", () => {
    const neg = (v: V3): V3 => ({ x: -v.x, y: -v.y, z: -v.z });
    for (let grip = 0; grip < 12; grip++) {
      for (const [pos, re] of [
        ["R", /^R'?$/],
        ["L", /^L'?$/],
      ] as const) {
        let resolved = 0;
        for (const dir of [cameraRight, cameraUp, neg(cameraRight), neg(cameraUp)]) {
          const canonical = dragCornerAt(grip, pos, dir);
          if (!canonical) continue; // ambiguous swipe — the resolver refuses
          resolved++;
          const displayed = displayPyraminxTokenThroughGrip(canonical, grip);
          expect(displayed, `grip ${grip} pos ${pos} resolved ${canonical}`).toMatch(re);
        }
        expect(resolved, `grip ${grip} pos ${pos} should resolve at least one direction`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("every grip: the display letter of a canonical token is its screen position", () => {
    // display(canonical) must name the position where that canonical vertex
    // actually projects — otherwise the scramble text would disagree with
    // what the user sees.
    for (let grip = 0; grip < 12; grip++) {
      const gq = PYRAMINX_GRIP_QUATERNIONS[grip];
      for (const v of ["U", "L", "R", "B"] as const) {
        const s = screenPos(qmul(gq, PYRAMINX_VERTEX_POSITIONS[v]));
        const shown = displayPyraminxTokenThroughGrip(v, grip);
        // The displayed letter must match the region the vertex sits in.
        if (shown === "U") expect(s.u).toBeGreaterThan(0.6);
        else if (shown === "B") {
          // Back = farthest from the camera (max depth along forward).
          const d = qmul(gq, PYRAMINX_VERTEX_POSITIONS[v]);
          const depth = d.x * forward.x + d.y * forward.y + d.z * forward.z;
          void cameraForward;
          const others = (["U", "L", "R", "B"] as const)
            .filter((o) => o !== v)
            .map((o) => {
              const p = qmul(gq, PYRAMINX_VERTEX_POSITIONS[o]);
              return p.x * forward.x + p.y * forward.y + p.z * forward.z;
            });
          expect(depth).toBeGreaterThan(Math.max(...others));
        } else if (shown === "L") {
          const others = (["U", "L", "R", "B"] as const)
            .filter((o) => o !== v && PYRAMINX_GRIP_MAPS[grip].B !== o)
            .map((o) => screenPos(qmul(gq, PYRAMINX_VERTEX_POSITIONS[o])).r);
          expect(s.r).toBeLessThan(Math.min(...others));
        } else {
          const others = (["U", "L", "R", "B"] as const)
            .filter((o) => o !== v && PYRAMINX_GRIP_MAPS[grip].B !== o)
            .map((o) => screenPos(qmul(gq, PYRAMINX_VERTEX_POSITIONS[o])).r);
          expect(s.r).toBeGreaterThan(Math.max(...others));
        }
      }
    }
  });
});
