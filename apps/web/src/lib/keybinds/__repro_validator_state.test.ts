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
 * Faithful copy of useScrambleValidator's move-handling state machine
 * (the parts that matter for error registration), driven by the SAME
 * `actionToValidatorEvents` feed the view uses. Goal: reproduce the exact
 * scenario "rotate y → perform scramble moves → wrong move" and check that
 * `activeErrorMoves` gets populated.
 */
function createValidator(scramble: string) {
  const moves = scramble.trim().split(/\s+/).filter(Boolean);
  const expectedFacelets: string[] = [];
  const temp = new CubeState();
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
    actualMoves: [] as string[],
    consecutiveErrors: 0,
    activeErrorMoves: [] as string[],
    needsReset: false,
    scrambleCompleted: false,
    awaitingSolve: false,
    startedFromSolved: true,
    pendingHalfFace: null as string | null,
    pendingHalfTokenIndex: -1,
  };
}

function baseFaceOfMove(token: string): string | null {
  if (token.length < 1) return null;
  const c = token[0];
  return "URFDLB".includes(c) ? c : null;
}

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

function handleMove(s: ReturnType<typeof createValidator>, face: string, direction: 1 | -1) {
  const notation = `${face}${direction < 0 ? "'" : ""}`;

  if (s.needsReset) {
    s.actualMoves.push(notation);
    try { s.currentState.applySequence(notation); } catch { /* skip */ }
    return;
  }
  if (s.moves.length === 0) return;
  if (s.scrambleCompleted && !s.needsReset) return;
  if (s.awaitingSolve) return;

  const expectedToken = s.moves[s.currentIndex];

  if (s.pendingHalfFace !== null) {
    const tokenIdx = s.pendingHalfTokenIndex;
    const inputFace = baseFaceOfMove(notation);
    if (inputFace !== s.pendingHalfFace) {
      s.actualMoves.push(notation);
      try { s.currentState.applySequence(notation); } catch { /* skip */ }
      s.isError = true;
      s.consecutiveErrors++;
      s.activeErrorMoves.push(notation);
      s.pendingHalfFace = null;
      s.pendingHalfTokenIndex = -1;
      if (s.consecutiveErrors >= 5) s.needsReset = true;
      return;
    }
    try { s.currentState.applySequence(notation); } catch { return; }
    s.actualMoves.push(notation);
    const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);
    const expected = s.expectedFacelets[tokenIdx];
    if (currentFacelets === expected) {
      s.currentIndex = tokenIdx + 1;
      s.isError = false;
      s.consecutiveErrors = 0;
      s.activeErrorMoves = [];
      s.pendingHalfFace = null;
      s.pendingHalfTokenIndex = -1;
    } else {
      s.isError = true;
      s.consecutiveErrors++;
      s.activeErrorMoves.push(notation);
      s.pendingHalfFace = null;
      s.pendingHalfTokenIndex = -1;
      if (s.consecutiveErrors >= 5) s.needsReset = true;
    }
    return;
  }

  try { s.currentState.applySequence(notation); } catch { return; }
  if (s.isError && s.currentState.isSolved()) return;

  s.actualMoves.push(notation);
  const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);

  // double-move handling (skip; scramble has no doubles in repro)

  // inverse recovery
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

  // facelet-based recovery
  const matchedForward = s.expectedFacelets.findIndex(
    (f, i) => i >= s.currentIndex && f === currentFacelets,
  );
  const matchedBackward = s.isError
    ? s.expectedFacelets.findIndex((f, i) => i < s.currentIndex && f === currentFacelets)
    : -1;
  const recoverTo =
    s.isError && matchedBackward !== -1
      ? matchedBackward
      : matchedForward !== -1
        ? matchedForward
        : matchedBackward;

  if (recoverTo !== -1) {
    s.currentIndex = recoverTo + 1;
    s.isError = false;
    s.consecutiveErrors = 0;
    s.activeErrorMoves = [];
    s.pendingHalfFace = null;
    s.pendingHalfTokenIndex = -1;
  } else if (!s.isError) {
    s.isError = true;
    s.consecutiveErrors++;
    s.activeErrorMoves.push(notation);
    if (s.consecutiveErrors >= 5) s.needsReset = true;
  } else {
    s.consecutiveErrors++;
    s.activeErrorMoves.push(notation);
    if (s.consecutiveErrors >= 5) s.needsReset = true;
  }
}

describe("REAL validator state machine after rotation (repro)", () => {
  const yGrip = OrientationTable.rotationEntryFor("y")!;

  it("registers an error when a wrong move follows a correct one", () => {
    const s = createValidator("R U R' U'");
    // Correct first move: after y, drag the FRONT face = cube-fixed R.
    for (const ev of actionToValidatorEvents({ kind: "turn", face: "F", direction: 1 }, yGrip)) {
      handleMove(s, ev.face, ev.direction);
    }
    expect(s.activeErrorMoves).toEqual([]);
    expect(s.currentIndex).toBe(1);

    // WRONG second move: user drags the TOP face (cube-fixed U) instead of
    // the expected U? No — second expected token IS U. Drag the RIGHT face
    // (position R = cube-fixed B) → wrong for U.
    for (const ev of actionToValidatorEvents({ kind: "turn", face: "R", direction: 1 }, yGrip)) {
      handleMove(s, ev.face, ev.direction);
    }
    expect(s.activeErrorMoves.length).toBeGreaterThan(0);
    expect(s.activeErrorMoves).toEqual(["B"]);
  });

  it("registers an error with the IDENTITY grip (baseline)", () => {
    const s = createValidator("R U R' U'");
    for (const ev of actionToValidatorEvents({ kind: "turn", face: "U", direction: 1 }, OrientationTable.IDENTITY)) {
      handleMove(s, ev.face, ev.direction);
    }
    expect(s.activeErrorMoves.length).toBeGreaterThan(0);
  });

  it("wrong move directly at start after y rotation registers an error", () => {
    const s = createValidator("R U R' U'");
    // Scramble starts with R (cube-fixed). After y, user drags the LEFT face
    // (position L = cube-fixed F) → wrong.
    for (const ev of actionToValidatorEvents({ kind: "turn", face: "L", direction: 1 }, yGrip)) {
      handleMove(s, ev.face, ev.direction);
    }
    expect(s.activeErrorMoves.length).toBeGreaterThan(0);
    expect(s.activeErrorMoves[0]).toBe("F");
  });
});
