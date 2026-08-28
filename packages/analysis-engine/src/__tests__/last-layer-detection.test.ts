import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * State-based last-layer detection integration tests.
 *
 * These verify that analyzeSolveText reports the OLL and PLL case detected
 * BY STATE (not by the written labels) plus the AUF face, so the renderer
 * can show the case from the solver's exact angle.
 *
 * The fixture is reconz-12743 (Yiheng Wang, 3.40s — a real dataset solve):
 * its OLL (11 moves) and PLL (17 moves) are detected by state as OLL 28 /
 * PLL Jb with the solver's AUF faces.
 */
const SCRAMBLE = "B2 U' B2 U L2 D R2 B2 L2 U2 B L' D' B2 D' L2 U' L2 R2 F R' U'";
const SOLUTION = [
  "y' // inspection",
  "D' U' B L F' U R' // xcross",
  "U R' U' R U' R' U R // 2nd pair",
  "y' R U' R' // 3rd pair",
  "U' L' U' L U' L' U L // 4th pair",
  "U2' r U R' U' r' R U R U' R' // OLL",
  "U R U R' F' R U R' U' R' R R' F R2 U' R' U2 // PLL",
].join('\n');

describe('analyzeSolveText — last-layer state detection', () => {
  it('detects OLL and PLL cases by state on a real solve', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      inspection: "y'",
      solution: SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
    });

    expect(reconstruction.oll?.detectedCase).toBeDefined();
    expect(reconstruction.pll?.detectedCase).toBeDefined();

    const oll = reconstruction.oll!.detectedCase!;
    const pll = reconstruction.pll!.detectedCase!;
    expect(oll.confidence).toBe('exact');
    expect(pll.confidence).toBe('exact');
    expect(oll.caseNumber).toBe('OLL 28');
    expect(pll.caseNumber).toBe('Jb');
  });

  it('reports the AUF face so the renderer can match the solver angle', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      inspection: "y'",
      solution: SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
    });

    // The AUF face is the sticker on the solver's U face at the F position
    // — always a valid lateral face letter for an exact detection.
    const ollAuf = reconstruction.oll?.detectedCase?.aufFace;
    const pllAuf = reconstruction.pll?.detectedCase?.aufFace;
    expect(ollAuf).toMatch(/^[URFDLB]$/);
    expect(pllAuf).toMatch(/^[URFDLB]$/);
  });

  it('does not crash when the last layer is not a standard case', () => {
    // A short pseudo-solve with an OLL that is not in the 57-case catalog:
    // detection must degrade to 'unknown' without breaking the result.
    const result = analyzeSolveText({
      setup: SCRAMBLE,
      inspection: "y'",
      solution: [
        "R' U' F R F' U R U R' // a made-up OLL",
        "U R U R' // trailing",
      ].join('\n'),
      method: 'CFOP',
    });
    expect(result.reconstruction).toBeDefined();
  });
});