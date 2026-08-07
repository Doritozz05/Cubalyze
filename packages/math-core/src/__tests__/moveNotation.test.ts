import { describe, expect, it } from 'vitest';
import {
  tokenize,
  foldAdjacentSameFace,
  stripRotations,
  leadingUMoves,
  withoutLeadingUMoves,
  isRotation,
} from '../notation/moveNotation';

describe('moveNotation.tokenize', () => {
  it('normalizes unicode primes', () => {
    expect(tokenize("R’ F′ U´")).toEqual(["R'", "F'", "U'"]);
  });

  it('splits glued tokens', () => {
    expect(tokenize('RUR\'U\'')).toEqual(['R', 'U', "R'", "U'"]);
  });

  it('normalizes numbered turns', () => {
    expect(tokenize('R3 U3 D3')).toEqual(["R'", "U'", "D'"]);
    expect(tokenize('R4')).toEqual([]);
  });

  it('expands wide moves', () => {
    expect(tokenize('r')).toEqual(['R', "M'"]);
    expect(tokenize("r'")).toEqual(["R'", 'M']);
  });

  it('drops parenthesized groups and stray separators', () => {
    expect(tokenize('(R U R\' U\') ↑ D')).toEqual(['R', 'U', "R'", "U'", 'D']);
  });

  it('expands parenthesized groups with a multiplier: (F D)3 → F D F D F D', () => {
    expect(tokenize('(F D)3')).toEqual(['F', 'D', 'F', 'D', 'F', 'D']);
    expect(tokenize("U (R U R' U')2")).toEqual([
      'U', 'R', 'U', "R'", "U'", 'R', 'U', "R'", "U'",
    ]);
  });

  it('drops inline // comments from phase segments', () => {
    expect(tokenize('U R // pair insert')).toEqual(['U', 'R']);
    expect(tokenize("R' D R // W Cross\nU L' U L")).toEqual(["R'", 'D', 'R', 'U', "L'", 'U', 'L']);
  });

  it('splits CubeRoot ↓ / ↑ / · / . separators (regrip markers)', () => {
    // Note: expandWideMoves normalizes `2'` → `2` (U2' ≡ U2), so "U2'" → "U2".
    expect(tokenize("x'↓R U2 R U'")).toEqual(["x'", 'R', 'U2', 'R', "U'"]);
    expect(tokenize("R U'.R U' R' U R U'")).toEqual(['R', "U'", 'R', "U'", "R'", 'U', 'R', "U'"]);
    expect(tokenize("↑B U2'")).toEqual(['B', 'U2']);
    expect(tokenize("x'↓R2 U R2'")).toEqual(["x'", 'R2', 'U', 'R2']);
  });

  it('keeps rotations and slices', () => {
    expect(tokenize("z y x' M2 E")).toEqual(['z', 'y', "x'", 'M2', 'E']);
  });
});

describe('moveNotation.foldAdjacentSameFace (Quest-style)', () => {
  it('folds U U into U2', () => {
    expect(foldAdjacentSameFace(['U', 'U'])).toEqual(['U2']);
  });

  it('folds U2 U into U\'', () => {
    expect(foldAdjacentSameFace(['U2', 'U'])).toEqual(["U'"]);
  });

  it('cancels U U\' completely', () => {
    expect(foldAdjacentSameFace(['U', "U'"])).toEqual([]);
  });

  it('cancels U2 U2 completely', () => {
    expect(foldAdjacentSameFace(['U2', 'U2'])).toEqual([]);
  });

  it('only folds adjacent same-face moves', () => {
    expect(foldAdjacentSameFace(['R', 'U', 'U', "R'"])).toEqual(['R', 'U2', "R'"]);
    expect(foldAdjacentSameFace(['U', 'R', 'U'])).toEqual(['U', 'R', 'U']);
  });

  it('passes rotations through untouched and does not fold across them', () => {
    expect(foldAdjacentSameFace(["y'", 'R', 'U', 'R', "U'"])).toEqual(["y'", 'R', 'U', 'R', "U'"]);
    expect(foldAdjacentSameFace(["y'", 'U', 'U', "U'", 'R'])).toEqual(["y'", 'U', 'R']);
  });

  it('folds the actual Quest example U2 U → U\'', () => {
    expect(foldAdjacentSameFace(tokenize('U2 U L U\' L\''))).toEqual(tokenize("U' L U' L'"));
  });
});

describe('moveNotation.helpers', () => {
  it('classifies rotations', () => {
    expect(isRotation('x')).toBe(true);
    expect(isRotation("y'")).toBe(true);
    expect(isRotation('z2')).toBe(true);
    expect(isRotation('R')).toBe(false);
  });

  it('strips rotations', () => {
    expect(stripRotations(tokenize("z y R U R' U'"))).toEqual(['R', 'U', "R'", "U'"]);
  });

  it('extracts and strips leading U moves', () => {
    expect(leadingUMoves(tokenize("U2 y' R U R' U'"))).toEqual(['U2']);
    expect(withoutLeadingUMoves(tokenize("U2 y' R U R' U'"))).toEqual(["y'", 'R', 'U', "R'", "U'"]);
    expect(leadingUMoves(tokenize("R U R' U'"))).toEqual([]);
  });
});
