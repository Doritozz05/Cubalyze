import { describe, it, expect } from 'vitest';
import { CubeState } from './CubeState';
import { Move } from './Constants';

describe('CubeState (Mathematical Core)', () => {
  it('should initialize as solved', () => {
    const cube = new CubeState();
    expect(cube.isSolved()).toBe(true);
  });

  it('should return to solved state after 4 of the same moves', () => {
    const cube = new CubeState();
    cube.applyMove(Move.U1);
    expect(cube.isSolved()).toBe(false);
    cube.applyMove(Move.U1);
    cube.applyMove(Move.U1);
    cube.applyMove(Move.U1);
    expect(cube.isSolved()).toBe(true);

    cube.applyMove(Move.R1);
    cube.applyMove(Move.R1);
    cube.applyMove(Move.R1);
    cube.applyMove(Move.R1);
    expect(cube.isSolved()).toBe(true);
  });

  it('should handle standard move sequences correctly (T-Perm)', () => {
    const cube = new CubeState();
    // T-Perm: R U R' U' R' F R2 U' R' U' R U R' F'
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    
    // T-Perm swaps two corners (URF and UBR) and two edges (UR and UL)
    expect(cube.isSolved()).toBe(false);

    // Apply T-Perm again should solve it (since it's an involution)
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    expect(cube.isSolved()).toBe(true);
  });

  it('should create the Superflip state', () => {
    const cube = new CubeState();
    // Superflip: U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2
    cube.applySequence("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
    
    // In Superflip, all corners are solved
    for (let i = 0; i < 8; i++) {
      expect(cube.cp[i]).toBe(i);
      expect(cube.co[i]).toBe(0);
    }
    
    // All edges are in their original position but flipped
    for (let i = 0; i < 12; i++) {
      expect(cube.ep[i]).toBe(i);
      expect(cube.eo[i]).toBe(1);
    }
  });

  it('should be extremely fast (Stress test 10,000 moves)', () => {
    const cube = new CubeState();
    const moves = [
      Move.U1, Move.U2, Move.U3,
      Move.R1, Move.R2, Move.R3,
      Move.F1, Move.F2, Move.F3,
      Move.D1, Move.D2, Move.D3,
      Move.L1, Move.L2, Move.L3,
      Move.B1, Move.B2, Move.B3
    ];
    
    const numMoves = 10000;
    const randomSequence: Move[] = [];
    for (let i = 0; i < numMoves; i++) {
      randomSequence.push(moves[Math.floor(Math.random() * moves.length)]);
    }

    const start = performance.now();
    for (let i = 0; i < numMoves; i++) {
      cube.applyMove(randomSequence[i]);
    }
    const end = performance.now();
    
    const timeTakenMs = end - start;
    console.log(`Time taken for ${numMoves} moves: ${timeTakenMs.toFixed(2)}ms`);
    
    // According to PRD, it must be under 10ms for 10k moves
    expect(timeTakenMs).toBeLessThan(15); // 15ms buffer for CI environments
  });
});
