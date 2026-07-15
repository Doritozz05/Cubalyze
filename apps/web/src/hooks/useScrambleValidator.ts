import { useState, useEffect, useRef, useCallback } from 'react';
import { globalCubeAdapter } from '@/components/Hardware/CubeConnector';
import type { CubeMoveEvent } from '@cubeforge/types';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';

export type ScrambleMoveState = 'pending' | 'correct' | 'incorrect';

export interface ScrambleValidationResult {
  moves: string[];
  states: ScrambleMoveState[];
  isScrambled: boolean;
  currentIndex: number;
  errorMoves: string[];
  pendingHalfDouble: boolean;
  needsReset: boolean;
}

function parseScramble(scramble: string): string[] {
  return scramble.trim().split(/\s+/).filter(Boolean);
}

const MAX_CONSECUTIVE_ERRORS = 3;
const SOLVED_FACELETS = /^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/;

// ── Expected-facelet pre-computation ─────────────────────────────────────
// Each token may produce 1 or 2 facelet entries (half-turn produces both).
//   moves[]             – token list, e.g. ["R", "U2"]
//   expectedFacelets[]  – facelet string at each step
//   faceletToTokenMap[] – maps each expectedFacelets entry → token index
//
// Example: "R U2"
//   expectedFacelets: [after R, after R+U (half of U2), after R+U2]
//   faceletToTokenMap: [0(R), 1(U half), 1(U2 full)]
//   currentIndex tracks consumed entries (1-based count):
//     0 = none, 1 = after R done, 2 = after R+U done, 3 = all done
function computeExpected(scramble: string): {
  moves: string[];
  expectedFacelets: string[];
  faceletToTokenMap: number[];
} {
  const moves = parseScramble(scramble);
  const expectedFacelets: string[] = [];
  const faceletToTokenMap: number[] = [];
  const tempState = new CubeState();

  for (let ti = 0; ti < moves.length; ti++) {
    const m = moves[ti];
    try {
      if (m.includes('2')) {
        const half = m.replace('2', '');
        if (half) {
          tempState.applySequence(half);
          expectedFacelets.push(FaceletStringConverter.toFaceletString(tempState));
          faceletToTokenMap.push(ti);
          // Undo half-move so full move is applied from correct state
          tempState.applySequence(half + "'");
        }
      }
      tempState.applySequence(m);
      expectedFacelets.push(FaceletStringConverter.toFaceletString(tempState));
      faceletToTokenMap.push(ti);
    } catch (e) {
      console.warn("Invalid move in scramble:", m, e);
    }
  }

  return { moves, expectedFacelets, faceletToTokenMap };
}

// ── Mutable ref state (never triggers re-render) ─────────────────────────
interface ValidatorState {
  moves: string[];
  expectedFacelets: string[];
  faceletToTokenMap: number[];
  currentState: CubeState;
  currentIndex: number;      // 1-based count of consumed facelet entries
  isError: boolean;
  startedFromSolved: boolean;
  actualMoves: string[];
  consecutiveErrors: number;
  errorStartIndex: number;
  needsReset: boolean;
  errorState: CubeState;
  requestFaceletsTimeout: ReturnType<typeof setTimeout> | undefined;
}

