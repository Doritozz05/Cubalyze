import { describe, expect, it } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * findRecoveryRotation — recovers the whole-cube rotation that maps a
 * "solved up to rotation" state onto the CANONICAL solved cube. This is the
 * engine behind P2 (frame recovery): a reconstruction whose final state is
 * uniform but rotated gets all its snapshots rotated by this rotation, so
 * phase detection runs in a frame where the final state is exactly solved.
 */
describe('CubeState.findRecoveryRotation', () => {
  it('returns a rotation that resolves the rotated solved cube', () => {
    for (const seq of [
      'x',
      "x'",
      'x2',
      'y',
      "y'",
      'y2',
      'z',
      "z'",
      "x y2 z'",
      "y z x2",
      "z' y x",
    ]) {
      const c = new CubeState();
      c.applySequence(seq);
      expect(c.isSolved()).toBe(false);
      const rot = c.findRecoveryRotation();
      expect(rot).not.toBeNull();
      const candidate = c.clone();
      candidate.multiply(rot!);
      expect(candidate.isSolved()).toBe(true);
    }
  });

  it('returns a rotation for the exact solved state (identity works)', () => {
    const c = new CubeState();
    const rot = c.findRecoveryRotation();
    expect(rot).not.toBeNull();
    const candidate = c.clone();
    candidate.multiply(rot!);
    expect(candidate.isSolved()).toBe(true);
  });

  it('recovers the frame of a full scramble + wide-move solution', () => {
    // reconz-12564 — the real record: perfect solve ending in a rotated frame.
    const c = new CubeState();
    c.applySequence("L B R2 B' R2 U2 F D R2 U R2 F2 D2 R U B L2");
    c.applySequence(
      "x' r' U F U' r U' r' U2 r' U r R U2' R2' U' R U R U2' R' U' F' r U R' U' r' F R",
    );
    expect(c.isSolvedUpToRotation()).toBe(true);
    const rot = c.findRecoveryRotation();
    expect(rot).not.toBeNull();
    const candidate = c.clone();
    candidate.multiply(rot!);
    expect(candidate.isSolved()).toBe(true);
  });

  it('returns null for a genuinely scrambled cube', () => {
    const c = new CubeState();
    c.applySequence("R U R'");
    expect(c.findRecoveryRotation()).toBeNull();
  });

  it('returns null for a cube with a corner twisted in place', () => {
    const c = new CubeState(
      [0, 1, 2, 3, 4, 5, 6, 7],
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );
    expect(c.findRecoveryRotation()).toBeNull();
  });
});
