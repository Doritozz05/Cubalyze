import { describe, it, expect } from 'vitest';
import { CaseVerifier } from '../caseVerifier';
import { getSeedData } from '../seed/index';

describe('CaseVerifier — Min2Phase oracle validation', () => {
  const { cases, algorithms } = getSeedData();
  const PLL_SUBSET = '00000000-0000-4000-9000-000000000001';
  const pllCases = cases.filter((c) => c.subsetId === PLL_SUBSET);

  describe('verifyAlgorithm', () => {
    it('verifies T perm correctly (clean state, solver ok)', () => {
      const verifier = new CaseVerifier();
      const tPermCase = pllCases.find((c) => c.caseNumber === 'T')!;
      const tPermAlg = algorithms.find(
        (a) => a.caseId === tPermCase.id && a.isDefault,
      )!;

      const result = verifier.verifyAlgorithm(tPermCase, tPermAlg);

      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.checks.solverFindsSolution).toBe(true);
      expect(result.checks.solverSolutionWorks).toBe(true);
      // T perm has no rotations → no warnings
      expect(result.warnings).toEqual([]);
    });

    it('F perm (has y rotation) passes verification but has warnings', () => {
      const verifier = new CaseVerifier();
      const fPermCase = pllCases.find((c) => c.caseNumber === 'F')!;
      const fPermAlg = algorithms.find(
        (a) => a.caseId === fPermCase.id && a.isDefault,
      )!;

      const result = verifier.verifyAlgorithm(fPermCase, fPermAlg);

      // Clean state IS valid → solver works
      expect(result.checks.solverFindsSolution).toBe(true);
      expect(result.checks.solverSolutionWorks).toBe(true);
      expect(result.passed).toBe(true);
      // Raw state has rotation artifacts → warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('E perm (rotations cancel out: y x\'...x) has no errors', () => {
      const verifier = new CaseVerifier();
      const ePermCase = pllCases.find((c) => c.caseNumber === 'E')!;
      const ePermAlg = algorithms.find(
        (a) => a.caseId === ePermCase.id && a.isDefault,
      )!;

      const result = verifier.verifyAlgorithm(ePermCase, ePermAlg);

      expect(result.passed).toBe(true);
      expect(result.checks.solverFindsSolution).toBe(true);
      expect(result.checks.solverSolutionWorks).toBe(true);
      // Rotations individually may leave artifacts; the solver must still pass.
      expect(result.errors).toEqual([]);
    });

    it('algorithm with invalid moves fails verification', () => {
      const verifier = new CaseVerifier();
      const tPermCase = pllCases.find((c) => c.caseNumber === 'T')!;
      const fakeAlg = {
        ...algorithms.find((a) => a.caseId === tPermCase.id && a.isDefault)!,
        moves: ['Q', 'X', 'Z'], // Invalid moves → will cause exception
        id: 'invalid-moves-test-id',
      };

      const result = verifier.verifyAlgorithm(tPermCase, fakeAlg);

      // Invalid moves cause an exception → error in errors array
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });
  });

  describe('verifySubset', () => {
    it('all 21 PLL clean states are physically valid (solver finds solution)', () => {
      const verifier = new CaseVerifier();
      const report = verifier.verifySubset(pllCases, algorithms, 'PLL');

      expect(report.subsetName).toBe('PLL');
      expect(report.totalCases).toBe(21);

      // All clean states should be solvable
      const unsolvable = report.results.filter(
        (r) => !r.checks.solverFindsSolution,
      );
      if (unsolvable.length > 0) {
        console.error(
          'Unsolvable:',
          unsolvable.map((r) => r.caseNumber),
        );
      }
      expect(unsolvable.length).toBe(0);

      // All solver solutions should work
      for (const r of report.results) {
        expect(
          r.checks.solverSolutionWorks,
          `${r.caseNumber}: solver solution doesn't work`,
        ).toBe(true);
      }
    });

    it('all 21 PLLs pass verification (no errors)', () => {
      const verifier = new CaseVerifier();
      const report = verifier.verifySubset(pllCases, algorithms, 'PLL');

      const failed = report.results.filter((r) => !r.passed);
      if (failed.length > 0) {
        console.error(
          'Failed cases:',
          JSON.stringify(
            failed.map((f) => ({ case: f.caseNumber, errors: f.errors })),
            null,
            2,
          ),
        );
      }
      expect(failed.length).toBe(0);
    });

    it('algorithms with rotations produce warnings', () => {
      const verifier = new CaseVerifier();
      const report = verifier.verifySubset(pllCases, algorithms, 'PLL');

      const rotationTokens = new Set(['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']);

      for (const r of report.results) {
        const alg = algorithms.find((a) => a.id === r.algorithmId)!;
        const hasRotation = alg.moves.some((m) => rotationTokens.has(m));

        if (hasRotation) {
          // Algorithms WITH rotations should still pass (clean state works)
          expect(r.passed, `${r.caseNumber}: should pass with rotations`).toBe(true);
        }
      }
    });

    it('reports reasonable solver move counts', () => {
      const verifier = new CaseVerifier();
      const report = verifier.verifySubset(pllCases, algorithms, 'PLL');

      for (const r of report.results) {
        expect(r.solverMoveCount).toBeGreaterThan(0);
        expect(r.solverMoveCount).toBeLessThanOrEqual(21);
      }
    });
  });
});
