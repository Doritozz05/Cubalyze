/**
 * recon-2286-pll-ja.test.ts — Regression for WCA solve #2286.
 *
 * The solver executes the PLL block `x R2 F R F' R U2 r' U r U2 x' U'`
 * (Cuberoot labels it PLL-Ja). The trailing `U'` is an AUF folded into the
 * algorithm: the pre-PLL state differs from the catalog Ja state by a LEFT
 * multiplication U^a · state, which the old one-sided (y-rotation) AUF
 * canonicalization could never reach. The PLL probe must now canonicalize
 * over the two-sided orbit { U^a · state · U^b } and recognize it as Ja.
 */
import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

const SCRAMBLE = "U L' U2 D2 R' F' B U' L R2 U2 F2 B' L2 U2 L2 F' R F";
const SOLUTION = [
  "x2 y // inspection",
  "l D' R2 x' L F' L' // Y cross",
  "R' U2 R U2 L U L' // RB",
  "y' R U' R' // OB",
  "y U' R' U R U2 R' U R // GR",
  "U' y L' U L U' L' U' L // OG",
  "U R U R' U' R' F R F' // OLL 33",
  "x R2 F R F' R U2 r' U r U2 x' U' // PLL-Ja",
].join('\n');

describe('analyzeSolveText — solve #2286', () => {
  it('detects OLL 33 and PLL Ja by state', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      solution: SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
      totalTimeMs: 12370,
    });

    expect(reconstruction.finalSolved).toBe(true);

    // OLL is detected exactly as before.
    expect(reconstruction.oll?.detectedCase?.confidence).toBe('exact');
    expect(reconstruction.oll?.detectedCase?.caseNumber).toBe('OLL 33');

    // PLL must now resolve to Ja — previously undefined because the
    // trailing U' makes the pre-state differ by a left-side AUF.
    expect(reconstruction.pll?.detectedCase?.confidence).toBe('exact');
    expect(reconstruction.pll?.detectedCase?.caseNumber).toBe('Ja');
  });

  it('reports the AUF face of the observed state', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      solution: SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
      totalTimeMs: 12370,
    });
    const auf = reconstruction.pll?.detectedCase?.aufFace;
    expect(auf).toMatch(/^[URFDLB]$/);
  });
});
