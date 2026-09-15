/**
 * @cubalyze/training — Type definitions (barrel)
 *
 * Central export for all training type definitions.
 * This file is the single import point for consumers.
 */
export type {
  // Exercise
  ExerciseCategory,
  ExercisePreset,
} from './exercise';

export type {
  // Session
  TrainingSessionPhase,
  TrainingSessionConfig,
  TrainingSessionState,
  TrainingAttempt,
  TrainingSessionSummary,
  AttemptVerdict,
  PlayMode,
} from './session';

export type {
  // Progress
  MasteryLevel,
  AlgorithmProgress,
  ExerciseProgress,
  MethodProgress,
  PhaseProgress,
  TrainingSessionRecord,
  AttemptSnapshot,
} from './progress';

export { MASTERY_THRESHOLDS } from './progress';
