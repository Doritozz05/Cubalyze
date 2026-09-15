import { describe, it, expect } from 'vitest';
import {
  detectCanonicalAuf,
  generateAufVariants,
  normalizeToCanonical,
} from '../auf';
import { CaseStateGenerator } from '../caseGenerator';
import { getSeedData } from '../seed/index';
import { CubeState } from '@cubalyze/math-core';

describe('AUF — Canonical Orientation System', () => {
  const { cases, algorithms } = getSeedData();
  const PLL_SUBSET = '00000000-0000-4000-9000-000000000001';
  const pllCases = cases.filter((c) => c.subsetId === PLL_SUBSET);

  describe('detectCanonicalAuf', () => {
    it('detects 0 for already canonical permutation', () => {
      const cp = [0, 1, 2, 3, 4, 5, 6, 7]; // solved
      expect(detectCanonicalAuf(cp, cp)).toBe(0);
    });

    it('detects 3 for U away from canonical', () => {
      // After U: cp = [3, 0, 1, 2, 4, 5, 6, 7]
      // From [3,0,1,2] to [0,1,2,3] needs 3 CW (U')
      const current = [3, 0, 1, 2, 4, 5, 6, 7];
      const canonical = [0, 1, 2, 3, 4, 5, 6, 7];
      expect(detectCanonicalAuf(current, canonical)).toBe(3);
    });

    it('detects 2 for U2 away from canonical', () => {
      // After U2: cp = [2, 3, 0, 1, 4, 5, 6, 7]
      const current = [2, 3, 0, 1, 4, 5, 6, 7];
      const canonical = [0, 1, 2, 3, 4, 5, 6, 7];
      expect(detectCanonicalAuf(current, canonical)).toBe(2);
    });

    it('detects 1 for U\' away from canonical', () => {
      // After U': cp = [1, 2, 3, 0, 4, 5, 6, 7]
      // From [1,2,3,0] to [0,1,2,3] needs 1 CW (U)
      const current = [1, 2, 3, 0, 4, 5, 6, 7];
      const canonical = [0, 1, 2, 3, 4, 5, 6, 7];
      expect(detectCanonicalAuf(current, canonical)).toBe(1);
    });
  });

  describe('generateAufVariants', () => {
    it('generates 4 variants from a PLL state', () => {
      const state = new CubeState();
      // Make a non-solved state with a corner swap
      state.cp.set([1, 0, 2, 3, 4, 5, 6, 7]);

      const variants = generateAufVariants(state);
      expect(variants.length).toBe(4);
    });

    it('variant 0 = original state (identical)', () => {
      const state = new CubeState();
      state.cp.set([1, 0, 2, 3, 4, 5, 6, 7]);
      const variants = generateAufVariants(state);
      expect(variants[0]._corners).toBe(state._corners);
    });

    it('AUF variants produce different corner states', () => {
      const state = new CubeState();
      state.cp.set([1, 0, 2, 3, 4, 5, 6, 7]);
      const variants = generateAufVariants(state);

      // Variant 0 and variant 1 should have different corner states
      expect(variants[0]._corners).not.toBe(variants[1]._corners);
      // Variant 1 (U) vs variant 3 (U') should be different
      expect(variants[1]._corners).not.toBe(variants[3]._corners);
    });

    it('variant 1 (U) undone by U\' returns to original', () => {
      const state = new CubeState();
      state.cp.set([1, 0, 2, 3, 4, 5, 6, 7]);
      const variants = generateAufVariants(state);

      // Apply U' to variant 1 (U) should get back to variant 0
      const u1 = variants[1];
      u1.applySequence("U'");
      expect(u1._corners).toBe(state._corners);
    });
  });

  describe('normalizeToCanonical', () => {
    it('returns auf=0 for already canonical state', () => {
      const state = new CubeState();
      state.cp.set([2, 0, 1, 3, 4, 5, 6, 7]); // Aa with solved corner at UBR
      const refCp = Array.from(state.cp);
      const { canonicalState, auf } = normalizeToCanonical(state, refCp);

      expect(auf).toBe(0);
      expect(canonicalState._corners).toBe(state._corners);
    });

    it('detects and normalizes U-rotated state back to canonical', () => {
      // Reference: Aa cp with solved corner at UBR
      const refCp = [2, 0, 1, 3, 4, 5, 6, 7];

      // Create a state that's 1 U away from canonical.
      // After U on canonical: cp = [3, 2, 0, 1, 4, 5, 6, 7]
      // From [3,2,0,1] to ref [2,0,1,3] needs 3 CW (U') → auf=3.
      const canonical = new CubeState(null, null, null, null);
      canonical.cp.set(refCp);
      const rotated = canonical.clone();
      rotated.applySequence('U');

      const { canonicalState, auf } = normalizeToCanonical(rotated, refCp);
      expect(auf).toBe(3);
      expect(canonicalState._corners).toBe(canonical._corners);
    });

    it('correctly handles U2 rotation', () => {
      const refCp = [2, 0, 1, 3, 4, 5, 6, 7];
      const canonical = new CubeState(null, null, null, null);
      canonical.cp.set(refCp);
      const rotated = canonical.clone();
      rotated.applySequence('U2');

      const { canonicalState, auf } = normalizeToCanonical(rotated, refCp);
      expect(auf).toBe(2);
      expect(canonicalState._corners).toBe(canonical._corners);
    });
  });

  // ── Full PLL: verify all 21 cases can generate AUF variants ──────────

  describe('All 21 PLL cases — AUF variant generation', () => {
    for (const caseData of pllCases) {
      const caseAlgs = algorithms.filter((a) => a.caseId === caseData.id);
      const defaultAlg = caseAlgs.find((a) => a.isDefault) ?? caseAlgs[0];

      describe(`${caseData.caseNumber} Perm`, () => {
        it('generateAufVariants produces 4 states', () => {
          const rawState = CaseStateGenerator.generateCaseState(defaultAlg.moves);
          const cleanState = CaseStateGenerator.createCleanState(rawState);
          const variants = generateAufVariants(cleanState);
          expect(variants.length).toBe(4);

          // All U-layer corners should be the same set {0,1,2,3}
          for (const v of variants) {
            const uCorners = Array.from(v.cp).slice(0, 4).sort();
            expect(uCorners, 'AUF variant corners mismatch').toEqual([0, 1, 2, 3]);
          }
        });

        it('normalizeToCanonical round-trips correctly', () => {
          const rawState = CaseStateGenerator.generateCaseState(defaultAlg.moves);
          const cleanState = CaseStateGenerator.createCleanState(rawState);

          // Use the clean state's cp as the reference
          const refCp = Array.from(cleanState.cp);

          // Rotate away with U2
          const rotated = cleanState.clone();
          rotated.applySequence('U2');

          const { canonicalState } = normalizeToCanonical(rotated, refCp);
          expect(canonicalState._corners).toBe(cleanState._corners);
        });

        it('detects correct AUF for each variant', () => {
          const rawState = CaseStateGenerator.generateCaseState(defaultAlg.moves);
          const cleanState = CaseStateGenerator.createCleanState(rawState);
          const refCp = Array.from(cleanState.cp);
          const variants = generateAufVariants(cleanState);

          for (let i = 0; i < 4; i++) {
            const auf = detectCanonicalAuf(variants[i].cp, refCp);
            // generateAufVariants[i] applies U^i to canonical.
            // detectCanonicalAuf returns how many CW U to get BACK to canonical.
            // That's (4 - i) % 4: for variant[1] (U applied), need U' = 3.
            expect(auf).toBe((4 - i) % 4);
          }
        });
      });
    }
  });
});
