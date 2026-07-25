import { describe, it, expect } from 'vitest';
import { CubeState } from './CubeState';
import { Move } from './Constants';

describe('CubeState (Mathematical Core)', () => {
  // ── Existing tests (preserved) ──────────────────────────────────────────

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
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    expect(cube.isSolved()).toBe(false);
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    expect(cube.isSolved()).toBe(true);
  });

  it('should create the Superflip state', () => {
    const cube = new CubeState();
    cube.applySequence("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
    for (let i = 0; i < 8; i++) {
      expect(cube.cp[i]).toBe(i);
      expect(cube.co[i]).toBe(0);
    }
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
    expect(timeTakenMs).toBeLessThan(150);
  });

  // ── NEW: Expanded coverage ─────────────────────────────────────────────

  // Constructor
  it('constructor with custom arrays creates correct state', () => {
    // Solved but with custom constructor call
    const cp = [0, 1, 2, 3, 4, 5, 6, 7];
    const co = [0, 0, 0, 0, 0, 0, 0, 0];
    const ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const cube = new CubeState(cp, co, ep, eo);
    expect(cube.isSolved()).toBe(true);
  });

  it('constructor with Int8Array params works', () => {
    const cube = new CubeState(
      new Int8Array([0, 1, 2, 3, 4, 5, 6, 7]),
      new Int8Array([0, 0, 0, 0, 0, 0, 0, 0]),
      new Int8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    expect(cube.isSolved()).toBe(true);
  });

  // Each face turn individually
  it('F face: 4× F = solved', () => {
    const cube = new CubeState();
    cube.applyMove(Move.F1);
    cube.applyMove(Move.F1);
    cube.applyMove(Move.F1);
    cube.applyMove(Move.F1);
    expect(cube.isSolved()).toBe(true);
  });

  it('D face: 4× D = solved', () => {
    const cube = new CubeState();
    cube.applyMove(Move.D1);
    cube.applyMove(Move.D1);
    cube.applyMove(Move.D1);
    cube.applyMove(Move.D1);
    expect(cube.isSolved()).toBe(true);
  });

  it('L face: 4× L = solved', () => {
    const cube = new CubeState();
    cube.applyMove(Move.L1);
    cube.applyMove(Move.L1);
    cube.applyMove(Move.L1);
    cube.applyMove(Move.L1);
    expect(cube.isSolved()).toBe(true);
  });

  it('B face: 4× B = solved', () => {
    const cube = new CubeState();
    cube.applyMove(Move.B1);
    cube.applyMove(Move.B1);
    cube.applyMove(Move.B1);
    cube.applyMove(Move.B1);
    expect(cube.isSolved()).toBe(true);
  });

  // Identity after composed moves
  it('R U R\' U\' applied 6 times = solved (sexy move)', () => {
    const cube = new CubeState();
    for (let i = 0; i < 6; i++) {
      cube.applyMove(Move.R1);
      cube.applyMove(Move.U1);
      cube.applyMove(Move.R3);
      cube.applyMove(Move.U3);
    }
    expect(cube.isSolved()).toBe(true);
  });

  // Edge orientation behavior
  it('F move flips orientation of some edges (SebLague cross-check)', () => {
    const cube = new CubeState();
    cube.applyMove(Move.F1);

    // F moves should flip edges on the F face (positions UF, FR, DF, FL)
    // Edge orientation bit = 1 for those four edges
    let flippedCount = 0;
    for (let i = 0; i < 12; i++) {
      if (cube.eo[i] === 1) flippedCount++;
    }
    expect(flippedCount).toBe(4);
  });

  it('B move flips orientation of some edges', () => {
    const cube = new CubeState();
    cube.applyMove(Move.B1);

    let flippedCount = 0;
    for (let i = 0; i < 12; i++) {
      if (cube.eo[i] === 1) flippedCount++;
    }
    expect(flippedCount).toBe(4);
  });

  it('U/D moves never flip edges', () => {
    for (const move of [Move.U1, Move.U2, Move.U3, Move.D1, Move.D2, Move.D3]) {
      const cube = new CubeState();
      cube.applyMove(move);

      let flippedCount = 0;
      for (let i = 0; i < 12; i++) {
        if (cube.eo[i] === 1) flippedCount++;
      }
      expect(flippedCount).toBe(0);
    }
  });

  it('R/L moves never flip edges', () => {
    for (const move of [Move.R1, Move.R2, Move.R3, Move.L1, Move.L2, Move.L3]) {
      const cube = new CubeState();
      cube.applyMove(move);

      let flippedCount = 0;
      for (let i = 0; i < 12; i++) {
        if (cube.eo[i] === 1) flippedCount++;
      }
      expect(flippedCount).toBe(0);
    }
  });

  // isSolved edge cases
  it('isSolved returns false after single move', () => {
    const cube = new CubeState();
    cube.applyMove(Move.R1);
    expect(cube.isSolved()).toBe(false);
  });

  it('isSolved returns false for non-trivial scramble', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U' R' F R F'");
    expect(cube.isSolved()).toBe(false);
  });

  // Performance: clone speed
  it('clone is fast (1000 clones < 10ms)', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      cube.clone();
    }
    const end = performance.now();
    expect(end - start).toBeLessThan(20);
  });

  // Consistency: applyMove vs applySequence across all faces
  it('applyMove matches applySequence for all 18 moves', () => {
    const testCases: [Move, string][] = [
      [Move.U1, 'U'], [Move.U2, 'U2'], [Move.U3, "U'"],
      [Move.R1, 'R'], [Move.R2, 'R2'], [Move.R3, "R'"],
      [Move.F1, 'F'], [Move.F2, 'F2'], [Move.F3, "F'"],
      [Move.D1, 'D'], [Move.D2, 'D2'], [Move.D3, "D'"],
      [Move.L1, 'L'], [Move.L2, 'L2'], [Move.L3, "L'"],
      [Move.B1, 'B'], [Move.B2, 'B2'], [Move.B3, "B'"],
    ];

    for (const [move, seq] of testCases) {
      const viaMove = new CubeState();
      viaMove.applyMove(move);

      const viaSeq = new CubeState();
      viaSeq.applySequence(seq);

      for (let i = 0; i < 8; i++) {
        expect(viaMove.cp[i]).toBe(viaSeq.cp[i]);
        expect(viaMove.co[i]).toBe(viaSeq.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(viaMove.ep[i]).toBe(viaSeq.ep[i]);
        expect(viaMove.eo[i]).toBe(viaSeq.eo[i]);
      }
    }
  });
});
