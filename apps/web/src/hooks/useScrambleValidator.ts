import { useState, useEffect, useRef, useCallback } from 'react';
import type { Observable } from 'rxjs';
import { globalCubeAdapter } from '@/components/Hardware/CubeConnector';
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { CubeState, FaceletStringConverter, MoveTransformer, SOLVED_FACELETS } from '@cubeforge/math-core';
import { orientationStore } from '@cubeforge/state';

/**
 * The minimal adapter surface the scramble validator consumes. The real
 * Smart Cube (globalCubeAdapter) satisfies it, and the virtual cube drives
 * an equivalent adapter so the EXACT same validation logic powers both the
 * physical timer and the Cube tab.
 */
export interface ScrambleValidationAdapter {
  isConnected: boolean;
  moves$: Observable<CubeMoveEvent>;
  facelets$?: Observable<string> | null;
  onFacelets?: ((facelets: string) => void) | null;
  requestFacelets?: () => Promise<void>;
}

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

const MAX_CONSECUTIVE_ERRORS = 5;

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
  /** Once the scramble is fully verified, this stays true until the
   *  scramble text changes. It locks the validator into a "post-scramble"
   *  mode where solve moves and post-solve random moves are ignored so
   *  the UI doesn't show errors once the user's job is done. */
  scrambleCompleted: boolean;
  awaitingSolve: boolean;
  initialCheckDone: boolean;
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
    scrambleCompleted: false,
    awaitingSolve: false,
    initialCheckDone: false,
    requestFaceletsTimeout: undefined,
    pendingHalfFace: null,
    pendingHalfTokenIndex: -1,
  };
}

