/**
 * @file Pure data-derivation utilities for the Insights dashboard.
 *
 * These functions have been moved to the headless @cubeforge/analysis-engine
 * package. This file re-exports them for backward compatibility with
 * existing UI code.
 *
 * New code should import directly from @cubeforge/analysis-engine.
 */

export {
  deriveTimeline,
  deriveSparkline,
  deriveHistogram,
  deriveActivityHeatmap,
  deriveTpsSeries,
  derivePhaseDistribution,
  isComparablePhaseAnalysis,
  derivePauseCause,
  deriveAvgTime,
} from "@cubeforge/analysis-engine";

export type {
  MoveTick,
  TpsSample,
  PauseMark,
  TimelineSegmentKind,
  TimelineSegment,
  StageSegment,
  TimelineData,
  HistogramBin,
  TpsPoint,
  PhaseShare,
} from "@cubeforge/analysis-engine";
