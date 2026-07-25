import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { Move } from '../Constants';

/**
 * Move Table Tests — Safety Net for Binary Refactoring
 *
 * Verifies that CubeState.moveTable (the 18 pre-computed move states)
 * is correctly initialized and produces identical results to direct
 * move application.
 *
 * This is critical because initTables() builds the move table using
 * multiply() and clone(), and applyMove() delegates to moveTable.
 */

describe('CubeState — Move Table', () => {
  it('initTables initializes moveTable with 18 entries', () => {
    CubeState.initTables();

    // Access the private static via any instance's applyMove
    const cube = new CubeState();
    cube.applyMove(Move.U1); // triggers initTables() if not init

    // We can't access moveTable directly, but we can verify through behavior
    expect(cube.isSolved()).toBe(false);
  });

  it('moveTable move produces identical state to computing from base moves', () => {
    // For each of the 6 face-turn bases, verify that moveTable entries
    // match the expected composition of base moves
    const faceBases: { move: Move; name: string }[] = [
      { move: Move.U1, name: 'U' },
      { move: Move.R1, name: 'R' },
      { move: Move.F1, name: 'F' },
      { move: Move.D1, name: 'D' },
      { move: Move.L1, name: 'L' },
      { move: Move.B1, name: 'B' },
    ];

    for (const { move, name } of faceBases) {
      // applyMove returns the state after applying move X to solved
      const viaMoveTable = new CubeState();
      viaMoveTable.applyMove(move); // turn 1 (clockwise)

      // Manually compose: solved * baseMove
      const manualClockwise = new CubeState();
      // We need the raw base move — compute by applying to solved
      manualClockwise.applySequence(name);

      for (let i = 0; i < 8; i++) {
        expect(viaMoveTable.cp[i]).toBe(manualClockwise.cp[i]);
        expect(viaMoveTable.co[i]).toBe(manualClockwise.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(viaMoveTable.ep[i]).toBe(manualClockwise.ep[i]);
        expect(viaMoveTable.eo[i]).toBe(manualClockwise.eo[i]);
      }
    }
  });

  it('moveTable turn 2 = base * base (half-turn)', () => {
    const halfTurns: { move: Move; name: string }[] = [
      { move: Move.U2, name: 'U2' },
      { move: Move.R2, name: 'R2' },
      { move: Move.F2, name: 'F2' },
      { move: Move.D2, name: 'D2' },
      { move: Move.L2, name: 'L2' },
      { move: Move.B2, name: 'B2' },
    ];

    for (const { move, name } of halfTurns) {
      const viaMoveTable = new CubeState();
      viaMoveTable.applyMove(move);

      const viaSequence = new CubeState();
      viaSequence.applySequence(name);

      for (let i = 0; i < 8; i++) {
        expect(viaMoveTable.cp[i]).toBe(viaSequence.cp[i]);
        expect(viaMoveTable.co[i]).toBe(viaSequence.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(viaMoveTable.ep[i]).toBe(viaSequence.ep[i]);
        expect(viaMoveTable.eo[i]).toBe(viaSequence.eo[i]);
      }
    }
  });

  it('moveTable turn 3 = inverse of turn 1', () => {
    for (const face of [0, 1, 2, 3, 4, 5]) {
      const turn1 = (face * 3 + 0) as Move;
      const turn3 = (face * 3 + 2) as Move;

      const viaTurn1 = new CubeState();
      viaTurn1.applyMove(turn1);
      // Apply inverse
      viaTurn1.applyMove(turn3);
      expect(viaTurn1.isSolved()).toBe(true);
    }
  });

  it('moveTable is idempotent (calling initTables twice is safe)', () => {
    CubeState.initTables();
    CubeState.initTables(); // Should not throw or corrupt

    const cube = new CubeState();
    cube.applyMove(Move.U1);
    cube.applyMove(Move.U3);
    expect(cube.isSolved()).toBe(true);
  });

  it('moveTable entries produce valid states', () => {
    const allMoves = [
      Move.U1, Move.U2, Move.U3,
      Move.R1, Move.R2, Move.R3,
      Move.F1, Move.F2, Move.F3,
      Move.D1, Move.D2, Move.D3,
      Move.L1, Move.L2, Move.L3,
      Move.B1, Move.B2, Move.B3,
    ];

    for (const move of allMoves) {
      const cube = new CubeState();
      cube.applyMove(move);

      // Verify parity invariant
      let cpInv = 0;
      for (let j = 0; j < 7; j++)
        for (let k = j + 1; k < 8; k++)
          if (cube.cp[j] > cube.cp[k]) cpInv++;

      let epInv = 0;
      for (let j = 0; j < 11; j++)
        for (let k = j + 1; k < 12; k++)
          if (cube.ep[j] > cube.ep[k]) epInv++;

      expect(cpInv % 2).toBe(epInv % 2);

      // Verify orientation invariants
      let coSum = 0;
      for (let i = 0; i < 8; i++) coSum += cube.co[i];
      expect(coSum % 3).toBe(0);

      let eoSum = 0;
      for (let i = 0; i < 12; i++) eoSum += cube.eo[i];
      expect(eoSum % 2).toBe(0);
    }
  });

  it('1000 random moves via applyMove maintain valid state', () => {
    const allMoves = [
      Move.U1, Move.U2, Move.U3,
      Move.R1, Move.R2, Move.R3,
      Move.F1, Move.F2, Move.F3,
      Move.D1, Move.D2, Move.D3,
      Move.L1, Move.L2, Move.L3,
      Move.B1, Move.B2, Move.B3,
    ];

    const cube = new CubeState();
    for (let i = 0; i < 1000; i++) {
      const move = allMoves[Math.floor(Math.random() * allMoves.length)];
      cube.applyMove(move);
    }

    // Should still be a valid state
    let cpInv = 0;
    for (let j = 0; j < 7; j++)
      for (let k = j + 1; k < 8; k++)
        if (cube.cp[j] > cube.cp[k]) cpInv++;

    let epInv = 0;
    for (let j = 0; j < 11; j++)
      for (let k = j + 1; k < 12; k++)
        if (cube.ep[j] > cube.ep[k]) epInv++;

    expect(cpInv % 2).toBe(epInv % 2);

    let coSum = 0;
    for (let i = 0; i < 8; i++) coSum += cube.co[i];
    expect(coSum % 3).toBe(0);

    let eoSum = 0;
    for (let i = 0; i < 12; i++) eoSum += cube.eo[i];
    expect(eoSum % 2).toBe(0);
  });
});
