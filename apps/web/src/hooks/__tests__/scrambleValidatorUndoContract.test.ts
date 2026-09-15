import { describe, expect, it } from "vitest";
import {
  CubeState,
  FaceletStringConverter,
  OrientationTable,
  SOLVED_FACELETS,
  conjugateTokenThroughGrip,
} from "@cubalyze/math-core";

/**
 * Regression contract for the virtual cube's error→undo flow.
 *
 * The scramble validator is a React hook with no rendering harness in this
 * repo, so this test ports the TWO pieces of its pipeline that the bug
 * depended on — processToken's branch ORDER and the view's facelet push —
 * and pins the contract the bug broke:
 *
 *   1. A legitimate undo (the inverse of the last error) MUST clear the
 *      error EVEN when it lands the validator's math state back on solved.
 *      The math-solved guard (a physical-cube BLE-drift safeguard) used to
 *      run first and silently swallow the undo, leaving the error stuck.
 *   2. The view pushes the CANONICAL solved facelet string when the mirror
 *      is solved-up-to-rotation. Math-core keeps centers FIXED, so a rotated
 *      solved mirror serializes to faces with mismatched center stickers
 *      ("BBBBRBBBB") that fail SOLVED_FACELETS — the canonical string is the
 *      only one both consumers (timer-stop + validator reset) accept.
 */

const MAX_CONSECUTIVE_ERRORS = 5;

function isInverse(a: string, b: string): boolean {
  if (a.length < 1 || b.length < 1) return false;
  if (a[0] !== b[0]) return false;
  const aDir: number = a.endsWith("2") ? 2 : a.endsWith("'") ? -1 : 1;
  const bDir: number = b.endsWith("2") ? 2 : b.endsWith("'") ? -1 : 1;
  if (aDir === 2 && bDir === 2) return true;
  if (aDir === 1 && bDir === -1) return true;
  if (aDir === -1 && bDir === 1) return true;
  return false;
}

interface Sim {
  moves: string[];
  expectedFacelets: string[];
  currentState: CubeState;
  currentIndex: number;
  isError: boolean;
  startedFromSolved: boolean;
  actualMoves: string[];
  consecutiveErrors: number;
  activeErrorMoves: string[];
  needsReset: boolean;
  initialCheckDone: boolean;
}

function fresh(moves: string[]): Sim {
  const temp = new CubeState();
  const expectedFacelets: string[] = [];
  for (const m of moves) {
    temp.applySequence(m);
    expectedFacelets.push(FaceletStringConverter.toFaceletString(temp));
  }
  return {
    moves,
    expectedFacelets,
    currentState: new CubeState(),
    currentIndex: 0,
    isError: false,
    startedFromSolved: true,
    actualMoves: [],
    consecutiveErrors: 0,
    activeErrorMoves: [],
    needsReset: false,
    initialCheckDone: true, // mount facelet already consumed
  };
}

function resetRef(s: Sim): void {
  s.currentState = new CubeState();
  s.currentIndex = 0;
  s.isError = false;
  s.actualMoves = [];
  s.consecutiveErrors = 0;
  s.activeErrorMoves = [];
  s.needsReset = false;
}

/** handleFacelets — only the branches the virtual cube's canonical-solved
 *  push can hit (isSolved → resetRef). A non-solved facelet at index 0 is
 *  the normal mid-scramble broadcast and MUST NOT downgrade startedFromSolved
 *  (the regression below pins that isScrambled can still fire afterwards). */
function handleFacelets(s: Sim, f: string): void {
  const isSolved = SOLVED_FACELETS.test(f);
  if (isSolved) {
    s.startedFromSolved = true;
    if (s.needsReset) {
      resetRef(s);
      return;
    }
    if (s.currentIndex > 0 || s.isError) {
      resetRef(s);
    }
  }
}

/** processToken — branch ORDER is the contract (undo first, guard second). */
function processToken(s: Sim, notation: string): void {
  if (s.needsReset) {
    s.actualMoves.push(notation);
    try { s.currentState.applySequence(notation); } catch { /* skip */ }
    return;
  }
  if (s.moves.length === 0) return;

  try { s.currentState.applySequence(notation); } catch { return; }

  // 1) Undo detection FIRST: the inverse of the last error always pops it,
  //    even when the math state lands back on solved.
  if (
    s.isError &&
    s.activeErrorMoves.length > 0 &&
    isInverse(notation, s.activeErrorMoves[s.activeErrorMoves.length - 1])
  ) {
    s.activeErrorMoves.pop();
    s.consecutiveErrors = Math.max(0, s.consecutiveErrors - 1);
    if (s.activeErrorMoves.length === 0) {
      s.isError = false;
      s.consecutiveErrors = 0;
    }
    return;
  }

  // 2) Math-solved guard (physical BLE-drift safeguard) — only non-undo moves
  //    reach it.
  if (s.isError && s.currentState.isSolved()) {
    return;
  }

  s.actualMoves.push(notation);
  const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);

  const matchedForward = s.expectedFacelets.findIndex(
    (f, i) => i >= s.currentIndex && f === currentFacelets,
  );
  const recoverTo = matchedForward;

  if (recoverTo !== -1) {
    s.currentIndex = recoverTo + 1;
    s.isError = false;
    s.consecutiveErrors = 0;
    s.activeErrorMoves = [];
  } else if (!s.isError) {
    s.isError = true;
    s.consecutiveErrors++;
    s.activeErrorMoves.push(notation);
    if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
  } else {
    s.consecutiveErrors++;
    s.activeErrorMoves.push(notation);
    if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
  }
}

