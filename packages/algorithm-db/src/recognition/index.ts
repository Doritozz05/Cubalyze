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

// ─── Pre-built loader for Basic F2L ─────────────────────────────────────────
export {
  BASIC_F2L_SUBSET_MANIFEST,
  loadBasicF2LCases,
  createBasicF2LDetector,
} from './loaders/basicF2L';