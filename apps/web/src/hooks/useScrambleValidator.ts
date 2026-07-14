import { useState, useEffect } from 'react';
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

export function useScrambleValidator(scramble: string): ScrambleValidationResult {
  const [moves, setMoves] = useState<string[]>([]);
  const [states, setStates] = useState<ScrambleMoveState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorStack, setErrorStack] = useState<string[]>([]);

  // Reset when scramble changes
  useEffect(() => {
    const parsed = parseScramble(scramble);
    setMoves(parsed);
    setStates(parsed.map(() => 'pending'));
    setCurrentIndex(0);
    setErrorStack([]);
  }, [scramble]);

  useEffect(() => {
    if (!globalCubeAdapter.moves$) return;
    
    const sub = globalCubeAdapter.moves$.subscribe((ev: CubeMoveEvent) => {
      const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");
      
      setStates(prevStates => {
        const nextStates = [...prevStates];
        
        setErrorStack(prevErrors => {
          // If we have errors, we must undo them first
          if (prevErrors.length > 0) {
            const lastError = prevErrors[prevErrors.length - 1];
            const expectedRecovery = getInverseMove(lastError);
            
            if (notation === expectedRecovery) {
              // Successfully undid the error
              const newErrors = prevErrors.slice(0, -1);
              if (newErrors.length === 0) {
                // All errors fixed, clear the red mark on the current index
                setCurrentIndex(curr => {
                  nextStates[curr] = 'pending';
                  return curr;
                });
              }
              return newErrors;
            } else {
              // Made another mistake while trying to recover
              return [...prevErrors, notation];
            }
          }
          
          // No errors, we are on the main track
          setCurrentIndex(curr => {
            if (curr >= moves.length) return curr; // Already finished
            
            const expectedMove = moves[curr];
            if (notation === expectedMove) {
              // Correct move!
              nextStates[curr] = 'correct';
              return curr + 1;
            } else {
              // Mistake!
              nextStates[curr] = 'incorrect';
              return curr; // Do not advance index, wait for recovery
            }
          });
          
          // Return new errors if we just made a mistake
          if (nextStates[currentIndex] === 'incorrect') {
            return [notation];
          }
          return [];
        });

        return nextStates;
      });
    });

    return () => sub.unsubscribe();
  }, [moves, currentIndex]);

  const isScrambled = moves.length > 0 && currentIndex === moves.length && errorStack.length === 0;

  return { moves, states, isScrambled, currentIndex };
}
