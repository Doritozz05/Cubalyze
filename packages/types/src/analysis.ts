/**
 * @cubeforge/types — Analysis pipeline types.
 *
 * These types define the data structures used by the analysis engine
 * to compute solve metrics. They are framework-agnostic and shared
 * between analysis-engine, math-core, and the web app.
 */

import type { CubeFace, CubeMoveDirection, CubeMoveEvent } from './index';
import type { CubeOrientation, DisplayMove } from './orientation';

// ─── Solve Timeline ──────────────────────────────────────────────────────────

/**
 * A single entry in the solve timeline.
 *
 * Each entry represents one move applied to the cube, capturing:
 * - The raw move event from BLE
 * - The display move (remapped for cube orientation)
 * - The mathematical cube state AFTER applying the move
 * - The orientation of the cube at this point (if IMU available)
 */
export interface TimelineEntry {
  /** Zero-based index of this move in the solve sequence. */
  index: number;

  /** The raw move event from the hardware (BLE). NEVER modified. */
  move: CubeMoveEvent;

  /** The display move — face remapped according to cube orientation. */
  displayMove: DisplayMove;

  /** The mathematical cube state AFTER applying this move. */
  state: CubeStateSnapshot;

  /** Host timestamp (performance.now()) when this move was received. */
  hostTimestamp: number;

  /**
   * The cube's physical orientation at this point in the timeline.
   * Undefined if IMU not available.
   */
  orientation?: CubeOrientation;

  /**
   * The phase ID this entry belongs to (assigned by PhaseSplitter).
   * Undefined until phase recognition runs.
   */
  phaseId?: number;

  /**
   * The phase name this entry belongs to (assigned by PhaseSplitter).
   * Undefined until phase recognition runs.
   */
  phaseName?: string;
}

// ─── Cube State Snapshot ─────────────────────────────────────────────────────

/**
 * A serializable snapshot of a CubeState.
 * CubeState uses Int8Array which is not JSON-serializable,
 * so we provide a plain object representation for storage and transfer.
 */
export interface CubeStateSnapshot {
  /** Corner permutation: cp[position] = piece_id */
  cp: number[];
  /** Corner orientation: co[position] = orientation (0-2) */
  co: number[];
  /** Edge permutation: ep[position] = piece_id */
  ep: number[];
  /** Edge orientation: eo[position] = orientation (0-1) */
  eo: number[];
}

// ─── Solve Timeline ──────────────────────────────────────────────────────────

/**
 * A complete, immutable, replayable timeline of a single solve.
 *
 * Each entry is a (MoveEvent, CubeState, timestamp) triple, plus
 * optional orientation data. The timeline can be replayed offline
 * to recalculate any metrics without needing the original hardware.
 */
export interface SolveTimeline {
  /** The solve ID this timeline belongs to. */
  solveId: string;

  /** The solving method used (e.g. "CFOP", "Roux"). */
  method: string;

  /** The ordered timeline entries (one per move). */
  entries: TimelineEntry[];

  /** The detected/reconstructed phase segments. */
  phases: PhaseSegment[];

  /** Timestamp of the solve start (first move). */
  startTimestamp: number;

  /** Timestamp of the solve end (last move or solved detection). */
  endTimestamp: number;
}

// ─── Phase Segmentation ──────────────────────────────────────────────────────

/**
 * A contiguous segment of the solve timeline corresponding to
 * one phase of the solving method.
 *
 * Example (CFOP):
 *   - Phase "Cross":  entries 0-6 (7 moves, 2.1s)
 *   - Phase "F2L":    entries 7-35 (29 moves, 6.5s)
 *   - Phase "OLL":    entries 36-44 (9 moves, 1.2s)
 *   - Phase "PLL":    entries 45-57 (13 moves, 1.8s)
 */
export interface PhaseSegment {
  /** The phase name (e.g. "Cross", "F2L", "OLL", "PLL"). */
  phaseName: string;

  /** Index of the FIRST entry belonging to this phase. */
  startIndex: number;

