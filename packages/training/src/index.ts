/**
 * @cubalyze/training
 *
 * Core training engine for Cubalyze.
 *
 * This package provides:
 * - Type definitions: exercises, sessions, progress tracking
 * - Exercise catalog: canonical exercise identities, phases, mastery labels
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
export {
  EXERCISE_IDS,
  METHOD_PHASES,
  buildMethodPhases,
  getMethodPhases,
  findSubsetId,
  getPhasePracticeType,
  getPhaseModes,
  PHASE_MODES,
  masteryLevel,
  MASTERY_LEVEL_LABELS,
  buildExerciseCatalog,
} from './exercises';
export type {
  PhaseDefinition,
  PhasePracticeType,
  PhaseModeDefinition,
  ExerciseDefinition,
  MasteryLabel,
} from './exercises';

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
  buildDailyQueue,
  scoreCandidate,
  DEFAULT_NEW_PER_DAY,
  computeSRSInsights,
  computeMastery,
  DEFAULT_EASE_FACTOR,
  MASTERY_WEIGHTS,
  normalizeAlgorithmProgress,
  normalizeExerciseProgress,
  replayProgress,
} from './progress';
export type {
  ITrainingProgressRepo,
  TrainingAttemptRecord,
  TrainingSessionProgressRecord,
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  PhaseStatsRecord,
  MethodProgressBreakdown,
  MetricKind,
  QueueCandidateRecord,
  QueueCandidate,
  QueueItem,
  QueueReason,
  QueueCaseMeta,
  QueueSubsetMeta,
  BuildQueueOptions,
  ReplayResult,
  ReplaySessionRef,
  SRSInsights,
  SRSStateCounts,
  RetentionBucket,
  IntervalPoint,
  DueProjection,
  FSRSRecord,
  SRSGrade,
  SRSState,
} from './progress';
