export { AlgorithmSchema, AlgorithmCaseSchema, AlgorithmSubsetSchema, AlgorithmMethodSchema } from './schema';
export type {
  ArrowDef,
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

// AUF detection and canonical orientation
export {
  detectCanonicalAuf,
  generateAufVariants,
  normalizeToCanonical,
} from './auf';

// Case verifier (Min2Phase oracle)
export { CaseVerifier } from './caseVerifier';
export type { CaseVerificationResult, SubsetVerificationReport } from './caseVerifier';
