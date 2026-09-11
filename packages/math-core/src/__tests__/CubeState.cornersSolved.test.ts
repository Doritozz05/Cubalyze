import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';

describe('CubeState.isCornersSolved — 3×3 as 2×2 mode', () => {
  it('solved cube reports corners solved', () => {
    expect(new CubeState().isCornersSolved()).toBe(true);
  });

  it('scramble moves report corners unsolved', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U'");
    expect(cube.isCornersSolved()).toBe(false);
  });

  it('corners solved with edges scrambled still reports true', () => {
    const cube = new CubeState();
    // M moves cycle edges only — corners stay home and oriented.
    cube.applySequence('M M M M');
    expect(cube.isSolved()).toBe(true); // M4 = identity, sanity
    cube.applySequence('M');
    expect(cube.isSolved()).toBe(false);
    expect(cube.isCornersSolved()).toBe(true);
  });

  it('corner twist reports false', () => {
    const cube = new CubeState();
    cube.applySequence('R U R\' U R U2 R\'');
    expect(cube.isCornersSolved()).toBe(false);
  });

  it('2x2 scramble solved via inverse restores corners', () => {
    const cube = new CubeState();
    const scramble = 'R U R\' F R U R\' U\' F\'';
    cube.applySequence(scramble);
    expect(cube.isCornersSolved()).toBe(false);
    // Undo in reverse: invert each token.
    const inverse = scramble
      .split(' ')
      .reverse()
      .map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`))
      .join(' ');
    cube.applySequence(inverse);
    expect(cube.isCornersSolved()).toBe(true);
  });

  it('wide move affects corners (r moves the R corners)', () => {
    const cube = new CubeState();
    cube.applySequence('r');
    expect(cube.isCornersSolved()).toBe(false);
  });
});
