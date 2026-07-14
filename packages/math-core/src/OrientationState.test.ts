import { describe, it, expect } from 'vitest';
import { OrientationState } from './OrientationState';

describe('OrientationState', () => {
  describe('offset 0 (standard orientation)', () => {
    it('does not change any face', () => {
      const s = new OrientationState();
      expect(s.mapFaceForDisplay('U')).toBe('U');
      expect(s.mapFaceForDisplay('R')).toBe('R');
      expect(s.mapFaceForDisplay('F')).toBe('F');
      expect(s.mapFaceForDisplay('D')).toBe('D');
      expect(s.mapFaceForDisplay('L')).toBe('L');
      expect(s.mapFaceForDisplay('B')).toBe('B');
    });
  });

  describe('offset 1 (90° CW around Y)', () => {
    it('maps R→B, F→R, L→F, B→L, U→U, D→D', () => {
      const s = new OrientationState();
      s.setOffset(1);
      expect(s.mapFaceForDisplay('U')).toBe('U');
      expect(s.mapFaceForDisplay('D')).toBe('D');
      expect(s.mapFaceForDisplay('R')).toBe('B');
      expect(s.mapFaceForDisplay('F')).toBe('R');
      expect(s.mapFaceForDisplay('L')).toBe('F');
      expect(s.mapFaceForDisplay('B')).toBe('L');
    });
  });

  describe('offset 2 (180° around Y)', () => {
    it('maps R→L, L→R, F→B, B→F', () => {
      const s = new OrientationState();
      s.setOffset(2);
      expect(s.mapFaceForDisplay('U')).toBe('U');
      expect(s.mapFaceForDisplay('D')).toBe('D');
      expect(s.mapFaceForDisplay('R')).toBe('L');
      expect(s.mapFaceForDisplay('L')).toBe('R');
      expect(s.mapFaceForDisplay('F')).toBe('B');
      expect(s.mapFaceForDisplay('B')).toBe('F');
    });
  });

  describe('offset 3 (270° CW around Y)', () => {
    it('maps R→F, F→L, L→B, B→R', () => {
      const s = new OrientationState();
      s.setOffset(3);
      expect(s.mapFaceForDisplay('U')).toBe('U');
      expect(s.mapFaceForDisplay('D')).toBe('D');
      expect(s.mapFaceForDisplay('R')).toBe('F');
      expect(s.mapFaceForDisplay('F')).toBe('L');
      expect(s.mapFaceForDisplay('L')).toBe('B');
      expect(s.mapFaceForDisplay('B')).toBe('R');
    });
  });

  describe('calibrateFromFacelets', () => {
    it('detects offset 0 from solved state', () => {
      const s = new OrientationState();
      s.calibrateFromFacelets('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
      expect(s.getOffset()).toBe(0);
    });

    it('detects offset 1 when U center is R', () => {
      // R at U center position (index 4) means 90° CW rotation
      const facelets = 'RRRRRRRRRUUUUUUUUULLLLLLLLLDDDDDDDDDFFFFFFFFFBBBBBBBBB';
      const s = new OrientationState();
      s.calibrateFromFacelets(facelets);
      expect(s.getOffset()).toBe(1);
    });

    it('detects offset 2 when U center is F (180° Y rotation)', () => {
      // 180° Y: U→U, R→L, F→B, D→D, L→R, B→F
      // So U face shows F's colors, R face shows L's colors, etc.
      const facelets = 'FFFFFFFFFLLLLLLLLLBBBBBBBBBUUUUUUUUURRRRRRRRRDDDDDDDDD';
      const s = new OrientationState();
      s.calibrateFromFacelets(facelets);
      expect(s.getOffset()).toBe(2);
    });

    it('detects offset 3 when U center is L (270° Y rotation)', () => {
      // 270° Y: U→U, R→B, F→R, D→D, L→F, B→L
      // So U face shows L's colors, R face shows B's colors, etc.
      const facelets = 'LLLLLLLLLBBBBBBBBBRRRRRRRRRDDDDDDDDDFFFFFFFFFUUUUUUUUU';
      const s = new OrientationState();
      s.calibrateFromFacelets(facelets);
      expect(s.getOffset()).toBe(3);
    });

    it('preserves offset when U center = D (non-Y rotation)', () => {
      const s = new OrientationState();
      s.setOffset(1);
      // D at U center: not a Y-axis rotation, offset should stay unchanged
      const facelets = 'DDDDDDDDDFFFFFFFFFBBBBBBBBBUUUUUUUUURRRRRRRRRLLLLLLLLL';
      s.calibrateFromFacelets(facelets);
      expect(s.getOffset()).toBe(1); // unchanged
    });

    it('ignores invalid facelet strings', () => {
      const s = new OrientationState();
      s.setOffset(2);
      s.calibrateFromFacelets('short');
      expect(s.getOffset()).toBe(2); // unchanged
    });
  });

  describe('setOffset normalization', () => {
    it('normalizes negative offsets', () => {
      const s = new OrientationState();
      s.setOffset(-1);
      expect(s.getOffset()).toBe(3);
    });

    it('normalizes offsets > 3', () => {
      const s = new OrientationState();
      s.setOffset(5);
      expect(s.getOffset()).toBe(1);
    });

    it('normalizes large negative offsets', () => {
      const s = new OrientationState();
      s.setOffset(-9);
      expect(s.getOffset()).toBe(3);
    });
  });
});
