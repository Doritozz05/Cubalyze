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

  it('P2: recovers the solver\'s frame and detects the real cross', () => {
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
    // The real cross wins the detector: a multi-slot cross, not a spurious
    // single-face coincidence (the raw writes "xxxcross").
    expect(report.crossType).toBe('xxcross');
    expect(report.crossFace).toBe('U');
    expect(report.crossColor).toBe('U');
    // 3 pairs were made inside the cross; the raw's standalone "4th pair"
    // (BR) is the only free F2L pair left.
    expect(reconstruction.pairs).toHaveLength(1);
    expect(reconstruction.pairs[0].slot).toBe('BR');
    expect(reconstruction.pairs[0].colors).toEqual(['B', 'R']);
    // ZBLL (1-look LL) lands on OLL; PLL is skipped.
    expect(reconstruction.oll?.moves.length).toBe(9);
    expect(reconstruction.oll?.skipped).toBe(false);
    expect(reconstruction.pll?.skipped).toBe(true);
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
