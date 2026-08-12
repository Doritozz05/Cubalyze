import { describe, expect, it } from 'vitest';
import { resolveDragTurn, type CubeDragSticker } from '../layerPick';

const s = (x: number, y: number, z: number, face: CubeDragSticker['face']): CubeDragSticker => ({
  position: { x, y, z },
  face,
});

const notation = (m: { face: string; direction: number } | null) =>
  m ? `${m.face}${m.direction < 0 ? "'" : ''}` : null;

/**
 * Port of the virtual-cube.net drag model: the move is derived from the
 * geometric relationship between the START sticker and the CURRENT sticker
 * under the pointer — never from the sticker's face alone. These tests pin
 * the exact mapping the reference site produces (verified by hand against
 * its dragCube implementation).
 */
describe('resolveDragTurn — sticker-geometry drag model', () => {
  it('same sticker → no move', () => {
    expect(resolveDragTurn(s(-1, 1, 1, 'F'), s(-1, 1, 1, 'F'))).toBeNull();
  });

  it('non-adjacent stickers (no shared axis) → no move', () => {
    expect(resolveDragTurn(s(-1, 1, 1, 'F'), s(1, -1, -1, 'B'))).toBeNull();
  });

  describe('same cubie — crossing the sticker over its own edge turns the layer', () => {
    it('UFL corner: F sticker dragged up onto its U sticker → U', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'F'), s(-1, 1, 1, 'U')))).toBe('U');
    });

    it('UFR corner: F sticker dragged right onto its R sticker → F\'', () => {
      expect(notation(resolveDragTurn(s(1, 1, 1, 'F'), s(1, 1, 1, 'R')))).toBe("F'");
    });

    it('UBL corner: U sticker dragged down-left onto its L sticker → L', () => {
      expect(notation(resolveDragTurn(s(-1, 1, -1, 'U'), s(-1, 1, -1, 'L')))).toBe('L');
    });

    it('reverse direction gives the opposite move', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'U'), s(-1, 1, 1, 'F')))).toBe("U'");
    });
  });

  describe('same face, same row/column (2 shared axes)', () => {
    it('front face top row dragged right (UFL → UFR) → F', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'F'), s(1, 1, 1, 'F')))).toBe('F');
    });

    it('front face left column dragged down (UFL → DLF) → U\'', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'F'), s(-1, -1, 1, 'F')))).toBe("U'");
    });

    it('front face center line dragged down ((0,0,1) → (0,-1,1)) → E (that slice)', () => {
      expect(notation(resolveDragTurn(s(0, 0, 1, 'F'), s(0, -1, 1, 'F')))).toBe('E');
    });

    it('front face center line dragged right ((0,0,1) → (1,0,1)) → S', () => {
      expect(notation(resolveDragTurn(s(0, 0, 1, 'F'), s(1, 0, 1, 'F')))).toBe('S');
    });

    it("top face: UBL corner dragged forward (toward UFL) → U' (virtual-cube's turnorder direction)", () => {
      expect(notation(resolveDragTurn(s(-1, 1, -1, 'U'), s(-1, 1, 1, 'U')))).toBe("U'");
    });

    it('top face: UBL corner dragged right (toward UBR) → L', () => {
      expect(notation(resolveDragTurn(s(-1, 1, -1, 'U'), s(1, 1, -1, 'U')))).toBe('L');
    });

    it('top face: UF edge dragged right (toward UFR) → R\'', () => {
      expect(notation(resolveDragTurn(s(0, 1, 1, 'U'), s(1, 1, 1, 'U')))).toBe("R'");
    });
  });

  describe('single shared axis (diagonal / edge crossings)', () => {
    it('same-face diagonal (UFL → DFR on F) → no move (virtual-cube bans it)', () => {
      expect(resolveDragTurn(s(-1, 1, 1, 'F'), s(1, -1, 1, 'F'))).toBeNull();
    });

    it('cross-face diagonal (UFL F sticker → UBR U sticker) → F\'', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'F'), s(1, 1, -1, 'U')))).toBe("F'");
    });

    it('corner to far corner sharing only x: UFL F sticker → DBL D sticker → U\'', () => {
      expect(notation(resolveDragTurn(s(-1, 1, 1, 'F'), s(-1, -1, -1, 'D')))).toBe("U'");
    });

    it('crossing the F-R edge from the front-top edge (UF F → UR R) → F', () => {
      expect(notation(resolveDragTurn(s(0, 1, 1, 'F'), s(1, 1, 0, 'R')))).toBe('F');
    });

    it("same-face diagonal ending on B (DBL B → BL B) → U' (DIAGONAL_FUNC face 0 direction)", () => {
      expect(notation(resolveDragTurn(s(-1, -1, -1, 'B'), s(-1, 0, 0, 'B')))).toBe("U'");
    });
  });
});