  /** Index of the LAST entry belonging to this phase (inclusive). */
  endIndex: number;

  /** Timestamp of the first move in this phase. */
  startTimestamp: number;

  /** Timestamp of the last move in this phase. */
  endTimestamp: number;

  /** Duration of this phase in milliseconds. */
  durationMs: number;

  /** Number of moves in this phase. */
  moveCount: number;
}

// ─── Method Definition (extended) ────────────────────────────────────────────

/**
 * Extended method definition for the analysis engine.
 *
 * Extends the math-core MethodDefinition with metadata for
 * color schemes and detection heuristics.
 */
export interface MethodMeta {
  /** Method name (e.g. "CFOP", "Roux"). */
  name: string;

  /** Human-readable description. */
  description: string;

  /** Phase names in order. */
  phaseNames: string[];

  /** Default color for UI differentiation. */
  defaultColorScheme?: string;
}

// ─── Metric Result Types ─────────────────────────────────────────────────────

/** Phase-level metrics for a single phase. */
export interface PhaseMetrics {
  phaseName: string;
  durationMs: number;
  moveCount: number;
  tps: number;
  pauseCount: number;
  pauseTimeMs: number;
}

/**
 * Single solve metrics — the output of running all metric calculators
 * against a SolveTimeline.
 */
export interface SolveMetrics {
  /** The solve ID these metrics belong to. */
  solveId: string;

  /** Total solve time in ms. */
  totalTimeMs: number;

  /** Total number of moves. */
  totalMoves: number;

  /** Phase-level metrics. */
  phases: PhaseMetrics[];

  // ─── Core Metrics ───
  tps: TPSMetrics;
  pauses: PauseMetrics;
  fluidity: FluidityMetrics;

  // ─── Advanced Metrics ───
  efficiency?: EfficiencyMetrics;
  rotation?: RotationMetrics;
  redundancy?: RedundancyResult;

  // ─── Phase-specific ───
  cfop?: CFOPMetrics;
  roux?: RouxMetrics;
  zz?: ZZMetrics;
}

// ─── TPS Metrics ─────────────────────────────────────────────────────────────

export interface TPSMetrics {
  /** Total moves / total time (including pauses). */
  global: number;

  /** Total moves / effective time (excluding pauses). */
  effective: number;

  /** TPS for each phase, keyed by phase name. */
  byPhase: Record<string, number>;

  /** Maximum TPS in any 1-second window. */
  peakInstantaneous: number;

  /** Array of TPS values for sliding window of N moves. */
  instantaneousWindow?: number[];
}

// ─── Pause Metrics ───────────────────────────────────────────────────────────

export interface PauseMetrics {
  /** Total number of pauses detected. */
  totalCount: number;

  /** Longest pause duration in ms. */
  maxDurationMs: number;

  /** Average pause duration in ms. */
  avgDurationMs: number;

  /** Pause statistics by phase. */
  byPhase: Record<string, { count: number; avgMs: number }>;

  /** Total time spent in pauses (ms). */
  totalPauseTimeMs: number;

  /** Ratio: totalPauseTimeMs / totalTimeMs (0-1). */
  pauseRatio: number;

  /** Individual pause details. */
  pauses: PauseDetail[];
}

export interface PauseDetail {
  /** Start of the pause (index in timeline). */
  startIndex: number;

  /** End of the pause (index in timeline). */
  endIndex: number;

  /** Duration in ms. */
  durationMs: number;

  /** Phase where this pause occurred. */
  phase: string;

  /** Position: "mid-phase", "pre-algorithm", "transition". */
  category: 'mid-phase' | 'pre-algorithm' | 'transition';
}

// ─── Fluidity Metrics ────────────────────────────────────────────────────────

export interface FluidityMetrics {
  /** Standard deviation of inter-move times. */
  stdDevMs: number;

  /** Coefficient of variation (σ/μ) of inter-move times. */
  coefficientOfVariation: number;

