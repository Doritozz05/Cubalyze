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

// ─── Reconstruction Case Recognition (formal, convention-independent) ────────
export { recognizeSolve } from './recognition/solveRecognition';
export type {
  SolveRecognition,
  RecognizedPair,
  RecognizeSolveOptions,
} from './recognition/solveRecognition';

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