function scheduleFacelets(s: ValidatorState, adapter: ScrambleValidationAdapter): void {
  clearTimeout(s.requestFaceletsTimeout);
  s.requestFaceletsTimeout = setTimeout(() => {
    if (adapter.isConnected) {
      adapter.requestFacelets?.().catch(() => {});
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
  // NOTE: scrambleCompleted is intentionally NOT reset here. It
  // persists across resetRef so that after a full solve the validator
  // stays in "post-scramble" mode and stops tracking moves. It is
  // only reset when the scramble text changes (via freshValidatorState).
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
  adapter: ScrambleValidationAdapter = globalCubeAdapter,
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

    // Lock the validator into post-scramble mode once the scramble has
    // been fully verified. This flag STAYS true through resetRef and
    // is only cleared when a new scramble is generated (freshValidatorState
    // resets it to false). This is what makes the validator deterministic
    // post-solve: solve moves and random post-solve moves no longer
    // trigger spurious error UI.
    if (isScrambled && !s.scrambleCompleted) {
      s.scrambleCompleted = true;
    }

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
    scheduleFacelets(ref, adapter);
  }, [scramble, updateUI, enabled, adapter]);

  // Subscribe to the move/facelet stream while validation is enabled.
  useEffect(() => {
    if (!enabled) return;
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
        if (s.currentIndex > 0 || s.actualMoves.length > 0) {
          s.startedFromSolved = true;
          s.awaitingSolve = false;
        } else if (isSolved) {
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

      // ── Facelet sync: handle whole-cube rotations ──────────────────
      // Whole-cube rotations (x, y, z) change the facelet string but do
      // NOT emit MOVE events. This causes currentState (accumulated from
      // moves only) to desync from the real cube. After a rotation,
      // subsequent move validation would fail because the base state is
      // wrong.
      //
      // Fix: when facelets diverge from currentState AND we're in the
      // middle of a scramble, find the real facelet state in
      // expectedFacelets and sync both currentState and currentIndex.
      if (
        s.startedFromSolved &&
        !s.needsReset &&
        !s.scrambleCompleted &&
        !isSolved &&
        s.moves.length > 0 &&
        s.currentIndex > 0 &&
        s.currentIndex < s.moves.length
      ) {
        const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);
        if (f !== currentFacelets) {
          const matchedIdx = s.expectedFacelets.findIndex((ef) => ef === f);
          if (matchedIdx !== -1) {
            try {
              const realState = FaceletStringConverter.fromFaceletString(f);
              s.currentState = realState;
              s.currentIndex = matchedIdx + 1;
              s.isError = false;
              s.consecutiveErrors = 0;
              s.activeErrorMoves = [];
              s.pendingHalfFace = null;
              s.pendingHalfTokenIndex = -1;
              updateUI();
            } catch {
              // Parse error — let move handler deal with it
            }
          }
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
      if (!s.initialCheckDone && !s.awaitingSolve) {
        s.initialCheckDone = true;
      }

      const notation = MoveTransformer.moveToNotation(ev.face, ev.direction);

      if (s.needsReset) {
        // ── STICKY needsReset — 100% DETERMINISTIC ─────────────
        // Once too many errors fire, the scramble is FORBIDDEN until
        // the cube is PHYSICALLY solved (verified by the SOLVED_FACELETS
        // regex on a facelets event in handleFacelets).
        //
        // We deliberately do NOT use any in-memory CubeState math to
        // decide "cube is solved":
        //   - A previous implementation tracked `errorState` and only
        //     applied needsReset-phase moves to it (skipping the moves
        //     made BEFORE needsReset was triggered). That meant
        //     `errorState.isSolved()` could return true after an
        //     identity sequence even when the physical cube was at a
        //     completely scrambled state. The buggy resetRef then put
        //     the validator back into a position-0 frame and the next
        //     user move advanced currentIndex via a false-positive
        //     facelet match — scramble reappeared at "position one"
        //     with the cube still disordered. THIS IS THE BUG.
        //
        // The ONLY reliable source of truth is the absolute cube
        // snapshot delivered by the hardware via `facelets$`. The
        // scheduleFacelets() below triggers that snapshot request;
        // when SOLVED_FACELETS.test(f) returns true (in handleFacelets),
        // resetRef fires and we're out. Until then, the UI shows the
        // "Too many mistakes" message and nothing else.
        //
        // We still apply the notation to currentState so the math
        // state stays in sync with the cube (in case any future code
        // relies on it). But we never use currentState.isSolved() as
        // a trigger either — only facelets can confirm solved.
        s.actualMoves.push(notation);
        try { s.currentState.applySequence(notation); } catch { /* skip */ }
        scheduleFacelets(s, adapter);
        updateUI();
        return;
      }

      if (s.moves.length === 0) return;

      // Once the scramble is verified complete, the validator's job is
      // done. Don't fire errors on random post-solve moves. needsReset is
      // prioritized: if the cube state somehow got into a "too many
      // errors" condition during/after solving, that path still handles it.
      if (s.scrambleCompleted && !s.needsReset) return;

      if (s.awaitingSolve) {
        scheduleFacelets(s, adapter);
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
          scheduleFacelets(s, adapter);
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
          scheduleFacelets(s, adapter);
        }
        updateUI();
        return;
      }

      try { s.currentState.applySequence(notation); } catch { return; }

      // DO NOT trust math state to decide whether the cube is solved.
      // currentState.isSolved() can drift from the real cube if BLE
      // events are lost/duplicated. The single source of truth is the
      // absolute facelets snapshot delivered by hardware and gated by
      // SOLVED_FACELETS regex in handleFacelets. When math hints at
      // solved and we're in error mode, drop the move SILENTLY (no
      // error bookkeeping, no reset, NOT pushed to actualMoves) and
      // rely on handleFacelets to fire resetRef when the next facelets
      // event confirms solved. This prevents a math-drift false-positive
      // from polluting the error stack or triggering a spurious
      // needsReset escalation.
      if (s.isError && s.currentState.isSolved()) {
        scheduleFacelets(s, adapter);
        return;
      }

      s.actualMoves.push(notation);

      const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);

      // ── Double-move handling ──────────────────────────────────────
      // IMPORTANT: skip if already in error so inverse detection can run first.
      // Otherwise, when the expected token is a double move (e.g. D2) but the
      // user is on a different face trying to undo (R'), the double-move handler
      // intercepts the move as a "wrong face" error and appends it — the inverse
      // detection code (below) is never reached, and the error stack grows
      // instead of shrinking. Bug scenario: D ✓ R ✓ R (mistake) R' (no undo).
      if (expectedToken && isDoubleMove(expectedToken) && !s.isError) {
        const baseFace = baseFaceOfDouble(expectedToken);
        const inputFace = baseFaceOfMove(notation);
        if (baseFace !== inputFace) {
          s.isError = true;
          s.consecutiveErrors++;
          s.activeErrorMoves.push(notation);
          if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
          scheduleFacelets(s, adapter);
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
        scheduleFacelets(s, adapter);
      } else {
        // Already in error and the move is not an inverse — new error.
        s.consecutiveErrors++;
        s.activeErrorMoves.push(notation);
        if (s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) s.needsReset = true;
        scheduleFacelets(s, adapter);
      }

      updateUI();
    });

    return () => {
      moveSub.unsubscribe();
      faceletCleanup?.();
      clearTimeout(stateRef.current.requestFaceletsTimeout);
    };
  }, [updateUI, enabled, adapter]);

  return uiState;
}
