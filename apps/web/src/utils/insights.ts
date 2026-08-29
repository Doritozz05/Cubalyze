/**
 * Pure data-derivation utilities for the Insights dashboard.
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
  derivePairSegments,
} from "@cubeforge/analysis-engine";

export type {
  TimelineSegment,
  TimelineData,
  PairSegment,
} from "@cubeforge/analysis-engine";
