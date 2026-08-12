import { describe, expect, it } from "vitest";
import {
  CubeState,
  FaceletStringConverter,
  OrientationTable,
} from "@cubeforge/math-core";
import {
  actionToValidatorEvents,
  type CubeKeyAction,
} from "./cubeKeybinds";

/**
 * Reproduce the virtual-cube flow: rotate the cube (grip), then perform
 * scramble moves by feeding the validator events, and check that correct
 * moves advance and WRONG moves produce errors.
 */
function simulateValidator(scramble: string, actions: CubeKeyAction[], grip = OrientationTable.IDENTITY) {
  // ── Validator internals (mirror useScrambleValidator) ────────────────
  const moves = scramble.trim().split(/\s+/).filter(Boolean);
  const expectedFacelets: string[] = [];
  const temp = new CubeState();
  for (const m of moves) {
    temp.applySequence(m);
    expectedFacelets.push(FaceletStringConverter.toFaceletString(temp));
  }

  const currentState = new CubeState();
  let currentIndex = 0;
  let isError = false;
  const activeErrorMoves: string[] = [];

  for (const action of actions) {
    if (action.kind === "rotate") {
      // skip (not moves)
      continue;
    }
    const events = actionToValidatorEvents(action, grip);
    for (const ev of events) {
      const notation = `${ev.face}${ev.direction < 0 ? "'" : ""}`;
      currentState.applySequence(notation);
      const facelets = FaceletStringConverter.toFaceletString(currentState);
      const matched = expectedFacelets.findIndex(
        (f, i) => i >= currentIndex && f === facelets,
      );
      if (matched !== -1) {
        currentIndex = matched + 1;
        isError = false;
      } else if (!isError) {
        isError = true;
        activeErrorMoves.push(notation);
      }
    }
  }
  return { currentIndex, isError, activeErrorMoves };
}

describe("virtual cube validator feed after rotation (repro)", () => {
  const yGrip = OrientationTable.rotationEntryFor("y")!;

  it("correct moves complete the scramble with zero errors", () => {
    // After y, the displayed scramble is F U F' U' (R U R' U' remapped).
    // The user drags the faces they see: F, U, F', U'.
    const actions: CubeKeyAction[] = [
      { kind: "turn", face: "F", direction: 1 },
      { kind: "turn", face: "U", direction: 1 },
      { kind: "turn", face: "F", direction: -1 },
      { kind: "turn", face: "U", direction: -1 },
    ];
    const r = simulateValidator("R U R' U'", actions, yGrip);
    expect(r.activeErrorMoves).toEqual([]);
    expect(r.currentIndex).toBe(4);
    expect(r.isError).toBe(false);
  });

  it("a WRONG move still produces an error", () => {
    // Scramble starts with R (cube-fixed). After y the user should drag the
    // FRONT face (= R). If they instead drag the RIGHT face (= cube-fixed B),
    // an error MUST fire.
    const actions: CubeKeyAction[] = [
      { kind: "turn", face: "R", direction: 1 }, // position R = cube B → WRONG
    ];
    const r = simulateValidator("R U R' U'", actions, yGrip);
    expect(r.activeErrorMoves.length).toBeGreaterThan(0);
    expect(r.isError).toBe(true);
  });

  it("no rotation: a wrong first move produces an error", () => {
    const actions: CubeKeyAction[] = [
      { kind: "turn", face: "U", direction: 1 }, // expected R → WRONG
    ];
    const r = simulateValidator("R U R' U'", actions);
    expect(r.activeErrorMoves.length).toBeGreaterThan(0);
  });
});
