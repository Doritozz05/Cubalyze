import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

describe('Solve 2542 — Kenta Ikeda (Kansai Mega Day 2026)', () => {
  it('correctly segments F2L3 with conjugate f R\' f\' and detects all 4 pairs cleanly', () => {
    const setup = "F2 B D2 L' D2 L' F' L2 B2 D B2 R2 U' F2 U' L F2 L2";
    const solution = [
      "z2 y' // insp",
      "D' R' L D' F D' F // cross",
      "R U' R' U' R U R' L U' L' // F2L1",
      "U2 R U' R' // F2L2",
      "L' U L U f R' f' // F2L3",
      "U2 y' U R U' R' U' R U' R' U R U' R' // F2L4",
      "F U R U' R' U R U' R' F' // OLL",
      "R U' R' U' R U R D R' U' R D' R' U2 R' U // PLL-Ra",
    ].join('\n');

    const result = analyzeSolveText({
      setup,
      solution,
      inspection: "z2 y'",
      method: 'CFOP',
    });

    const recon = result.reconstruction;

    // Cross
    expect(recon.cross.moves.join(' ')).toBe("D' R' L D' F D' F");

    // 4 F2L Pairs
    expect(recon.pairs.length).toBe(4);

    // Pair 1
    expect(recon.pairs[0].moves.join(' ')).toBe("R U' R' U' R U R' L U' L'");

    // Pair 2
    expect(recon.pairs[1].moves.join(' ')).toBe("U2 R U' R'");

    // Pair 3: must contain full conjugate f R' f' (not cut prematurely at f R')
    expect(recon.pairs[2].moves.join(' ')).toBe("L' U L U f R' f'");

    // Pair 4: must start with U2 y' U R ... without any leaked f'
    expect(recon.pairs[3].moves.join(' ')).toBe("U2 U R U' R' U' R U' R' U R U' R'");
    // Case detection for F2L4 should now detect cleanly:
    expect(recon.pairs[3].detectedCase).toBeDefined();

    // OLL and PLL
    expect(recon.oll?.moves.join(' ')).toBe("F U R U' R' U R U' R' F'");
    expect(recon.oll?.detectedCase?.caseNumber).toBe('OLL 51');

    expect(recon.pll?.moves.join(' ')).toBe("R U' R' U' R U R D R' U' R D' R' U2 R' U");

    // Solved
    expect(recon.finalSolved).toBe(true);
  });
});
