/**
 * @cubeforge/training — Exercise type definitions
 *
 * Defines the contract that every training exercise must implement.
 * Exercises are method-agnostic: an "Execution Drill" works the same
 * for OLL, PLL, CMLL, or ZBLL — the only difference is which subset
 * of the Algorithm Database is used.
 */

// ─── Exercise Categories ──────────────────────────────────────────────────

/**
 * The six fundamental training mechanics.
 *
 * Naming is intentional:
 * - "Execution" (not "Drill") — the mechanic is executing an algorithm
 * - "Phase Target" (not "Train") — the mechanic is reaching a sub-state
 *
 * Each category maps to a different validation strategy and UI layout.
 */
export type ExerciseCategory =
  | 'execution-drill'    // Execute an algorithm against a targeted setup
  | 'recognition-quiz'   // Identify a case from its visual state
  | 'phase-target'       // Reach a specific sub-state from a scramble
  | 'full-solve'         // Complete solve with phase tracking
  | 'lookahead'          // Cognitive drills (blind, inspection, transition)
  | 'efficiency';        // Solve with constraints (move limit, rotationless)

/** Human-readable labels for each category */
export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  'execution-drill':    'Execution Drill',
  'recognition-quiz':   'Recognition Quiz',
  'phase-target':       'Phase Target',
  'full-solve':         'Full Solve',
  'lookahead':          'Lookahead / Inspection',
  'efficiency':         'Efficiency Challenge',
};

// ─── Scramble Strategy ────────────────────────────────────────────────────

/** How scrambles are generated for this exercise */
export type ScrambleStrategyType =
  | 'random-state'       // WCA-standard random state scramble
  | 'targeted-case'      // Setup that forces a specific algorithm case
  | 'partial-scramble'   // Scramble until a target sub-state remains
  | 'adaptive'           // Generated based on user's weakness data
  | 'repetition-set';    // Queue from spaced-repetition engine

export interface ScrambleStrategy {
  type: ScrambleStrategyType;
  /** For targeted-case: case ID from Algorithm DB */
  targetCaseId?: string;
  /** For targeted-case/partial-scramble: subset ID */
  subsetId?: string;
  /** For partial-scramble: which phase to leave unsolved */
  targetPhase?: string;
  /** For adaptive/repetition-set: max cases in queue */
  queueSize?: number;
}

// ─── Validation Rules ─────────────────────────────────────────────────────

/** How exercise success is validated */
export type ValidationRuleType =
  | 'algorithm-match'    // Moves match expected algorithm exactly
  | 'state-match'        // Cube facelets match a target state mask
  | 'move-limit'         // Solve within N moves
  | 'rotation-limit'     // Solve with ≤ N rotations
  | 'tps-threshold'      // Maintain TPS above minimum
  | 'manual-verdict';    // User self-reports correct/incorrect

export interface ValidationRule {
  type: ValidationRuleType;
  /** For state-match: the state mask ID from method definitions */
  stateMask?: string;
  /** For algorithm-match: expected move sequence */
  expectedMoves?: string[];
  /** For move-limit: maximum allowed moves */
  maxMoves?: number;
  /** For rotation-limit: maximum allowed rotations */
  maxRotations?: number;
  /** For tps-threshold: minimum TPS */
  minTps?: number;
}

// ─── Smart Cube Requirement ───────────────────────────────────────────────

export type SmartCubeRequirement =
  | 'required'     // Exercise cannot function without a smart cube
  | 'recommended'  // Works manually but smart cube adds auto-detection
  | 'optional';    // Works identically with or without smart cube

// ─── Exercise Definition ──────────────────────────────────────────────────

/**
 * The core contract: every training exercise implements this interface.
 *
 * Exercises are registered in the ExerciseRegistry and instantiated
 * by the Session Engine. The UI layer (apps/web) consumes exercise
 * definitions to render the appropriate interface.
 *
 * An exercise is method-agnostic: e.g., "OLL Execution Drill" and
 * "CMLL Execution Drill" are the SAME exercise definition with
 * different `subsets` and `compatibleMethods`.
 */
export interface ITrainingExercise {
  /** Unique identifier (e.g., "cfop-oll-execution") */
  id: string;
  /** Display label (e.g., "OLL Execution") */
  label: string;
  /** Short description shown in the exercise catalog */
  description: string;
  /** Which training mechanic this exercise uses */
  category: ExerciseCategory;
  /** Compatible solving methods (empty = all methods) */
  compatibleMethods: string[];
  /** Which phases of the method this exercise targets */
  targetPhases: string[];
  /** Algorithm DB subsets used by this exercise */
  subsets: string[];
  /** How scrambles are generated */
  scramble: ScrambleStrategy;
  /** How success is validated */
  validation: ValidationRule;
  /** Smart cube requirement level */
  smartCubeRequirement: SmartCubeRequirement;
  /** Whether the exercise has a timer */
  hasTimer: boolean;
  /**
   * UI layout hints — read by the presentation layer (apps/web).
   * These are NOT UI logic; they are capability declarations that
   * tell the generic ExerciseView which panels to render.
   */
  layout: {
    /** Whether to show the 3D cube panel */
    show3DCube: boolean;
    /** Whether to show the case diagram */
    showCaseDiagram: boolean;
    /** Whether to show the algorithm text (hidden by default in drills) */
    showAlgorithm: boolean;
  };
}

// ─── Exercise Preset ──────────────────────────────────────────────────────

/**
 * A pre-configured exercise instance ready to start.
 * Created by combining an ITrainingExercise with a specific method+subset.
 */
export interface ExercisePreset {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  /** Pre-selected case (for direct navigation from Algorithm DB) */
  preselectedCaseId?: string;
}

// ─── Exercise Registry ────────────────────────────────────────────────────

/**
 * The exercise catalog. Methods (CFOP, Roux, etc.) query this to
 * discover which exercises are available for their phases.
 */
export interface ExerciseRegistry {
  /** All registered exercises */
  getAll(): ITrainingExercise[];
  /** Exercises compatible with a specific method */
  getByMethod(methodId: string): ITrainingExercise[];
  /** Exercises targeting a specific phase of a method */
  getByPhase(methodId: string, phaseId: string): ITrainingExercise[];
  /** Exercise by ID */
  getById(id: string): ITrainingExercise | undefined;
  /** Exercises by category */
  getByCategory(category: ExerciseCategory): ITrainingExercise[];
}
