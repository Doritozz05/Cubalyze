import { describe, it, expect } from 'vitest';
import { MoveTransformer } from '../MoveTransformer';
import { OrientationTable } from '../OrientationTable';
import type { CubeMoveEvent, FacePermutation } from '@cubeforge/types';

// Helper: create a raw CubeMoveEvent
function rawMove(face: string, direction: 1 | -1 | 2): CubeMoveEvent {
  return {
    face: face as CubeMoveEvent['face'],
    direction,
    cubeTimestamp: 1000,
    hostTimestamp: 2000,
  };
}

// Helper: get orientation entry by face map
function orient(map: FacePermutation) {
  return OrientationTable.fromFaceMap(map);
}

const IDENTITY = OrientationTable.IDENTITY;

const Y_MAP: FacePermutation = { U: 'U', D: 'D', F: 'R', B: 'L', L: 'F', R: 'B' };
const X_MAP: FacePermutation = { U: 'F', D: 'B', F: 'D', B: 'U', L: 'L', R: 'R' };
const Z_MAP: FacePermutation = { U: 'L', D: 'R', F: 'F', B: 'B', L: 'D', R: 'U' };
const Y2_MAP: FacePermutation = { U: 'U', D: 'D', F: 'B', B: 'F', L: 'R', R: 'L' };
const YP_MAP: FacePermutation = { U: 'U', D: 'D', F: 'L', B: 'R', L: 'B', R: 'F' };

