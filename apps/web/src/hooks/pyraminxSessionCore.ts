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

export type PyraminxMoveResult =
  /** Scramble phase: the move advanced verification progress. */
  | { kind: "scramble-progress" }
  /** Scramble phase: the move did not match (wrong token / order). */
  | { kind: "scramble-mistake" }
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

  /**
   * Apply one move. The scramble/solve phase is decided by whether the full
   * scramble has already been verified (`isScrambled`).
   */
  applyMove(token: string): PyraminxMoveResult {
    // Post-solve: the user keeps turning but nothing matters anymore.
    if (this.solved) return { kind: "ignored" };

    const next = applyPyraminxSequence(this.state, token) ?? this.state;
    this.state = next;

    // Scramble phase: verify against the expected prefix states.
    if (!this.scrambled) {
      let p = this.progress;
      while (p < this.expectedStates.length && pyraminxStatesEqual(this.expectedStates[p], next)) {
        p++;
      }
      if (p > this.progress) {
        this.progress = p;
        this.mistakes = 0;
      } else {
        this.mistakes++;
        if (this.mistakes >= MAX_CONSECUTIVE_MISTAKES) this.needsReset = true;
      }
      if (this.progress >= this.expectedStates.length) {
        this.scrambled = true;
        return { kind: "scramble-complete" };
      }
      return p > this.progress ? { kind: "scramble-progress" } : { kind: "scramble-mistake" };
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
  }

  /** Set internal state directly (testing hook). */
  setStateForTesting(state: PyraminxState, scrambled = true): void {
    this.state = state;
    this.scrambled = scrambled;
    this.solved = isPyraminxSolvedAnyOrientation(state);
  }
}
