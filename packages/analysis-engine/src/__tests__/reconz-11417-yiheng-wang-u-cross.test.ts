import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

describe('Reconstruction tests: Yiheng Wang #11417 (U-cross with wide moves)', () => {
  const setup = "L' F2 B' U' D' L' F' D L2 B D2 B2 D L2 D2 F2 U F2 D' L2 U'";
  const solution = `
x2 y // inspection
U L F' U' R L' U L u // xcross
L' U L // 2nd pair
R U R' U' R U R' // 3rd pair
U' d' R U' R' // 4th pair
U F R' F' R U R U' R' // OLL(CP)
U' // AUF
`;

  it('correctly detects cross face as U, segments all 4 F2L pairs cleanly, identifies OLL 37 and PLL skip', () => {
    const result = analyzeSolveText({ setup, solution });
    const recon = result.reconstruction;

    // Cross verification
    expect(recon.cross.moves).toEqual(['U', 'L', "F'", "U'", 'R']);

    // F2L pairs verification: all 4 pairs are properly separated!
    expect(recon.pairs).toHaveLength(4);

    // Pair 1 (BR slot)
    expect(recon.pairs[0].slot).toBe('BR');
    expect(recon.pairs[0].moves).toEqual(["L'", 'U', 'L', 'u']);
    expect(recon.pairs[0].detectedCase?.caseNumber).toBe('F2L 26');

    // Pair 2 (FR slot)
    expect(recon.pairs[1].slot).toBe('FR');
    expect(recon.pairs[1].moves).toEqual(["L'", 'U', 'L']);
    expect(recon.pairs[1].detectedCase?.caseNumber).toBe('F2L 2');

    // Pair 3 (FL slot)
    expect(recon.pairs[2].slot).toBe('FL');
    expect(recon.pairs[2].moves).toEqual(['R', 'U', "R'", "U'", 'R', 'U', "R'"]);
    expect(recon.pairs[2].detectedCase?.caseNumber).toBe('F2L 30');

    // Pair 4 (BL slot)
    expect(recon.pairs[3].slot).toBe('BL');
    expect(recon.pairs[3].moves).toEqual(["U'", "d'", 'R', "U'", "R'"]);
    expect(recon.pairs[3].detectedCase?.caseNumber).toBe('F2L 1');

    // OLL verification
    expect(recon.oll?.skipped).toBe(false);
    expect(recon.oll?.detectedCase?.caseNumber).toBe('OLL 37');
    expect(recon.oll?.moves).toEqual(['U', 'F', "R'", "F'", 'R', 'U', 'R', "U'", "R'", "U'"]);

    // PLL verification (skipped)
    expect(recon.pll?.skipped).toBe(true);
    expect(recon.pll?.moves).toEqual([]);
  });
});
