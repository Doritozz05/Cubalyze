/**
 * @cubalyze/training — Progress tracking type definitions
 *
 * Tracks user mastery across algorithms, exercises, and methods.
 * This data feeds the Spaced Repetition System, Skill Tree,
 * and adaptive exercise generation.
 */

import type { TrainingSessionSummary } from './session';

// ─── Mastery Level ────────────────────────────────────────────────────────

export type MasteryLevel =
  | 'new'        // Never practiced
  | 'learning'   // Practiced but not consistent
  | 'practicing' // Consistent but not fast
  | 'mastered'   // Fast and consistent
  | 'expert';    // Exceptional performance

export const MASTERY_THRESHOLDS: Record<MasteryLevel, { minAccuracy: number; maxTimeMs?: number }> = {
  new:        { minAccuracy: 0 },
  learning:   { minAccuracy: 0.3 },
  practicing: { minAccuracy: 0.7 },
  mastered:   { minAccuracy: 0.9, maxTimeMs: 3000 },
  expert:     { minAccuracy: 0.95, maxTimeMs: 1500 },
};

// ─── Per-Algorithm Progress ───────────────────────────────────────────────

/**
 * Tracks a user's progress on a single algorithm case.
 *
 * One record per (user, algorithm) pair. Updated after every
 * training attempt that targets this algorithm.
 */
export interface AlgorithmProgress {
  /** Algorithm case ID from algorithm-db */
  algorithmId: string;
  /** Current mastery level */
  mastery: MasteryLevel;
  /** Accuracy over last 20 attempts (0-1) */
  recentAccuracy: number;
  /** Best execution time in ms */
  bestTimeMs: number;
  /** Average execution time over last 10 attempts */
  avgTimeMs: number;
  /** Best TPS achieved */
  bestTps: number;
  /** Total attempts ever */
  totalAttempts: number;
  /** Total correct attempts */
  correctAttempts: number;
  /** Current streak of correct attempts */
  streak: number;
  /** Timestamp of last practice */
  lastPracticedAt: number;
  /** Timestamp of when this algorithm was first learned */
  firstLearnedAt: number;
  /** SRS interval in hours (0 = due now, negative = overdue) */
  srsIntervalHours: number;
  /** When SRS says this should be reviewed next */
  srsNextReviewAt: number;
  /** History of last 20 attempt results (for rolling calculations) */
  recentAttempts: AttemptSnapshot[];
}

export interface AttemptSnapshot {
  timestamp: number;
  timeMs: number;
  correct: boolean;
  tps: number;
}

// ─── Per-Exercise Progress ────────────────────────────────────────────────

/**
 * Tracks a user's progress on a specific exercise type.
 *
 * One record per (user, exercise) pair. Aggregated from
 * TrainingSessionSummary records.
 */
export interface ExerciseProgress {
  /** Exercise ID */
  exerciseId: string;
  /** Method context */
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  /** Total sessions completed */
  totalSessions: number;
  /** Total attempts across all sessions */
  totalAttempts: number;
  /** Best session accuracy */
  bestAccuracy: number;
  /** Best time achieved (for timed exercises) */
  bestTimeMs: number;
  /** Average session duration */
  avgSessionDurationMs: number;
  /** Current streak (consecutive days practiced) */
  dayStreak: number;
  /** Last practice date (epoch day) */
  lastPracticedDay: number;
  /** Total time spent on this exercise (ms) */
  totalTimeSpentMs: number;
}

// ─── Method-Level Progress ────────────────────────────────────────────────

/**
 * Aggregated progress across all exercises within a method.
 *
 * Used for the method dashboard (L1 in the current UI) and
 * to determine "what should I train next?"
 */
export interface MethodProgress {
  /** Method ID */
  methodId: string;
  /** Overall mastery percentage (0-100) */
  overallMastery: number;
  /** Breakdown by phase */
  phases: PhaseProgress[];
  /** Weakest phase(s) — training recommendations target these */
  weakestPhases: string[];
  /** Strongest phase(s) */
  strongestPhases: string[];
  /** Total cases in method's algorithm subsets */
  totalCases: number;
  /** Cases mastered (mastery === 'mastered' or 'expert') */
  casesMastered: number;
  /** Cases currently learning */
  casesLearning: number;
  /** Cases never attempted */
  casesNew: number;
  /** Best full solve time */
  bestFullSolveMs: number;
}

export interface PhaseProgress {
  phaseId: string;
  mastery: number;
  avgTimeMs: number;
  bestTimeMs: number;
}

// ─── Training History ─────────────────────────────────────────────────────

/**
 * A record of a completed training session.
 * Stored in the database for analytics and progress tracking.
 */
export interface TrainingSessionRecord {
  id: string;
  /** Summary of the session */
  summary: TrainingSessionSummary;
  /** Individual attempts */
  attempts: import('./session').TrainingAttempt[];
  /** When the session was completed */
  completedAt: number;
  /** Duration of the session */
  durationMs: number;
  /** Smart cube used? */
  smartCubeUsed: boolean;
}