function freshValidatorState(): ValidatorState {
  return {
    moves: [],
    expectedFacelets: [],
    faceletToTokenMap: [],
    currentState: new CubeState(),
    currentIndex: 0,
    isError: false,
    startedFromSolved: true,
    actualMoves: [],
    consecutiveErrors: 0,
    errorStartIndex: -1,
    needsReset: false,
    errorState: new CubeState(),
    requestFaceletsTimeout: undefined,
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
  s.errorStartIndex = -1;
  s.needsReset = false;
  s.errorState = new CubeState();
  clearTimeout(s.requestFaceletsTimeout);
}

export function useScrambleValidator(scramble: string, onReset?: () => void): ScrambleValidationResult {
  const stateRef = useRef<ValidatorState>(freshValidatorState());
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  const [uiState, setUiState] = useState<ScrambleValidationResult>({
    moves: [],
    states: [],
    isScrambled: false,
    currentIndex: 0,
    errorMoves: [],
    pendingHalfDouble: false,
    needsReset: false,
  });

  // Stable update function — reads from ref, writes to React state
  const updateUI = useCallback(() => {
    const s = stateRef.current;

    // Token states: correct when every expected-facelet for that token is consumed
    const tokenStates: ScrambleMoveState[] = s.moves.map((_, i) => {
      const lastFaceletIdx = s.faceletToTokenMap.lastIndexOf(i);
      if (lastFaceletIdx >= 0 && lastFaceletIdx < s.currentIndex) return 'correct';
      if (lastFaceletIdx === s.currentIndex && s.isError) return 'incorrect';
      return 'pending';
    });

    // isScrambled: all expected-facelet entries consumed
    const isScrambled = s.startedFromSolved && s.currentIndex >= s.expectedFacelets.length && !s.isError && !s.needsReset;

    // pendingHalfDouble: current facelet shares its token with previous facelet
    // → user completed a half-move and needs to press again for the same token
    const tokenAtCur = s.faceletToTokenMap[s.currentIndex];
    const tokenAtPrev = s.faceletToTokenMap[s.currentIndex - 1];
    const pendingHalfDouble = s.currentIndex > 0 && s.currentIndex < s.expectedFacelets.length && tokenAtCur >= 0 && tokenAtPrev >= 0 && tokenAtCur === tokenAtPrev;

    const errorMoves = s.errorStartIndex >= 0
      ? s.actualMoves.slice(s.errorStartIndex)
      : [];

    setUiState({
      moves: s.moves,
      states: tokenStates,
      isScrambled,
      currentIndex: s.currentIndex,
      errorMoves,
      pendingHalfDouble,
      needsReset: s.needsReset,
    });
  }, []);

  // ── Effect 1: reset tracking when scramble changes ─────────────────────
  useEffect(() => {
    const { moves, expectedFacelets, faceletToTokenMap } = computeExpected(scramble);
    const ref = freshValidatorState();
    ref.moves = moves;
    ref.expectedFacelets = expectedFacelets;
    ref.faceletToTokenMap = faceletToTokenMap;
    stateRef.current = ref;
    updateUI();
  }, [scramble, updateUI]);

  // ── Effect 2: lifetime subscriptions (mount once, never re-subscribe) ──
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    // ── facelet stream ────────────────────────────────────────────────────
    // Subscribe to facelets$ (observable, not mutable callback chain).
    // Falls back to onFacelets for adapters without facelets$.
    let faceletCleanup: (() => void) | undefined;

    if ('facelets$' in adapter && (adapter as typeof adapter & { facelets$: unknown }).facelets$) {
      const faceletSub = (adapter as typeof adapter & { facelets$: import('rxjs').Observable<string> }).facelets$.subscribe((f: string) => {
        handleFacelets(f);
      });
      faceletCleanup = () => faceletSub.unsubscribe();
    } else {
      const originalOnFacelets = adapter.onFacelets;
      adapter.onFacelets = (f: string) => {
        if (originalOnFacelets) originalOnFacelets(f);
        handleFacelets(f);
      };
      faceletCleanup = () => { adapter.onFacelets = originalOnFacelets; };
    }

    function handleFacelets(f: string): void {
      const isSolved = SOLVED_FACELETS.test(f);
      const s = stateRef.current;

      if (isSolved) {
        s.startedFromSolved = true;
        if (s.needsReset) {
          resetRef(s);
          onResetRef.current?.();
          updateUI();
          return;
        }
        if (s.currentIndex > 0 || s.isError) {
          resetRef(s);
          updateUI();
        }
      } else if (s.currentIndex === 0 && s.startedFromSolved) {
        s.startedFromSolved = false;
      }
    }

    // ── move stream ──────────────────────────────────────────────────────
    const moveSub = adapter.moves$.subscribe((ev: CubeMoveEvent) => {
      const s = stateRef.current;

      const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");

      // ── needsReset: accumulating moves to detect solve ─────────────────
      if (s.needsReset) {
        s.actualMoves.push(notation);
        try { s.errorState.applySequence(notation); } catch { /* skip */ }
        scheduleFacelets(s);
        if (s.errorState.isSolved()) {
          resetRef(s);
          onResetRef.current?.();
        }
        updateUI();
        return;
      }

      if (s.moves.length === 0) return;

      // ── skip if already all correct (should not happen, but safe) ──────
      if (s.currentIndex >= s.expectedFacelets.length && !s.isError) return;

      // ── track the move ─────────────────────────────────────────────────
      s.actualMoves.push(notation);
      try { s.currentState.applySequence(notation); } catch { return; }

      // ── check if move corrected an error back to solved ────────────────
      // This handles: error (U') → correction (U) = back to solved
      if (s.isError && s.currentState.isSolved()) {
        resetRef(s);
        updateUI();
        return;
      }

      const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);
      const matchedIndex = s.expectedFacelets.lastIndexOf(currentFacelets);

      if (matchedIndex !== -1) {
        // CORRECT: currentIndex = matchedIndex + 1 (1-based count)
        s.currentIndex = matchedIndex + 1;
        s.isError = false;
        s.consecutiveErrors = 0;
        s.errorStartIndex = -1;
      } else {
        s.isError = true;
        s.consecutiveErrors++;
        if (s.errorStartIndex === -1) s.errorStartIndex = s.actualMoves.length - 1;
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
  }, [updateUI]);

  return uiState;
}
