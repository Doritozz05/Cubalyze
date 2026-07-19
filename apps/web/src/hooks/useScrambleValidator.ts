import { useState, useEffect, useRef, useCallback } from 'react';
import { globalCubeAdapter } from '@/components/Hardware/CubeConnector';
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { CubeState, FaceletStringConverter, MoveTransformer, SOLVED_FACELETS } from '@cubeforge/math-core';
import { orientationStore } from '@cubeforge/state';

export type ScrambleMoveState = 'pending' | 'correct' | 'incorrect';

export interface ScrambleValidationResult {
  moves: string[];
  states: ScrambleMoveState[];
  isScrambled: boolean;
  currentIndex: number;
  errorMoves: string[];
  /** Error moves in display notation (orientation-adapted). */
  displayErrorMoves: string[];
  pendingHalfDouble: boolean;
  needsReset: boolean;
  awaitingSolve: boolean;
}

function parseScramble(scramble: string): string[] {
  return scramble.trim().split(/\s+/).filter(Boolean);
}

const MAX_CONSECUTIVE_ERRORS = 3;

function isDoubleMove(token: string): boolean {
  return (
    (token.length === 2 && token[1] === '2') ||
    (token.length === 3 && token.endsWith("2'"))
  );
}

function baseFaceOfDouble(token: string): string | null {
  if (!isDoubleMove(token)) return null;
  return token[0];
}

function baseFaceOfMove(token: string): string | null {
  if (token.length < 1) return null;
  const c = token[0];
  return 'URFDLB'.includes(c) ? c : null;
}

/**
 * Returns true when `b` undoes `a` on the same face.
 * - R  ↔ R'   (CW ↔ CCW)
 * - R2 ↔ R2   (half-turn is its own inverse)
 */
function isInverse(a: string, b: string): boolean {
  if (a.length < 1 || b.length < 1) return false;
  if (a[0] !== b[0]) return false;
  const aDir: number = a.endsWith('2') ? 2 : a.endsWith("'") ? -1 : 1;
  const bDir: number = b.endsWith('2') ? 2 : b.endsWith("'") ? -1 : 1;
  // 2 is its own inverse
  if (aDir === 2 && bDir === 2) return true;
  // 1 ↔ -1
  if (aDir === 1 && bDir === -1) return true;
  if (aDir === -1 && bDir === 1) return true;
  return false;
}

function computeExpected(scramble: string): {
  moves: string[];
  expectedFacelets: string[];
} {
  const moves = parseScramble(scramble);
  const expectedFacelets: string[] = [];
  const tempState = new CubeState();

  for (const m of moves) {
    try {
      tempState.applySequence(m);
      expectedFacelets.push(FaceletStringConverter.toFaceletString(tempState));
    } catch (e) {
      console.warn('Invalid move in scramble:', m, e);
    }
  }

  return { moves, expectedFacelets };
}

interface ValidatorState {
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
  awaitingSolve: boolean;
  initialCheckDone: boolean;
  errorState: CubeState;
  requestFaceletsTimeout: ReturnType<typeof setTimeout> | undefined;
  pendingHalfFace: string | null;
  pendingHalfTokenIndex: number;
}

function freshValidatorState(): ValidatorState {
  return {
    moves: [],
    expectedFacelets: [],
    currentState: new CubeState(),
    currentIndex: 0,
    isError: false,
    startedFromSolved: true,
    actualMoves: [],
    consecutiveErrors: 0,
    activeErrorMoves: [],
    needsReset: false,
    awaitingSolve: false,
    initialCheckDone: false,
    errorState: new CubeState(),
    requestFaceletsTimeout: undefined,
    pendingHalfFace: null,
    pendingHalfTokenIndex: -1,
  };
}

function scheduleFacelets(s: ValidatorState): void {
  clearTimeout(s.requestFaceletsTimeout);
  s.requestFaceletsTimeout = setTimeout(() => {
    if (globalCubeAdapter.isConnected) {
      globalCubeAdapter.requestFacelets().catch(() => {});
    }
  }, 400);
}

function resetRef(s: ValidatorState): void {
  s.currentState = new CubeState();
  s.currentIndex = 0;
  s.isError = false;
  s.actualMoves = [];
  s.consecutiveErrors = 0;
  s.activeErrorMoves = [];
  s.needsReset = false;
  s.errorState = new CubeState();
  s.pendingHalfFace = null;
  s.pendingHalfTokenIndex = -1;
}

