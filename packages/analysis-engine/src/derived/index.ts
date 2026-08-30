/**
 * @cubeforge/analysis-engine — Derived Visualization Data
 *
 * This module transforms raw solve data and analysis metrics into
 * chart-ready shapes for the Insights dashboard.
 *
 * All functions are pure, headless, and framework-agnostic.
 * They consume minimal input interfaces rather than tying to
 * any specific domain model.
 */

// ─── Phase Colors ─────────────────────────────────────────────────────────
export type { PauseCategory } from './phase-colors';
export {
  PAUSE_COLOR_BY_CATEGORY,
  TAIL_COLOR,
  phaseColorHex,
  pauseColorHex,
  tailColorHex,
} from './phase-colors';

// ─── Timeline ────────────────────────────────────────────────────────────
export { deriveTimeline, derivePauseCause, derivePairSegments } from './timeline';
export type {
  MoveTick,
  TpsSample,
  PauseMark,
  TimelineSegmentKind,
  TimelineSegment,
  StageSegment,
  TimelineData,
  TimelineSolveInput,
  PairSegment,
} from './timeline';

// ─── Distribution ────────────────────────────────────────────────────────
export { deriveSparkline, deriveHistogram, deriveActivityHeatmap } from './distribution';
export type { HistogramBin, DistribSolve } from './distribution';

// ─── Series ──────────────────────────────────────────────────────────────
export { deriveTpsSeries, derivePhaseDistribution, isComparablePhaseAnalysis } from './series';
export type { TpsPoint, PhaseShare, SeriesSolve } from './series';

// ─── Aggregates ──────────────────────────────────────────────────────────
export { deriveAvgTime } from './aggregates';

// ─── Pause aggregation (session-level) ───────────────────────────────────
export {
  derivePauseCauseSums,
  flattenPauseCauses,
} from './pause-aggregates';
export type {
  PauseAggSolveInput,
  CausePauseRow,
  PauseCauseSum,
} from './pause-aggregates';
