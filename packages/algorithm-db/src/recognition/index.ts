/**
 * recognition/index.ts — Barrel exports for the case detection module.
 */

// Core types
export type {
  CatalogEntry,
  DetectionResult,
  SubsetManifest,
  CaseDetectorOptions,
  CaseSeedData,
} from './types';

// Probe abstraction (signature families)
export type { ProbeKind, ProbeContext } from './probes';
export { getProbe } from './probes';
export { f2lSlotProbe } from './probes/f2lSlotProbe';
export {
  lastLayerOrientationProbe,
  lastLayerPermutationProbe,
} from './probes/lastLayerProbes';

// Core modules
export { pairSignature } from './pairSignature';
export { resolveSlotPieces, slotToFRRotation } from './slotResolver';
export {
  D_TO_CROSS,
  CROSS_TO_D,
  recolorState,
} from './crossFaceAdapter';
export {
  buildCatalog,
  lookupCatalog,
  createCatalog,
} from './caseCatalog';
export { CaseDetector } from './caseDetector';

// ─── Pre-built loaders ──────────────────────────────────────────────────────
export {
  BASIC_F2L_SUBSET_MANIFEST,
  loadBasicF2LCases,
  createBasicF2LDetector,
} from './loaders/basicF2L';
export {
  ADVANCED_F2L_SUBSET_MANIFEST,
  loadAdvancedF2LCases,
  loadF2LCases,
  createF2LDetector,
} from './loaders/advancedF2L';
export {
  OLL_SUBSET_MANIFEST,
  PLL_SUBSET_MANIFEST,
  loadOLLCases,
  loadPLLCases,
  createOLLDetector,
  createPLLDetector,
  createCFOPDetector,
} from './loaders/lastLayer';