/**
 * loaders/lastLayer.ts — OLL + PLL wiring for the case detector.
 *
 * Follows the same pattern as loaders/basicF2L.ts: a manifest + a loader
 * per subset, registered in the detector's subsets array. The OLL and PLL
 * subsets use the last-layer probes (see probes/lastLayerProbes.ts), so
 * their catalog entries are keyed on the orientation / permutation
 * signature of the last layer instead of the F2L pair signature.
 *
 * The seed setups are canonical (cross on D, last layer on U), and the
 * probes normalize any solver frame onto that anchor at detection time.
 */
import { CaseStateGenerator } from '../../caseGenerator';
import { CaseDetector } from '../caseDetector';
import { OLL_CASES } from '../../seed/cfop-oll';
import { PLL_CASES } from '../../seed/cfop-pll';
import { BASIC_F2L_SUBSET_MANIFEST } from './basicF2L';
import { loadBasicF2LCases } from './basicF2L';
import type { CaseSeedData, SubsetManifest } from '../types';

/** Subset IDs from the methodRegistry. */
export const OLL_SUBSET_ID = '00000000-0000-4000-9000-000000000002';
export const PLL_SUBSET_ID = '00000000-0000-4000-9000-000000000001';

/** CFOP method ID (mid(1) in methodRegistry). */
export const CFOP_METHOD_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Manifest for OLL — the 57 last-layer orientation cases. The probe is
 * 'last-layer-orientation', so the catalog is keyed on the orientation
 * pattern of the last layer (see lastLayerProbes.ts).
 */
export const OLL_SUBSET_MANIFEST: SubsetManifest = {
  methodId: CFOP_METHOD_ID,
  subsetId: OLL_SUBSET_ID,
  label: 'CFOP OLL',
  crossFaces: ['D', 'U', 'F', 'B', 'R', 'L'],
  probe: 'last-layer-orientation',
};

/**
 * Manifest for PLL — the 21 last-layer permutations. The cross the
 * 'last-layer-permutation' probe (see lastLayerProbes.ts).
 */
export const PLL_SUBSET_MANIFEST: SubsetManifest = {
  methodId: CFOP_METHOD_ID,
  subsetId: PLL_SUBSET_ID,
  label: 'CFOP PLL',
  crossFaces: ['D', 'U', 'F', 'B', 'R', 'L'],
  probe: 'last-layer-permutation',
};

/** Load OLL seed cases (setups are always D-cross; the builder anchors them). */
export function loadOLLCases(
  _subsetId: string,
  _crossFace: string,
): CaseSeedData[] {
  return OLL_CASES.map((c) => ({
    caseNumber: c.caseDef.caseNumber,
    caseName: c.caseDef.name,
    setupScramble: c.caseDef.setupScramble,
  }));
}

/** Load PLL seed cases (setups are always D-cross; the builder anchors them). */
export function loadPLLCases(
  _subsetId: string,
  _crossFace: string,
): CaseSeedData[] {
  return PLL_CASES.map((c) => ({
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

/**
 * Build a CaseDetector pre-wired for OLL.
 * This is the highest-level factory for the app.
 */
export function createOLLDetector(): CaseDetector {
  return CaseDetector.create(
    [OLL_SUBSET_MANIFEST],
    loadOLLCases,
  );
}

/**
 * Build a CaseDetector pre-wired for PLL.
 * This is the highest-level factory for the app.
 */
export function createPLLDetector(): CaseDetector {
  return CaseDetector.create(
    [PLL_SUBSET_MANIFEST],
    loadPLLCases,
  );
}

/**
 * Build a CaseDetector pre-wired for Basic F2L + OLL + PLL — the full
 * CFOP detection surface. The catalog is keyed on three disjoint signature
 * families (F2L pair signatures, OLL orientation signatures, PLL
 * permutation signatures), so the subsets never collide.
 */
export function createCFOPDetector(): CaseDetector {
  return CaseDetector.create(
    [
      BASIC_F2L_SUBSET_MANIFEST,
      OLL_SUBSET_MANIFEST,
      PLL_SUBSET_MANIFEST,
    ],
    (subsetId, crossFace) => {
      if (subsetId === OLL_SUBSET_ID) return loadOLLCases(subsetId, crossFace);
      if (subsetId === PLL_SUBSET_ID) return loadPLLCases(subsetId, crossFace);
      return loadBasicF2LCases(subsetId, crossFace);
    },
  );
}