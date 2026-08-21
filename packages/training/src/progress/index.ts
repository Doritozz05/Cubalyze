export {
  ProgressTracker,
  DEFAULT_EASE_FACTOR,
  computeMastery,
  MASTERY_WEIGHTS,
  normalizeAlgorithmProgress,
  normalizeExerciseProgress,
} from './progress-tracker';
export type {
  ITrainingProgressRepo,
  TrainingAttemptRecord,
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  PhaseStatsRecord,
  MethodProgressBreakdown,
  MetricKind,
  QueueCandidateRecord,
  TrainingSessionProgressRecord,
} from './progress-tracker';
// ─── SRS daily queue scheduler ────────────────────────────────────────
export {
  buildDailyQueue,
  scoreCandidate,
  DEFAULT_NEW_PER_DAY,
} from './scheduler';
export type {
  QueueCandidate,
  QueueItem,
  QueueReason,
  QueueCaseMeta,
  QueueSubsetMeta,
  BuildQueueOptions,
} from './scheduler';
// ─── SRS insights ──────────────────────────────────────────────────────
export { computeSRSInsights } from './insights';
export type {
  SRSInsights,
  SRSStateCounts,
  RetentionBucket,
  IntervalPoint,
  DueProjection,
} from './insights';
// ─── Deterministic aggregate replay (sync rebuild) ────────────────────
export { replayProgress } from './replay';
export type { ReplayResult, ReplaySessionRef } from './replay';
// ─── FSRS-lite scheduler ──────────────────────────────────────────────
export {
  FSRS_DEFAULTS,
  retrievability,
  nextDifficulty,
  nextStability,
  intervalFor,
  isDue,
  review as fsrsReview,
} from './fsrs';
export type { FSRSRecord, SRSGrade, SRSState } from './fsrs';
