import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

describe('Solve 2064 — Yiheng Wang 3.32 (Xi\'an Cherry Blossom 2025)', () => {
  it('correctly detects OLL 7 and PLL T Perm', () => {
    const setup = "R' D' B2 U2 L U2 B2 L2 F2 L2 F2 R' F' D2 R' U' F R2 D2";
    const solution = [
      'x2 y // insp',
      "D L D' U2 L' // W P (BO)",
      "U' U R U' R2' U R // 223 (GO)",
      "U2 F' // RB",
      "L F' L' // xxxcross",
      "U' R U2' R' U R U' R' // RG",
      "r U R' U R U2' r' // OLL-N+",
      "R U R' U' R' F R2 U' R' U' R U R' F' // PLL-T",
    ].join('\n');

    const result = analyzeSolveText({
      setup,
      solution,
      inspection: 'x2 y',
      method: 'CFOP',
    });

    const recon = result.reconstruction;

    // Cross and F2L
    expect(recon.cross.type).toBe('xxxcross');

    // OLL Detection: OLL 7 (N+ shape solved by r U R' U R U2' r')
    expect(recon.oll).not.toBeNull();
    expect(recon.oll?.skipped).toBe(false);
    expect(recon.oll?.detectedCase?.confidence).toBe('exact');
    expect(recon.oll?.detectedCase?.caseNumber).toBe('OLL 7');
    expect(recon.oll?.detectedCase?.caseName).toBe('OLL 7');

    // PLL Detection: T Perm
    expect(recon.pll).not.toBeNull();
    expect(recon.pll?.skipped).toBe(false);
    expect(recon.pll?.detectedCase?.confidence).toBe('exact');
    expect(recon.pll?.detectedCase?.caseNumber).toBe('T');
    expect(recon.pll?.detectedCase?.caseName).toBe('T Perm');

    // Solved
    expect(recon.finalSolved).toBe(true);
  });
});
