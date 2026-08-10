import { describe, expect, it } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * reconz-9068 — E-layer compensation. The raw reconstruction puts a WIDE u'
 * inside the xcross and a d' inside the 3rd pair:
 *
 *   L D L' U' R u' U R // xcross
 *   L' U' L // 2nd pair
 *   d' R' U2' R U R' U' R // 3rd pair
 *   U' L' U L // 4th pair
 *
 * The cross's u' rotates the equator (E layer) together with U, so the D+E
 * block does NOT end where a token accumulator would predict; the F2L d'
 * then COMPENSATES that rotation back to identity. A token-based d-offset
 * accumulator sums the two and corrupts the solver-frame slot analysis
 * (it produced 0 slots and no pairs for this solve). The frame must be
 * MEASURED from the preserved solver-frame states — the state-based DP
 * (bestFrameRotationSequence) reads the compensated frame correctly.
 *
 * Ground truth (reconstructor): an xcross (FR pair home when the cross
 * completes) + exactly 3 more pairs (BL, BR, FL) matching the raw tokens
 * 1:1.
 */
const FIXTURE = {
  setup: "L2 R2 U F2 U L2 F2 D' R2 D2 F U R2 F2 U' L' B' R' D' B2 U'",
  solution: [
    "L D L' U' R u' U R // xcross",
    "L' U' L // 2nd pair",
    "d' R' U2' R U R' U' R // 3rd pair",
    "U' L' U L // 4th pair",
    "U' F R U R' U' F' // OLL",
    "U' R U R' U' D R2 U' R U' R' U R' U R2 U' D' U' // PLL",
  ].join('\n'),
};

describe('reconz-9068 (E-layer compensation — u\' in cross, d\' in F2L)', () => {
  it('detects the xcross with FR home at cross end', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.setup,
      solution: FIXTURE.solution,
      method: 'CFOP',
    });
    const { reconstruction, timeline } = result!;
    const report = timeline.detectionReport!;

    // The raw xcross segment is 8 tokens (the u' counts once, as written).
    expect(reconstruction.cross.moves).toEqual(['L', 'D', "L'", "U'", 'R', "u'", 'U', 'R']);
    expect(reconstruction.cross.type).toBe('xcross');
    expect(reconstruction.cross.xcrossPair?.name).toBe('FR');
    expect(report.crossType).toBe('xcross');
  });

  it('detects exactly 3 pairs matching the raw tokens 1:1', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.setup,
      solution: FIXTURE.solution,
      method: 'CFOP',
    });
    const { reconstruction } = result!;

    // F2L 1 is the xcross (FR) — the remaining pairs are 2-4.
    expect(reconstruction.pairs).toHaveLength(3);
    expect(reconstruction.pairs.map((p) => p.slot)).toEqual(['BL', 'BR', 'FL']);
    expect(reconstruction.pairs.map((p) => p.moves)).toEqual([
      ["L'", "U'", 'L'],
      ["d'", "R'", "U2'", 'R', 'U', "R'", "U'", 'R'],
      ["U'", "L'", 'U', 'L'],
    ]);
    // The d' is kept as written (it is the frame-compensation move).
    expect(reconstruction.pairs[1].moves[0]).toBe("d'");
    expect(reconstruction.finalSolved).toBe(true);
  });
});
