/**
 * @cubeforge/analysis-engine — Real-Time Analysis Pipeline
 *
 * This package implements the EPIC 5 analysis pipeline:
 *
 *   1. SolveTimeline — Immutable, replayable record of every move
 *   2. PhaseSplitter — Automatic phase detection (CFOP, Roux, ZZ, Petrus)
 *   3. Metric Calculators — TPS, pauses, fluidity, efficiency, rotations
 *   4. Telemetry Service — Live metrics streaming during solve
 *   5. Derived Visualization — Chart-ready data for insights dashboard
 *
 * All components are headless (no UI dependency) and can be used
 * both in real-time (during a solve) and offline (post-solve analysis).
 */

// ─── Timeline ────────────────────────────────────────────────────────────────
export { TimelineBuilder } from './timeline/TimelineBuilder';
export { ANALYSIS_PIPELINE_VERSION } from './version';

// ─── Phase Recognition ───────────────────────────────────────────────────────
export { PhaseSplitter } from './phases/PhaseSplitter';

// ─── Reconstruction (Fase 2) ────────────────────────────────────────────────
// Headless string → phases/pairs API, rebuilt on the stats pipeline
// (TimelineBuilder + PhaseSplitter). See docs/plan_reconstruction.
export { analyzeSolveText } from './reconstruction/analyzeSolveText';
export type {
  SolveTextInput,
  SolveReconstruction,
  F2LPairResult,
  AnalyzeSolveTextResult,
} from './reconstruction/analyzeSolveText';

// ─── Unified Pipeline (Fase 1+3) — the ONLY place detection runs ───────────
export {
  analyzeSolve,
  buildAnnotatedTimeline,
  type AnalyzeSolveInput,
  type AnalyzeSolveResult,
} from './pipeline/analyzeSolve';
export { recoverRotatedFrame, type FrameRecoveryOptions } from './pipeline/frameRecovery';
export { segmentF2LPairs, type SegmentF2LPairsOptions, type UnifiedF2LPair } from './pipeline/segmentF2LPairs';

// ─── Metrics ────────────────────────────────────────────────────────────────
export { TPSCalculator } from './metrics/TPSCalculator';
export { PauseDetector } from './metrics/PauseDetector';
export { FluidityCalculator } from './metrics/FluidityCalculator';
export { RotationCounter } from './metrics/RotationCounter';
export { EfficiencyCalculator } from './metrics/EfficiencyCalculator';
export { RedundancyDetector } from './metrics/RedundancyDetector';
export { CFOPMetricsCalculator } from './metrics/CFOPMetricsCalculator';
export { RouxMetricsCalculator } from './metrics/RouxMetricsCalculator';
export { MetricsAggregator } from './metrics/MetricsAggregator';

// ─── Derived Visualization Data ──────────────────────────────────────────────
export * from './derived';