/** The view's mirror (CubeSimulatorView.applyAction): position-frame move on
 *  the CubeState, conjugated token to the validator, and a solved-up-to-
 *  rotation state pushes the CANONICAL solved facelets. */
interface ViewMirror {
  state: CubeState;
  grip: ReturnType<typeof OrientationTable.rotationEntryFor> | typeof OrientationTable.IDENTITY;
}

const SOLVED_CANONICAL = FaceletStringConverter.toFaceletString(new CubeState());

function feed(view: ViewMirror, sim: Sim, positionMove: string): void {
  view.state.applySequence(positionMove);
  const fixed = conjugateTokenThroughGrip(positionMove, view.grip as never);
  processToken(sim, fixed);
  if (view.state.isSolvedUpToRotation()) {
    handleFacelets(sim, SOLVED_CANONICAL);
  }
}

function rotate(view: ViewMirror, axis: string): void {
  view.state.applySequence(axis);
  const entry = OrientationTable.rotationEntryFor(axis);
  if (entry) view.grip = entry;
}

const SCRAMBLE = "U R U' R' U R U' R'";

describe("scramble validator — error → rotate → undo contract", () => {
  it("math-core centers are fixed: a rotated solved mirror fails SOLVED_FACELETS (the bug the canonical push avoids)", () => {
    const rotated = new CubeState();
    rotated.applySequence("y");
    // Corners/edges ARE a rotation of solved…
    expect(rotated.isSolvedUpToRotation()).toBe(true);
    // …but the facelet string has mismatched centers and is NOT 6 runs of 9.
    expect(SOLVED_FACELETS.test(FaceletStringConverter.toFaceletString(rotated))).toBe(false);
  });

  it("U' (mistake at index 0) → rotate y → U: the undo clears the error", () => {
    const sim = fresh(SCRAMBLE.split(" "));
    const view: ViewMirror = { state: new CubeState(), grip: OrientationTable.IDENTITY };

    feed(view, sim, "U'");
    expect(sim.activeErrorMoves).toEqual(["U'"]);
    expect(sim.isError).toBe(true);

    rotate(view, "y");
    expect(view.grip).not.toBe(OrientationTable.IDENTITY);

    feed(view, sim, "U");

    // The undo pops the error — no new error, no stuck error.
    expect(sim.activeErrorMoves).toEqual([]);
    expect(sim.isError).toBe(false);
    expect(sim.currentIndex).toBe(0);

    // The canonical solved facelet push kept startedFromSolved true, so the
    // scramble can still be verified (timer arms on completion).
    expect(sim.startedFromSolved).toBe(true);
  });

  it("the same undo WITHOUT a rotation also clears the error", () => {
    const sim = fresh(SCRAMBLE.split(" "));
    const view: ViewMirror = { state: new CubeState(), grip: OrientationTable.IDENTITY };

    feed(view, sim, "U'");
    feed(view, sim, "U");

    expect(sim.activeErrorMoves).toEqual([]);
    expect(sim.isError).toBe(false);
    expect(sim.startedFromSolved).toBe(true);
  });

  it("after the undo, performing the scramble correctly verifies and arms", () => {
    const sim = fresh(SCRAMBLE.split(" "));
    const view: ViewMirror = { state: new CubeState(), grip: OrientationTable.IDENTITY };

    feed(view, sim, "U'"); // mistake
    feed(view, sim, "U"); // undo → cleared
    expect(sim.isError).toBe(false);

    for (const move of SCRAMBLE.split(" ")) {
      feed(view, sim, move);
    }

    expect(sim.currentIndex).toBe(SCRAMBLE.split(" ").length);
    expect(sim.isError).toBe(false);
    expect(sim.startedFromSolved).toBe(true);
  });

  it("a non-solved facelet at index 0 (first-turn broadcast racing the MOVE) does not poison startedFromSolved", () => {
    const sim = fresh(SCRAMBLE.split(" "));
    // The cube broadcasts a facelet for the first turn BEFORE the MOVE event
    // advances currentIndex. This must not downgrade startedFromSolved —
    // otherwise the clean scramble below absorbs every token yet isScrambled
    // can never fire (the reported "stuck gray / waiting" bug).
    const afterFirstMove = new CubeState();
    afterFirstMove.applySequence("U");
    handleFacelets(sim, FaceletStringConverter.toFaceletString(afterFirstMove));
    expect(sim.startedFromSolved).toBe(true);

    for (const move of SCRAMBLE.split(" ")) {
      processToken(sim, move);
    }

    expect(sim.currentIndex).toBe(SCRAMBLE.split(" ").length);
    expect(sim.isError).toBe(false);
    expect(sim.startedFromSolved).toBe(true);
  });
});
