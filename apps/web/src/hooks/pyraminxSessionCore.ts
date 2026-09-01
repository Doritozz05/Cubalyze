/**
 * Pure pyraminx session core — framework-agnostic, fully unit-testable.
 *
 * Owns the PyraminxState mirror and the scramble-verification logic the
 * virtual session needs:
 *
 *   • the user performs the WCA scramble move by move; progress advances
 *     while the state matches the expected prefix states (a self-correcting
 *     sequence can catch up), consecutive wrong moves accumulate into
 *     `needsReset` (same contract as the cube's scramble validator)
 *   • `applyScrambleNow` reaches the scrambled state in one step (Scramble
 *     button)
 *   • `isSolved` detects the solved state for the timer stop
 *
 * The React hook (`usePyraminxVirtualSession`) wraps this class with the
 * TimerEngine state machine; the class itself knows nothing about React or
 * timing.
 */
import {
  applyPyraminxSequence,
  isPyraminxSolvedAnyOrientation,
  solvedPyraminx,
  type PyraminxState,
} from "@cubeforge/solver-engine/pyraminx";

/** Too many consecutive wrong scramble moves → the user must reset. */
export const MAX_CONSECUTIVE_MISTAKES = 5;

/** Structural equality for the packed PyraminxState encoding. */
export function pyraminxStatesEqual(a: PyraminxState, b: PyraminxState): boolean {
  return (
    a.edgePerm === b.edgePerm &&
    a.edgeOrient === b.edgeOrient &&
    a.cornerOrient === b.cornerOrient &&
    a.tips === b.tips
  );
}

/**
 * True when `b` undoes `a` on the same vertex+scope (U ↔ U', u ↔ u').
 * Mirror of the cube validator's `isInverse` — a tip turn never undoes a
 * layer turn (different piece), so the case-sensitive base must match.
 */
export function isPyraminxInverse(a: string, b: string): boolean {
  if (a.length < 1 || b.length < 1) return false;
  if (a[0] !== b[0]) return false;
  const aPrime = a.endsWith("'");
  const bPrime = b.endsWith("'");
  return aPrime !== bPrime;
}

export type PyraminxMoveResult =
  /** Scramble phase: the move advanced verification progress. */
  | { kind: "scramble-progress" }
  /** Scramble phase: the move did not match (wrong token / order). */
  | { kind: "scramble-mistake" }
  /** Scramble phase: the move undid the previous wrong move (error popped). */
  | { kind: "scramble-undo" }
  /** Scramble phase: the puzzle returned to SOLVED — verification restarts
   *  from a fresh frame (3×3-parity: the cube validator resets on solved
   *  facelets mid-scramble instead of counting an error). */
  | { kind: "scramble-restart" }
  /** The full scramble is now verified. */
  | { kind: "scramble-complete" }
  /** Solve phase: the move was recorded as a solve move. */
  | { kind: "solve-move" }
  /** Solve phase: the move solved the puzzle (timer should stop). */
  | { kind: "solve-complete" }
  /** Post-solve: the move is ignored. */
  | { kind: "ignored" };

export class PyraminxScrambleTracker {
  readonly expectedTokens: string[];
  private readonly expectedStates: PyraminxState[];

  private state: PyraminxState = solvedPyraminx();
  private progress = 0;
  private mistakes = 0;
  private needsReset = false;
  private scrambled = false;
  private solved = false;
  /** Stack of the consecutive wrong scramble moves (canonical frame), for the
   *  per-move error display — mirror of the cube validator's activeErrorMoves.
   *  Popped by an inverse move (undo), cleared on progress / completion. */
  private errorMoves: string[] = [];

  constructor(scramble: string) {
    this.expectedTokens = scramble.trim().split(/\s+/).filter(Boolean);
    const states: PyraminxState[] = [];
    let s = solvedPyraminx();
    for (const token of this.expectedTokens) {
      s = applyPyraminxSequence(s, token) ?? s;
      states.push(s);
    }
    this.expectedStates = states;
  }

  get currentState(): PyraminxState {
    return this.state;
  }
  get isScrambled(): boolean {
    return this.scrambled;
  }
  get isSolved(): boolean {
    return this.solved;
  }
  get needsResetState(): boolean {
    return this.needsReset;
  }
  get progressCount(): number {
    return this.progress;
  }
  get totalTokens(): number {
    return this.expectedTokens.length;
  }
  get mistakeCount(): number {
    return this.mistakes;
  }
  /** The consecutive wrong-move stack (canonical frame) — for the per-token
   *  scramble error display. Empty when the user is on track. */
  get errorMovesList(): string[] {
    return [...this.errorMoves];
  }
  /** True while at least one wrong move is pending (undone by its inverse). */
  get isError(): boolean {
    return this.errorMoves.length > 0;
  }

