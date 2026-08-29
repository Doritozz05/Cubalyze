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
  createBasicF2LDetector,
  createCFOPDetector,
  type CaseDetector,
} from '@cubeforge/algorithm-db';

let f2lDetector: CaseDetector | undefined;
let cfopDetector: CaseDetector | undefined;

/** Basic F2L (41-case catalog) — used for per-pair `detectedCase`. */
export function getF2LDetector(): CaseDetector {
  return (f2lDetector ??= createBasicF2LDetector());
}

/** Full CFOP (Basic F2L + OLL + PLL) — used for last-layer case detection. */
export function getCFOPDetector(): CaseDetector {
  return (cfopDetector ??= createCFOPDetector());
}