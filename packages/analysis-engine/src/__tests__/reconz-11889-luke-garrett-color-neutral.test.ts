import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

describe('Luke Garrett #11889 — Color-Neutral OLL/PLL Detection', () => {
  const setup = "U' L' D U2 R2 B2 D' R2 U' L2 F2 D L2 R D F' U2 F2 U2 F'";
  const solution = `
z y2 // inspection
R' D' R // cross
L U' L2' U2 L // 1st/2nd pairs
R U2' R' // 3rd pair
U2 R' U' R // 4th pair
R U R' U' R' F R2 U R' U' F' // OLL(CP)
U // AUF
`;

  it('detects Red-cross, 4 F2L pairs, OLL 9, and PLL skip', () => {
    const result = analyzeSolveText({
      setup,
      solution,
    });

    // Cross: Red (R)
    expect(result.reconstruction.crossColor).toBe('R');

    // F2L Pairs: 4 pairs detected with correct cases
    expect(result.reconstruction.pairs.length).toBe(4);
    expect(result.reconstruction.pairs[0].detectedCase?.caseName).toBe('Jb');
    expect(result.reconstruction.pairs[2].detectedCase?.caseName).toBe('Jb');
    expect(result.reconstruction.pairs[3].detectedCase?.caseName).toBe('Je');

    // OLL: OLL 9 detected with exact confidence on Orange LL (opposite of Red cross)
    expect(result.reconstruction.oll).toBeDefined();
    expect(result.reconstruction.oll?.skipped).toBe(false);
    expect(result.reconstruction.oll?.detectedCase?.confidence).toBe('exact');
    expect(result.reconstruction.oll?.detectedCase?.caseNumber).toBe('OLL 9');
    expect(result.reconstruction.oll?.detectedCase?.caseName).toBe('OLL 9');

    // PLL: skipped (0 moves) due to OLL(CP) solving the cube up to AUF
    expect(result.reconstruction.pll).toBeDefined();
    expect(result.reconstruction.pll?.skipped).toBe(true);
    expect(result.reconstruction.pll?.moves.length).toBe(0);
  });
});
