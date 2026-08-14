import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { ColorPhaseDetector } from '../methods/cfop/ColorPhaseDetector';

/**
 * strictCrossSpurious.test.ts — regression for the strict-mode "spurious
 * cross" bug (real smart-cube solve).
 *
 * On this solve the scramble + first three moves accidentally put the 4
 * white stickers on the U face (a "completed" cross at index 3) with the
 * edges in a SWAPPED order — a reflection, not a rotation. Every scheme
 * `buildScheme` derives from that is therefore mirrored, so the F2L/OLL
 * chain never completes under it. The OLD strict detector locked onto that
 * first hit, discarded the U candidate as incomplete, and then returned a
 * different spurious candidate (a cross on the F face at index 72 whose
 * F2L/OLL/PLL all "complete" only at the final solved state). The reported
 * solve was then Cross(58m) → F2L(35m) → OLL skip → PLL skip with a false
 * xcross.
 *
 * The fix: strict mode evaluates EVERY valid strict completion (not just the
 * first), keeping the earliest COMPLETE chain per (face, color), mirroring
 * relaxed mode. The real cross (index 13) has a complete chain and wins.
 */

const SCRAMBLE = "U2 F U2 B2 U2 L2 B' L2 B' D2 R2 B2 D' L' U' L' F R B' F R2";

const SOLVE = (
  "U' B L L L L D D R' R' D' D' L L D' L D' D' L' D R D R' L D L' D' D' D D' " +
  "B D B' D D D D R' D' R D' R' D R D' F' D F D F' D F D' F' D F B D' D' B' B' " +
  "D' B B D' B' B' D' D' B D B D B' L' B D B' D' D D' B' L B B D' B' D' B F' R' F " +
  "B' F B' L' F B' F B' R' B F' U' U' F B' F B' D' D'"
).split(/\s+/).filter(Boolean);

function trajectory(): CubeState[] {
  const s = new CubeState();
  s.applySequence(SCRAMBLE);
  return SOLVE.map((m) => {
    s.applySequence(m);
    return s.clone();
  });
}

describe('strict cross detection does not lock onto a spurious cross', () => {
  it('finds the real early cross with a complete chain, not a late end-of-solve cross', () => {
    const states = trajectory();
    const result = ColorPhaseDetector.detect(states);
    expect(result).not.toBeNull();

    const last = states.length - 1;
    // A real cross, not the spurious ~72-move late cross.
    expect(result!.completions[0]).toBeLessThan(30);
    // F2L and OLL must complete strictly before the final solved state —
    // a spurious candidate crams them all at the last index.
    expect(result!.completions[1]).toBeGreaterThanOrEqual(0);
    expect(result!.completions[1]).toBeLessThan(last);
    expect(result!.completions[2]).toBeLessThan(last);
    expect(result!.completions[3]).toBe(last);
    // The winning cross is the white cross on U (the solver's actual cross).
    expect(result!.crossFace).toBe('U');
    expect(result!.crossColor).toBe('U');
  });

  it('matches the relaxed result for this solve', () => {
    const states = trajectory();
    const strict = ColorPhaseDetector.detect(states);
    const relaxed = ColorPhaseDetector.detect(states, undefined, { relaxedCross: true });
    expect(relaxed).not.toBeNull();
    expect(strict!.completions).toEqual(relaxed!.completions);
    expect(strict!.crossFace).toBe(relaxed!.crossFace);
  });
});
