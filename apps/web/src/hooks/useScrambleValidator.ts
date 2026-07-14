import { useState, useEffect, useRef } from 'react';
import { globalCubeAdapter } from '@/components/Hardware/CubeConnector';
import type { CubeMoveEvent } from '@cubeforge/types';

export type ScrambleMoveState = 'pending' | 'correct' | 'incorrect';

export interface ScrambleValidationResult {
  moves: string[];
  states: ScrambleMoveState[];
  isScrambled: boolean;
  currentIndex: number;
}

function parseScramble(scramble: string): string[] {
  return scramble.trim().split(/\s+/).filter(Boolean);
}

function getInverseMove(move: string): string {
  if (move.endsWith("'")) return move.slice(0, -1);
  if (move.endsWith("2")) return move;
  return move + "'";
}

// Parse a move string into face and rotation (1, -1, 2)
const parseExpectedMove = (move: string) => {
  const face = move[0];
  let targetRot = 1;
  if (move.endsWith("'")) targetRot = -1;
  else if (move.endsWith("2")) targetRot = 2;
  return { face, targetRot };
};

export function useScrambleValidator(scramble: string): ScrambleValidationResult {
  // Use a ref for synchronous state tracking to prevent rapid-fire event bugs
  const stateRef = useRef({
    moves: [] as string[],
    states: [] as ScrambleMoveState[],
    currentIndex: 0,
    currentRot: 0,
    errorStack: [] as string[],
  });

  const [uiState, setUiState] = useState<ScrambleValidationResult>({
    moves: [],
    states: [],
    isScrambled: false,
    currentIndex: 0,
  });

  const updateUI = () => {
    const isScrambled =
      stateRef.current.moves.length > 0 &&
      stateRef.current.currentIndex === stateRef.current.moves.length &&
      stateRef.current.errorStack.length === 0;

    setUiState({
      moves: stateRef.current.moves,
      states: [...stateRef.current.states],
      currentIndex: stateRef.current.currentIndex,
      isScrambled,
    });
  };

  // Reset when scramble changes
  useEffect(() => {
    const parsed = parseScramble(scramble);
    stateRef.current = {
      moves: parsed,
      states: parsed.map(() => 'pending'),
      currentIndex: 0,
      currentRot: 0,
      errorStack: [],
    };
    updateUI();
  }, [scramble]);

  useEffect(() => {
    if (!globalCubeAdapter.moves$) return;

    // We decorate onFacelets to detect if the cube is solved, to allow restarting the scramble
    const originalOnFacelets = globalCubeAdapter.onFacelets;
    globalCubeAdapter.onFacelets = (f) => {
      if (originalOnFacelets) originalOnFacelets(f);

      const isSolved = f.match(/^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/);
      
      const s = stateRef.current;
      const isCurrentlyScrambled = s.moves.length > 0 && s.currentIndex === s.moves.length && s.errorStack.length === 0;

      // If cube is back to solved, and we were in the middle of a scramble (with errors or not), reset!
      if (isSolved && !isCurrentlyScrambled && (s.currentIndex > 0 || s.errorStack.length > 0)) {
        s.currentIndex = 0;
        s.currentRot = 0;
        s.errorStack = [];
        s.states.fill('pending');
        updateUI();
      }
    };

    const sub = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
      const s = stateRef.current;
      
      const moveRot = ev.direction === -1 ? -1 : ev.direction === 2 ? 2 : 1;
      const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");

      // 1. Recovering from an error
      if (s.errorStack.length > 0) {
        const lastError = s.errorStack[s.errorStack.length - 1];
        const expectedRecovery = getInverseMove(lastError);

        if (notation === expectedRecovery) {
          // Fixed the top error
          s.errorStack.pop();
          if (s.errorStack.length === 0 && s.currentIndex < s.moves.length) {
            s.states[s.currentIndex] = 'pending';
          }
        } else {
          // Made another mistake
          s.errorStack.push(notation);
        }
        updateUI();
        return;
      }

      // 2. Normal progression
      if (s.currentIndex >= s.moves.length) {
        return; // Already done
      }

      const expected = parseExpectedMove(s.moves[s.currentIndex]);

      if (ev.face === expected.face) {
        const newRot = (s.currentRot + moveRot) % 4;
        let normalizedRot = newRot;
        if (normalizedRot === 3) normalizedRot = -1;
        if (normalizedRot === -3) normalizedRot = 1;
        if (normalizedRot === -2) normalizedRot = 2;

        if (normalizedRot === expected.targetRot) {
          // Move completed!
          s.states[s.currentIndex] = 'correct';
          s.currentIndex += 1;
          s.currentRot = 0;
        } else {
          // Partially completed or overshot
          s.states[s.currentIndex] = 'pending';
          s.currentRot = normalizedRot;
        }
      } else {
        // Wrong face! Mistake!
        s.states[s.currentIndex] = 'incorrect';
        s.errorStack.push(notation);
      }

      updateUI();
    });

    return () => {
      sub.unsubscribe();
      globalCubeAdapter.onFacelets = originalOnFacelets;
    };
  }, [scramble]); // Only resubscribe if the scramble prop changes entirely

  return uiState;
}
