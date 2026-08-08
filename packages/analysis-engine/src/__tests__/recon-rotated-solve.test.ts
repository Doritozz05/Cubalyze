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

  it('still marks a genuinely inconsistent solve as incoherent', () => {
    const result = analyzeSolveText({
      setup: FIXTURE.scramble,
      solution: "x' // inspection\nr' U F U' r U' r' U2 r' U r // xxxcross\nR U2' R2' U' R U R U2' R' // 4th pair\nU' F' r U R' U' r' F R // ZBLL\nR'", // +1 extra move → broken
      method: 'CFOP',
    });
    expect(result).not.toBeNull();
    expect(result!.reconstruction.finalSolved).toBe(false);
  });
});