  /**
   * Apply one move. The scramble/solve phase is decided by whether the full
   * scramble has already been verified (`isScrambled`).
   */
  applyMove(token: string): PyraminxMoveResult {
    // Post-solve: the user keeps turning but nothing matters anymore.
    if (this.solved) return { kind: "ignored" };

    const next = applyPyraminxSequence(this.state, token) ?? this.state;
    this.state = next;

    // ── STICKY needsReset (cube-validator parity) ──────────────────────
    // Once too many consecutive mistakes fire, the scramble is FORBIDDEN
    // until the puzzle is PHYSICALLY solved in any of the 12 A₄ orientations
    // (the pyraminx analog of the cube validator's SOLVED_FACELETS reset).
    // The state mirror keeps following the moves (the 3D engine stays in
    // sync) but progress is never evaluated; a solved state clears the flag
    // and restarts verification from a fresh solved frame.
    if (this.needsReset) {
      if (isPyraminxSolvedAnyOrientation(this.state)) {
        this.needsReset = false;
        this.progress = 0;
        this.mistakes = 0;
        this.errorMoves = [];
      }
      return { kind: "ignored" };
    }

    // Scramble phase: verify against the expected prefix states.
    if (!this.scrambled) {
      // ── Solved restart (3×3-parity) ──────────────────────────────────
      // If a move returns the puzzle to a SOLVED state mid-scramble (e.g.
      // the user undoes their own first move, or the scramble prefix
      // cancels), the verification restarts from a fresh solved frame —
      // exactly like the cube validator's resetRef on solved facelets. The
      // 3×3 never marks a solved cube as an error, so neither do we.
      if (
        isPyraminxSolvedAnyOrientation(this.state) &&
        (this.progress > 0 || this.errorMoves.length > 0)
      ) {
        this.progress = 0;
        this.mistakes = 0;
        this.errorMoves = [];
        return { kind: "scramble-restart" };
      }

      // ── Inverse-undo (cube-validator parity) ─────────────────────────
      // When the user is in an error state and performs the INVERSE of the
      // last wrong move, pop it instead of pushing a new error — the
      // deterministic undo path (R → R′ clears the error; it never counts
      // as a second mistake and never advances progress).
      if (
        this.errorMoves.length > 0 &&
        isPyraminxInverse(token, this.errorMoves[this.errorMoves.length - 1])
      ) {
        this.errorMoves.pop();
        this.mistakes = Math.max(0, this.mistakes - 1);
        return { kind: "scramble-undo" };
      }

      let p = this.progress;
      while (p < this.expectedStates.length && pyraminxStatesEqual(this.expectedStates[p], next)) {
        p++;
      }
      // NOTE: `advanced` must be captured BEFORE `this.progress = p` — the
      // old code compared p > this.progress AFTER the assignment, so every
      // correct-but-not-final move was misreported as a mistake.
      const advanced = p > this.progress;
      if (advanced) {
        this.progress = p;
        this.mistakes = 0;
        this.errorMoves = [];
      } else {
        this.mistakes++;
        this.errorMoves.push(token);
        if (this.mistakes >= MAX_CONSECUTIVE_MISTAKES) this.needsReset = true;
      }
      if (this.progress >= this.expectedStates.length) {
        this.scrambled = true;
        return { kind: "scramble-complete" };
      }
      return advanced ? { kind: "scramble-progress" } : { kind: "scramble-mistake" };
    }

    // Solve phase: match ANY of the 12 canonical A₄ solved orientations.
    if (isPyraminxSolvedAnyOrientation(this.state)) {
      this.solved = true;
      return { kind: "solve-complete" };
    }
    return { kind: "solve-move" };
  }

  /** Reach the scrambled state in one step (Scramble button). */
  applyScrambleNow(): void {
    let s = solvedPyraminx();
    for (const token of this.expectedTokens) {
      s = applyPyraminxSequence(s, token) ?? s;
    }
    this.state = s;
    this.progress = this.expectedTokens.length;
    this.mistakes = 0;
    this.needsReset = false;
    this.errorMoves = [];
    this.scrambled = true;
  }

  /** Restore the solved state (reset / regenerate). */
  reset(): void {
    this.state = solvedPyraminx();
    this.progress = 0;
    this.mistakes = 0;
    this.needsReset = false;
    this.scrambled = false;
    this.solved = false;
    this.errorMoves = [];
  }

  /** Set internal state directly (testing hook). */
  setStateForTesting(state: PyraminxState, scrambled = true): void {
    this.state = state;
    this.scrambled = scrambled;
    this.solved = isPyraminxSolvedAnyOrientation(state);
  }
}
