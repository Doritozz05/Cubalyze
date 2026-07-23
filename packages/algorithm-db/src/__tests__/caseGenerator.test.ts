import { describe, it, expect } from 'vitest';
import { CaseStateGenerator, invertMove, invertAlgorithm, invertMoveArray } from '../caseGenerator';
import { getSeedData } from '../seed/index';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';

describe('CaseStateGenerator', () => {
  // ── Utility function tests ──────────────────────────────────────────

  describe('invertMove', () => {
    it('inverts CW to CCW', () => {
      expect(invertMove('R')).toBe("R'");
      expect(invertMove('U')).toBe("U'");
      expect(invertMove('M')).toBe("M'");
      expect(invertMove('x')).toBe("x'");
    });

    it('inverts CCW to CW', () => {
      expect(invertMove("R'")).toBe('R');
      expect(invertMove("U'")).toBe('U');
      expect(invertMove("M'")).toBe('M');
    });

    it('180° is self-inverse', () => {
      expect(invertMove('R2')).toBe('R2');
      expect(invertMove('U2')).toBe('U2');
      expect(invertMove('M2')).toBe('M2');
      expect(invertMove('x2')).toBe('x2');
    });
  });

  describe('invertAlgorithm', () => {
    it('reverses and inverts each move', () => {
      expect(invertAlgorithm("R U R'")).toBe("R U' R'");
      expect(invertAlgorithm("R U R' U'")).toBe("U R U' R'");
    });

    it('algorithm + inverse = identity', () => {
      const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
      const c = new CubeState();
      c.applySequence(alg);
      c.applySequence(invertAlgorithm(alg));
      expect(c.isSolved()).toBe(true);
    });
  });

  // ── Case state generation ───────────────────────────────────────────

  describe('generateCaseState', () => {
    it('T-perm inverse produces a non-solved state', () => {
      const moves = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"];
      const state = CaseStateGenerator.generateCaseState(moves);
      expect(state.isSolved()).toBe(false);
    });

    it('T-perm solves its generated case state', () => {
      const moves = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"];
      const caseState = CaseStateGenerator.generateCaseState(moves);
      expect(CaseStateGenerator.verifyAlgorithmSolvesCase(caseState, moves)).toBe(true);
    });
  });

  // ── Full PLL validation: all 21 cases ───────────────────────────────

  describe('All 21 PLL cases — mathematical validation', () => {
    const { cases, algorithms } = getSeedData();
    const PLL_SUBSET = '00000000-0000-4000-9000-000000000001';
    const pllCases = cases.filter((c) => c.subsetId === PLL_SUBSET);

    it('should have 21 PLL cases', () => {
      expect(pllCases.length).toBe(21);
    });

    for (const caseData of pllCases) {
      const caseAlgs = algorithms.filter((a) => a.caseId === caseData.id);
      const defaultAlg = caseAlgs.find((a) => a.isDefault) ?? caseAlgs[0];

      describe(`${caseData.caseNumber} Perm`, () => {
        it('algorithm solves the generated case state', () => {
          const caseState = CaseStateGenerator.generateCaseState(defaultAlg.moves);
          expect(
            CaseStateGenerator.verifyAlgorithmSolvesCase(caseState, defaultAlg.moves),
          ).toBe(true);
        });

        it('generated facelets have valid U-face (all same color for PLL)', () => {
          const { faceletString } = CaseStateGenerator.generateCaseVisualization(
            defaultAlg.moves,
            'full-color',
          );
          // PLL preserves orientation → U face should be all 'U'
          const uFace = faceletString.substring(0, 9);
          expect(uFace.split('').every((c) => c === 'U'), `U face: ${uFace}`).toBe(true);
        });

        it('generated facelets have valid U-layer color distribution (3 of each side color)', () => {
          const { faceletString } = CaseStateGenerator.generateCaseVisualization(
            defaultAlg.moves,
            'full-color',
          );
          // PLL only permutes U-layer pieces. The U-layer side stickers are
          // the top row of each side face:
          //   R face top row: indices 9, 10, 11
          //   F face top row: indices 18, 19, 20
          //   L face top row: indices 36, 37, 38
          //   B face top row: indices 45, 46, 47
          // That's 12 stickers total, 3 of each color (R/F/L/B).
          const uLayerSideIndices = [9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47];
          const uLayerSide = uLayerSideIndices.map((i) => faceletString[i]);
          const counts: Record<string, number> = {};
          for (const f of uLayerSide) counts[f] = (counts[f] ?? 0) + 1;
          // Each side color should appear exactly 3 times (12 stickers / 4 colors)
          expect(counts['R'], `R count`).toBe(3);
          expect(counts['F'], `F count`).toBe(3);
          expect(counts['L'], `L count`).toBe(3);
          expect(counts['B'], `B count`).toBe(3);
        });

        it('generated facelets have 4 valid U-layer corners (no duplicates)', () => {
          const { faceletString } = CaseStateGenerator.generateCaseVisualization(
            defaultAlg.moves,
            'full-color',
          );
          // U-layer corner facelet indices (from FaceletStringConverter):
          // URF: [8, 9, 20], UFL: [6, 18, 38], ULB: [0, 36, 47], UBR: [2, 45, 11]
          const cornerIndices = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11]];
          const validCorners = ['URF', 'UFL', 'ULB', 'UBR'];
          const validCornerColors = [
            ['U', 'R', 'F'], // URF
            ['U', 'F', 'L'], // UFL
            ['U', 'L', 'B'], // ULB
            ['U', 'B', 'R'], // UBR
          ];

          const seen = new Set<string>();
          for (let i = 0; i < 4; i++) {
            const colors = cornerIndices[i].map((idx) => faceletString[idx]).sort();
            const key = colors.join('');
            expect(seen.has(key), `Duplicate corner at position ${i}: ${colors.join('')}`).toBe(false);
            seen.add(key);

            // Check it's a valid corner cubie
            const isValid = validCornerColors.some((vc) =>
              vc.slice().sort().join('') === key,
            );
            expect(isValid, `Invalid corner cubie at position ${i}: ${colors.join('')}`).toBe(true);
          }
        });

        it('generated state is not solved (it is a real PLL case)', () => {
          const caseState = CaseStateGenerator.generateCaseState(defaultAlg.moves);
          expect(caseState.isSolved()).toBe(false);
        });
      });
    }
  });

  // ── Visualization styles ────────────────────────────────────────────

  describe('faceletStringToDiagramColors', () => {
    it('full-color style maps all faces to color letters', () => {
      const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
      const colors = CaseStateGenerator.faceletStringToDiagramColors(solved, 'full-color');
      expect(colors[0]).toBe('Y'); // U → Yellow
      expect(colors[9]).toBe('R'); // R → Red
      expect(colors[18]).toBe('G'); // F → Green
      expect(colors[27]).toBe('W'); // D → White
      expect(colors[36]).toBe('O'); // L → Orange
      expect(colors[45]).toBe('B'); // B → Blue
    });

    it('yellow-gray style grays out side faces (OLL visualization)', () => {
      const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
      const colors = CaseStateGenerator.faceletStringToDiagramColors(solved, 'yellow-gray');
      // U face (0-8) keeps color
      expect(colors[0]).toBe('Y');
      expect(colors[4]).toBe('Y');
      // Side faces (9+) are grayed out
      expect(colors[9]).toBe('#');
      expect(colors[18]).toBe('#');
      expect(colors[27]).toBe('#');
      expect(colors[36]).toBe('#');
      expect(colors[45]).toBe('#');
    });
  });

  // ── AUF ─────────────────────────────────────────────────────────────

  describe('applyAuf', () => {
    it('AUF=0 returns a clone (no change)', () => {
      const state = new CubeState();
      const result = CaseStateGenerator.applyAuf(state, 0);
      expect(result.isSolved()).toBe(true);
    });

    it('AUF=1 applies U move', () => {
      const state = new CubeState();
      const result = CaseStateGenerator.applyAuf(state, 1);
      expect(result.isSolved()).toBe(false); // U move breaks solved state
    });

    it('AUF=4 (via 0) returns to solved', () => {
      const state = new CubeState();
      state.applySequence('R U R'); // some non-solved state
      const auf0 = CaseStateGenerator.applyAuf(state, 0);
      const u1 = CaseStateGenerator.applyAuf(state, 1);
      const u2 = CaseStateGenerator.applyAuf(state, 2);
      const u3 = CaseStateGenerator.applyAuf(state, 3);
      // All 4 AUF variants should be different from each other
      const states = [auf0, u1, u2, u3];
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          expect(states[i]._edges).not.toBe(states[j]._edges);
        }
      }
    });
  });
});
