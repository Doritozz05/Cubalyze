/**
 * @cubeforge/training — Exercise type definitions
 *
 * The canonical exercise identity catalog lives in `exercises/catalog.ts`
 * (EXERCISE_IDS, buildExerciseCatalog, buildMethodPhases). This module only
 * keeps the types consumed by the session layer.
 */

// ─── Exercise Categories ──────────────────────────────────────────────────

/**
 * The training mechanics an exercise can measure.
 *
 * Naming is intentional:
 * - "Execution" (not "Drill") — the mechanic is executing an algorithm
 * - "Phase Target" (not "Train") — the mechanic is reaching a sub-state
 */
export type ExerciseCategory =
  | 'execution-drill'    // Execute an algorithm against a targeted setup
  | 'recognition-quiz'   // Identify a case from its visual state
  | 'phase-target'       // Reach a specific sub-state from a scramble
  | 'full-solve'         // Complete solve with phase tracking
  | 'lookahead'          // Cognitive drills (blind, inspection, transition)
  | 'efficiency';        // Solve with constraints (move limit, rotationless)

// ─── Exercise Preset ──────────────────────────────────────────────────────

/**
 * A pre-configured exercise instance ready to start.
 * Created by combining an exercise id with a specific method+phase+subset.
 */
export interface ExercisePreset {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  /** Pre-selected case (for direct navigation from Algorithm DB) */
  preselectedCaseId?: string;
}