describe('MoveTransformer', () => {
  describe('toDisplay — identity orientation', () => {
    it('identity: raw F CW → display F CW', () => {
      const result = MoveTransformer.toDisplay(rawMove('F', 1), IDENTITY);
      expect(result.face).toBe('F');
      expect(result.direction).toBe(1);
    });

    it("identity: raw R' → display R'", () => {
      const result = MoveTransformer.toDisplay(rawMove('R', -1), IDENTITY);
      expect(result.face).toBe('R');
      expect(result.direction).toBe(-1);
    });

    it('identity: raw U2 → display U2', () => {
      const result = MoveTransformer.toDisplay(rawMove('U', 2), IDENTITY);
      expect(result.face).toBe('U');
      expect(result.direction).toBe(2);
    });
  });

  describe('toDisplay — after y rotation', () => {
    it('y: raw F CW → display L CW', () => {
      // After y, position L has original F. So raw F is at position L.
      const result = MoveTransformer.toDisplay(rawMove('F', 1), orient(Y_MAP));
      expect(result.face).toBe('L');
      expect(result.direction).toBe(1);
    });

    it('y: raw R CW → display F CW', () => {
      // After y, position F has original R. So raw R is at position F.
      const result = MoveTransformer.toDisplay(rawMove('R', 1), orient(Y_MAP));
      expect(result.face).toBe('F');
      expect(result.direction).toBe(1);
    });

    it('y: raw U CW → display U CW (U unchanged by y)', () => {
      const result = MoveTransformer.toDisplay(rawMove('U', 1), orient(Y_MAP));
      expect(result.face).toBe('U');
      expect(result.direction).toBe(1);
    });

    it("y: raw F' → display L' (direction preserved)", () => {
      const result = MoveTransformer.toDisplay(rawMove('F', -1), orient(Y_MAP));
      expect(result.face).toBe('L');
      expect(result.direction).toBe(-1);
    });

    it('y: raw R2 → display F2 (direction preserved)', () => {
      const result = MoveTransformer.toDisplay(rawMove('R', 2), orient(Y_MAP));
      expect(result.face).toBe('F');
      expect(result.direction).toBe(2);
    });
  });

  describe('toDisplay — after x rotation', () => {
    it('x: raw U CW → display B CW (U moved to B position)', () => {
      const result = MoveTransformer.toDisplay(rawMove('U', 1), orient(X_MAP));
      expect(result.face).toBe('B');
      expect(result.direction).toBe(1);
    });

    it('x: raw F CW → display U CW (F moved to U position)', () => {
      const result = MoveTransformer.toDisplay(rawMove('F', 1), orient(X_MAP));
      expect(result.face).toBe('U');
      expect(result.direction).toBe(1);
    });
  });

  describe('toDisplay — after z rotation', () => {
    it('z: raw U CW → display R CW (U moved to R position)', () => {
      const result = MoveTransformer.toDisplay(rawMove('U', 1), orient(Z_MAP));
      expect(result.face).toBe('R');
      expect(result.direction).toBe(1);
    });
  });

  describe('toDisplay — after y2 rotation', () => {
    it('y2: raw F CW → display B CW (F<->B swap)', () => {
      const result = MoveTransformer.toDisplay(rawMove('F', 1), orient(Y2_MAP));
      expect(result.face).toBe('B');
      expect(result.direction).toBe(1);
    });

    it('y2: raw L CW → display R CW (L<->R swap)', () => {
      const result = MoveTransformer.toDisplay(rawMove('L', 1), orient(Y2_MAP));
      expect(result.face).toBe('R');
      expect(result.direction).toBe(1);
    });
  });

  describe('toRaw — round-trip reversibility', () => {
    it('round-trip: raw F CW after y → display → raw again', () => {
      const o = orient(Y_MAP);
      const r = rawMove('F', 1);
      const d = MoveTransformer.toDisplay(r, o);
      const back = MoveTransformer.toRaw(d, o);
      expect(back.face).toBe('F');
      expect(back.direction).toBe(1);
    });

    it('round-trip: raw R2 after x → display → raw again', () => {
      const o = orient(X_MAP);
      const r = rawMove('R', 2);
      const d = MoveTransformer.toDisplay(r, o);
      const back = MoveTransformer.toRaw(d, o);
      expect(back.face).toBe('R');
      expect(back.direction).toBe(2);
    });

    it('round-trip: raw U after z → display → raw again', () => {
      const o = orient(Z_MAP);
      const r = rawMove('U', -1);
      const d = MoveTransformer.toDisplay(r, o);
      const back = MoveTransformer.toRaw(d, o);
      expect(back.face).toBe('U');
      expect(back.direction).toBe(-1);
    });
  });

  describe('toDisplayNotation', () => {
    it('produces correct notation string for identity', () => {
      expect(MoveTransformer.toDisplayNotation(rawMove('R', -1), IDENTITY)).toBe("R'");
    });

    it('produces correct notation string after y', () => {
      expect(MoveTransformer.toDisplayNotation(rawMove('R', 1), orient(Y_MAP))).toBe('F');
    });

    it('produces correct 2 notation', () => {
      expect(MoveTransformer.toDisplayNotation(rawMove('U', 2), IDENTITY)).toBe('U2');
    });
  });

  describe('remapScrambleString', () => {
    it('identity leaves scramble unchanged', () => {
      expect(MoveTransformer.remapScrambleString("R U R' U'", IDENTITY)).toBe("R U R' U'");
    });

    it('y rotation remaps scramble correctly', () => {
      // After y: R→F, U→U, R'→F', U'→U'
      expect(MoveTransformer.remapScrambleString("R U R' U'", orient(Y_MAP))).toBe("F U F' U'");
    });

    it('y rotation remaps F R U R sequence', () => {
      // After y: F→L, R→F, U→U, R→F
      expect(MoveTransformer.remapScrambleString("F R U R", orient(Y_MAP))).toBe("L F U F");
    });

    it('handles empty scramble', () => {
      expect(MoveTransformer.remapScrambleString('', IDENTITY)).toBe('');
    });

    it('passes through unknown tokens', () => {
      expect(MoveTransformer.remapScrambleString("R x U", IDENTITY)).toBe("R x U");
    });
  });

  describe('toDisplaySequence', () => {
    it('remaps a sequence of moves', () => {
      const moves = [rawMove('R', 1), rawMove('U', -1), rawMove('F', 2)];
      const result = MoveTransformer.toDisplaySequence(moves, orient(Y_MAP));
      expect(result).toHaveLength(3);
      expect(result[0].face).toBe('F');
      expect(result[1].face).toBe('U');
      expect(result[2].face).toBe('L');
      // Directions preserved
      expect(result[0].direction).toBe(1);
      expect(result[1].direction).toBe(-1);
      expect(result[2].direction).toBe(2);
    });
  });

  describe('direction preservation (all 24 orientations x 18 moves)', () => {
    it('direction is ALWAYS preserved for every orientation and every move', () => {
      const directions: (1 | -1 | 2)[] = [1, -1, 2];
      const faces = ['U', 'D', 'R', 'L', 'F', 'B'] as const;

      for (const entry of OrientationTable.ENTRIES) {
        for (const face of faces) {
          for (const dir of directions) {
            const result = MoveTransformer.toDisplay(rawMove(face, dir), entry);
            expect(result.direction).toBe(dir);
          }
        }
      }
    });
  });

  describe('mathematical properties (property-based over 24x18)', () => {
    it('round-trip reversibility: toRaw(toDisplay(m, O), O) === m for all O and m', () => {
      const directions: (1 | -1 | 2)[] = [1, -1, 2];
      const faces = ['U', 'D', 'R', 'L', 'F', 'B'] as const;

      for (const entry of OrientationTable.ENTRIES) {
        for (const face of faces) {
          for (const dir of directions) {
            const r = rawMove(face, dir);
            const d = MoveTransformer.toDisplay(r, entry);
            const back = MoveTransformer.toRaw(d, entry);
            expect(back.face).toBe(face);
            expect(back.direction).toBe(dir);
          }
        }
      }
    });

    it('identity is no-op: toDisplay(m, identity) === m for all m', () => {
      const directions: (1 | -1 | 2)[] = [1, -1, 2];
      const faces = ['U', 'D', 'R', 'L', 'F', 'B'] as const;

      for (const face of faces) {
        for (const dir of directions) {
          const r = rawMove(face, dir);
          const d = MoveTransformer.toDisplay(r, IDENTITY);
          expect(d.face).toBe(face);
          expect(d.direction).toBe(dir);
        }
      }
    });

    it('composition homomorphism: toDisplay(toDisplay(m, B), A) === toDisplay(m, compose(A, B)) for all A, B, m', () => {
      // Note: composeFaceMap(A, B) = σ_B ∘ σ_A, so compose(A,B) represents
      // "A first, then B". The homomorphism requires applying B then A to match.
      const directions: (1 | -1 | 2)[] = [1, -1, 2];
      const faces = ['U', 'D', 'R', 'L', 'F', 'B'] as const;

      for (const entryA of OrientationTable.ENTRIES) {
        for (const entryB of OrientationTable.ENTRIES) {
          const composed = OrientationTable.compose(entryA, entryB);
          for (const face of faces) {
            for (const dir of directions) {
              const r = rawMove(face, dir);
              // Apply B then A
              const step1 = MoveTransformer.toDisplay(r, entryB);
              const step2 = MoveTransformer.toDisplay(step1, entryA);
              // Apply compose(A, B) directly
              const direct = MoveTransformer.toDisplay(r, composed);
              expect(step2.face).toBe(direct.face);
              expect(step2.direction).toBe(direct.direction);
            }
          }
        }
      }
    });
  });
});
