/**
 * PyraminxScrambleTracker — pure verification + state mirror tests.
 *
 * The virtual pyraminx session's logic lives here (the React hook only wires
 * the TimerEngine around it), so the full solve lifecycle is testable without
 * any rendering harness:
 *   • performing the WCA scramble advances progress token by token
 *   • wrong moves count as mistakes and can trigger needsReset
 *   • the Scramble button reaches the scrambled state in one step
 *   • the first solve move is collected; the solved move stops the solve
 *   • post-solve moves are ignored
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CONSECUTIVE_MISTAKES,
  PyraminxScrambleTracker,
} from "../pyraminxSessionCore";
import {
  isPyraminxSolved,
  PYRAMINX_SOLVED_STATES,
} from "@cubeforge/solver-engine/pyraminx";

const SCRAMBLE = "U L' B R' u l'";

describe("PyraminxScrambleTracker — scramble verification", () => {
  it("starts physically solved, unscrambled, with the right token count", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    expect(t.totalTokens).toBe(6);
    expect(t.isScrambled).toBe(false);
    expect(t.progressCount).toBe(0);
    // `isSolved` is the "solve completed" flag — false until the solve ends.
    expect(t.isSolved).toBe(false);
    expect(isPyraminxSolved(t.currentState)).toBe(true);
  });

  it("advances progress when the user performs the scramble correctly", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    for (const token of SCRAMBLE.split(" ")) {
      const r = t.applyMove(token);
      expect(r.kind.startsWith("scramble-")).toBe(true);
    }
    expect(t.isScrambled).toBe(true);
    expect(t.progressCount).toBe(6);
    expect(t.mistakeCount).toBe(0);
    // The scramble state is NOT solved (a real scramble).
    expect(isPyraminxSolved(t.currentState)).toBe(false);
  });

  it("the final scramble move reports scramble-complete", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    for (const token of SCRAMBLE.split(" ").slice(0, 5)) t.applyMove(token);
    const r = t.applyMove(SCRAMBLE.split(" ")[5]);
    expect(r).toEqual({ kind: "scramble-complete" });
  });

  it("a wrong move is a mistake and does not advance progress", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyMove("U");
    const r = t.applyMove("U"); // expected L' — wrong
    expect(r).toEqual({ kind: "scramble-mistake" });
    expect(t.progressCount).toBe(1);
    expect(t.mistakeCount).toBe(1);
    expect(t.errorMovesList).toEqual(["U"]);
    expect(t.isError).toBe(true);
  });

  it("an inverse move undoes the last wrong move (cube-validator parity)", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyMove("U"); // progress 1
    t.applyMove("L"); // wrong (expected L') → error stack ["L"]
    expect(t.errorMovesList).toEqual(["L"]);
    expect(t.mistakeCount).toBe(1);
    const r = t.applyMove("L'"); // undo → pops the error, no new mistake
    expect(r).toEqual({ kind: "scramble-undo" });
    expect(t.errorMovesList).toEqual([]);
    expect(t.isError).toBe(false);
    expect(t.mistakeCount).toBe(0);
    expect(t.progressCount).toBe(1); // undo never advances progress
    // The correct move then advances.
    const r2 = t.applyMove("L'");
    expect(r2).toEqual({ kind: "scramble-progress" });
    expect(t.progressCount).toBe(2);
  });

  it("multiple wrong moves stack; only the LAST error can be undone", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyMove("U"); // progress 1
    t.applyMove("B"); // mistake → ["B"]
    t.applyMove("R"); // mistake → ["B", "R"]
    expect(t.errorMovesList).toEqual(["B", "R"]);
    expect(t.isError).toBe(true);
    t.applyMove("B'"); // not the inverse of the last error (R) → push
    expect(t.errorMovesList).toEqual(["B", "R", "B'"]);
    expect(t.mistakeCount).toBe(3);
    t.applyMove("B"); // inverse of the last error → pop
    expect(t.errorMovesList).toEqual(["B", "R"]);
    expect(t.mistakeCount).toBe(2);
  });

  it("recovers progress after a wrong move (self-correcting catch-up)", () => {
    const t = new PyraminxScrambleTracker("U L'");
    t.applyMove("U"); // progress 1
    t.applyMove("L"); // wrong (expected L') → mistake
    expect(t.progressCount).toBe(1);
    // Undoing the wrong move pops the error (cube parity) — no new mistake.
    t.applyMove("L'");
    expect(t.progressCount).toBe(1);
    expect(t.mistakeCount).toBe(0);
    expect(t.errorMovesList).toEqual([]);
    // Repeating the correct move now advances past expected[1].
    t.applyMove("L'");
    expect(t.progressCount).toBe(2);
    expect(t.mistakeCount).toBe(0); // mistakes reset on progress
  });

  it("a move that returns the puzzle to SOLVED restarts the scramble (3×3 parity)", () => {
    const t = new PyraminxScrambleTracker("U L'");
    t.applyMove("U"); // progress 1
    // U' is wrong for the scramble (expected L'), but the puzzle is now
    // physically solved — the 3×3 validator would resetRef on solved
    // facelets instead of flagging an error, so we restart verification.
    const r = t.applyMove("U'");
    expect(r).toEqual({ kind: "scramble-restart" });
    expect(t.progressCount).toBe(0);
    expect(t.mistakeCount).toBe(0);
    expect(t.errorMovesList).toEqual([]);
    expect(t.isScrambled).toBe(false);
    // The scramble can be performed again from scratch.
    t.applyMove("U");
    expect(t.progressCount).toBe(1);
  });

  it("solved mid-error also restarts (no error is kept for a solved puzzle)", () => {
    const t = new PyraminxScrambleTracker("U L' B");
    t.applyMove("U"); // progress 1
    t.applyMove("L"); // mistake → error stack ["L"], state U·L
    expect(t.errorMovesList).toEqual(["L"]);
    t.applyMove("B'"); // not the inverse of L → stack grows
    expect(t.errorMovesList).toEqual(["L", "B'"]);
    // Undo BOTH errors in LIFO order (B undoes B', then L' undoes L).
    const r1 = t.applyMove("B"); // inverse of the last (B') → pop
    expect(r1).toEqual({ kind: "scramble-undo" });
    expect(t.errorMovesList).toEqual(["L"]);
    const r2 = t.applyMove("L'"); // inverse of the last (L) → pop
    expect(r2).toEqual({ kind: "scramble-undo" });
    expect(t.errorMovesList).toEqual([]);
    expect(t.mistakeCount).toBe(0);
    // State is back at U (progress 1, not solved); U' now solves it.
    const r3 = t.applyMove("U'"); // U·U' = solved → restart
    expect(r3).toEqual({ kind: "scramble-restart" });
    expect(t.progressCount).toBe(0);
    expect(t.mistakeCount).toBe(0);
    expect(t.errorMovesList).toEqual([]);
  });

  it("too many consecutive mistakes sets needsReset", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyMove("U"); // progress 1
    for (let i = 0; i < MAX_CONSECUTIVE_MISTAKES; i++) {
      t.applyMove("B");
    }
    expect(t.needsResetState).toBe(true);
    expect(t.isScrambled).toBe(false);
  });

  it("needsReset is sticky until the puzzle is physically solved, then restarts fresh", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyMove("U"); // progress 1
    // Five mistakes with no adjacent inverse pairs (no undo branch).
    for (const w of ["B", "R", "L", "B'", "R'"]) {
      const r = t.applyMove(w);
      expect(r.kind).toBe("scramble-mistake");
    }
    expect(t.needsResetState).toBe(true);
    expect(t.isScrambled).toBe(false);
    // While needsReset: moves are ignored (never evaluated) but still
    // applied to the state mirror.
    expect(t.applyMove("U").kind).toBe("ignored");
    // Drive the state back to solved with the exact inverse of everything
    // applied so far ([U, B, R, L, B', R', U]). The needsReset phase
    // detects the solved state and restarts verification from a fresh frame.
    for (const tok of ["U'", "R", "B", "L'", "R'", "B'", "U'"]) {
      expect(t.applyMove(tok).kind).toBe("ignored");
    }
    expect(t.needsResetState).toBe(false);
    expect(t.progressCount).toBe(0);
    expect(t.mistakeCount).toBe(0);
    expect(t.errorMovesList).toEqual([]);
  });

  it("applyScrambleNow reaches the scrambled state in one step", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyScrambleNow();
    expect(t.isScrambled).toBe(true);
    expect(t.progressCount).toBe(6);
    expect(t.mistakeCount).toBe(0);
    expect(isPyraminxSolved(t.currentState)).toBe(false);
  });

  it("reset returns to solved and clears mistakes", () => {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyScrambleNow();
    for (let i = 0; i < MAX_CONSECUTIVE_MISTAKES; i++) t.applyMove("B");
    t.reset();
    expect(isPyraminxSolved(t.currentState)).toBe(true);
    expect(t.isScrambled).toBe(false);
    expect(t.needsResetState).toBe(false);
    expect(t.progressCount).toBe(0);
  });
});

describe("PyraminxScrambleTracker — solve phase", () => {
  function solvedTracker(): PyraminxScrambleTracker {
    const t = new PyraminxScrambleTracker(SCRAMBLE);
    t.applyScrambleNow();
    return t;
  }

  it("collects solve moves after the scramble and detects the solved move", () => {
    const t = solvedTracker();
    // The inverse of the scramble solves it.
    const inverse = SCRAMBLE.split(" ")
      .reverse()
      .map((tok) => (tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`));
    let solvedMove: string | null = null;
    for (const token of inverse) {
      const r = t.applyMove(token);
      if (r.kind === "solve-complete") solvedMove = token;
      expect(r.kind === "solve-move" || r.kind === "solve-complete").toBe(true);
    }
    expect(solvedMove).toBe(inverse[inverse.length - 1]);
    expect(t.isSolved).toBe(true);
  });

  it("ignores moves after the solve is complete", () => {
    const t = solvedTracker();
    const inverse = SCRAMBLE.split(" ")
      .reverse()
      .map((tok) => (tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`));
    for (const token of inverse) t.applyMove(token);
    expect(t.isSolved).toBe(true);
    expect(t.applyMove("U")).toEqual({ kind: "ignored" });
  });

  it("solving with the exact scramble reverse ends solved (round trip)", () => {
    const t = solvedTracker();
    const inverse = SCRAMBLE.split(" ")
      .reverse()
      .map((tok) => (tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`));
    for (const token of inverse) t.applyMove(token);
    expect(isPyraminxSolved(t.currentState)).toBe(true);
    expect(t.isSolved).toBe(true);
  });

  it("Phase 3: solves while the puzzle is in ANY of the 12 A₄ states", () => {
    for (let k = 0; k < 12; k++) {
      const t = new PyraminxScrambleTracker(SCRAMBLE);
      t.setStateForTesting(PYRAMINX_SOLVED_STATES[k]);
      expect(t.isSolved).toBe(true);
    }
  });

  it("Phase 3: a single defect in ANY of the 12 A₄ states keeps isSolved === false", () => {
    for (let k = 0; k < 12; k++) {
      const base = PYRAMINX_SOLVED_STATES[k];
      const t = new PyraminxScrambleTracker(SCRAMBLE);

      // Flipped edge defect:
      t.setStateForTesting({ ...base, edgeOrient: base.edgeOrient ^ 1 });
      expect(t.isSolved).toBe(false);

      // Twisted corner defect:
      t.setStateForTesting({ ...base, cornerOrient: (base.cornerOrient + 1) % 81 });
      expect(t.isSolved).toBe(false);

      // Twisted tip defect:
      t.setStateForTesting({ ...base, tips: (base.tips + 1) % 81 });
      expect(t.isSolved).toBe(false);

      // Swapped edges defect:
      t.setStateForTesting({ ...base, edgePerm: (base.edgePerm + 1) % 720 });
      expect(t.isSolved).toBe(false);
    }
  });
});

