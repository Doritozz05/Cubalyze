import { describe, expect, it } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * isSolvedUpToRotation — a cube whose six faces are each monochromatic is a
 * solved cube, even when it sits in a rotated frame (reconstructions often
 * end "solved up to one whole-cube rotation"). `isSolved()` requires the
 * exact canonical orientation; `isSolvedUpToRotation()` must accept any of
 * the 24 rotations of the solved cube and reject everything else.
 */
describe('CubeState.isSolvedUpToRotation', () => {
  it('accepts the exact solved state', () => {
    const c = new CubeState();
    expect(c.isSolved()).toBe(true);
    expect(c.isSolvedUpToRotation()).toBe(true);
  });

  it('accepts every base whole-cube rotation of the solved cube', () => {
    for (const seq of [
      'x',
      "x'",
      'x2',
      'y',
      "y'",
      'y2',
      'z',
      "z'",
      'z2',
      "x y2 z'",
      "y z x2",
      "z' y x",
    ]) {
      const c = new CubeState();
      c.applySequence(seq);
      expect(c.isSolved()).toBe(false);
      expect(c.isSolvedUpToRotation()).toBe(true);
    }
  });

  it('accepts a full scramble + solution that ends rotated (wide moves)', () => {
    // reconz-12564 (Teodor Zajder) — the real dataset record that the panel
    // marks "Inconsistent": the solve IS perfect, it just finishes in a
    // rotated frame.
    const c = new CubeState();
    c.applySequence("L B R2 B' R2 U2 F D R2 U R2 F2 D2 R U B L2");
    c.applySequence(
      "x' r' U F U' r U' r' U2 r' U r R U2' R2' U' R U R U2' R' U' F' r U R' U' r' F R",
    );
    expect(c.isSolved()).toBe(false); // canonical orientation not matched
    expect(c.isSolvedUpToRotation()).toBe(true); // but the cube IS solved
  });

  it('rejects a genuinely scrambled cube', () => {
    const c = new CubeState();
    c.applySequence("R U R'");
    expect(c.isSolvedUpToRotation()).toBe(false);
  });

  it('rejects a cube with a single corner twisted in place', () => {
    // Piece 0 (URF) sits home but twisted by +1: every face still has its
    // own pieces, yet this is NOT a rotation of the solved cube.
    const c = new CubeState(
      [0, 1, 2, 3, 4, 5, 6, 7],
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );
    expect(c.isSolvedUpToRotation()).toBe(false);
  });

  it('rejects a cube with a single edge flipped in place', () => {
    const c = new CubeState(
      [0, 1, 2, 3, 4, 5, 6, 7],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );
    expect(c.isSolvedUpToRotation()).toBe(false);
  });
});
