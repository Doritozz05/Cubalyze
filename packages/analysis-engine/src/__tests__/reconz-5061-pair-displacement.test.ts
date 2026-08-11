import { describe, expect, it } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * reconz-5061 — Ruihang Xu 2.68 (unofficial 2021-04-24), the exact record the
 * user reported. Regression guard for the persistence lookahead in
 * segmentF2LPairs.
 *
 * The solve: "U R' U' R" finishes the 1st pair with FL home, then the 2nd
 * pair's insertion "L' U' L" passes THROUGH the FL slot for two moves — FL
 * dips and is home again (alongside BL) at the 2nd pair's end.
 *
 * With the old 1-entry lookahead, FL's completion at move 9 was killed (it
 * dips at 10) and re-fired at move 12 together with BL: the two algorithms
 * merged into "F2L 1 BL — 7 moves" + "F2L 2 FL — 0 moves", which is what the
 * user saw on the reconstruction page.
 *
 * The fix (see segmentF2LPairs): when a completion dips and re-appears inside
 * the persistence window AND a DIFFERENT undedicated slot completes inside
 * the window, the first completion was a real pair boundary displaced by the
 * next pair's insertion — it fires EARLY at its first home. FL therefore
 * fires at move 9 and the two algorithms stay separate.
 */
const INPUT = {
  setup: "B2 U2 B R2 F2 U2 F' U2 B' D2 R B U' L' B' R B' U' F",
  inspection: "x' z'",
  solution: [
    "r' R' B' R2 U' R' // cross",
    "U R' U' R // 1st pair",
    "y' L' U' L // 2nd pair",
    "y U' L' U L // 3rd pair",
    "U' R U' R' // 4th pair",
    "R U2' R' U' R U' R' // OLL(CP)",
    "U2 // AUF",
  ].join('\n'),
  method: 'CFOP' as const,
  totalTimeMs: 2680,
};

describe('reconz-5061 (Ruihang Xu — pair displaced by the next insertion)', () => {
  it('segments 4 clean pairs at the reconstructor boundaries (no merge, no empty pair)', () => {
    const result = analyzeSolveText(INPUT);
    expect(result).not.toBeNull();
    const { reconstruction, timeline } = result!;

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.cross.type).toBe('plain');
    expect(reconstruction.cross.moves).toEqual(["r'", "R'", "B'", 'R2', "U'", "R'"]);

    // F2L 1 = FL: "U R' U' R" completes at its 4th move — NOT swallowed into
    // a merged "F2L 1 BL — 7 moves" row.
    expect(reconstruction.pairs.map((p) => p.slot)).toEqual([
      'FL', 'BL', 'BR', 'FR',
    ]);
    expect(reconstruction.pairs.map((p) => p.completionIndex)).toEqual([
      9, 12, 16, 20,
    ]);
    // No pair may own zero moves (the old merge produced an empty F2L 2).
    for (const p of reconstruction.pairs) {
      expect(p.moves.length).toBeGreaterThan(0);
    }
    expect(reconstruction.pairs[0].moves).toEqual(['U', "R'", "U'", 'R']);
    expect(reconstruction.pairs[1].moves).toEqual(["L'", "U'", 'L']);
    expect(reconstruction.pairs[2].moves).toEqual(["U'", "L'", 'U', 'L']);
    expect(reconstruction.pairs[3].moves).toEqual(["U'", 'R', "U'", "R'"]);

    // Move accounting stays exact: cross 6 + pairs 4+3+4+4 = 21 face moves,
    // then OLL 8 (the antisune + the trailing U2 alignment — see below). The
    // rotations and the y regrips are reported separately, never counted as
    // entries.
    const faceTotal =
      reconstruction.cross.moves.length +
      reconstruction.pairs.reduce((s, p) => s + p.moves.length, 0) +
      (reconstruction.oll?.moves.length ?? 0) +
      (reconstruction.pll?.moves.length ?? 0);
    expect(timeline.entries.length).toBe(faceTotal);

    // AUF-only PLL = PLL skip: the OLL(CP) antisune already solved the
    // permutation — the only thing left is the U2 alignment, so the PLL
    // phase is a SKIP (badge + report.skips) and the alignment folds into
    // the OLL moves.
    expect(reconstruction.pll?.skipped).toBe(true);
    expect(reconstruction.pll?.moves).toEqual([]);
    expect(reconstruction.oll?.skipped).toBe(false);
    expect(reconstruction.oll?.moves).toEqual([
      'R', "U2'", "R'", "U'", 'R', "U'", "R'", 'U2',
    ]);
    expect(timeline.detectionReport?.skips).toContain('pll');
  });

  it('keeps the y regrips as rotations, never inside pair moves', () => {
    const result = analyzeSolveText(INPUT);
    expect(result).not.toBeNull();
    const { reconstruction } = result!;
    expect(reconstruction.rotations.map((r) => r.token)).toEqual([
      "x'", "z'", "y'", 'y',
    ]);
    // The two mid-solve y regrips belong to the F2L row, not to a pair.
    const solveRots = reconstruction.rotations.filter((r) => r.moveIndex > 0);
    expect(solveRots.map((r) => [r.token, r.moveIndex])).toEqual([
      ["y'", 10],
      ['y', 13],
    ]);
  });
});
