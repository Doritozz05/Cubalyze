/**
 * @cubeforge/training — Exercise Registry
 *
 * The catalog of all training exercises available in CubeForge.
 * Exercises are method-agnostic: an "Execution Drill" works the same
 * whether you're practicing OLL, PLL, CMLL, or ZBLL.
 *
 * Each method (CFOP, Roux, ZZ, Petrus) queries this registry to
 * discover which exercises are available for its phases.
 */

import type {
  ITrainingExercise,
  ExerciseCategory,
  ExerciseRegistry as IExerciseRegistry,
} from '../types';

// ─── Exercise Definitions ────────────────────────────────────────────────

const EXERCISES: ITrainingExercise[] = [
  // ── Execution Drills ──────────────────────────────────────────────
  {
    id: 'algorithm-execution-drill',
    label: 'Algorithm Execution',
    description: 'Execute algorithms against targeted case setups. Timer-based with case diagram, scramble display, and correctness validation.',
    category: 'execution-drill',
    compatibleMethods: ['cfop', 'roux', 'zz', 'petrus'],
    targetPhases: ['oll', 'pll', 'f2l', 'cmll', 'll-zz', 'f2l-zz', 'll-petrus', 'f2l-petrus'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'targeted-case' },
    validation: { type: 'manual-verdict' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: true,
      showAlgorithm: false,
    },
  },

  // ── Recognition Quizzes ───────────────────────────────────────────
  {
    id: 'algorithm-recognition-quiz',
    label: 'Case Recognition',
    description: 'Identify algorithm cases from visual diagrams. Multiple choice quiz with rotation randomization and accuracy tracking.',
    category: 'recognition-quiz',
    compatibleMethods: ['cfop', 'roux', 'zz', 'petrus'],
    targetPhases: ['oll', 'pll', 'f2l', 'cmll', 'll-zz', 'f2l-zz', 'll-petrus', 'f2l-petrus'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'targeted-case' },
    validation: { type: 'manual-verdict' },
    smartCubeRequirement: 'optional',
    hasTimer: false,
    layout: {
      show3DCube: false,
      showCaseDiagram: true,
      showAlgorithm: false,
    },
  },

  // ── Phase Targets ─────────────────────────────────────────────────
  {
    id: 'cross-trainer',
    label: 'Cross Trainer',
    description: 'Practice solving the cross from random scrambles. Includes modes: standard, blind, XCross, color-neutral, and transition.',
    category: 'phase-target',
    compatibleMethods: ['cfop'],
    targetPhases: ['cross'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'state-match', stateMask: 'cross-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'f2l-trainer',
    label: 'F2L Trainer',
    description: 'Practice first two layers until F2L is solved. Focus on pair recognition, lookahead, and efficient insertion.',
    category: 'phase-target',
    compatibleMethods: ['cfop', 'zz'],
    targetPhases: ['f2l', 'f2l-zz'],
    subsets: ['f2l'],
    scramble: { type: 'partial-scramble', targetPhase: 'f2l' },
    validation: { type: 'state-match', stateMask: 'f2l-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'first-block-trainer',
    label: 'First Block Trainer',
    description: 'Build the first 1×2×3 block (Roux). Practice efficient block building from any scramble.',
    category: 'phase-target',
    compatibleMethods: ['roux'],
    targetPhases: ['first-block'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'state-match', stateMask: 'first-block-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'second-block-trainer',
    label: 'Second Block Trainer',
    description: 'Build the second 1×2×3 block while preserving the first. Practice efficient Roux block building.',
    category: 'phase-target',
    compatibleMethods: ['roux'],
    targetPhases: ['second-block'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'partial-scramble', targetPhase: 'second-block' },
    validation: { type: 'state-match', stateMask: 'second-block-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'lse-trainer',
    label: 'LSE Trainer',
    description: 'Last Six Edges practice (Roux). Master EO, UL/UR placement, and M-slice edge permutation.',
    category: 'phase-target',
    compatibleMethods: ['roux'],
    targetPhases: ['lse'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'partial-scramble', targetPhase: 'lse' },
    validation: { type: 'state-match', stateMask: 'lse-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'eoline-trainer',
    label: 'EOLine Trainer',
    description: 'Practice Edge Orientation + Line (ZZ method). Master solving EO and the DF/DB edges simultaneously.',
    category: 'phase-target',
    compatibleMethods: ['zz'],
    targetPhases: ['eoline'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'state-match', stateMask: 'eoline-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },

  // ── Full Solve ────────────────────────────────────────────────────
  {
    id: 'full-solve',
    label: 'Full Solve',
    description: 'Complete solve with phase tracking. Track each phase against your target times. Supports phase targets, move limit, TPS challenge, and rotationless modes.',
    category: 'full-solve',
    compatibleMethods: ['cfop', 'roux', 'zz', 'petrus'],
    targetPhases: [],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'state-match', stateMask: 'cube-solved' },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },

  // ── Lookahead / Inspection ────────────────────────────────────────
  {
    id: 'blind-cross',
    label: 'Blind Cross',
    description: 'Plan the entire cross during inspection, then execute with the cube hidden or eyes closed. Trains inspection planning and trust in muscle memory.',
    category: 'lookahead',
    compatibleMethods: ['cfop'],
    targetPhases: ['cross'],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'state-match', stateMask: 'cross-solved' },
    smartCubeRequirement: 'optional',
    hasTimer: true,
    layout: {
      show3DCube: false,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },

  // ── Efficiency Challenges ─────────────────────────────────────────
  {
    id: 'rotationless-solve',
    label: 'Rotationless Solve',
    description: 'Complete a full solve with zero cube rotations. Forces efficient F2L solutions and advanced fingertricks.',
    category: 'efficiency',
    compatibleMethods: ['cfop', 'zz'],
    targetPhases: [],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'rotation-limit', maxRotations: 0 },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
  {
    id: 'move-limit-solve',
    label: 'Move Limit Challenge',
    description: 'Solve the cube within a target move count. Builds efficiency awareness and optimal solution finding.',
    category: 'efficiency',
    compatibleMethods: ['cfop', 'roux', 'zz', 'petrus'],
    targetPhases: [],
    /**
     * Subset IDs from algorithm-db. Empty means the subset is
     * determined at runtime by the UI (e.g., user selects OLL vs PLL).
     * When non-empty, the exercise is only available for those subsets.
     */
    subsets: [],
    scramble: { type: 'random-state' },
    validation: { type: 'move-limit', maxMoves: 60 },
    smartCubeRequirement: 'recommended',
    hasTimer: true,
    layout: {
      show3DCube: true,
      showCaseDiagram: false,
      showAlgorithm: false,
    },
  },
];

// ─── Registry Implementation ─────────────────────────────────────────────

/**
 * The exercise catalog. Provides query methods for the UI layer
 * to discover available exercises by method, phase, or category.
 */
class ExerciseRegistryImpl implements IExerciseRegistry {
  private exercises: ITrainingExercise[];

  constructor(exercises: ITrainingExercise[]) {
    this.exercises = exercises;
  }

  getAll(): ITrainingExercise[] {
    return [...this.exercises];
  }

  getByMethod(methodId: string): ITrainingExercise[] {
    return this.exercises.filter(
      (e) =>
        e.compatibleMethods.length === 0 ||
        e.compatibleMethods.includes(methodId),
    );
  }

  getByPhase(methodId: string, phaseId: string): ITrainingExercise[] {
    return this.exercises.filter(
      (e) =>
        (e.compatibleMethods.length === 0 ||
          e.compatibleMethods.includes(methodId)) &&
        (e.targetPhases.length === 0 ||
          e.targetPhases.includes(phaseId)),
    );
  }

  getById(id: string): ITrainingExercise | undefined {
    return this.exercises.find((e) => e.id === id);
  }

  getByCategory(category: ExerciseCategory): ITrainingExercise[] {
    return this.exercises.filter((e) => e.category === category);
  }
}

/** The singleton exercise registry instance */
export const exerciseRegistry: IExerciseRegistry =
  new ExerciseRegistryImpl(EXERCISES);
