import { Min2PhaseSolver } from '@cubeforge/solver-engine';
import type { Algorithm, AlgorithmCase } from './schema';
import { CaseStateGenerator } from './caseGenerator';

// ─── Verification Results ─────────────────────────────────────────────────

export interface CaseVerificationResult {
  caseNumber: string;
  algorithmId: string;
  passed: boolean;
  /** Checks performed on the clean state (solver validation). */
  checks: {
    /** Min2Phase finds a solution for the clean case state. */
    solverFindsSolution: boolean;
    /** Applying the solver's solution to the clean state yields solved. */
    solverSolutionWorks: boolean;
  };
  /** Warnings from raw state inspection (not blocking). */
  warnings: string[];
  errors: string[];
  solverSolution?: string;
  solverMoveCount?: number;
  algorithmMoveCount: number;
  durationMs: number;
}

export interface SubsetVerificationReport {
  subsetName: string;
  totalCases: number;
  totalAlgorithms: number;
  passed: number;
  failed: number;
  results: CaseVerificationResult[];
  durationMs: number;
}

// ─── Case Verifier ────────────────────────────────────────────────────────

/**
 * Verifies algorithm cases using min2phase as a mathematical oracle.
 *
 * Pipeline:
 *   1. Generate clean case state (createCleanState: co=0, eo=0).
 *   2. Ask Min2Phase to solve the clean state → proves physical validity.
 *   3. Verify the solver's solution actually works.
 *   4. Additionally, inspect the raw state for orientation/permutation issues
 *      caused by Kociemba rotation artifacts (warnings, not errors).
 */
export class CaseVerifier {
  private solver: Min2PhaseSolver;

  constructor() {
    this.solver = new Min2PhaseSolver();
  }

  /**
   * Verify a single algorithm against its case.
   */
  verifyAlgorithm(
    caseData: AlgorithmCase,
    algorithm: Algorithm,
  ): CaseVerificationResult {
    const start = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks = {
      solverFindsSolution: false,
      solverSolutionWorks: false,
    };

    let solverSolution = '';
    let solverMoveCount = 0;

    try {
      // 1. Generate raw state (with Kociemba rotation artifacts if present)
      const rawState = CaseStateGenerator.generateCaseState(algorithm.moves);

      // 2. Inspect raw state for orientation/permutation issues (warnings)
      const co = Array.from(rawState.co);
      const eo = Array.from(rawState.eo);
      if (!co.every((c) => c === 0) || !eo.every((e) => e === 0)) {
        warnings.push(
          `Raw state has non-zero orientations (co=${co}, eo=${eo}). ` +
          `This is expected if the algorithm contains rotations (y/x/z). ` +
          `Visual representations should use createCleanState().`,
        );
      }

      const cp = Array.from(rawState.cp);
      const ep = Array.from(rawState.ep);
      const uCorners = cp.slice(0, 4).sort();
      const uEdges = ep.slice(0, 4).sort();
      const dCorners = cp.slice(4, 8).sort();
      if (uCorners.join(',') !== '0,1,2,3' || uEdges.join(',') !== '0,1,2,3') {
        warnings.push(
          `Raw state has non-U-layer pieces in U-layer ` +
          `(U-corners: ${cp.slice(0, 4)}, U-edges: ${ep.slice(0, 4)}). ` +
          `This is expected if the algorithm contains rotations.`,
        );
      }
      if (dCorners.join(',') !== '4,5,6,7') {
        warnings.push(
          `Raw state has D-layer permutation changes ` +
          `(D-corners: ${cp.slice(4, 8)}). ` +
          `This is expected if the algorithm contains rotations.`,
        );
      }

      // 3. Generate clean state (co=0, eo=0, valid for solver)
      const cleanState = CaseStateGenerator.createCleanState(rawState);

      // 4. Ask Min2Phase to solve the clean state
      solverSolution = this.solver.solve(cleanState);
      solverMoveCount = solverSolution.trim().split(/\s+/).filter(Boolean).length;
      checks.solverFindsSolution = solverSolution.length > 0;
      if (!checks.solverFindsSolution) {
        errors.push('Min2Phase could not find a solution for the clean case state');
      }

      // 5. Verify solver's solution works on the clean state
      if (checks.solverFindsSolution) {
        const solverTestState = cleanState.clone();
        solverTestState.applySequence(solverSolution);
        checks.solverSolutionWorks = solverTestState.isSolved();
        if (!checks.solverSolutionWorks) {
          errors.push(
            `Min2Phase solution "${solverSolution}" does not solve the clean case state`,
          );
        }
      }
    } catch (err) {
      errors.push(`Exception: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      caseNumber: caseData.caseNumber,
      algorithmId: algorithm.id,
      passed: errors.length === 0,
      checks,
      warnings,
      errors,
      solverSolution: solverSolution || undefined,
      solverMoveCount,
      algorithmMoveCount: algorithm.moveCount.htm,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Verify all algorithms for a set of cases.
   */
  verifySubset(
    cases: AlgorithmCase[],
    algorithms: Algorithm[],
    subsetName: string,
  ): SubsetVerificationReport {
    const start = Date.now();
    const results: CaseVerificationResult[] = [];

    for (const caseData of cases) {
      const caseAlgs = algorithms.filter((a) => a.caseId === caseData.id);
      for (const alg of caseAlgs) {
        results.push(this.verifyAlgorithm(caseData, alg));
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    return {
      subsetName,
      totalCases: cases.length,
      totalAlgorithms: results.length,
      passed,
      failed,
      results,
      durationMs: Date.now() - start,
    };
  }
}
