import { describe, expect, it } from 'vitest';
import { CubeState } from '@cubalyze/math-core';
import type { CubeStateSnapshot } from '@cubalyze/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

function snapEquals(a: CubeStateSnapshot, b: CubeStateSnapshot): boolean {
  return (
    a.ep.join(',') === b.ep.join(',') &&
    a.cp.join(',') === b.cp.join(',') &&
    a.eo.join(',') === b.eo.join(',') &&
    a.co.join(',') === b.co.join(',')
  );
}

function rotatedBy(snapshot: CubeStateSnapshot, seq: string): CubeStateSnapshot {
  const c = TimelineBuilder.fromSnapshot(snapshot);
  c.applySequence(seq);
  return TimelineBuilder.toSnapshot(c);
}

/**
 * cuberoot-2010 — Yiheng Wang (王艺衡), 3.08 WR solve, XMUM Cube Open 2025 —
 * the exact record the user reported: the reconstructionist labels pairs by
 * COLOR (OB, RG, OG, RB), which in the canonical frame are the slots
 * BL, FR, FL, BR. The old detector read F2L 1 as BR (blue-red) and "lost"
 * the blue-orange pair — the reported color-detection bug.
 *
 * The solver's inspection grip is `x z'` — a MULTI-TOKEN grip. The written
 * order grip inverse (`x'` then `z`) is a DIFFERENT rotation than the
 * recovery rotation the frame recovery applies (`z`): empirically `x' z ≡ y`
 * here, which rotates every slot name one step. The solver-frame states
 * (which drive the slot analysis) must be rotated by the RECOVERY rotation —
 * the frame where the final state is canonically solved, i.e. where the
 * reconstructionist's color labels live — not by the written-order token
 * inverse. Single-token grips (reconz-12564's `x'`) agree either way, which
 * is why the bug only surfaced on multi-token grips.
 *
 * The raw text is copied verbatim from the dataset (including the `.`, `↑`,
 * `R3` and `(…)` transcription quirks — the tokenizer tolerates them).
 */
const SCRAMBLE = "U2 F B U2 F2 U' D2 L' R2 U L2 D' B2 R2 L2 D F2 U R";
const SOLUTION = [
  "x z' // insp",
  "D'U' r R' DU' R' U'D // W cross",
  "R U R' // OB",
  "·L U L' U' L U L2' // RG cancel into",
  "U' L // OG",
  "U2 R' U R U' R' U R // RB/OLL(CP) Skip",
  "U'↑R' U R' U' R3 U' R' U R U (R' U' U R') U' // EPLL-U+",
].join('\n');

describe('reconz-2010 (Yiheng Wang 3.08 — multi-token grip slot names)', () => {
  it('names the pairs BL/FR/FL/BR — the canonical homes of OB/RG/OG/RB', () => {
    const result = analyzeSolveText({
      setup: SCRAMBLE,
      solution: SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
      totalTimeMs: 3080,
    });
    expect(result).not.toBeNull();
    const { reconstruction, timeline } = result;
    const report = timeline.detectionReport!;

    // The cross is white, on U, in the canonical frame — the reconstruction
    // is coherent and the pair labels must be the canonical ones.
    expect(reconstruction.finalSolved).toBe(true);
    expect(report.crossFace).toBe('U');
    expect(report.crossColor).toBe('U');
    expect(reconstruction.scheme).toEqual({
      U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B',
    });

    // OB → BL, RG → FR, OG → FL, RB → BR — exactly the reconstructionist's
    // color labels, in the canonical frame. (Before the fix these came out
    // y-rotated: BR, BL, FL, FR.)
    expect(reconstruction.pairs.map((p) => p.slot)).toEqual([
      'BL', 'FR', 'FL', 'BR',
    ]);
    expect(reconstruction.pairs.map((p) => p.colors)).toEqual([
      ['B', 'L'], // OB — orange-blue
      ['F', 'R'], // RG — red-green
      ['F', 'L'], // OG — orange-green
      ['B', 'R'], // RB — red-blue
    ]);

    // The per-pair moves are the solver's raw notation, unchanged.
    expect(reconstruction.pairs[0].moves).toEqual(['R', 'U', "R'"]);
    expect(reconstruction.pairs[1].moves).toEqual([
      'L', 'U', "L'", "U'", 'L', 'U', "L2'", "U'", 'L',
    ]);
    expect(reconstruction.pairs[2].moves).toEqual([]); // OG home when F2L ends
    expect(reconstruction.pairs[3].moves).toEqual([
      'U2', "R'", 'U', 'R', "U'", "R'", 'U', 'R',
    ]);
    expect(reconstruction.pairs.map((p) => p.completionIndex)).toEqual([
      11, 20, 20, 28,
    ]);
  });

  it('uses the identity rotation when a grip solve ends canonically solved', () => {
    // Grip `x2` with a solution written in the x2 frame that exactly undoes
    // the scramble: the conjugated final state is canonical, so the solver
    // frame IS the scramble frame (identity rotation), not the grip inverse
    // (x2's inverse is x2 — the two would disagree on the slot naming frame
    // even though here no slots exist to name).
    const result = analyzeSolveText({
      setup: "R U R'",
      inspection: 'x2',
      solution: "R D' R'",
      method: 'CFOP',
    });
    const { timeline } = result;
    const sfs = timeline.solverFrameStates!;
    expect(sfs.length).toBe(timeline.entries.length);
    // Identity branch: the preserved solver-frame states equal the entries.
    expect(snapEquals(sfs[0], timeline.entries[0].state)).toBe(true);
    expect(timeline.detectionReport?.finalStateSolved).toBe(true);
  });

  it('falls back to the written-order grip inverse for an inconsistent solve', () => {
    // Grip `x'` but the solution does NOT undo the scramble (final state is
    // not uniform) → no recovery rotation exists, so the solver-frame states
    // must be the written-order grip inverse of the entries (the previous
    // behavior) rather than crash.
    const result = analyzeSolveText({
      setup: "R U R'",
      inspection: "x'",
      solution: "R D' R'",
      method: 'CFOP',
    });
    const { timeline } = result;
    const sfs = timeline.solverFrameStates!;
    const gripInverse = rotatedBy(timeline.entries[0].state, 'x');
    expect(snapEquals(sfs[0], gripInverse)).toBe(true);
    expect(timeline.detectionReport?.finalStateSolved).toBe(false);
  });
});
