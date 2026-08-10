import { describe, expect, it } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * reconz-12564 (Teodor Zajder, 2.76s WR solve) — the exact record the user
 * reported: the reconstructed solve is PERFECT but finishes in a rotated
 * frame (recon.nz frame quirk), so the panel showed "Inconsistent".
 *
 * With the rotation-tolerant verdict (P1), `finalSolved` must flip to true:
 * the cube's faces are all uniform at the end, which IS a solved cube.
 */
const FIXTURE = {
  scramble: "L B R2 B' R2 U2 F D R2 U R2 F2 D2 R U B L2",
  text: [
    "x' // inspection",
    "r' U F U' r U' r' U2 r' U r // xxxcross",
    "R U2' R2' U' R U R U2' R' // 4th pair",
    "U' F' r U R' U' r' F R // ZBLL",
  ].join('\n'),
};

describe('reconz-12564 (rotated-frame solve)', () => {
  it('verdicts the solve coherent (solved up to rotation)', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.scramble,
      solution: FIXTURE.text,
      method: 'CFOP',
    });
    expect(result).not.toBeNull();

    const { reconstruction, timeline } = result!;
    expect(reconstruction.finalSolved).toBe(true);
    expect(timeline.detectionReport?.finalStateSolved).toBe(true);
    expect(timeline.detectionReport?.warnings).not.toContain(
      'final-state-not-solved',
    );
  });

  it('P2+P4: recovers the solver\'s frame and detects the real xxxcross', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.scramble,
      solution: FIXTURE.text,
      method: 'CFOP',
    });
    const { reconstruction } = result!;
    const report = result!.timeline.detectionReport!;

    // The solver holds white front / blue up after the x' grip — the frame
    // the user verified by hand. The panel's Orientation row must match.
    expect(reconstruction.orientation).toEqual({ up: 'B', front: 'U' });
    // Identity scheme: the scramble frame colors are the canonical ones.
    expect(reconstruction.scheme).toEqual({
      U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B',
    });
    // The real cross wins the detector — with the wide-slice fix the cross
    // completes exactly at the written segment end (11 moves) instead of a
    // coincidental late completion, so it is a genuine XXXCROSS: three pairs
    // were solved inside the cross (the raw writes "xxxcross").
    expect(report.crossType).toBe('xxxcross');
    expect(report.crossFace).toBe('U');
    expect(report.crossColor).toBe('U');
    // The Cross phase ends at entry 10 (11 moves) — matching the raw, NOT 16.
    const crossPhase = report.phases.find((p) => p.phaseName === 'Cross');
    expect(crossPhase?.endIndex).toBe(10);
    expect(crossPhase?.completionIndex).toBe(10);
    // The cross moves are the SOLVER's raw notation, wides as written.
    expect(reconstruction.cross.moves).toEqual([
      "r'", 'U', 'F', "U'", 'r', "U'", "r'", 'U2', "r'", 'U', 'r',
    ]);
    // 3 pairs were made inside the cross (BR/BL/FL); the raw's standalone
    // "4th pair" solves the only free slot (FR) and owns the WHOLE written
    // 9-move segment — the trailing moves restore the BR slot the insertion
    // temporarily displaced.
    expect(reconstruction.pairs).toHaveLength(1);
    expect(reconstruction.pairs[0].slot).toBe('FR');
    expect(reconstruction.pairs[0].colors).toEqual(['F', 'R']);
    expect(reconstruction.pairs[0].moves).toEqual([
      'R', "U2'", "R2'", "U'", 'R', 'U', 'R', "U2'", "R'",
    ]);
    // ZBLL (1-look LL) lands on OLL (raw notation, wide moves kept); the
    // skipped PLL owns no moves (nothing to double-count).
    expect(reconstruction.oll?.moves).toEqual([
      "U'", "F'", 'r', 'U', "R'", "U'", "r'", 'F', 'R',
    ]);
    expect(reconstruction.oll?.skipped).toBe(false);
    expect(reconstruction.pll?.skipped).toBe(true);
    expect(reconstruction.pll?.moves).toEqual([]);
  });

  it('flat (comment-free) solutions never degrade to an end-of-solve cross', () => {
    // Without the written `//` phases there is NO signal to tell the real
    // cross from a persistent coincidence, so the detector falls back to its
    // pre-P2 heuristics. The regression guard must ensure it never uses the
    // whole-solve end as the "written cross segment" (that would let a
    // coincidental end-of-solve cross — completions [last,last,last,last] —
    // win every tie, collapsing the Cross phase onto the final move).
    const flat = FIXTURE.text
      .split('\n')
      .map((l) => l.replace(/\s*\/\/.*$/, '').trim())
      .filter(Boolean)
      .join(' ');
    const result = analyzeSolveText({
      setup: FIXTURE.scramble,
      solution: flat,
      method: 'CFOP',
    });
    const { reconstruction, timeline } = result!;
    const report = timeline.detectionReport!;
    const cross = report.phases.find((p) => p.phaseName === 'Cross');
    // The verdict stays coherent (the solve is still perfect).
    expect(reconstruction.finalSolved).toBe(true);
    // The written cross is the first 11 moves; the detected Cross phase must
    // land inside that window — never at the very end of the solve.
    expect(cross).toBeDefined();
    expect(cross!.endIndex ?? -1).toBeLessThan(timeline.entries.length - 1);
    expect(cross!.endIndex ?? -1).toBeLessThanOrEqual(10);
  });

  it('still marks a genuinely inconsistent solve as incoherent', () => {
    // +1 extra move breaks the (rotated) solved state → non-uniform faces.
    const result = analyzeSolveText({
      setup: FIXTURE.scramble,
      solution: FIXTURE.text + "\nR'",
      method: 'CFOP',
    });
    expect(result).not.toBeNull();
    expect(result!.reconstruction.finalSolved).toBe(false);
  });
});
