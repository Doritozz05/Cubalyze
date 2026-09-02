import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { Min2PhaseSolver } from '@cubeforge/solver-engine';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * Advanced F2L detection end-to-end through analyzeSolveText — the route
 * shared by reconstruction text, smart and virtual analysis.
 *
 * Construction: from solved, E2 parks the FR edge in the BL slot with the
 * DFR corner home and the D-cross intact (slice 2-move keeps the state
 * cubie-legal; a single E' quarter-turn is odd-permutation and min2phase
 * rejects it as a parity error). The pair's cut is therefore the advanced
 * configuration "corner home + edge in a foreign E-slice slot" (C4E11) —
 * outside the 41 Basic F2L cases. Min2Phase solves the rest; the pipeline
 * fires the FR pair at its completion with the cut at the E2 state.
 *
 * Before the Advanced F2L loader was wired into the shared analysis
 * detector (caseDetectors.getF2LDetector), this pair reported undefined;
 * now it resolves to its BirdF2L pattern (measured: "Uj").
 */
describe('case detection — Advanced F2L in the analysis route', () => {
  it('detects an advanced BirdF2L case at a real pair cut', () => {
    const b = new CubeState();
    b.applySequence('E2');

    const w = new Min2PhaseSolver().solve(b);
    expect(w.length).toBeGreaterThan(0);

    const { reconstruction } = analyzeSolveText({
      setup: '',
      solution: `E2 ${w}`,
      method: 'CFOP',
      relaxedCross: true,
    });

    expect(reconstruction.pairs.length).toBeGreaterThan(0);

    // The FR pair's cut is the E2 state (corner home + edge in BL slot) —
    // an ADVANCED configuration. Its case must be exact and carry the
    // BirdF2L pattern name, not a Basic "F2L n" number and not undefined.
    const fr = reconstruction.pairs.find((p) => p.slot === 'FR');
    expect(fr?.detectedCase?.confidence).toBe('exact');
    expect(fr?.detectedCase?.caseNumber).toBe('Uj');
    expect(fr?.detectedCase?.caseNumber).not.toMatch(/^F2L \d+$/);
  });
});
