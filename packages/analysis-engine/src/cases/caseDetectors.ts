/**
 * caseDetectors.ts — Shared, cached CaseDetector singletons.
 *
 * Both analysis routes (reconstruction text and smart/virtual) must recognize
 * the SAME algorithm cases for the same solve. The detector is stateless after
 * construction (the catalog is built once from the seed setups), but building
 * it reads every seed and computes the ~164 F2L signatures / the OLL+PLL
 * catalog entries — cheap once, wasteful per call. These singletons make the
 * "one detector for the whole app" guarantee explicit: any consumer reads the
 * same catalog, so text and smart/virtual can never diverge by construction.
 */
import {
  createF2LDetector,
  createCFOPDetector,
  type CaseDetector,
} from '@cubalyze/algorithm-db';

let f2lDetector: CaseDetector | undefined;
let cfopDetector: CaseDetector | undefined;

/**
 * F2L detector — Basic (41) + Advanced (BirdF2L) catalog, used for per-pair
 * `detectedCase`. Basic is registered first, so the 17 signature-colliding
 * BirdF2L patterns keep their canonical "F2L n" labels; the 19 genuinely
 * new signatures cover split/trapped pair configurations that real solves
 * can present at a pair's cut (previously reported as undefined).
 */
export function getF2LDetector(): CaseDetector {
  return (f2lDetector ??= createF2LDetector());
}

/** Full CFOP (Basic F2L + OLL + PLL) — used for last-layer case detection. */
export function getCFOPDetector(): CaseDetector {
  return (cfopDetector ??= createCFOPDetector());
}