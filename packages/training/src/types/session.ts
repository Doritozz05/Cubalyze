/**
 * @cubeforge/training — Session & attempt type definitions
 *
 * The Training Session is the runtime state machine that orchestrates
 * an exercise from start to finish. It is exercise-agnostic: the same
 * engine runs an OLL Drill or a Cross Trainer.
 */

import type { ExerciseCategory, ExercisePreset } from './exercise';

// ─── Session State Machine ────────────────────────────────────────────────

/**
 * States of the training session state machine.
 *
 *   IDLE → SETUP → ARMED → SOLVING → VERDICT → SETUP (cycle)
 *                                          ↘ IDLE (exit)
 */
export type TrainingSessionPhase =
  | 'idle'       // No active exercise; waiting for user to start
  | 'setup'      // Scramble generated; waiting for user to arm timer
  | 'armed'      // Timer armed (manual: holding space; smart: ready_for_move)
  | 'solving'    // Timer running; user is executing the exercise
  | 'verdict';   // Timer stopped; showing result (correct/incorrect/skip)

// ─── Session Configuration ────────────────────────────────────────────────

export interface TrainingSessionConfig {
  /** The exercise preset to run */
  preset: ExercisePreset;
  /** How many attempts before auto-ending the session (0 = unlimited) */
  maxAttempts?: number;
  /** Time limit per attempt in ms (0 = no limit) */
  timeLimitMs?: number;
  /** Whether to use inspection time */
  useInspection?: boolean;
  /** Inspection duration in ms (default: 15000) */
  inspectionDurationMs?: number;
  /** Smart cube mode: auto-detected or forced */
  smartCubeMode?: 'auto' | 'on' | 'off';
}

// ─── Session State ────────────────────────────────────────────────────────

export interface TrainingSessionState {
  /** Current phase in the state machine */
  phase: TrainingSessionPhase;
  /** Active configuration */
  config: TrainingSessionConfig;
  /** Current attempt number (0-based) */
  attemptIndex: number;
  /** Accumulated attempts in this session */
  attempts: TrainingAttempt[];
  /** Live timer value in ms */
  currentTimeMs: number;
  /** Time captured at stop (for verdict display) */
  stoppedTimeMs: number;
  /** Whether a smart cube is currently connected */
  smartCubeConnected: boolean;
}

// ─── Attempt ──────────────────────────────────────────────────────────────

/** The verdict of a single training attempt */
export type AttemptVerdict = 'correct' | 'incorrect' | 'skipped' | 'dnf';

/** Play mode for this attempt */
export type PlayMode = 'manual' | 'smart-cube';

export interface TrainingAttempt {
  /** Unique attempt ID */
  id: string;
  /** Which exercise this was */
  exerciseId: string;
  /** The case being practiced (algorithm-db case ID) */
  caseId: string;
  /** The scramble/setup used */
  scramble: string;
  /** Total time in ms */
  timeMs: number;
  /** Verdict (set to 'dnf' if user gave up or timed out) */
  verdict: AttemptVerdict;
  /** How the attempt was played */
  playMode: PlayMode;
  /** When the attempt happened */
  timestamp: number;
  /** The algorithm moves the user was supposed to execute */
  expectedMoves?: string[];
  /** The actual moves executed (from smart cube, if available) */
  executedMoves?: string[];
  /** Turns per second */
  tps?: number;
  /** Number of moves executed */
  moveCount?: number;
  /** Number of cube rotations during attempt */
  rotationCount?: number;
  /** Inspection time used (if applicable) */
  inspectionMs?: number;
}

// ─── Session Summary ──────────────────────────────────────────────────────

/** Aggregate stats for a completed training session */
export interface TrainingSessionSummary {
  /** Exercise that was practiced */
  exerciseId: string;
  /** Method used */
  methodId: string;
  /** Phase/subset targeted */
  phaseId?: string;
  subsetId?: string;
  /** Category of exercise */
  category: ExerciseCategory;
  /** Total attempts */
  totalAttempts: number;
  /** Correct / Incorrect / Skipped counts */
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  /** Accuracy percentage */
  accuracy: number;
  /** Time stats */
  bestTimeMs: number;
  avgTimeMs: number;
  worstTimeMs: number;
  /** Average TPS */
  avgTps: number;
  /** When the session started */
  startedAt: number;
  /** Duration of the session in ms */
  durationMs: number;
  /** Unique cases/items practiced */
  uniqueItemsPracticed: number;
}
