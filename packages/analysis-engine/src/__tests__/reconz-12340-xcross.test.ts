import { describe, expect, it } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * reconz-12340 — Yiheng Wang 3.59 (Beijing Only 3x3 2025), the exact record
 * the user reported. The user hand-verified (and the ground-truth state walk
 * confirmed) that:
 *
 *   - the cross is YELLOW on D and completes at move 11 — NOT at the raw
 *     comment's "xcross // 9 moves" (the record itself says "Cross STM 11"),
 *   - the blue-orange pair is already home when the cross completes → a
 *     genuine XCROSS (the raw labels it "xcross" but our state-based
 *     detection must agree),
 *   - only THREE F2L pairs follow, in order blue-red (BR) → green-red (FR)
 *     → the last (FL) — the solve has no standalone "F2L 1",
 *   - the OLL keeps its S token visible ("U' S R U R' U' R' F R f'").
 *
 * This is the regression guard for the frame-aware slot analysis: the solve
 * finishes in a y'-rotated frame (reconz scramble-frame quirk), so P2 frame
 * recovery rotates the snapshots AWAY from the solver's frame. The xcross
 * check and the F2L pair scan must read the preserved solver-frame states
 * (with the d-regrip offset undone), not the rotated timeline states —
 * otherwise the xcross degrades to 'plain' and the pairs collapse.
 */
const FIXTURE = {
  setup: "R' U L' D' F' R' L' U' D R2 U B2 D' R2 U B2 R U2 L'",
  solution: [
    "R' F R U' B U' R2' D' R2 // xcross",
    "U' R' U R' U' R // 2nd pair",
    "U R U R' U R' F R F' // 3rd pair",
    "d U R U' R' U R U' R' // 4th pair",
    "U' S R U R' U' R' F R f' // OLL",
    "R U' R U R' D R D' R U' D R2' U R2 D' R2' U' // PLL",
  ].join('\n'),
};

describe('reconz-12340 (Yiheng Wang xcross — solver-frame slot analysis)', () => {
  it('detects the real xcross with the blue-orange pair (BL) home at cross end', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.setup,
      solution: FIXTURE.solution,
      method: 'CFOP',
      totalTimeMs: 3590,
    });
    const { reconstruction, timeline } = result!;
    const report = timeline.detectionReport!;

    // Cross: 11 moves (the trailing U' R' complete the D cross — the raw
    // comment's "9 moves" is wrong; the record itself says Cross STM 11).
    expect(reconstruction.cross.moves).toHaveLength(11);
    expect(reconstruction.cross.moves[9]).toBe("U'");
    expect(reconstruction.cross.moves[10]).toBe("R'");
    // The pair was already home when the cross completed.
    expect(reconstruction.cross.type).toBe('xcross');
    expect(reconstruction.cross.xcrossPair?.name).toBe('BL');
    expect(reconstruction.cross.xcrossPair?.colors).toEqual(['B', 'L']);
    expect(report.crossType).toBe('xcross');
    expect(report.xcrossPairs).toEqual([{ slot: 'BL', colors: ['B', 'L'] }]);
  });

  it('detects exactly 3 F2L pairs in the order blue-red → green-red → last', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.setup,
      solution: FIXTURE.solution,
      method: 'CFOP',
    });
    const { reconstruction } = result!;

    // F2L 1 is the xcross — the remaining pairs are numbered 2-4.
    expect(reconstruction.pairs).toHaveLength(3);
    expect(reconstruction.pairs.map((p) => p.slot)).toEqual(['BR', 'FR', 'FL']);
    expect(reconstruction.pairs.map((p) => p.colors)).toEqual([
      ['B', 'R'], // 2nd pair: blue-red
      ['F', 'R'], // 3rd pair: green-red
      ['F', 'L'], // 4th pair: last
    ]);
    expect(reconstruction.pairs[0].moves).toEqual(["U", "R'", "U'", "R"]);
    expect(reconstruction.pairs[1].moves).toEqual([
      'U', 'R', 'U', "R'", 'U', "R'", 'F', 'R', "F'",
    ]);
    // The wide d regrip is kept and tracked as a solver-frame offset.
    expect(reconstruction.pairs[2].moves).toEqual([
      'd', 'U', 'R', "U'", "R'", 'U', 'R', "U'", "R'",
    ]);
  });

  it('keeps the OLL S slice visible and reports every raw move exactly', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.setup,
      solution: FIXTURE.solution,
      method: 'CFOP',
    });
    const { reconstruction, timeline } = result!;

    // S produces no timeline entry (entries are face-move indexed) — it is
    // reported as a standalone slice for the panel to interleave.
    expect(reconstruction.slices.map((s) => s.token)).toContain('S');
    const sSlice = reconstruction.slices.find((s) => s.token === 'S');
    expect(sSlice).toBeDefined();
    expect(sSlice!.moveIndex).toBeGreaterThan(0);
    expect(reconstruction.oll?.moves).toEqual([
      "U'", 'R', 'U', "R'", "U'", "R'", 'F', 'R', "f'",
    ]);
    expect(reconstruction.pll?.moves).toHaveLength(17);
    // 60 raw moves = 11 cross + 4+9+9 pairs + 9 OLL + 17 PLL + 1 S slice.
    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.rawPhases.length).toBe(6);
    expect(timeline.entries.length).toBe(59); // face moves only (S excluded)
  });
});
