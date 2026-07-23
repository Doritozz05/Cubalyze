import { describe, it, expect } from 'vitest';
import { compactMoveNotation } from '../MoveNotationCompactor';

describe('MoveNotationCompactor', () => {
  describe('basic face move compaction', () => {
    it('F F → F2', () => {
      expect(compactMoveNotation(['F', 'F'])).toEqual(['F2']);
    });

    it('F F F → F\'', () => {
      expect(compactMoveNotation(['F', 'F', 'F'])).toEqual(["F'"]);
    });

    it('F F F F → [] (identity)', () => {
      expect(compactMoveNotation(['F', 'F', 'F', 'F'])).toEqual([]);
    });

    it('F F F F F → F', () => {
      expect(compactMoveNotation(['F', 'F', 'F', 'F', 'F'])).toEqual(['F']);
    });

    it('F F F F F F → F2', () => {
      expect(compactMoveNotation(['F', 'F', 'F', 'F', 'F', 'F'])).toEqual(['F2']);
    });
  });

  describe('rotation compaction', () => {
    it('y y → y2', () => {
      expect(compactMoveNotation(['y', 'y'])).toEqual(['y2']);
    });

    it('y y y → y\'', () => {
      expect(compactMoveNotation(['y', 'y', 'y'])).toEqual(["y'"]);
    });

    it('x x → x2', () => {
      expect(compactMoveNotation(['x', 'x'])).toEqual(['x2']);
    });

    it('z z → z2', () => {
      expect(compactMoveNotation(['z', 'z'])).toEqual(['z2']);
    });

    it('x x x → x\'', () => {
      expect(compactMoveNotation(['x', 'x', 'x'])).toEqual(["x'"]);
    });

    it("x' x' → x2", () => {
      expect(compactMoveNotation(["x'", "x'"])).toEqual(['x2']);
    });
  });

  describe('face variants', () => {
    it('R R → R2', () => {
      expect(compactMoveNotation(['R', 'R'])).toEqual(['R2']);
    });

    it('U U U → U\'', () => {
      expect(compactMoveNotation(['U', 'U', 'U'])).toEqual(["U'"]);
    });

    it('L L → L2', () => {
      expect(compactMoveNotation(['L', 'L'])).toEqual(['L2']);
    });

    it('D D D → D\'', () => {
      expect(compactMoveNotation(['D', 'D', 'D'])).toEqual(["D'"]);
    });

    it('B B → B2', () => {
      expect(compactMoveNotation(['B', 'B'])).toEqual(['B2']);
    });
  });

  describe('mixed modifiers', () => {
    it("F F' → [] (cancel)", () => {
      expect(compactMoveNotation(['F', "F'"])).toEqual([]);
    });

    it("F2 F → F'", () => {
      expect(compactMoveNotation(['F2', 'F'])).toEqual(["F'"]);
    });

    it("F' F2 → F", () => {
      expect(compactMoveNotation(["F'", 'F2'])).toEqual(['F']);
    });

    it("F' F' → F2", () => {
      expect(compactMoveNotation(["F'", "F'"])).toEqual(['F2']);
    });

    it("F' F' F' → F", () => {
      expect(compactMoveNotation(["F'", "F'", "F'"])).toEqual(['F']);
    });

    it('F2 F2 → [] (identity)', () => {
      expect(compactMoveNotation(['F2', 'F2'])).toEqual([]);
    });

    it("F2 F' → F", () => {
      expect(compactMoveNotation(['F2', "F'"])).toEqual(['F']);
    });
  });

  describe('different bases do not compact', () => {
    it('F R F → stays F R F', () => {
      expect(compactMoveNotation(['F', 'R', 'F'])).toEqual(['F', 'R', 'F']);
    });

    it('R U R → stays R U R', () => {
      expect(compactMoveNotation(['R', 'U', 'R'])).toEqual(['R', 'U', 'R']);
    });

    it('U D stays separate', () => {
      expect(compactMoveNotation(['U', 'D'])).toEqual(['U', 'D']);
    });
  });

  describe('rotations break face groups', () => {
    it('F y F → stays F y F', () => {
      expect(compactMoveNotation(['F', 'y', 'F'])).toEqual(['F', 'y', 'F']);
    });

    it('F x F → stays F x F', () => {
      expect(compactMoveNotation(['F', 'x', 'F'])).toEqual(['F', 'x', 'F']);
    });

    it('R z R → stays R z R', () => {
      expect(compactMoveNotation(['R', 'z', 'R'])).toEqual(['R', 'z', 'R']);
    });

    it('R2 y R → stays R2 y R', () => {
      expect(compactMoveNotation(['R2', 'y', 'R'])).toEqual(['R2', 'y', 'R']);
    });
  });

  describe('rotations with different axes do not compact', () => {
    it('x y stays separate', () => {
      expect(compactMoveNotation(['x', 'y'])).toEqual(['x', 'y']);
    });

    it('y z stays separate', () => {
      expect(compactMoveNotation(['y', 'z'])).toEqual(['y', 'z']);
    });
  });

  describe('complex sequences', () => {
    it('R U R\' U\' stays unchanged (different bases)', () => {
      expect(compactMoveNotation(['R', 'U', "R'", "U'"])).toEqual([
        'R', 'U', "R'", "U'",
      ]);
    });

    it('F F R R → F2 R2', () => {
      expect(compactMoveNotation(['F', 'F', 'R', 'R'])).toEqual(['F2', 'R2']);
    });

    it('y y R R y → y2 R2 y', () => {
      expect(compactMoveNotation(['y', 'y', 'R', 'R', 'y'])).toEqual([
        'y2', 'R2', 'y',
      ]);
    });

    it('F F y y R R R U U U → F2 y2 R\' U\'', () => {
      expect(
        compactMoveNotation(['F', 'F', 'y', 'y', 'R', 'R', 'R', 'U', 'U', 'U']),
      ).toEqual(['F2', 'y2', "R'", "U'"]);
    });
  });

  describe('unknown tokens pass through', () => {
    it('passes through unknown tokens unchanged', () => {
      expect(compactMoveNotation(['F', 'unknown', 'R'])).toEqual([
        'F', 'unknown', 'R',
      ]);
    });

    it('handles empty array', () => {
      expect(compactMoveNotation([])).toEqual([]);
    });

    it('handles single token', () => {
      expect(compactMoveNotation(['F'])).toEqual(['F']);
    });
  });

  describe('edge cases', () => {
    it('handles three of same with modifier: F2 F2 F → F', () => {
      expect(compactMoveNotation(['F2', 'F2', 'F'])).toEqual(['F']);
    });

    it("F' F' F' F' → [] (4 CCW = identity)", () => {
      expect(compactMoveNotation(["F'", "F'", "F'", "F'"])).toEqual([]);
    });

    it('long sequence: F F R R F F → F2 R2 F2', () => {
      expect(compactMoveNotation(['F', 'F', 'R', 'R', 'F', 'F'])).toEqual([
        'F2', 'R2', 'F2',
      ]);
    });

    it('R2 U2 stays as is', () => {
      expect(compactMoveNotation(['R2', 'U2'])).toEqual(['R2', 'U2']);
    });

    it('x2 x2 → [] (identity)', () => {
      expect(compactMoveNotation(['x2', 'x2'])).toEqual([]);
    });

    it('z z y y x x → z2 y2 x2', () => {
      expect(compactMoveNotation(['z', 'z', 'y', 'y', 'x', 'x'])).toEqual([
        'z2', 'y2', 'x2',
      ]);
    });
  });

  describe('wide move pair combining (BLE hardware sensor decomposition)', () => {
    it('combines [L, x] → r', () => {
      expect(compactMoveNotation(['L', 'x'])).toEqual(['r']);
    });

    it('combines [x, L] → r', () => {
      expect(compactMoveNotation(['x', 'L'])).toEqual(['r']);
    });

    it("combines [L', x'] → r'", () => {
      expect(compactMoveNotation(["L'", "x'"])).toEqual(["r'"]);
    });

    it("combines [x', L'] → r'", () => {
      expect(compactMoveNotation(["x'", "L'"])).toEqual(["r'"]);
    });

    it("combines [R, x'] → l", () => {
      expect(compactMoveNotation(['R', "x'"])).toEqual(['l']);
    });

    it("combines [R', x] → l'", () => {
      expect(compactMoveNotation(["R'", 'x'])).toEqual(["l'"]);
    });

    it('combines [D, y] → u', () => {
      expect(compactMoveNotation(['D', 'y'])).toEqual(['u']);
    });

    it("combines [D', y'] → u'", () => {
      expect(compactMoveNotation(["D'", "y'"])).toEqual(["u'"]);
    });

    it("combines [U, y'] → d", () => {
      expect(compactMoveNotation(['U', "y'"])).toEqual(['d']);
    });

    it("combines [U', y] → d'", () => {
      expect(compactMoveNotation(["U'", 'y'])).toEqual(["d'"]);
    });

    it('combines [B, z] → f', () => {
      expect(compactMoveNotation(['B', 'z'])).toEqual(['f']);
    });

    it("combines [B', z'] → f'", () => {
      expect(compactMoveNotation(["B'", "z'"])).toEqual(["f'"]);
    });

    it("combines [F, z'] → b", () => {
      expect(compactMoveNotation(['F', "z'"])).toEqual(['b']);
    });

    it("combines [F', z] → b'", () => {
      expect(compactMoveNotation(["F'", 'z'])).toEqual(["b'"]);
    });

    it("combines in a sequence: R U L' x' U L x → R U r' U r", () => {
      expect(compactMoveNotation(['R', 'U', "L'", "x'", 'U', 'L', 'x'])).toEqual([
        'R', 'U', "r'", 'U', 'r',
      ]);
    });
  });
});