const EMPTY_VALIDATION: ScrambleValidationResult = {
  moves: [],
  states: [],
  isScrambled: false,
  currentIndex: 0,
  errorMoves: [],
  displayErrorMoves: [],
  pendingHalfDouble: false,
  needsReset: false,
  awaitingSolve: false,
};

/**
 * Subscribes to the Smart Cube (when paired) and tracks progression through
 * the provided `scramble`. Used to gate the timer start when Scramble
 * Verification is enabled.
 *
 * Pass `enabled = false` to short-circuit completely: the hook returns the
 * empty validation state, no moves$ subscription, no facelets request. This
 * matches Modes 3 & 4 (Scramble Verification OFF) where the user does not
 * want any scramble-related UI or work.
 *
 * @param scramble  The scramble notation. Still generated and persisted even
 *                  when `enabled` is false (so solves keep a record) but is
 *                  not consumed by this hook.
 * @param enabled   Defaults to `true`. When `false`, no work is performed.
 */
export function useScrambleValidator(
  scramble: string,
  enabled: boolean = true,
): ScrambleValidationResult {
  const stateRef = useRef<ValidatorState>(freshValidatorState());

  const [uiState, setUiState] = useState<ScrambleValidationResult>(
    enabled ? {
      moves: [],
      states: [],
      isScrambled: false,
      currentIndex: 0,
      errorMoves: [],
      displayErrorMoves: [],
      pendingHalfDouble: false,
      needsReset: false,
      awaitingSolve: false,
    } : EMPTY_VALIDATION,
  );

  const updateUI = useCallback(() => {
    if (!enabled) return;
    const s = stateRef.current;

    const tokenStates: ScrambleMoveState[] = s.moves.map((_, i) => {
      if (i < s.currentIndex) return 'correct';
      if (i === s.currentIndex && s.isError) return 'incorrect';
      return 'pending';
    });

    const isScrambled =
      s.startedFromSolved &&
      s.currentIndex >= s.expectedFacelets.length &&
      !s.isError &&
      !s.needsReset &&
      !s.awaitingSolve;

    const errorMoves = s.activeErrorMoves;

    // Compute display-notation error moves using current orientation
    const orientation = orientationStore.getState().orientation;
    const displayErrorMoves = errorMoves.map((notation) => {
      const face = notation[0] as CubeFace;
      const dir: CubeMoveDirection =
        notation.endsWith("'") ? -1 : notation.endsWith('2') ? 2 : 1;
      const raw: CubeMoveEvent = { face, direction: dir, cubeTimestamp: 0, hostTimestamp: 0 };
      return MoveTransformer.toDisplayNotation(raw, orientation);
    });

    setUiState({
      moves: s.moves,
      states: tokenStates,
      isScrambled,
      currentIndex: s.currentIndex,
      errorMoves,
      displayErrorMoves,
      pendingHalfDouble: s.pendingHalfFace !== null,
      needsReset: s.needsReset,
      awaitingSolve: s.awaitingSolve,
    });
  }, [enabled]);

  // Recompute expected state whenever the scramble text changes.
  useEffect(() => {
    if (!enabled) {
      setUiState(EMPTY_VALIDATION);
      return;
    }
    const { moves, expectedFacelets } = computeExpected(scramble);
    const ref = freshValidatorState();
    ref.moves = moves;
    ref.expectedFacelets = expectedFacelets;
    stateRef.current = ref;
    updateUI();
    scheduleFacelets(ref);
  }, [scramble, updateUI, enabled]);

  // Subscribe to the Smart Cube while validation is enabled.
  useEffect(() => {
    if (!enabled) return;
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    let faceletCleanup: (() => void) | undefined;

    if (adapter.facelets$) {
      const faceletSub = adapter.facelets$.subscribe((f: string) => {
        handleFacelets(f);
      });
      faceletCleanup = () => faceletSub.unsubscribe();
    } else if (adapter.onFacelets) {
      const originalOnFacelets = adapter.onFacelets;
      adapter.onFacelets = (f: string) => {
        if (originalOnFacelets) originalOnFacelets(f);
        handleFacelets(f);
      };
      faceletCleanup = () => { adapter.onFacelets = originalOnFacelets; };
    }

    function handleFacelets(f: string): void {
      const s = stateRef.current;
      const isSolved = SOLVED_FACELETS.test(f);

      if (!s.initialCheckDone) {
        s.initialCheckDone = true;
        if (isSolved) {
          s.startedFromSolved = true;
          s.awaitingSolve = false;
        } else {
          s.startedFromSolved = false;
          s.awaitingSolve = true;
        }
        updateUI();
        return;
      }

      if (s.awaitingSolve) {
        if (isSolved) {
          s.startedFromSolved = true;
          s.awaitingSolve = false;
          updateUI();
        }
        return;
      }

      if (isSolved) {
        s.startedFromSolved = true;
        if (s.needsReset) {
          resetRef(s);
          updateUI();
          return;
        }
        if (s.currentIndex > 0 || s.isError) {
          resetRef(s);
          updateUI();
        }
      } else if (s.currentIndex === 0 && s.startedFromSolved && s.initialCheckDone) {
        s.startedFromSolved = false;
      }
    }

    const moveSub = adapter.moves$.subscribe((ev: CubeMoveEvent) => {
      const s = stateRef.current;

      const notation = MoveTransformer.moveToNotation(ev.face, ev.direction);

      if (s.needsReset) {
        s.actualMoves.push(notation);
        try { s.errorState.applySequence(notation); } catch { /* skip */ }

        // Allow undoing errors when in needsReset. Pop from the active
        // error stack so the user can recover deterministically.
        if (s.activeErrorMoves.length > 0 && isInverse(notation, s.activeErrorMoves[s.activeErrorMoves.length - 1])) {
          s.activeErrorMoves.pop();
          s.consecutiveErrors = Math.max(0, s.consecutiveErrors - 1);
          if (s.activeErrorMoves.length === 0) {
            // All errors undone — exit needsReset back to the pre-error state.
            s.isError = false;
            s.consecutiveErrors = 0;
            s.needsReset = false;
          }
        } else {
          s.activeErrorMoves.push(notation);
        }

        scheduleFacelets(s);
        if (s.errorState.isSolved()) {
          resetRef(s);
        }
        updateUI();
        return;
      }

      if (s.moves.length === 0) return;

      if (s.currentIndex >= s.expectedFacelets.length && !s.isError) return;

      if (s.awaitingSolve) {
        scheduleFacelets(s);
        return;
      }

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
          if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
          scheduleFacelets(s);
          updateUI();
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
          if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
          scheduleFacelets(s);
        }
        updateUI();
        return;
      }

      try { s.currentState.applySequence(notation); } catch { return; }
      s.actualMoves.push(notation);

      if (s.isError && s.currentState.isSolved()) {
        resetRef(s);
        updateUI();
        return;
      }

      const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);

      if (expectedToken && isDoubleMove(expectedToken)) {
        const baseFace = baseFaceOfDouble(expectedToken);
        const inputFace = baseFaceOfMove(notation);
        if (baseFace !== inputFace) {
          s.isError = true;
          s.consecutiveErrors++;
          s.activeErrorMoves.push(notation);
          if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
          scheduleFacelets(s);
          updateUI();
          return;
        }

        s.pendingHalfFace = baseFace;
        s.pendingHalfTokenIndex = s.currentIndex;
        s.isError = false;
        s.consecutiveErrors = 0;
        s.activeErrorMoves = [];
        updateUI();
        return;
      }

      // ── Error recovery: inverse-move detection (stack-based) ──────
      // When the user is in an error state and performs the INVERSE of
      // the last active error movement, pop from the stack instead of
      // pushing a new error. This is the deterministic undo path — it
      // handles `currentIndex === 0` (where matchedBackward can never
      // find a match because `i < 0` is empty) and multi-step undo
      // (R → B → B′ → R′).
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
        updateUI();
        return;
      }

      // ── Facelet-based recovery (the existing safety net) ───────────
      const matchedForward = s.expectedFacelets.findIndex(
        (f, i) => i >= s.currentIndex && f === currentFacelets
      );
      const matchedBackward = s.isError
        ? s.expectedFacelets.findIndex(
            (f, i) => i < s.currentIndex && f === currentFacelets
          )
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
        // Only push a NEW error — skip if we already handled an undo above.
        s.isError = true;
        s.consecutiveErrors++;
        s.activeErrorMoves.push(notation);
        if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
        scheduleFacelets(s);
      } else {
        // Already in error and the move is not an inverse — new error.
        s.consecutiveErrors++;
        s.activeErrorMoves.push(notation);
        if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
        scheduleFacelets(s);
      }

      updateUI();
    });

    return () => {
      moveSub.unsubscribe();
      faceletCleanup?.();
      clearTimeout(stateRef.current.requestFaceletsTimeout);
    };
  }, [updateUI, enabled]);

  return uiState;
}
