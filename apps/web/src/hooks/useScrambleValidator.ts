import { useState, useEffect, useRef } from 'react';
import { globalCubeAdapter } from '@/components/Hardware/CubeConnector';
import type { CubeMoveEvent } from '@cubeforge/types';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';

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

export function useScrambleValidator(scramble: string): ScrambleValidationResult {
  const stateRef = useRef({
    moves: [] as string[],
    expectedFacelets: [] as string[],
    currentState: new CubeState(),
    currentIndex: 0,
    isError: false,
    startedFromSolved: true,
    requestFaceletsTimeout: undefined as any,
  });

  const [uiState, setUiState] = useState<ScrambleValidationResult>({
    moves: [],
    states: [],
    isScrambled: false,
    currentIndex: 0,
  });

  const updateUI = () => {
    const s = stateRef.current;
    const states = s.moves.map((_, i) => {
      if (i < s.currentIndex) return 'correct' as ScrambleMoveState;
      if (i === s.currentIndex && s.isError) return 'incorrect' as ScrambleMoveState;
      return 'pending' as ScrambleMoveState;
    });

    const isScrambled = s.startedFromSolved && s.currentIndex === s.moves.length && !s.isError;

    setUiState({
      moves: s.moves,
      states,
      isScrambled,
      currentIndex: s.currentIndex,
    });
  };

  useEffect(() => {
    const moves = parseScramble(scramble);
    const expectedFacelets: string[] = [];
    const tempState = new CubeState();
    
    // Add solved state as index 0
    expectedFacelets.push(FaceletStringConverter.toFaceletString(tempState));

    for (const m of moves) {
      try {
        tempState.applySequence(m);
        expectedFacelets.push(FaceletStringConverter.toFaceletString(tempState));
      } catch (e) {
        console.warn("Invalid move in scramble:", m, e);
      }
    }

    stateRef.current = {
      moves,
      expectedFacelets,
      currentState: new CubeState(),
      currentIndex: 0,
      isError: false,
      startedFromSolved: true,
      requestFaceletsTimeout: undefined as any,
    };
    updateUI();
  }, [scramble]);

  useEffect(() => {
    if (!globalCubeAdapter.moves$) return;

    const originalOnFacelets = globalCubeAdapter.onFacelets;
    globalCubeAdapter.onFacelets = (f) => {
      if (originalOnFacelets) originalOnFacelets(f);

      // Simple regex for solved cube
      const isSolved = f.match(/^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/);
      const s = stateRef.current;
      
      if (isSolved) {
        s.startedFromSolved = true;
        
        const isCurrentlyScrambled = s.moves.length > 0 && s.currentIndex === s.moves.length && !s.isError;

        if (!isCurrentlyScrambled && (s.currentIndex > 0 || s.isError)) {
          s.currentState = new CubeState();
          s.currentIndex = 0;
          s.isError = false;
          updateUI();
        }
      } else {
        if (s.currentIndex === 0) {
          s.startedFromSolved = false;
        }
      }
    };

    const sub = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
      const s = stateRef.current;
      
      if (!s.startedFromSolved) {
        clearTimeout(s.requestFaceletsTimeout);
        s.requestFaceletsTimeout = setTimeout(() => {
          if (globalCubeAdapter.isConnected) {
            globalCubeAdapter.requestFacelets().catch(() => {});
          }
        }, 300) as any;
      }

      if (s.moves.length === 0) return;

      if (s.currentIndex === 0 && !s.startedFromSolved) {
         // Force error if they start from an unsolved state
         s.isError = true;
         updateUI();
         return;
      }

      const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");

      try {
        s.currentState.applySequence(notation);
      } catch {
        return; // Ignore malformed moves
      }

      const currentFacelets = FaceletStringConverter.toFaceletString(s.currentState);
      
      // Find where we are in the exact mathematical scramble path
      const matchedIndex = s.expectedFacelets.lastIndexOf(currentFacelets);

      if (matchedIndex !== -1) {
        s.currentIndex = matchedIndex;
        s.isError = false;
      } else {
        s.isError = true;
      }

      updateUI();
    });

    return () => {
      sub.unsubscribe();
      globalCubeAdapter.onFacelets = originalOnFacelets;
      clearTimeout(stateRef.current.requestFaceletsTimeout);
    };
  }, [scramble]);

  return uiState;
}
