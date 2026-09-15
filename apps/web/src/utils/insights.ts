/**
 * Pure data-derivation utilities for the Insights dashboard.
 *
 * These functions have been moved to the headless @cubalyze/analysis-engine
 * package. This file re-exports them for backward compatibility with
 * existing UI code.
 *
 * New code should import directly from @cubalyze/analysis-engine.
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
  derivePauseCauseSums,
  flattenPauseCauses,
  deriveAvgTime,
  derivePairSegments,
} from "@cubalyze/analysis-engine";

export type {
  TimelineSegment,
  TimelineData,
  PairSegment,
  PauseCauseSum,
} from "@cubalyze/analysis-engine";

// Session TECHNICAL statistics (headless @cubalyze/statistics).
export {
  deriveSessionTechnicalStats,
  derivePhaseTimeStats,
  deriveEconomyStats,
  deriveRotationStats,
  deriveLookaheadStats,
  deriveCrossStats,
  deriveRecognitionCosts,
  deriveMoveMetrics,
  deriveCaseIntelligence,
  deriveSkillRadarProfile,
} from "@cubalyze/statistics";
export type {
  SessionTechnicalStats,
  PhaseTechnicalStats,
  EconomyTechnicalStats,
  RotationTechnicalStats,
  LookaheadTechnicalStats,
  CrossTechnicalStats,
  RecognitionCost,
  MoveMetrics,
  CaseIntelligence,
  SkillAxisId,
  SkillAxisData,
  SkillRadarProfile,
} from "@cubalyze/statistics";

