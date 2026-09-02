/**
 * loaders/advancedF2L.ts — Advanced F2L wiring for the case detector.
 *
 * Follows the exact pattern of loaders/basicF2L.ts: a manifest + a loader,
 * then register it alongside Basic F2L in a combined detector.
 *
 * The Advanced F2L seed holds the 126 BirdF2L patterns (subset 0000…0004)
 * — the split/trapped pair configurations outside the 41 basic cases
 * (corner in a D-layer slot + edge on U, corner on U + edge in another
 * E-slice slot, …). The relational pair signature collapses BirdF2L's
 * mirrors/inverses, so the 126 setups yield 36 unique signatures, 17 of
 * which are signature-identical to basic cases (the same relational case
 * under a different BirdF2L label) and 19 of which are genuinely new.
 *
 * Registration order matters: buildCatalog keeps the FIRST entry for a
 * (crossFace, signature) key, so Basic F2L is registered BEFORE Advanced
 * F2L — the 17 colliding signatures keep their canonical "F2L n" label and
 * only the 19 new signatures extend the catalog.
 */
import { CaseStateGenerator } from '../../caseGenerator';
import { CaseDetector } from '../caseDetector';
import { ADVANCED_F2L_CASES } from '../../seed/cfop-f2l';
import type { CaseSeedData, SubsetManifest } from '../types';
import {
  BASIC_F2L_SUBSET_MANIFEST,
  loadBasicF2LCases,
  CFOP_METHOD_ID,
} from './basicF2L';

/** Subset ID of "Advanced F2L" in the methodRegistry (0000…0004). */
export const ADVANCED_F2L_SUBSET_ID =
  '00000000-0000-4000-9000-000000000004';

/**
 * Manifest for Advanced F2L — recognized with the same f2l-slot probe and
 * the same 6 cross faces as Basic F2L (setups are D-cross; the detector
 * normalizes every solver frame onto the D-cross FR anchor).
 */
export const ADVANCED_F2L_SUBSET_MANIFEST: SubsetManifest = {
  methodId: CFOP_METHOD_ID,
  subsetId: ADVANCED_F2L_SUBSET_ID,
  label: 'CFOP Advanced F2L',
  crossFaces: ['D', 'U', 'F', 'B', 'R', 'L'],
};

/**
 * Load Advanced F2L seed cases. Same contract as loadBasicF2LCases: the
 * crossFace is ignored (setups are always D-cross; the builder rotates).
 */
export function loadAdvancedF2LCases(
  _subsetId: string,
  _crossFace: string,
): CaseSeedData[] {
  return ADVANCED_F2L_CASES.map((c) => ({
    caseNumber: c.caseDef.caseNumber,
    caseName: c.caseDef.name,
    setupScramble: c.caseDef.setupScramble,
  }));
}

/** Dispatch loader for the combined Basic + Advanced catalog. */
export function loadF2LCases(
  subsetId: string,
  crossFace: string,
): CaseSeedData[] {
  return subsetId === ADVANCED_F2L_SUBSET_ID
    ? loadAdvancedF2LCases(subsetId, crossFace)
    : loadBasicF2LCases(subsetId, crossFace);
}

/**
 * Build a CaseDetector pre-wired for Basic + Advanced F2L.
 *
 * Basic is registered first so the 17 signature-colliding BirdF2L patterns
 * keep their canonical "F2L n" labels; the 19 genuinely new signatures
 * extend the catalog (measured: 41 basic + 19 advanced = 60 entries).
 */
export function createF2LDetector(): CaseDetector {
  return CaseDetector.create(
    [BASIC_F2L_SUBSET_MANIFEST, ADVANCED_F2L_SUBSET_MANIFEST],
    loadF2LCases,
  );
}

/** Convenience: generate a case's D-cross state from its setup scramble. */
export function advancedF2LState(setupScramble: string) {
  return CaseStateGenerator.generateFromScramble(setupScramble);
}