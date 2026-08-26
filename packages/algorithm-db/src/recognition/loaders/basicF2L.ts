/**
 * loaders/basicF2L.ts — Basic F2L wiring for the case detector.
 *
 * This is the FIRST subset wired into the modular detector. It loads the
 * 41 Basic F2L cases from the seed catalog and registers the detector for
 * ALL 6 cross faces. The catalog is frame-agnostic: the detector's
 * slot→anchor rotations (slotResolver.ts) normalize any solver frame onto
 * the D-cross FR anchor before the signature lookup.
 *
 * Adding another subset (Advanced F2L, OLL, PLL, 2×2 Ortega...) follows
 * the same pattern: a manifest + a loader, then register it in the
 * detector's subsets array.
 */
import { CaseStateGenerator } from '../../caseGenerator';
import { CaseDetector } from '../caseDetector';
import { BASIC_F2L_CASES } from '../../seed/cfop-f2l';
import type { CaseSeedData, SubsetManifest } from '../types';

/** Subset ID of "Basic F2L" in the methodRegistry (0000…0003). */
export const BASIC_F2L_SUBSET_ID =
  '00000000-0000-4000-9000-000000000003';

/** CFOP method ID (mid(1) in methodRegistry). */
export const CFOP_METHOD_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Manifest for Basic F2L — the subsets the detector can recognize.
 * crossFaces: all 6 — the detector normalizes every solver frame onto
 * the D-cross FR anchor (slotToFRRotation), so the same catalog serves
 * D, U, F, B, R and L crosses (validated: 41 cases × 6 faces × 4 slots).
 */
export const BASIC_F2L_SUBSET_MANIFEST: SubsetManifest = {
  methodId: CFOP_METHOD_ID,
  subsetId: BASIC_F2L_SUBSET_ID,
  label: 'CFOP Basic F2L',
  crossFaces: ['D', 'U', 'F', 'B', 'R', 'L'],
};

/**
 * Load Basic F2L seed cases. The crossFace is ignored for the actual
 * seed data (setups are always D-cross); the builder rotates them.
 */
export function loadBasicF2LCases(
  _subsetId: string,
  _crossFace: string,
): CaseSeedData[] {
  return BASIC_F2L_CASES.map((c) => ({
    caseNumber: c.caseDef.caseNumber,
    caseName: c.caseDef.name,
    setupScramble: c.caseDef.setupScramble,
  }));
}

/**
 * Build a CaseDetector pre-wired for Basic F2L.
 * This is the highest-level factory for the app.
 */
export function createBasicF2LDetector(): CaseDetector {
  return CaseDetector.create(
    [BASIC_F2L_SUBSET_MANIFEST],
    loadBasicF2LCases,
  );
}

/** Convenience: generate a case's D-cross state from its setup scramble. */
export function basicF2LState(setupScramble: string) {
  return CaseStateGenerator.generateFromScramble(setupScramble);
}