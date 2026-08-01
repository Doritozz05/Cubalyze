export { AlgorithmSchema, AlgorithmCaseSchema, AlgorithmSubsetSchema, AlgorithmMethodSchema } from './schema';
export type {
  ArrowDef,
  OrbitCamera,
  AlgorithmViewPreferences,
  Diagram2D,
  Diagram3D,
  Algorithm,
  AlgorithmCase,
  AlgorithmSubset,
  AlgorithmMethod,
  CaseWithAlgorithms,
} from './schema';
export {
  METHODS,
  SUBSETS,
  getSubsetsForMethod,
  getChildSubsets,
  getMethod,
  getSubset,
} from './methodRegistry';
export { getSeedData, seedIfEmpty, isSeeded } from './seed/index';

// Move metrics (shared utility — used by seed files and AlgorithmEditor)
export { computeMoveMetricsFromString, computeMoveMetricsFromTokens } from './moveMetrics';
export type { MoveMetric, MoveCountResult } from './moveMetrics';

// Case generation and verification pipeline
export {
  CaseStateGenerator,
  invertMove,
  invertAlgorithm,
  invertMoveArray,
  SUBSET_VISUALIZATION,
} from './caseGenerator';
export type { VisualizationStyle, VisualizationConfig } from './caseGenerator';

// Canonical case presentation and renderer-neutral render plans
export {
  DEFAULT_CASE_CAMERA,
  F2L_SLOT_MODEL_ROTATIONS,
  CASE_RENDER_GRAY,
  resolveCaseVisualizationStyle,
  resolveVisualizationStyleForSubset,
  resolveAlgorithmViewPreferences,
  resolveAlgorithmDiagramRotation,
  isF2LCase,
  isAdvancedF2LCase,
  buildCaseRenderPlan,
} from './visualization/casePresentation';
export type {
  F2LSlotId,
  CasePresentationOptions,
  CaseRenderPlan,
} from './visualization/casePresentation';

// AUF detection and canonical orientation
export {
  detectCanonicalAuf,
  generateAufVariants,
  normalizeToCanonical,
} from './auf';

// Case verifier (Min2Phase oracle)
export { CaseVerifier } from './caseVerifier';
export type { CaseVerificationResult, SubsetVerificationReport } from './caseVerifier';