  /** Fluidity per phase (lower = smoother). */
  byPhase: Record<string, number>;

  /** Number of "bursts" (sequences of low-variance moves). */
  burstCount: number;

  /** Acceleration events (moves faster than 150% of average). */
  accelerationCount: number;

  /** Deceleration events (moves slower than 50% of average). */
  decelerationCount: number;
}

// ─── Efficiency Metrics ──────────────────────────────────────────────────────

export interface EfficiencyMetrics {
  /** User move count / optimal move count. */
  moveEfficiencyRatio: number;

  /** Optimal move count from solver. */
  optimalMoveCount: number;

  /** Number of cancelable move pairs (e.g., R followed by R'). */
  redundancies: number;

  /** Move sequences that cancel (e.g., "R R'" → null). */
  cancellations: number;

  /** Number of moves > 90° (possible overturn). */
  overturns: number;

  /** Forward drift: ratio of moves that reduce distance to solved. */
  forwardDrift: number;
}

// ─── Rotation Metrics ────────────────────────────────────────────────────────

export interface RotationMetrics {
  /** Total number of cube rotations (x, y, z). */
  totalCount: number;

  /** Rotations by axis. */
  byAxis: { x: number; y: number; z: number };

  /** Total time estimated to be spent rotating (ms). */
  estimatedRotationTimeMs: number;

  /** Consecutive rotations without intervening moves. */
  consecutiveCount: number;

  /** Rotations per phase. */
  byPhase: Record<string, number>;

  /** Ratio: rotationCount / totalMoves. */
  rotationToMoveRatio: number;

  /** Rotations that cancel (e.g., y followed by y'). */
  redundantRotations: number;
}

// ─── CFOP-Specific Metrics ───────────────────────────────────────────────────

export interface CFOPMetrics {
  /** Cross efficiency: user moves / optimal (≤8). */
  crossEfficiency: number;
  crossToF2LTransitionMs: number;
  crossMoves: number;
  crossTPS: number;

  /** F2L pair analysis. */
  f2lPairs: F2LPairMetrics[];
  f2lLookaheadScore: number;

  /** OLL recognition + execution. */
  ollRecognitionMs: number;
  ollExecutionMs: number;
  ollTPS: number;
  ollAlgorithmId?: string;

  /** PLL recognition + execution. */
  pllRecognitionMs: number;
  pllExecutionMs: number;
  pllTPS: number;
  pllAlgorithmId?: string;
}

export interface F2LPairMetrics {
  pairNumber: number;
  timeMs: number;
  moves: number;
  tps: number;
  pauseBeforeMs: number;
}

// ─── Roux-Specific Metrics ───────────────────────────────────────────────────

export interface RouxMetrics {
  /** First Block. */
  firstBlockMoves: number;
  firstBlockTPS: number;
  firstBlockEfficiency: number;

  /** Second Block. */
  secondBlockMoves: number;
  secondBlockTPS: number;
  sbSquareTimeMs: number;

  /** CMLL. */
  cmllRecognitionMs: number;
  cmllExecutionMs: number;
  cmllTPS: number;

  /** LSE breakdown. */
  lseEOTimeMs: number;
  lseULURTimeMs: number;
  lseMsliceTimeMs: number;
}

// ─── ZZ-Specific Metrics ─────────────────────────────────────────────────────

export interface ZZMetrics {
  eolineTimeMs: number;
  eolineMoves: number;
  eolineEfficiency: number;
  zzF2LTimeMs: number;
  zzF2LEfficiency: number;
  zzLLTimeMs: number;
  zzLLTPS: number;
}

// ─── Redundancy Metrics ─────────────────────────────────────────────────────

export interface RedundancyResult {
  totalRedundancies: number;
  cancellations: number;
  repetitions: number;
  halfTurns: number;
  redundancyRate: number;
  patterns: RedundancyPattern[];
}

export interface RedundancyPattern {
  startIndex: number;
  endIndex: number;
  type: 'cancellation' | 'repetition' | 'half-turn';
  description: string;
}
