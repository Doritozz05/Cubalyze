import { describe, it, expect } from 'vitest';
import { expandWideMoves } from '../MoveExpander';
import { CubeState } from '../CubeState';

describe('MoveExpander', () => {
  it('expands wide moves into face + slice moves', () => {
    expect(expandWideMoves("r u f l d b")).toEqual([
      'R', "M'", 'U', "E'", 'F', 'S', 'L', 'M', 'D', 'E', 'B', "S'"
    ]);
  });

  it('expands prime wide moves into face + slice moves', () => {
    expect(expandWideMoves("r' u' f' l' d' b'")).toEqual([
      "R'", 'M', "U'", 'E', "F'", "S'", "L'", "M'", "D'", "E'", "B'", 'S'
    ]);
  });

  it('expands double wide moves into face + slice moves', () => {
    expect(expandWideMoves("r2 u2 f2 l2 d2 b2")).toEqual([
      'R2', 'M2', 'U2', 'E2', 'F2', 'S2', 'L2', 'M2', 'D2', 'E2', 'B2', 'S2'
    ]);
  });

  it('preserves elementary face and slice moves', () => {
    expect(expandWideMoves("R U' M2 S' x y2")).toEqual([
      'R', "U'", 'M2', "S'", 'x', 'y2'
    ]);
  });

  it('allows CubeState.applySequence to execute wide moves directly', () => {
    const s1 = new CubeState();
    s1.applySequence("r U R' U'");

    const s2 = new CubeState();
    s2.applySequence("R M' U R' U'");

    expect(Array.from(s1.cp)).toEqual(Array.from(s2.cp));
    expect(Array.from(s1.ep)).toEqual(Array.from(s2.ep));
    expect(Array.from(s1.co)).toEqual(Array.from(s2.co));
    expect(Array.from(s1.eo)).toEqual(Array.from(s2.eo));
  });
});
