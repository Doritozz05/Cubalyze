/**
 * @cubeforge/training
 *
 * Core training engine for CubeForge.
 *
 * This package provides:
 * - Type definitions: exercises, sessions, progress tracking
 * - Exercise registry: catalog of all available training exercises
 * - Generators: targeted setup scrambles for algorithm drills
 * - Session engine: state machine for training sessions (Idle→Setup→Armed→Solving→Verdict)
 * - Timer factory: drill-configured TimerEngine
 *
 * This package is method-agnostic: it does not contain CFOP,
 * Roux, or any method-specific logic. Methods define their own
 * exercises by implementing ITrainingExercise.
 *
 * UI components (DrillView, RecognizeView, etc.) live in
 * apps/web — this package is pure logic.
 */

// ─── Types ────────────────────────────────────────────────────────────────
export * from './types';

// ─── Generators ───────────────────────────────────────────────────────────
export { generateRandomSetup } from './generators';

// ─── Engine ───────────────────────────────────────────────────────────────
export { createTrainingTimer } from './engine';

// ─── Exercises ────────────────────────────────────────────────────────────
export { exerciseRegistry } from './exercises';

// ─── Session ──────────────────────────────────────────────────────────────
export { TrainingSessionEngine } from './session';
export type { SessionEvent, SessionStateListener } from './session';

// ─── Progress ─────────────────────────────────────────────────────────────
export { ProgressTracker } from './progress';
export {
  FSRS_DEFAULTS,
  retrievability,
  nextDifficulty,
  nextStability,
  intervalFor,
  isDue,
  fsrsReview,
  REQUEST_RETENTION,
  buildDailyQueue,
  scoreCandidate,
  DEFAULT_NEW_PER_DAY,
  computeSRSInsights,
  computeMastery,
  MASTERY_WEIGHTS,
  normalizeAlgorithmProgress,
  normalizeExerciseProgress,
} from './progress';
export type {
  ITrainingProgressRepo,
  TrainingAttemptRecord,
  TrainingSessionProgressRecord,
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  PhaseStatsRecord,
  MetricKind,
  QueueCandidateRecord,
  QueueCandidate,
  QueueItem,
  QueueReason,
  QueueCaseMeta,
  QueueSubsetMeta,
  BuildQueueOptions,
  SRSInsights,
  SRSStateCounts,
  RetentionBucket,
  IntervalPoint,
  DueProjection,
  FSRSRecord,
  SRSGrade,
  SRSState,
} from './progress';
